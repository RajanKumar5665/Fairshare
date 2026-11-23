import { Expense } from '../../models/expense.model.js';
import { ExpenseParticipant } from '../../models/expenseParticipant.model.js';
import { Room } from '../../models/room.model.js';
import { RoomMember } from '../../models/roomMember.js';
import { Settlement } from '../../models/settlement.model.js';
import { calculateSplit } from '../../utils/splitCalculator.js';
import { rupeesToPaise } from '../../utils/money.js';
import { isValidMonth, monthKey, monthRange } from '../../utils/month.js';
import { COUNTED_EXPENSE_STATUSES, planSettlements } from '../../utils/settlementPlanner.js';
import {
  attachParticipants,
  getRoomBalances,
  getRoomExpenses,
  settlementMonthFilter,
} from '../rooms/room.service.js';

import { assertCycleOpen, currentCycleFor } from '../rooms/roomCycle.service.js';

export { getRoomBalances, getRoomExpenses };

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

const idOf = (v) => (v?._id ?? v)?.toString();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build the participants array for calculateSplit.
 * For "exact" split the UI sends amountRupees per participant — convert once here.
 */
function buildSplitInput(participants, splitMethod) {
  return participants.map((p) => {
    const base = { userId: String(p.userId) };
    if (splitMethod === 'exact') base.amountPaise = rupeesToPaise(Number(p.amountRupees ?? 0));
    if (splitMethod === 'percentage') base.percentage = Number(p.percentage);
    if (splitMethod === 'shares') base.shares = Number(p.shares);
    return base;
  });
}

async function validateRoomMembers(roomId, participantIds) {
  if (new Set(participantIds).size !== participantIds.length) {
    throw new AppError('A roommate appears twice in this split', 400);
  }
  const memberIds = (await RoomMember.find({ roomId, status: 'active' }).select('userId')).map((m) =>
    m.userId.toString(),
  );
  const invalid = participantIds.find((id) => !memberIds.includes(id));
  if (invalid) throw new AppError('Everyone in the split must be an active member of this room', 400);
  return memberIds;
}

async function getActiveMembership(roomId, userId) {
  if (!roomId) return null;
  return RoomMember.findOne({ roomId, userId, status: 'active' });
}

async function requireActiveMember(roomId, userId) {
  const membership = await getActiveMembership(roomId, userId);
  if (!membership) throw new AppError('You are not a member of this room', 403);
  return membership;
}

/** Personal: only the owner. Shared: whoever added/paid it, or a room owner/admin. */
async function assertCanManageExpense(expense, userId) {
  const uid = userId.toString();
  if (expense.type === 'personal') {
    if (idOf(expense.createdBy) !== uid) throw new AppError('Expense not found', 404);
    return;
  }
  const membership = await getActiveMembership(expense.roomId, userId);
  if (!membership) throw new AppError('Expense not found', 404);
  const isAuthor = idOf(expense.createdBy) === uid || idOf(expense.paidBy) === uid;
  if (!isAuthor && !['owner', 'admin'].includes(membership.role)) {
    throw new AppError('Only the person who added this expense or a room admin can change it', 403);
  }
}

/**
 * Split an amount and decide whether roommates must approve it first.
 * `enteredBy` (whoever is adding/editing it) is auto-approved; everyone else in
 * the split — including the payer, if someone else recorded it — must approve.
 */
async function computeSharedSplit({ roomId, enteredBy, amountPaise, splitMethod, participants }) {
  const room = await Room.findById(roomId).select('settings status isClosed type');
  if (!room || room.status === 'archived') throw new AppError('Room not found', 404);
  if (room.isClosed) {
    throw new AppError(`This ${room.type === 'trip' ? 'trip' : 'group'} is finished. The owner can reopen it to add more expenses.`, 400);
  }

  const participantIds = participants.map((p) => String(p.userId));
  await validateRoomMembers(roomId, participantIds);
  const computed = calculateSplit(splitMethod, amountPaise, buildSplitInput(participants, splitMethod));

  const requireApproval = room.settings?.requireApproval !== false;
  const needsReview = requireApproval && computed.some((c) => String(c.userId) !== String(enteredBy));
  const now = new Date();

  const participantDocs = computed.map((c) => {
    const original = participants.find((p) => String(p.userId) === String(c.userId));
    const autoAccepted = !needsReview || String(c.userId) === String(enteredBy);
    return {
      userId: c.userId,
      owedAmountInSmallestUnit: c.amount,
      splitValue: original?.percentage ?? original?.shares ?? null,
      reviewStatus: autoAccepted ? 'accepted' : 'pending',
      reviewedAt: autoAccepted ? now : null,
    };
  });

  return {
    participantDocs,
    status: needsReview ? 'pending_review' : 'active',
    approvedAt: needsReview ? null : now,
  };
}

async function allActiveMemberParticipants(roomId) {
  const active = await RoomMember.find({ roomId, status: 'active' }).select('userId');
  return active.map((m) => ({ userId: m.userId.toString() }));
}

/**
 * Create a shared expense + its split rows. Used by manual entry and recurring bills.
 * Every roommate in the split (except the payer) must approve before it counts.
 */
export async function createSharedExpense({
  roomId,
  payerId,
  creatorId,
  title,
  description = '',
  amountPaise,
  category = 'general',
  expenseDate = new Date(),
  receiptUrl = null,
  splitMethod = 'equal',
  participants,
}) {
  const cycle = await currentCycleFor(roomId);
  if (cycle && new Date(expenseDate) < cycle.start) {
    throw new AppError(
      `Month ${cycle.index - 1} is already closed. Pick a date from ${cycle.start.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })} onwards.`,
      400,
    );
  }

  const list = participants?.length ? participants : await allActiveMemberParticipants(roomId);
  const split = await computeSharedSplit({
    roomId,
    enteredBy: creatorId,
    amountPaise,
    splitMethod,
    participants: list,
  });

  const expense = await Expense.create({
    title,
    description,
    amountInSmallestUnit: amountPaise,
    category,
    expenseDate,
    receiptUrl,
    type: 'shared',
    paidBy: payerId,
    roomId,
    splitMethod,
    createdBy: creatorId,
    status: split.status,
    approvedAt: split.approvedAt,
    cycle: cycle?.index ?? null,
  });

  try {
    await ExpenseParticipant.insertMany(split.participantDocs.map((d) => ({ ...d, expenseId: expense._id })));
  } catch (err) {
    await Expense.deleteOne({ _id: expense._id });
    throw err;
  }
  return expense;
}

// ─── Create Expense ───────────────────────────────────────────────────────────

export async function createExpense(userId, data) {
  const amountPaise = rupeesToPaise(data.amountRupees);
  const expenseDate = data.expenseDate ? new Date(data.expenseDate) : new Date();

  if (data.type === 'personal') {
    return Expense.create({
      title: data.title,
      description: data.description || '',
      amountInSmallestUnit: amountPaise,
      category: data.category,
      expenseDate,
      receiptUrl: data.receiptUrl || null,
      type: 'personal',
      paidBy: userId,
      createdBy: userId,
    });
  }

  await requireActiveMember(data.roomId, userId);
  const payerId = data.paidBy || userId;
  if (String(payerId) !== String(userId)) {
    const payer = await getActiveMembership(data.roomId, payerId);
    if (!payer) throw new AppError('The person who paid must be a member of this group', 400);
  }

  return createSharedExpense({
    roomId: data.roomId,
    payerId,
    creatorId: userId,
    title: data.title,
    description: data.description || '',
    amountPaise,
    category: data.category || 'general',
    expenseDate,
    receiptUrl: data.receiptUrl || null,
    splitMethod: data.splitMethod || 'equal',
    participants: data.participants,
  });
}

// ─── Get Single Expense ───────────────────────────────────────────────────────

export async function getExpenseById(expenseId, userId) {
  const expense = await Expense.findById(expenseId)
    .populate('paidBy', 'name mobile')
    .populate('createdBy', 'name')
    .populate('rejectedBy', 'name');
  if (!expense) throw new AppError('Expense not found', 404);

  if (expense.type === 'personal') {
    if (idOf(expense.createdBy) !== userId.toString()) throw new AppError('Expense not found', 404);
  } else if (!(await getActiveMembership(expense.roomId, userId))) {
    throw new AppError('Expense not found', 404);
  }

  const participants = await ExpenseParticipant.find({ expenseId }).populate('userId', 'name mobile');
  return { expense, participants };
}

// ─── List Personal Expenses ───────────────────────────────────────────────────

export async function getPersonalExpenses(userId, { category, from, to } = {}) {
  const filter = { type: 'personal', createdBy: userId };
  if (category) filter.category = category;
  if (from || to) {
    filter.expenseDate = {};
    if (from) filter.expenseDate.$gte = new Date(from);
    if (to) filter.expenseDate.$lte = new Date(to);
  }
  return Expense.find(filter).sort({ expenseDate: -1 });
}

// ─── Update Expense ────────────────────────────────────────────────────────────

export async function updateExpense(expenseId, userId, data) {
  const expense = await Expense.findById(expenseId);
  if (!expense) throw new AppError('Expense not found', 404);
  await assertCanManageExpense(expense, userId);
  if (expense.status === 'cancelled') throw new AppError('This expense was deleted', 400);

  if (expense.type === 'shared' && expense.cycle) {
    const cycle = await currentCycleFor(expense.roomId);
    if (cycle && expense.cycle < cycle.index) {
      if (expense.status !== 'rejected') await assertCycleOpen(expense.roomId, expense.cycle, 'edit this expense');
      // Fixing a rejected expense from a closed month re-submits it in the current month.
      expense.cycle = cycle.index;
      expense.carriedOver = true;
    }
    if (cycle && data.expenseDate && new Date(data.expenseDate) < cycle.start) {
      throw new AppError('That date is in a month that is already closed', 400);
    }
  }

  if (data.title) expense.title = data.title;
  if (data.description !== undefined) expense.description = data.description;
  if (data.category) expense.category = data.category;
  if (data.expenseDate) expense.expenseDate = data.expenseDate;
  if (data.receiptUrl !== undefined) expense.receiptUrl = data.receiptUrl || null;

  if (expense.type === 'personal') {
    if (data.amountRupees !== undefined) expense.amountInSmallestUnit = rupeesToPaise(data.amountRupees);
    await expense.save();
    return expense;
  }

  const moneyChanged =
    data.amountRupees !== undefined || data.splitMethod !== undefined || data.participants !== undefined;
  // Editing a rejected expense re-submits it for approval.
  if (moneyChanged || expense.status === 'rejected') {
    const amountPaise =
      data.amountRupees !== undefined ? rupeesToPaise(data.amountRupees) : expense.amountInSmallestUnit;
    const splitMethod = data.splitMethod || expense.splitMethod || 'equal';
    let participants = data.participants;
    if (!participants) {
      if (splitMethod !== 'equal') {
        throw new AppError('Send the participants when changing an unequal split', 400);
      }
      const existing = await ExpenseParticipant.find({ expenseId }).select('userId');
      participants = existing.map((p) => ({ userId: p.userId.toString() }));
    }

    const split = await computeSharedSplit({
      roomId: expense.roomId,
      enteredBy: userId,
      amountPaise,
      splitMethod,
      participants,
    });

    await ExpenseParticipant.deleteMany({ expenseId });
    await ExpenseParticipant.insertMany(split.participantDocs.map((d) => ({ ...d, expenseId })));

    expense.amountInSmallestUnit = amountPaise;
    expense.splitMethod = splitMethod;
    expense.status = split.status;
    expense.approvedAt = split.approvedAt;
    expense.rejectedBy = null;
    expense.rejectionReason = '';
  }

  await expense.save();
  return expense;
}

// ─── Cancel Expense ────────────────────────────────────────────────────────────

export async function cancelExpense(expenseId, userId) {
  const expense = await Expense.findById(expenseId);
  if (!expense) throw new AppError('Expense not found', 404);
  await assertCanManageExpense(expense, userId);
  if (expense.status === 'cancelled') throw new AppError('This expense was already deleted', 400);
  // Once everyone has approved a shared expense it is part of the hisaab for good.
  if (expense.type === 'shared' && !['rejected', 'pending_review'].includes(expense.status)) {
    throw new AppError('Approved expenses cannot be deleted. Ask the group to add a correcting expense instead.', 403);
  }
  expense.status = 'cancelled';
  expense.cancelledAt = new Date();
  expense.cancelledBy = userId;
  await expense.save();
  return expense;
}

// ─── Approvals ────────────────────────────────────────────────────────────────

/** A roommate approves or rejects a shared expense that includes them. */
export async function reviewExpense(userId, roomId, expenseId, { action, note = '' }) {
  const expense = await Expense.findOne({ _id: expenseId, roomId, type: 'shared' });
  if (!expense) throw new AppError('Expense not found in this room', 404);
  if (expense.status !== 'pending_review') {
    throw new AppError('This expense is no longer waiting for approval', 409);
  }

  const row = await ExpenseParticipant.findOne({ expenseId, userId });
  if (!row) throw new AppError('Only roommates included in this expense can approve or reject it', 403);
  if (row.reviewStatus !== 'pending') throw new AppError('You have already responded to this expense', 409);

  const now = new Date();
  row.reviewedAt = now;
  row.reviewNote = note.trim();

  if (action === 'approve') {
    row.reviewStatus = 'accepted';
    await row.save();
    const stillPending = await ExpenseParticipant.countDocuments({
      expenseId,
      reviewStatus: { $ne: 'accepted' },
    });
    if (stillPending === 0) {
      await Expense.updateOne({ _id: expenseId, status: 'pending_review' }, { status: 'active', approvedAt: now });
    }
  } else {
    row.reviewStatus = 'rejected';
    await row.save();
    await Expense.updateOne(
      { _id: expenseId, status: 'pending_review' },
      { status: 'rejected', rejectedBy: userId, rejectionReason: note.trim() },
    );
  }

  const fresh = await Expense.findById(expenseId)
    .populate('paidBy', 'name mobile')
    .populate('createdBy', 'name')
    .populate('rejectedBy', 'name')
    .lean();
  const [withParticipants] = await attachParticipants([fresh]);
  return withParticipants;
}

/** Everything waiting on this user's approval, across all their rooms. */
export async function getMyPendingApprovals(userId) {
  const rows = await ExpenseParticipant.find({ userId, reviewStatus: 'pending' })
    .select('expenseId owedAmountInSmallestUnit')
    .lean();
  if (!rows.length) return [];

  const myRooms = await RoomMember.find({ userId, status: 'active' }).distinct('roomId');
  const expenses = await Expense.find({
    _id: { $in: rows.map((r) => r.expenseId) },
    status: 'pending_review',
    roomId: { $in: myRooms },
  })
    .populate('paidBy', 'name')
    .populate('roomId', 'name')
    .sort({ createdAt: -1 })
    .lean();

  const shareByExpense = new Map(rows.map((r) => [r.expenseId.toString(), r.owedAmountInSmallestUnit]));
  return expenses.map((e) => ({
    expenseId: e._id,
    roomId: idOf(e.roomId),
    roomName: e.roomId?.name || 'Room',
    title: e.title,
    category: e.category,
    amountPaise: e.amountInSmallestUnit,
    mySharePaise: shareByExpense.get(e._id.toString()) || 0,
    paidByName: e.paidBy?.name || 'Roommate',
    expenseDate: e.expenseDate,
    createdAt: e.createdAt,
  }));
}

// ─── Suggested Settlements ────────────────────────────────────────────────────

/** Fewest payments that settle everyone's all-time balance. */
export async function getSuggestedSettlements(roomId) {
  const balances = await getRoomBalances(roomId);
  return planSettlements(balances);
}

// ─── Settlements ──────────────────────────────────────────────────────────────

const SETTLEMENT_POPULATE = [
  { path: 'paidBy', select: 'name mobile avatar' },
  { path: 'paidTo', select: 'name mobile avatar' },
  { path: 'recordedBy', select: 'name mobile' },
  { path: 'confirmedBy', select: 'name mobile' },
  { path: 'reversedBy', select: 'name mobile' },
];

/**
 * Record a payment between two roommates.
 * - Recorded by the payer  → "pending" until the receiver confirms they got it.
 * - Recorded by the receiver → "completed" straight away.
 */
export async function recordSettlement(userId, data) {
  const recorderId = userId.toString();
  const payerId = (data.paidBy || recorderId).toString();
  const payeeId = data.paidTo.toString();

  await requireActiveMember(data.roomId, userId);

  if (payerId === payeeId) throw new AppError('Cannot record a payment to yourself', 400);
  if (recorderId !== payerId && recorderId !== payeeId) {
    throw new AppError('You can only record payments you made or received', 403);
  }

  const memberIds = (await RoomMember.find({ roomId: data.roomId }).select('userId')).map((m) =>
    m.userId.toString(),
  );
  if (!memberIds.includes(payeeId) || !memberIds.includes(payerId)) {
    throw new AppError('Both people must be members of this room', 400);
  }

  const amountPaise = rupeesToPaise(data.amountRupees);

  // Prevent double-taps creating duplicate payments
  const duplicate = await Settlement.findOne({
    roomId: data.roomId,
    paidBy: payerId,
    paidTo: payeeId,
    amountInSmallestUnit: amountPaise,
    status: { $nin: ['reversed', 'rejected'] },
    createdAt: { $gte: new Date(Date.now() - 60 * 1000) },
  });
  if (duplicate) {
    throw new AppError('This payment was just recorded. Please wait a moment before trying again.', 409);
  }

  const cycle = await currentCycleFor(data.roomId);
  let settlementCycle = null;
  if (cycle) {
    // Flats: money moves only after a month's hisaab is done (closed / settled early).
    const asked = Number(data.cycle);
    if (!Number.isInteger(asked) || asked < 1 || asked >= cycle.index) {
      throw new AppError(
        `Month ${cycle.index} is still running. Payments are recorded after the owner settles it with "Settle now".`,
        400,
      );
    }
    settlementCycle = asked;
  }

  const receiverRecorded = recorderId === payeeId;
  const now = new Date();
  const settlement = await Settlement.create({
    roomId: data.roomId,
    paidBy: payerId,
    paidTo: payeeId,
    amountInSmallestUnit: amountPaise,
    paymentMethod: data.paymentMethod || 'upi',
    transactionRef: data.transactionRef ? data.transactionRef.trim() : '',
    note: data.note || '',
    status: receiverRecorded ? 'completed' : 'pending',
    confirmedAt: receiverRecorded ? now : null,
    confirmedBy: receiverRecorded ? userId : null,
    settledAt: data.settledAt ? new Date(data.settledAt) : now,
    forMonth: isValidMonth(data.forMonth) ? data.forMonth : null,
    cycle: settlementCycle,
    recordedBy: userId,
  });

  return settlement.populate(SETTLEMENT_POPULATE);
}

/** Receiver confirms they got the money. */
export async function confirmSettlement(userId, roomId, settlementId, data = {}) {
  const settlement = await Settlement.findOne({ _id: settlementId, roomId });
  if (!settlement) throw new AppError('Payment not found', 404);
  if (settlement.status !== 'pending') {
    throw new AppError(`This payment is already ${settlement.status}`, 409);
  }

  const isPayee = settlement.paidTo.toString() === userId.toString();
  const membership = await getActiveMembership(roomId, userId);
  const isAdminOrOwner = membership && ['owner', 'admin'].includes(membership.role);
  if (!isPayee && !isAdminOrOwner) {
    throw new AppError('Only the person who received the money (or a room admin) can confirm it', 403);
  }

  settlement.status = 'completed';
  settlement.confirmedAt = new Date();
  settlement.confirmedBy = userId;
  if (data.note) {
    settlement.note = settlement.note ? `${settlement.note} | Confirmed: ${data.note}` : data.note;
  }
  await settlement.save();
  return settlement.populate(SETTLEMENT_POPULATE);
}

/**
 * Pending payment → "rejected" (receiver says not received / payer withdraws).
 * Completed payment → "reversed" (audit correction).
 */
export async function reverseSettlement(userId, roomId, settlementId, { reason }) {
  const settlement = await Settlement.findOne({ _id: settlementId, roomId });
  if (!settlement) throw new AppError('Payment not found', 404);
  if (['reversed', 'rejected'].includes(settlement.status)) {
    throw new AppError(`This payment is already ${settlement.status}`, 409);
  }

  const isParty =
    settlement.paidBy.toString() === userId.toString() || settlement.paidTo.toString() === userId.toString();
  const membership = await getActiveMembership(roomId, userId);
  const isAdminOrOwner = membership && ['owner', 'admin'].includes(membership.role);
  if (!isParty && !isAdminOrOwner) {
    throw new AppError('You do not have permission to change this payment', 403);
  }

  settlement.status = settlement.status === 'pending' ? 'rejected' : 'reversed';
  settlement.reversalReason = reason || 'Payment entry reversed';
  settlement.reversedAt = new Date();
  settlement.reversedBy = userId;
  await settlement.save();
  return settlement.populate(SETTLEMENT_POPULATE);
}

export async function getRoomSettlements(roomId, options = {}) {
  const { month, status } = options;
  const query = { roomId };
  if (status) query.status = status;
  if (isValidMonth(month)) Object.assign(query, settlementMonthFilter(month));

  return Settlement.find(query)
    .populate('paidBy', 'name mobile avatar')
    .populate('paidTo', 'name mobile avatar')
    .populate('recordedBy', 'name mobile')
    .populate('confirmedBy', 'name mobile')
    .populate('reversedBy', 'name mobile')
    .sort({ settledAt: -1 })
    .lean();
}

// ─── Monthly Spending Summary for User (Personal + Rooms) ──────────────────────

export async function getUserMonthlySpendSummary(userId, monthString) {
  const month = isValidMonth(monthString) ? monthString : monthKey();
  const { start, end } = monthRange(month);

  const personalExpenses = await Expense.find({
    type: 'personal',
    createdBy: userId,
    expenseDate: { $gte: start, $lt: end },
    status: { $ne: 'cancelled' },
  }).select('amountInSmallestUnit');

  // Room spending = my share of approved room expenses this month
  const myRows = await ExpenseParticipant.find({ userId })
    .select('expenseId owedAmountInSmallestUnit')
    .lean();
  const countedIds = new Set(
    (
      await Expense.find({
        _id: { $in: myRows.map((r) => r.expenseId) },
        type: 'shared',
        expenseDate: { $gte: start, $lt: end },
        status: { $in: COUNTED_EXPENSE_STATUSES },
      }).distinct('_id')
    ).map(String),
  );
  const myShares = myRows.filter((r) => countedIds.has(String(r.expenseId)));

  const personalPaise = personalExpenses.reduce((sum, e) => sum + (e.amountInSmallestUnit || 0), 0);
  const roomPaise = myShares.reduce((sum, p) => sum + (p.owedAmountInSmallestUnit || 0), 0);

  const [y, m] = month.split('-').map(Number);
  return {
    month,
    monthName: new Date(Date.UTC(y, m - 1, 15)).toLocaleString('en-IN', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }),
    personalExpensesRupees: personalPaise / 100,
    roomExpensesRupees: roomPaise / 100,
    totalExpensesRupees: (personalPaise + roomPaise) / 100,
    personalCount: personalExpenses.length,
    roomCount: myShares.length,
  };
}
