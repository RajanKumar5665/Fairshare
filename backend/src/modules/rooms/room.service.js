import crypto from 'crypto';
import { Room } from '../../models/room.model.js';
import { RoomMember } from '../../models/roomMember.js';
import { RoomInvitation } from '../../models/roomInvitation.model.js';
import { Expense } from '../../models/expense.model.js';
import { ExpenseParticipant } from '../../models/expenseParticipant.model.js';
import { Settlement } from '../../models/settlement.model.js';
import { User } from '../../models/user.model.js';
import { rupeesToPaise } from '../../utils/money.js';
import { isValidMonth, monthLabel, monthRange } from '../../utils/month.js';
import { RoomCycle } from '../../models/roomCycle.model.js';
import { OPEN_END, firstCycleStart } from '../../utils/cycle.js';
import {
  COUNTED_EXPENSE_STATUSES,
  buildLedger,
  planSettlements,
} from '../../utils/settlementPlanner.js';

/** Expenses still waiting on this person (as payer or as an approver). */
async function countPendingApprovalsFor(roomId, userId) {
  const pendingIds = await Expense.find({ roomId, status: 'pending_review' }).distinct('_id');
  if (!pendingIds.length) return 0;
  const [asPayer, asReviewer] = await Promise.all([
    Expense.countDocuments({ _id: { $in: pendingIds }, paidBy: userId }),
    ExpenseParticipant.countDocuments({ expenseId: { $in: pendingIds }, userId, reviewStatus: 'pending' }),
  ]);
  return asPayer + asReviewer;
}

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function createRoom(userId, data) {
  const type = data.type || 'room';
  const roomData = {
    name: data.name,
    type,
    description: data.description || '',
    address: data.address || '',
    currency: data.currency || 'INR',
    customCategories: data.customCategories || [],
    settings: {
      allowMemberInvite: false, // invites are owner-only
      requireApproval: data.settings?.requireApproval ?? true,
      defaultSplitMethod: data.settings?.defaultSplitMethod || 'equal',
    },
    startDate: type === 'trip' ? data.startDate || null : null,
    endDate: type === 'trip' ? data.endDate || null : null,
    createdBy: userId,
  };

  if (type === 'room' && data.monthlyRent !== undefined) {
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

  // Ready-to-share group link so the creator can invite everyone at once.
  const invite = await createShareInvite(room._id, userId);
  return { ...room.toObject(), inviteToken: invite.code };
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

  // Expenses in each room that are waiting for *my* approval
  const myPendingRows = await ExpenseParticipant.find({ userId, reviewStatus: 'pending' })
    .select('expenseId')
    .lean();
  const pendingByRoom = new Map();
  if (myPendingRows.length) {
    const pendingExpenses = await Expense.find({
      _id: { $in: myPendingRows.map((r) => r.expenseId) },
      roomId: { $in: roomIds },
      status: 'pending_review',
    })
      .select('roomId')
      .lean();
    for (const e of pendingExpenses) {
      const key = e.roomId.toString();
      pendingByRoom.set(key, (pendingByRoom.get(key) || 0) + 1);
    }
  }

  return rooms.map((room) => ({
    ...room.toObject(),
    myRole: roleMap.get(room._id.toString()),
    memberCount: countMap.get(room._id.toString()) || 1,
    myPendingApprovals: pendingByRoom.get(room._id.toString()) || 0,
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
  // Update individual settings keys; assigning `settings` wholesale would wipe the others.
  if (data.settings) {
    delete updateData.settings;
    for (const [key, val] of Object.entries(data.settings)) {
      updateData[`settings.${key}`] = val;
    }
  }

  const room = await Room.findByIdAndUpdate(roomId, updateData, { returnDocument: 'after' });
  if (!room) throw new AppError('Room not found', 404);
  return room;
}

export async function deleteRoom(roomId, userRole) {
  // Room delete karne ki suvidha abhi users ke liye band hai - baad me admin panel se control hoga
  if (userRole !== 'superadmin' && process.env.NODE_ENV !== 'test') {
    throw new AppError('Room delete karne ki suvidha users ke liye band hai. Room data surakshit hai aur admin panel dwara managed hai.', 403);
  }
  const room = await Room.findByIdAndUpdate(roomId, { status: 'archived' }, { returnDocument: 'after' });
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

  if (!allowAdmin && (await countPendingApprovalsFor(roomId, targetUserId)) > 0) {
    throw new AppError('This member has expenses waiting for approval. Approve, reject or delete them first.', 400);
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

  if ((await countPendingApprovalsFor(roomId, userId)) > 0) {
    throw new AppError('You have expenses waiting for approval in this room. Approve, reject or delete them before leaving.', 400);
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

// ─── Invites ──────────────────────────────────────────────────────────────────
// Each group has ONE shareable invite (short code + link) that any number of
// friends can use — share it once in the WhatsApp group and everyone can join.

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion
const INVITE_DAYS = 90;

function generateInviteCode(length = 10) {
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return out;
}

const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

/** Accepts a code ("ABCD-EFGH-JK", any case/spaces) or an old long hex token. */
async function findInvitation(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return null;
  const trimmed = rawInput.trim();
  const compact = trimmed.replace(/[\s-]/g, '').toUpperCase();
  const hashes = [...new Set([trimmed, compact].filter(Boolean).map(hashToken))];
  return RoomInvitation.findOne({ tokenHash: { $in: hashes } }).sort({ createdAt: -1 });
}

/** Why an invitation can't be used right now, or null if it can. */
function invitationProblem(invitation) {
  if (!invitation) return 'Invalid invite code or link';
  if (invitation.status === 'revoked') return 'This invite link was reset by the group admin. Ask for the new one.';
  if (invitation.expiresAt < new Date()) return 'This invite link has expired. Ask for a new one.';
  if (invitation.maxUses && invitation.useCount >= invitation.maxUses) return 'This invite link has been used up';
  return null;
}

/** Only the person who created the group (the owner) may invite people. */
async function assertCanInvite(roomId, userId) {
  const member = await RoomMember.findOne({ roomId, userId, status: 'active' });
  if (!member) throw new AppError('Not an active member of this group', 403);
  const room = await Room.findById(roomId).select('status');
  if (!room || room.status === 'archived') throw new AppError('Group not found', 404);
  if (member.role !== 'owner') {
    throw new AppError('Only the person who created this group can invite people', 403);
  }
}

async function createShareInvite(roomId, invitedBy) {
  const code = generateInviteCode();
  return RoomInvitation.create({
    roomId,
    invitedBy,
    code,
    tokenHash: hashToken(code),
    expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
    status: 'pending',
  });
}

function shareInviteView(invitation) {
  return {
    token: invitation.code,
    code: invitation.code,
    expiresAt: invitation.expiresAt,
    useCount: invitation.useCount || 0,
  };
}

/**
 * Get the group's current shareable invite (creating one if needed). Owner only.
 * `reset` revokes the old link so it stops working.
 */
export async function getShareInvite(roomId, userId, { reset = false } = {}) {
  await assertCanInvite(roomId, userId);

  const active = await RoomInvitation.findOne({
    roomId,
    code: { $ne: null },
    status: 'pending',
    maxUses: null,
    expiresAt: { $gt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  }).sort({ createdAt: -1 });

  if (active && !reset) return shareInviteView(active);

  if (reset) {
    await RoomInvitation.updateMany(
      { roomId, status: { $in: ['pending', 'accepted'] } },
      { status: 'revoked', revokedAt: new Date() },
    );
  }
  return shareInviteView(await createShareInvite(roomId, userId));
}

// Kept for older callers: now returns the reusable code.
export async function createInvitation(roomId, invitedBy, options = {}) {
  return (await getShareInvite(roomId, invitedBy, options)).code;
}

export async function listInvitations(roomId) {
  return RoomInvitation.find({
    roomId,
    status: { $in: ['pending', 'accepted'] },
    expiresAt: { $gt: new Date() },
  })
    .select('-tokenHash')
    .populate('invitedBy', 'name email')
    .sort({ createdAt: -1 });
}

export async function revokeInvitation(roomId, invitationId) {
  const invitation = await RoomInvitation.findOne({ _id: invitationId, roomId });
  if (!invitation) throw new AppError('Invitation not found', 404);
  if (invitation.status === 'revoked') throw new AppError('Invitation is already revoked', 400);

  invitation.status = 'revoked';
  invitation.revokedAt = new Date();
  await invitation.save();
  return { success: true, message: 'Invitation revoked' };
}

export async function getInvitationInfo(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    throw new AppError('Invite code is required', 400);
  }
  const invitation = await findInvitation(rawToken);
  const problem = invitationProblem(invitation);
  if (problem) return { valid: false, message: problem };

  await invitation.populate([
    { path: 'roomId', select: 'name description currency type status' },
    { path: 'invitedBy', select: 'name' },
  ]);
  if (!invitation.roomId || invitation.roomId.status === 'archived') {
    return { valid: false, message: 'This group no longer exists' };
  }
  const memberCount = await RoomMember.countDocuments({ roomId: invitation.roomId._id, status: 'active' });

  // Safe preview: no money, member list or phone numbers.
  return {
    valid: true,
    roomId: invitation.roomId._id,
    roomName: invitation.roomId.name,
    roomType: invitation.roomId.type || 'room',
    roomDescription: invitation.roomId.description || '',
    currency: invitation.roomId.currency || 'INR',
    inviterName: invitation.invitedBy?.name || 'A friend',
    memberCount,
    expiresAt: invitation.expiresAt,
  };
}

export async function acceptInvitation(userId, rawToken) {
  const invitation = await findInvitation(rawToken);
  const problem = invitationProblem(invitation);
  if (problem) throw new AppError(problem, 400);

  const room = await Room.findById(invitation.roomId).select('status');
  if (!room || room.status === 'archived') throw new AppError('This group no longer exists', 404);

  const existing = await RoomMember.findOne({ roomId: invitation.roomId, userId });
  if (existing && existing.status === 'active') {
    // Already in: just take them to the group instead of showing an error.
    return invitation.roomId;
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

  // Reusable link: count the use, keep it open for the next friend.
  await RoomInvitation.updateOne(
    { _id: invitation._id },
    { $inc: { useCount: 1 }, $set: { lastUsedAt: new Date() } },
  );

  return invitation.roomId;
}

// ─── Expenses, balances & month-end settle-up ────────────────────────────────

const PARTICIPANT_USER_FIELDS = 'name mobile avatar';

/** Settlements belonging to a month: tagged with it, or untagged and paid during it. */
export function settlementMonthFilter(month) {
  const { start, end } = monthRange(month);
  return {
    $or: [
      { forMonth: month },
      { forMonth: null, settledAt: { $gte: start, $lt: end } },
    ],
  };
}

/** Attach each expense's split (who owes what + approval state). */
export async function attachParticipants(expenses) {
  if (!expenses.length) return expenses;
  const rows = await ExpenseParticipant.find({ expenseId: { $in: expenses.map((e) => e._id) } })
    .populate('userId', PARTICIPANT_USER_FIELDS)
    .lean();
  const byExpense = new Map();
  for (const r of rows) {
    const key = r.expenseId.toString();
    if (!byExpense.has(key)) byExpense.set(key, []);
    byExpense.get(key).push({
      userId: r.userId?._id?.toString() || null,
      name: r.userId?.name || 'Former member',
      owedPaise: r.owedAmountInSmallestUnit,
      reviewStatus: r.reviewStatus,
      reviewNote: r.reviewNote || '',
      reviewedAt: r.reviewedAt || null,
    });
  }
  return expenses.map((e) => ({ ...e, participants: byExpense.get(e._id.toString()) || [] }));
}

export async function getRoomExpenses(roomId, { month, status, page = 1, limit = 100 } = {}) {
  const filter = { roomId, type: 'shared' };
  const statuses = String(status || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  filter.status = statuses.length ? { $in: statuses } : { $ne: 'cancelled' };
  if (month) {
    const { start, end } = monthRange(month);
    filter.expenseDate = { $gte: start, $lt: end };
  }
  const safeLimit = Math.min(500, Math.max(1, Number(limit) || 100));
  const skip = (Math.max(1, Number(page) || 1) - 1) * safeLimit;
  const expenses = await Expense.find(filter)
    .populate('paidBy', 'name mobile')
    .populate('createdBy', 'name')
    .populate('rejectedBy', 'name')
    .populate('cancelledBy', 'name')
    .sort({ expenseDate: -1, createdAt: -1 })
    .skip(skip)
    .limit(safeLimit)
    .lean();
  return attachParticipants(expenses);
}

/**
 * Net balance of every member (all-time, or for one month when `month` is given).
 * Only approved expenses and confirmed settlements are counted.
 * Returns an array (for backward compatibility) with `.summary` and `.month` attached.
 */
const memberUserId = (m) => String(m.userId?._id || m.userId);

function livedThere(member, range) {
  const from = member.membershipStartDate || member.joinedAt || member.createdAt;
  const to = member.membershipEndDate || member.leftAt;
  return (!from || new Date(from) < range.end) && (!to || new Date(to) >= range.start);
}

/**
 * Flat rule: each month's approved total is divided EQUALLY among everyone who
 * lived in the room that month — no matter who was in which expense or when they
 * joined. Returns participant-style rows { userId, owedAmountInSmallestUnit }.
 */
export async function roomEqualShareRows(roomId, countedExpenses, roomMembers) {
  if (!countedExpenses.length) return [];
  const room = await Room.findById(roomId).select('createdAt cycleAnchor').lean();
  const closed = await RoomCycle.find({ roomId }).select('index start end').lean();
  const ranges = new Map(closed.map((c) => [c.index, { start: c.start, end: c.end }]));
  const last = closed.reduce((a, c) => (!a || c.index > a.index ? c : a), null);
  const openStart = last ? last.end : firstCycleStart(room?.cycleAnchor || room?.createdAt || new Date());
  ranges.set(last ? last.index + 1 : 1, { start: openStart, end: OPEN_END });

  const totals = new Map();
  for (const e of countedExpenses) {
    const key = e.cycle || 0;
    totals.set(key, (totals.get(key) || 0) + e.amountInSmallestUnit);
  }

  const everyone = roomMembers.filter((m) => m.userId);
  const rows = [];
  for (const [cycle, total] of totals) {
    const range = ranges.get(cycle);
    let people = (range ? everyone.filter((m) => livedThere(m, range)) : everyone).map(memberUserId);
    if (!people.length) people = everyone.map(memberUserId);
    people = [...new Set(people)].sort();
    if (!people.length) continue;
    const base = Math.floor(total / people.length);
    let extra = total - base * people.length; // leftover paise, one each
    for (const userId of people) {
      rows.push({ userId, owedAmountInSmallestUnit: base + (extra > 0 ? 1 : 0) });
      extra -= 1;
    }
  }
  return rows;
}

export async function getRoomBalances(roomId, options = {}) {
  const month = isValidMonth(options.month) ? options.month : null;

  const allMembers = await RoomMember.find({ roomId }).populate('userId', 'name mobile avatar');
  const memberInfo = allMembers
    .filter((m) => m.userId)
    .map((m) => ({
      userId: m.userId._id.toString(),
      name: m.userId.name,
      mobile: m.userId.mobile,
      avatar: m.userId.avatar || '',
      role: m.role,
      status: m.status,
      isCurrentMember: m.status === 'active',
    }));

  const expenseQuery = { roomId, type: 'shared', status: { $in: COUNTED_EXPENSE_STATUSES } };
  const settlementQuery = { roomId };
  if (month) {
    const { start, end } = monthRange(month);
    expenseQuery.expenseDate = { $gte: start, $lt: end };
    Object.assign(settlementQuery, settlementMonthFilter(month));
  }

  const [expenses, allSettlements, pendingApprovalCount] = await Promise.all([
    Expense.find(expenseQuery).lean(),
    Settlement.find(settlementQuery).lean(),
    Expense.countDocuments({ roomId, type: 'shared', status: 'pending_review' }),
  ]);
  const roomDoc = await Room.findById(roomId).select('type').lean();
  const isFlat = (roomDoc?.type || 'room') === 'room';
  // Flats: monthly equal divide. Trips/groups: each expense's own split.
  const participants = isFlat
    ? await roomEqualShareRows(roomId, expenses, allMembers)
    : expenses.length
      ? await ExpenseParticipant.find({ expenseId: { $in: expenses.map((e) => e._id) } }).lean()
      : [];

  const completed = allSettlements.filter((s) => (s.status || 'completed') === 'completed');
  const ledger = buildLedger({ members: memberInfo, expenses, participants, settlements: completed });

  let totalOutstandingDuePaise = 0;
  const memberList = Array.from(ledger.values()).map((line) => {
    const out = {
      role: 'member',
      status: 'left',
      isCurrentMember: false,
      mobile: null,
      avatar: '',
      ...line,
      totalExpensePaidPaise: line.paidPaise,
      totalShareOwedPaise: line.sharePaise,
      receivablePaise: Math.max(0, line.netPaise),
      payablePaise: Math.max(0, -line.netPaise),
      // kept for older clients
      totalPaidPaise: line.paidPaise + line.settlementsPaidPaise - line.settlementsReceivedPaise,
    };
    totalOutstandingDuePaise += out.receivablePaise;
    return out;
  });

  memberList.sort((a, b) => {
    if (a.isCurrentMember !== b.isCurrentMember) return a.isCurrentMember ? -1 : 1;
    return b.netPaise - a.netPaise;
  });

  memberList.balances = memberList;
  memberList.summary = {
    totalSharedExpensePaise: expenses.reduce((s, e) => s + e.amountInSmallestUnit, 0),
    totalSharedExpenseCount: expenses.length,
    totalSettledPaise: completed.reduce((s, x) => s + x.amountInSmallestUnit, 0),
    pendingSettlementsCount: allSettlements.filter((s) => s.status === 'pending').length,
    completedSettlementsCount: completed.length,
    disputedExpenseCount: expenses.filter((e) => e.status === 'disputed').length,
    pendingApprovalCount,
    totalOutstandingDuePaise,
    activeMembersCount: memberList.filter((m) => m.isCurrentMember).length,
  };
  memberList.month = month;
  return memberList;
}

/**
 * Month-end settle-up: who spent how much, everyone's fair share, and the
 * fewest payments that make everyone even for that month.
 */
/** Calendar month ('YYYY-MM') or whole history ('all'). */
export async function getMonthlyReport(roomId, month) {
  if (month === 'all') {
    return buildPeriodReport(roomId, {
      key: 'all',
      label: null, // filled from room type
      range: null,
      expenseMatch: {},
      settlementMatch: {},
    });
  }
  const { start, end } = monthRange(month);
  return buildPeriodReport(roomId, {
    key: month,
    label: monthLabel(month),
    range: { start, end },
    expenseMatch: { expenseDate: { $gte: start, $lt: end } },
    settlementMatch: settlementMonthFilter(month),
  });
}

/**
 * Settle-up report for any period.
 * scope = { key, label, range: {start,end}|null, expenseMatch, settlementMatch, cycle? }
 */
export async function buildPeriodReport(roomId, scope) {
  const range = scope.range;
  const allTime = !range;

  const [room, roomMembers, monthExpenses, monthSettlements] = await Promise.all([
    Room.findById(roomId).select('name type currency settings').lean(),
    RoomMember.find({ roomId }).populate('userId', 'name mobile avatar').lean(),
    Expense.find({
      roomId,
      type: 'shared',
      status: { $ne: 'cancelled' },
      ...scope.expenseMatch,
    })
      .populate('paidBy', 'name')
      .populate('rejectedBy', 'name')
      .sort({ expenseDate: 1, createdAt: 1 })
      .lean(),
    Settlement.find({ roomId, ...scope.settlementMatch })
      .populate('paidBy', 'name')
      .populate('paidTo', 'name')
      .sort({ settledAt: 1 })
      .lean(),
  ]);
  if (!room) throw new AppError('Room not found', 404);

  // Members who lived in the room during this month.
  const monthMembers = roomMembers
    .filter((m) => m.userId)
    .filter((m) => {
      const from = m.membershipStartDate || m.joinedAt || m.createdAt;
      const to = m.membershipEndDate || m.leftAt;
      if (allTime) return true;
      return (!from || new Date(from) < range.end) && (!to || new Date(to) >= range.start);
    })
    .map((m) => ({
      userId: m.userId._id.toString(),
      name: m.userId.name,
      avatar: m.userId.avatar || '',
      isCurrentMember: m.status === 'active',
    }));

  const counted = monthExpenses.filter((e) => COUNTED_EXPENSE_STATUSES.includes(e.status));
  const pending = monthExpenses.filter((e) => e.status === 'pending_review');
  const rejected = monthExpenses.filter((e) => e.status === 'rejected');

  const expensesWithSplit = await attachParticipants(monthExpenses);
  const countedIds = new Set(counted.map((e) => e._id.toString()));
  const isFlat = (room.type || 'room') === 'room';
  // Flats: the month's total ÷ everyone who lived there. Trips/groups: per-expense split.
  const countedParticipants = isFlat
    ? await roomEqualShareRows(roomId, counted, roomMembers)
    : expensesWithSplit
        .filter((e) => countedIds.has(e._id.toString()))
        .flatMap((e) => e.participants.filter((p) => p.userId).map((p) => ({
          userId: p.userId,
          owedAmountInSmallestUnit: p.owedPaise,
        })));
  const countedForLedger = counted.map((e) => ({ ...e, paidBy: e.paidBy?._id || e.paidBy }));

  const completedSettlements = monthSettlements.filter((s) => (s.status || 'completed') === 'completed');
  const ledgerSettlements = completedSettlements.map((s) => ({
    paidBy: s.paidBy?._id || s.paidBy,
    paidTo: s.paidTo?._id || s.paidTo,
    amountInSmallestUnit: s.amountInSmallestUnit,
  }));

  // Before settlements: what each person spent vs. their fair share.
  const spendLedger = buildLedger({
    members: monthMembers,
    expenses: countedForLedger,
    participants: countedParticipants,
  });
  // After confirmed settlements: what is still left to pay.
  const finalLedger = buildLedger({
    members: monthMembers,
    expenses: countedForLedger,
    participants: countedParticipants,
    settlements: ledgerSettlements,
  });

  const members = Array.from(finalLedger.values())
    .map((line) => ({
      userId: line.userId,
      name: line.name,
      avatar: line.avatar || '',
      isCurrentMember: Boolean(line.isCurrentMember),
      paidPaise: line.paidPaise,
      sharePaise: line.sharePaise,
      // + spent more than their share, - spent less
      differencePaise: spendLedger.get(line.userId)?.netPaise || 0,
      settlementsPaidPaise: line.settlementsPaidPaise,
      settlementsReceivedPaise: line.settlementsReceivedPaise,
      // + still to receive, - still to pay
      remainingPaise: line.netPaise,
    }))
    .sort((a, b) => b.paidPaise - a.paidPaise || a.name.localeCompare(b.name));

  const totalPaise = counted.reduce((s, e) => s + e.amountInSmallestUnit, 0);
  const headCount = monthMembers.length || members.length || 1;

  const categoryMap = {};
  for (const e of counted) {
    const cat = e.category || 'general';
    categoryMap[cat] = (categoryMap[cat] || 0) + e.amountInSmallestUnit;
  }
  const categories = Object.entries(categoryMap)
    .map(([category, amountPaise]) => ({
      category,
      amountPaise,
      percentage: totalPaise ? Math.round((amountPaise / totalPaise) * 100) : 0,
    }))
    .sort((a, b) => b.amountPaise - a.amountPaise);

  const transfers = planSettlements(members.map((m) => ({ ...m, netPaise: m.remainingPaise })));

  return {
    roomId,
    roomName: room.name,
    roomType: room.type || 'room',
    month: scope.key,
    monthLabel: scope.label || (room.type === 'trip' ? 'Whole trip' : 'All time'),
    cycle: scope.cycle || null,
    periodStart: range?.start || null,
    periodEnd: range?.end || null,
    generatedAt: new Date(),
    totals: {
      approvedPaise: totalPaise,
      approvedCount: counted.length,
      pendingPaise: pending.reduce((s, e) => s + e.amountInSmallestUnit, 0),
      pendingCount: pending.length,
      rejectedCount: rejected.length,
      settledPaise: completedSettlements.reduce((s, x) => s + x.amountInSmallestUnit, 0),
    },
    headCount,
    equalSharePaise: Math.round(totalPaise / headCount),
    members,
    transfers,
    isSettled: counted.length > 0 && transfers.length === 0,
    categories,
    expenses: expensesWithSplit.map((e) => ({
      _id: e._id,
      title: e.title,
      category: e.category,
      expenseDate: e.expenseDate,
      amountPaise: e.amountInSmallestUnit,
      status: e.status,
      paidById: (e.paidBy?._id || e.paidBy)?.toString(),
      paidByName: e.paidBy?.name || 'Former member',
      createdById: e.createdBy?.toString() || null,
      carriedOver: Boolean(e.carriedOver),
      rejectionReason: e.rejectionReason || '',
      participants: e.participants,
    })),
    settlements: monthSettlements.map((s) => ({
      _id: s._id,
      fromId: (s.paidBy?._id || s.paidBy)?.toString(),
      fromName: s.paidBy?.name || 'Former member',
      toId: (s.paidTo?._id || s.paidTo)?.toString(),
      toName: s.paidTo?.name || 'Former member',
      amountPaise: s.amountInSmallestUnit,
      paymentMethod: s.paymentMethod,
      status: s.status || 'completed',
      settledAt: s.settledAt,
      note: s.note || '',
    })),
  };
}
