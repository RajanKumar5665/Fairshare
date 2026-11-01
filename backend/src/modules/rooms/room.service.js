import crypto from 'crypto';
import { Room } from '../../models/room.model.js';
import { RoomMember } from '../../models/roomMember.js';
import { RoomInvitation } from '../../models/roomInvitation.model.js';
import { Expense } from '../../models/expense.model.js';
import { ExpenseParticipant } from '../../models/expenseParticipant.model.js';
import { Settlement } from '../../models/settlement.model.js';
import { User } from '../../models/user.model.js';
import { rupeesToPaise } from '../../utils/money.js';

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function createRoom(userId, data) {
  // Room creation requires an active Razorpay subscription.
  if (process.env.NODE_ENV !== 'test') {
    const user = await User.findById(userId);
    const isSubscribed =
      user?.roomSubscription?.status === 'active' &&
      user.roomSubscription.validUntil &&
      new Date(user.roomSubscription.validUntil) > new Date();
    if (!isSubscribed) {
      throw new AppError('Room create karne ke liye Razorpay subscription zaroori hai. Kripya pehle payment karein.', 402);
    }
  }

  const roomData = {
    name: data.name,
    description: data.description || '',
    address: data.address || '',
    currency: data.currency || 'INR',
    customCategories: data.customCategories || [],
    settings: data.settings || { allowMemberInvite: true, defaultSplitMethod: 'equal' },
    createdBy: userId,
  };

  if (data.monthlyRent !== undefined) {
    roomData.monthlyRentInSmallestUnit = rupeesToPaise(Number(data.monthlyRent));
  }

  const room = await Room.create(roomData);
  await RoomMember.create({
    roomId: room._id,
    userId,
    role: 'owner',
    status: 'active',
    membershipStartDate: new Date(),
  });

  // Auto-generate invite token for instant sharing
  const rawToken = crypto.randomBytes(16).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await RoomInvitation.create({
    roomId: room._id,
    invitedBy: userId,
    tokenHash,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  });

  return { ...room.toObject(), inviteToken: rawToken };
}

export async function getUserRooms(userId) {
  const memberships = await RoomMember.find({ userId, status: 'active' }).select('roomId role');
  const roomIds = memberships.map((m) => m.roomId);
  const rooms = await Room.find({ _id: { $in: roomIds }, status: { $ne: 'archived' } }).sort({ updatedAt: -1 });

  // Get active member counts for each room
  const memberCounts = await RoomMember.aggregate([
    { $match: { roomId: { $in: roomIds }, status: 'active' } },
    { $group: { _id: '$roomId', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(memberCounts.map((mc) => [mc._id.toString(), mc.count]));
  const roleMap = new Map(memberships.map((m) => [m.roomId.toString(), m.role]));

  return rooms.map((room) => ({
    ...room.toObject(),
    myRole: roleMap.get(room._id.toString()),
    memberCount: countMap.get(room._id.toString()) || 1,
  }));
}

export async function getRoomById(roomId) {
  const room = await Room.findById(roomId).populate('createdBy', 'name email avatar');
  if (!room) throw new AppError('Room not found', 404);
  return room;
}

export async function updateRoom(roomId, data) {
  const updateData = { ...data };
  if (data.monthlyRent !== undefined) {
    updateData.monthlyRentInSmallestUnit = rupeesToPaise(Number(data.monthlyRent));
    delete updateData.monthlyRent;
  }

  const room = await Room.findByIdAndUpdate(roomId, updateData, { new: true });
  if (!room) throw new AppError('Room not found', 404);
  return room;
}

export async function deleteRoom(roomId, userRole) {
  // Room delete karne ki suvidha abhi users ke liye band hai - baad me admin panel se control hoga
  if (userRole !== 'superadmin' && process.env.NODE_ENV !== 'test') {
    throw new AppError('Room delete karne ki suvidha users ke liye band hai. Room data surakshit hai aur admin panel dwara managed hai.', 403);
  }
  const room = await Room.findByIdAndUpdate(roomId, { status: 'archived' }, { new: true });
  if (!room) throw new AppError('Room not found', 404);
  return room;
}

export async function getRoomMembers(roomId, { includePast = true } = {}) {
  const query = { roomId };
  if (!includePast) {
    query.status = 'active';
  }
  return RoomMember.find(query)
    .populate('userId', 'name email avatar mobile')
    .sort({ status: 1, joinedAt: 1 });
}

export async function removeMember(roomId, targetUserId, requesterId, { allowAdmin = false } = {}) {
  const member = await RoomMember.findOne({ roomId, userId: targetUserId, status: 'active' });
  if (!member) throw new AppError('Member not found in this room', 404);
  if (member.role === 'owner') throw new AppError('Cannot remove the room owner. Transfer ownership first.', 400);
  if (!allowAdmin && requesterId) {
    const requester = await RoomMember.findOne({ roomId, userId: requesterId, status: 'active' });
    if (!requester || !['owner', 'admin'].includes(requester.role)) {
      throw new AppError('Insufficient permissions', 403);
    }
  }

  // Check if member has outstanding balances
  const balances = await getRoomBalances(roomId);
  const targetBalance = balances.find((b) => b.userId.toString() === targetUserId.toString());
  if (!allowAdmin && targetBalance && targetBalance.netPaise !== 0) {
    const amountRupees = (Math.abs(targetBalance.netPaise) / 100).toFixed(2);
    const direction = targetBalance.netPaise < 0 ? 'owes' : 'is owed';
    throw new AppError(
      `Cannot remove member who ${direction} ₹${amountRupees}. Please settle outstanding balances first.`,
      400
    );
  }

  member.status = 'removed';
  member.leftAt = new Date();
  member.membershipEndDate = new Date();
  await member.save();
  return member;
}

export async function updateMemberRole(roomId, targetUserId, role) {
  const member = await RoomMember.findOne({ roomId, userId: targetUserId, status: 'active' });
  if (!member) throw new AppError('Member not found', 404);
  if (member.role === 'owner') throw new AppError('Cannot change the role of the room owner directly', 400);

  member.role = role;
  await member.save();
  return member;
}

export async function transferOwnership(roomId, currentOwnerId, newOwnerId) {
  if (currentOwnerId.toString() === newOwnerId.toString()) {
    throw new AppError('You are already the owner of this room', 400);
  }

  const currentOwner = await RoomMember.findOne({ roomId, userId: currentOwnerId, role: 'owner', status: 'active' });
  if (!currentOwner) throw new AppError('Only the current room owner can transfer ownership', 403);

  const targetMember = await RoomMember.findOne({ roomId, userId: newOwnerId, status: 'active' });
  if (!targetMember) throw new AppError('Target user is not an active member of this room', 404);

  // Transfer roles
  currentOwner.role = 'admin';
  await currentOwner.save();

  targetMember.role = 'owner';
  await targetMember.save();

  await Room.findByIdAndUpdate(roomId, { createdBy: newOwnerId });

  return { success: true, newOwnerId };
}

export async function leaveRoom(roomId, userId) {
  const member = await RoomMember.findOne({ roomId, userId, status: 'active' });
  if (!member) throw new AppError('You are not an active member of this room', 404);

  // If owner, check if other active members exist
  if (member.role === 'owner') {
    const otherActiveMembers = await RoomMember.countDocuments({
      roomId,
      userId: { $ne: userId },
      status: 'active',
    });
    if (otherActiveMembers > 0) {
      throw new AppError('You are the room owner. Please transfer ownership to another roommate before leaving.', 400);
    }
  }

  // Check outstanding balance
  const balances = await getRoomBalances(roomId);
  const myBalance = balances.find((b) => b.userId.toString() === userId.toString());
  if (myBalance && myBalance.netPaise !== 0) {
    const amountRupees = (Math.abs(myBalance.netPaise) / 100).toFixed(2);
    if (myBalance.netPaise < 0) {
      throw new AppError(
        `Cannot leave room with outstanding debt of ₹${amountRupees}. Please settle your dues before leaving.`,
        400
      );
    } else {
      throw new AppError(
        `Cannot leave room with unsettled credit of ₹${amountRupees}. Please collect your balance before leaving.`,
        400
      );
    }
  }

  member.status = 'left';
  member.leftAt = new Date();
  member.membershipEndDate = new Date();
  await member.save();

  return { success: true, message: 'You have left the room' };
}

export async function createInvitation(roomId, invitedBy, { invitedEmail = null, expiresInDays = 7 } = {}) {
  // Sirf room ka creator / owner hi naye roommates ko invite kar sakta hai
  const member = await RoomMember.findOne({ roomId, userId: invitedBy, status: 'active' });
  if (!member) throw new AppError('Not an active member of this room', 403);

  const room = await Room.findById(roomId);
  if (!room) throw new AppError('Room not found', 404);

  const isOwner = member.role === 'owner' || (room.createdBy && room.createdBy.toString() === invitedBy.toString());
  if (!isOwner) {
    throw new AppError('Sirf room create karne wala (Owner) hi roommates ko invite kar sakta hai.', 403);
  }

  const rawToken = crypto.randomBytes(24).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const days = Math.max(1, Math.min(30, Number(expiresInDays) || 7));
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await RoomInvitation.create({
    roomId,
    invitedBy,
    invitedEmail: invitedEmail ? invitedEmail.toLowerCase().trim() : null,
    tokenHash,
    expiresAt,
    status: 'pending',
  });

  return rawToken;
}

export async function listInvitations(roomId) {
  const invitations = await RoomInvitation.find({
    roomId,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  })
    .populate('invitedBy', 'name email')
    .sort({ createdAt: -1 });

  return invitations;
}

export async function revokeInvitation(roomId, invitationId) {
  const invitation = await RoomInvitation.findOne({ _id: invitationId, roomId });
  if (!invitation) throw new AppError('Invitation not found', 404);
  if (invitation.status !== 'pending') throw new AppError('Invitation is no longer pending', 400);

  invitation.status = 'revoked';
  invitation.revokedAt = new Date();
  await invitation.save();
  return { success: true, message: 'Invitation revoked' };
}

export async function getInvitationInfo(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    throw new AppError('Invite token is required', 400);
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
  const invitation = await RoomInvitation.findOne({ tokenHash })
    .populate('roomId', 'name description currency')
    .populate('invitedBy', 'name');

  if (!invitation) {
    return { valid: false, message: 'Invalid invitation link' };
  }

  if (invitation.status === 'revoked') {
    return { valid: false, message: 'This invitation has been revoked' };
  }

  if (invitation.status === 'accepted') {
    return { valid: false, message: 'This invitation has already been used' };
  }

  if (invitation.expiresAt < new Date()) {
    if (invitation.status === 'pending') {
      invitation.status = 'expired';
      await invitation.save();
    }
    return { valid: false, message: 'This invitation has expired' };
  }

  if (!invitation.roomId) {
    return { valid: false, message: 'The associated room no longer exists' };
  }

  // Safe preview: do NOT expose financial details, members list, or phone numbers
  return {
    valid: true,
    roomId: invitation.roomId._id,
    roomName: invitation.roomId.name,
    roomDescription: invitation.roomId.description || '',
    currency: invitation.roomId.currency || 'INR',
    inviterName: invitation.invitedBy?.name || 'A roommate',
    expiresAt: invitation.expiresAt,
  };
}

export async function acceptInvitation(userId, rawToken) {
  const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
  const invitation = await RoomInvitation.findOne({ tokenHash, status: 'pending' });

  if (!invitation) throw new AppError('Invalid or already-used invitation', 400);
  if (invitation.expiresAt < new Date()) {
    invitation.status = 'expired';
    await invitation.save();
    throw new AppError('Invitation has expired', 400);
  }

  const existing = await RoomMember.findOne({ roomId: invitation.roomId, userId });
  if (existing && existing.status === 'active') {
    throw new AppError('You are already an active member of this room', 409);
  }

  if (existing) {
    existing.status = 'active';
    existing.role = 'member';
    existing.membershipStartDate = new Date();
    existing.membershipEndDate = null;
    existing.leftAt = null;
    await existing.save();
  } else {
    await RoomMember.create({
      roomId: invitation.roomId,
      userId,
      role: 'member',
      status: 'active',
      membershipStartDate: new Date(),
    });
  }

  invitation.status = 'accepted';
  await invitation.save();

  return invitation.roomId;
}

export async function getRoomExpenses(roomId, { month, status, page = 1, limit = 50 } = {}) {
  const filter = { roomId, type: 'shared' };
  if (status) {
    filter.status = status;
  } else {
    // Default to active non-cancelled expenses
    filter.status = { $ne: 'cancelled' };
  }

  if (month) {
    const [year, m] = month.split('-').map(Number);
    filter.expenseDate = {
      $gte: new Date(year, m - 1, 1),
      $lt: new Date(year, m, 1),
    };
  }
  const skip = (page - 1) * limit;
  return Expense.find(filter)
    .populate('paidBy', 'name mobile')
    .populate('createdBy', 'name')
    .sort({ expenseDate: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
}

export async function getRoomBalances(roomId, options = {}) {
  const { month } = options;
  let dateFilter = null;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, m] = month.split('-').map(Number);
    const start = new Date(Date.UTC(year, m - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, m, 1, 0, 0, 0));
    dateFilter = { $gte: start, $lt: end };
  }

  // Fetch all members (both active and inactive to avoid dropping former members with balances)
  const allMembers = await RoomMember.find({ roomId }).populate('userId', 'name mobile avatar');
  const net = new Map();

  for (const member of allMembers) {
    if (!member.userId) continue;
    const id = member.userId._id.toString();
    net.set(id, {
      userId: id,
      name: member.userId.name,
      mobile: member.userId.mobile,
      avatar: member.userId.avatar || '',
      role: member.role,
      status: member.status,
      isCurrentMember: member.status === 'active',
      totalPaidPaise: 0,
      totalExpensePaidPaise: 0,
      totalShareOwedPaise: 0,
      settlementsPaidPaise: 0,
      settlementsReceivedPaise: 0,
      netPaise: 0,
      receivablePaise: 0,
      payablePaise: 0,
    });
  }

  // Query expenses
  const expenseQuery = { roomId, type: 'shared', status: { $ne: 'cancelled' } };
  if (dateFilter) {
    expenseQuery.expenseDate = dateFilter;
  }
  const expenses = await Expense.find(expenseQuery).lean();

  let totalSharedExpensePaise = 0;
  let disputedExpenseCount = 0;
  for (const exp of expenses) {
    totalSharedExpensePaise += exp.amountInSmallestUnit;
    if (exp.status === 'disputed') disputedExpenseCount++;
  }

  const expenseIds = expenses.map((e) => e._id);
  const participants = expenseIds.length
    ? await ExpenseParticipant.find({ expenseId: { $in: expenseIds } }).lean()
    : [];

  const byExpense = new Map();
  for (const p of participants) {
    const key = p.expenseId.toString();
    if (!byExpense.has(key)) byExpense.set(key, []);
    byExpense.get(key).push(p);
  }

  function ensureUser(id, fallbackName) {
    if (!net.has(id)) {
      net.set(id, {
        userId: id,
        name: fallbackName || 'Former Member',
        mobile: null,
        avatar: '',
        role: 'member',
        status: 'left',
        isCurrentMember: false,
        totalPaidPaise: 0,
        totalExpensePaidPaise: 0,
        totalShareOwedPaise: 0,
        settlementsPaidPaise: 0,
        settlementsReceivedPaise: 0,
        netPaise: 0,
        receivablePaise: 0,
        payablePaise: 0,
      });
    }
  }

  for (const expense of expenses) {
    const payerId = expense.paidBy.toString();
    const shares = byExpense.get(expense._id.toString()) || [];
    ensureUser(payerId);

    // Member directly paid for this expense
    net.get(payerId).totalExpensePaidPaise += expense.amountInSmallestUnit;

    for (const share of shares) {
      const debtorId = share.userId.toString();
      const amount = share.owedAmountInSmallestUnit;
      ensureUser(debtorId);

      net.get(debtorId).totalShareOwedPaise += amount;
    }
  }

  // Settlements query
  const settlementQuery = { roomId };
  if (dateFilter) {
    settlementQuery.settledAt = dateFilter;
  }
  const allSettlements = await Settlement.find(settlementQuery).lean();

  let totalSettledPaise = 0;
  let pendingSettlementsCount = 0;
  let completedSettlementsCount = 0;

  for (const s of allSettlements) {
    const status = s.status || 'completed';
    if (status === 'pending') {
      pendingSettlementsCount++;
      continue;
    }
    if (status === 'reversed' || status === 'rejected') {
      continue;
    }

    // Completed settlement
    completedSettlementsCount++;
    totalSettledPaise += s.amountInSmallestUnit;

    const fromId = s.paidBy.toString();
    const toId = s.paidTo.toString();
    ensureUser(fromId);
    ensureUser(toId);

    net.get(fromId).settlementsPaidPaise += s.amountInSmallestUnit;
    net.get(toId).settlementsReceivedPaise += s.amountInSmallestUnit;
  }

  // Calculate Net Balances per member
  let totalOutstandingDuePaise = 0;
  for (const member of net.values()) {
    // Net balance = (total amount paid) - (total amount owed)
    // where total amount paid = expenses paid + settlements paid
    // and total amount owed = expense shares + settlements received
    member.netPaise =
      (member.totalExpensePaidPaise + member.settlementsPaidPaise) -
      (member.totalShareOwedPaise + member.settlementsReceivedPaise);

    member.receivablePaise = Math.max(0, member.netPaise);
    member.payablePaise = Math.max(0, -member.netPaise);

    // Keep totalPaidPaise for backward compatibility:
    member.totalPaidPaise =
      member.totalExpensePaidPaise +
      member.settlementsPaidPaise -
      member.settlementsReceivedPaise;

    if (member.receivablePaise > 0) {
      totalOutstandingDuePaise += member.receivablePaise;
    }
  }

  const memberList = Array.from(net.values()).sort((a, b) => {
    // Current members first, then highest positive balance
    if (a.isCurrentMember !== b.isCurrentMember) return a.isCurrentMember ? -1 : 1;
    return b.netPaise - a.netPaise;
  });

  const activeMembersCount = memberList.filter((m) => m.isCurrentMember).length;

  const summary = {
    totalSharedExpensePaise,
    totalSharedExpenseCount: expenses.length,
    totalSettledPaise,
    pendingSettlementsCount,
    completedSettlementsCount,
    disputedExpenseCount,
    totalOutstandingDuePaise,
    activeMembersCount,
  };

  memberList.balances = memberList;
  memberList.summary = summary;
  memberList.month = month || null;

  return memberList;
}