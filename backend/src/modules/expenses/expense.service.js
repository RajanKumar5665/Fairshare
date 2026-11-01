import { Expense } from '../../models/expense.model.js';
import { ExpenseParticipant } from '../../models/expenseParticipant.model.js';
import { RoomMember } from '../../models/roomMember.js';
import { Settlement } from '../../models/settlement.model.js';
import { calculateSplit } from '../../utils/splitCalculator.js';
import { rupeesToPaise } from '../../utils/money.js';

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build the participants array for calculateSplit.
 * IMPORTANT: For "exact" split the UI sends amountRupees per participant —
 * convert once here. Never double-convert.
 */
function buildSplitInput(participants, splitMethod) {
  return participants.map((p) => {
    const base = { userId: p.userId };
    if (splitMethod === 'exact') {
      // amountRupees is the per-participant amount in rupees (decimal)
      base.amountPaise = rupeesToPaise(Number(p.amountRupees ?? p.amountPaise ?? 0));
    }
    if (splitMethod === 'percentage') {
      base.percentage = Number(p.percentage);
    }
    if (splitMethod === 'shares') {
      base.shares = Number(p.shares);
    }
    return base;
  });
}

async function validateRoomMembers(roomId, participantIds) {
  const memberIds = (
    await RoomMember.find({ roomId, status: 'active' }).select('userId')
  ).map((m) => m.userId.toString());

  const invalid = participantIds.find((id) => !memberIds.includes(id));
  if (invalid) {
    throw new AppError(`User ${invalid} is not an active member of this room`, 400);
  }
  return memberIds;
}

// ─── Create Expense ───────────────────────────────────────────────────────────

export async function createExpense(userId, data) {
  const amountPaise = rupeesToPaise(data.amountRupees);

  if (data.type === 'personal') {
    return Expense.create({
      title: data.title,
      description: '',
      amountInSmallestUnit: amountPaise,
      category: data.category,
      expenseDate: new Date(),
      receiptUrl: data.receiptUrl || null,
      type: 'personal',
      paidBy: userId,
      createdBy: userId,
    });
  }

  // Shared expense — if participants not passed, automatically include ALL active room members
  let participants = data.participants;
  const splitMethod = data.splitMethod || 'equal';
  if (!participants || !Array.isArray(participants) || participants.length === 0) {
    const activeMembers = await RoomMember.find({ roomId: data.roomId, status: 'active' }).select('userId');
    participants = activeMembers.map((m) => ({ userId: m.userId.toString() }));
  }

  const participantIds = participants.map((p) => p.userId);
  await validateRoomMembers(data.roomId, participantIds);

  const splitInput = buildSplitInput(participants, splitMethod);
  const computed = calculateSplit(splitMethod, amountPaise, splitInput);

  const expense = await Expense.create({
    title: data.title,
    description: '',
    amountInSmallestUnit: amountPaise,
    category: data.category || 'general',
    expenseDate: new Date(),
    receiptUrl: data.receiptUrl || null,
    type: 'shared',
    paidBy: userId,
    roomId: data.roomId,
    splitMethod: splitMethod,
    createdBy: userId,
  });

  // Build participant docs — map computed results back to original order
  const participantDocs = computed.map((c) => {
    const original = participants.find((p) => p.userId === c.userId.toString());
    return {
      expenseId: expense._id,
      userId: c.userId,
      owedAmountInSmallestUnit: c.amount,
      splitValue:
        original?.percentage ?? original?.shares ?? null,
    };
  });

  await ExpenseParticipant.insertMany(participantDocs);
  return expense;
}

// ─── Get Single Expense ───────────────────────────────────────────────────────

export async function getExpenseById(expenseId) {
  const expense = await Expense.findById(expenseId)
    .populate('paidBy', 'name mobile')
    .populate('createdBy', 'name');
  if (!expense) throw new AppError('Expense not found', 404);
  const participants = await ExpenseParticipant.find({ expenseId })
    .populate('userId', 'name mobile');
  return { expense, participants };
}

// ─── List Room Expenses ───────────────────────────────────────────────────────

export async function getRoomExpenses(roomId, { month, status, page = 1, limit = 50 } = {}) {
  const filter = { roomId };
  if (status) {
    filter.status = status;
  } else {
    filter.status = { $ne: 'cancelled' }; // exclude cancelled by default
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

  // If amount or split method changes, recalculate participants
  if (
    expense.type === 'shared' &&
    data.participants &&
    data.participants.length > 0
  ) {
    const newAmountPaise = data.amountRupees
      ? rupeesToPaise(data.amountRupees)
      : expense.amountInSmallestUnit;
    const newMethod = data.splitMethod || expense.splitMethod;

    const participantIds = data.participants.map((p) => p.userId);
    await validateRoomMembers(expense.roomId.toString(), participantIds);

    const splitInput = buildSplitInput(data.participants, newMethod);
    const computed = calculateSplit(newMethod, newAmountPaise, splitInput);

    // Delete old participants and insert new ones
    await ExpenseParticipant.deleteMany({ expenseId });
    const participantDocs = computed.map((c) => {
      const original = data.participants.find((p) => p.userId === c.userId.toString());
      return {
        expenseId: expense._id,
        userId: c.userId,
        owedAmountInSmallestUnit: c.amount,
        splitValue: original?.percentage ?? original?.shares ?? null,
      };
    });
    await ExpenseParticipant.insertMany(participantDocs);

    // Update the expense itself
    const updateFields = {};
    if (data.title) updateFields.title = data.title;
    if (data.description !== undefined) updateFields.description = data.description;
    if (data.category) updateFields.category = data.category;
    if (data.expenseDate) updateFields.expenseDate = data.expenseDate;
    if (data.receiptUrl !== undefined) updateFields.receiptUrl = data.receiptUrl;
    if (data.status) updateFields.status = data.status;
    if (data.amountRupees) updateFields.amountInSmallestUnit = newAmountPaise;
    if (data.splitMethod) updateFields.splitMethod = newMethod;

    return Expense.findByIdAndUpdate(expenseId, updateFields, { new: true });
  }

  // Simple field update (no participant recalculation)
  const updateFields = {};
  if (data.title) updateFields.title = data.title;
  if (data.description !== undefined) updateFields.description = data.description;
  if (data.category) updateFields.category = data.category;
  if (data.expenseDate) updateFields.expenseDate = data.expenseDate;
  if (data.receiptUrl !== undefined) updateFields.receiptUrl = data.receiptUrl;
  if (data.status) updateFields.status = data.status;

  return Expense.findByIdAndUpdate(expenseId, updateFields, { new: true });
}

// ─── Cancel Expense ────────────────────────────────────────────────────────────

export async function cancelExpense(expenseId, userId) {
  const expense = await Expense.findById(expenseId);
  if (!expense) throw new AppError('Expense not found', 404);
  expense.status = 'cancelled';
  await expense.save();
  return expense;
}

import { getRoomBalances } from '../rooms/room.service.js';
export { getRoomBalances };

// ─── Suggested Settlements ────────────────────────────────────────────────────
/**
 * Returns minimal transactions to settle all debts (greedy algorithm).
 * Returns array of { from, fromName, to, toName, amountPaise }
 */
export async function getSuggestedSettlements(roomId) {
  const balances = await getRoomBalances(roomId);

  const debtors = balances
    .filter((b) => b.netPaise < 0)
    .map((b) => ({ ...b, remaining: -b.netPaise })); // how much they owe
  const creditors = balances
    .filter((b) => b.netPaise > 0)
    .map((b) => ({ ...b, remaining: b.netPaise })); // how much they're owed

  const transactions = [];
  let d = 0;
  let c = 0;

  while (d < debtors.length && c < creditors.length) {
    const amount = Math.min(debtors[d].remaining, creditors[c].remaining);
    if (amount > 0) {
      transactions.push({
        from: debtors[d].userId,
        fromName: debtors[d].name,
        to: creditors[c].userId,
        toName: creditors[c].name,
        amountPaise: amount,
      });
    }
    debtors[d].remaining -= amount;
    creditors[c].remaining -= amount;
    if (debtors[d].remaining === 0) d++;
    if (creditors[c].remaining === 0) c++;
  }

  return transactions;
}

// ─── Record Settlement ────────────────────────────────────────────────────────

export async function recordSettlement(userId, data) {
  const amountPaise = rupeesToPaise(data.amountRupees);

  // Validate both users are (or were) room members
  const memberIds = (
    await RoomMember.find({ roomId: data.roomId }).select('userId')
  ).map((m) => m.userId.toString());

  if (!memberIds.includes(data.paidTo)) {
    throw new AppError('Recipient is not a member of this room', 400);
  }

  if (userId.toString() === data.paidTo.toString()) {
    throw new AppError('Cannot record a settlement to yourself', 400);
  }

  // Prevent duplicate settlement submissions within 60 seconds
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
  const existingRecent = await Settlement.findOne({
    roomId: data.roomId,
    paidBy: userId,
    paidTo: data.paidTo,
    amountInSmallestUnit: amountPaise,
    status: { $nin: ['reversed', 'rejected'] },
    createdAt: { $gte: oneMinuteAgo },
  });

  if (existingRecent) {
    throw new AppError(
      'A matching settlement was recorded recently. Please wait a moment to prevent duplicate submissions.',
      409
    );
  }

  const settlement = await Settlement.create({
    roomId: data.roomId,
    paidBy: userId,
    paidTo: data.paidTo,
    amountInSmallestUnit: amountPaise,
    paymentMethod: data.paymentMethod || 'upi',
    transactionRef: data.transactionRef ? data.transactionRef.trim() : '',
    note: data.note || '',
    status: data.status || 'completed',
    settledAt: data.settledAt ? new Date(data.settledAt) : new Date(),
    recordedBy: userId,
  });

  return settlement.populate([
    { path: 'paidBy', select: 'name mobile avatar' },
    { path: 'paidTo', select: 'name mobile avatar' },
    { path: 'recordedBy', select: 'name mobile' },
  ]);
}

// ─── Confirm Settlement ───────────────────────────────────────────────────────

export async function confirmSettlement(userId, roomId, settlementId, data = {}) {
  const settlement = await Settlement.findOne({ _id: settlementId, roomId });
  if (!settlement) {
    throw new AppError('Settlement not found', 404);
  }

  if (settlement.status === 'reversed') {
    throw new AppError('Cannot confirm a reversed settlement', 400);
  }

  // Must be payee or room owner/admin
  const isPayee = settlement.paidTo.toString() === userId.toString();
  const membership = await RoomMember.findOne({ roomId, userId, status: 'active' });
  const isAdminOrOwner = membership && ['owner', 'admin'].includes(membership.role);

  if (!isPayee && !isAdminOrOwner) {
    throw new AppError('Only the recipient or room admin can confirm this settlement', 403);
  }

  settlement.status = 'completed';
  settlement.confirmedAt = new Date();
  settlement.confirmedBy = userId;
  if (data.note) {
    settlement.note = settlement.note ? `${settlement.note} | Confirmed: ${data.note}` : data.note;
  }
  await settlement.save();

  return settlement.populate([
    { path: 'paidBy', select: 'name mobile avatar' },
    { path: 'paidTo', select: 'name mobile avatar' },
    { path: 'recordedBy', select: 'name mobile' },
    { path: 'confirmedBy', select: 'name mobile' },
  ]);
}

// ─── Reverse Settlement (Audit Correction) ───────────────────────────────────

export async function reverseSettlement(userId, roomId, settlementId, { reason }) {
  const settlement = await Settlement.findOne({ _id: settlementId, roomId });
  if (!settlement) {
    throw new AppError('Settlement not found', 404);
  }

  if (settlement.status === 'reversed') {
    throw new AppError('Settlement has already been reversed', 400);
  }

  // Can be reversed by payer, payee, or room owner/admin
  const isParty =
    settlement.paidBy.toString() === userId.toString() ||
    settlement.paidTo.toString() === userId.toString();
  const membership = await RoomMember.findOne({ roomId, userId, status: 'active' });
  const isAdminOrOwner = membership && ['owner', 'admin'].includes(membership.role);

  if (!isParty && !isAdminOrOwner) {
    throw new AppError('You do not have permission to reverse this settlement', 403);
  }

  settlement.status = 'reversed';
  settlement.reversalReason = reason || 'Erroneous financial entry reversed';
  settlement.reversedAt = new Date();
  settlement.reversedBy = userId;
  await settlement.save();

  return settlement.populate([
    { path: 'paidBy', select: 'name mobile avatar' },
    { path: 'paidTo', select: 'name mobile avatar' },
    { path: 'recordedBy', select: 'name mobile' },
    { path: 'reversedBy', select: 'name mobile' },
  ]);
}

// ─── List Room Settlements ─────────────────────────────────────────────────────

export async function getRoomSettlements(roomId, options = {}) {
  const { month, status } = options;
  const query = { roomId };

  if (status) {
    query.status = status;
  }

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, m] = month.split('-').map(Number);
    const start = new Date(Date.UTC(year, m - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, m, 1, 0, 0, 0));
    query.settledAt = { $gte: start, $lt: end };
  }

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
  const now = new Date();
  let start, end;
  if (monthString && /^\d{4}-\d{2}$/.test(monthString)) {
    const [year, m] = monthString.split('-').map(Number);
    start = new Date(year, m - 1, 1);
    end = new Date(year, m, 1);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  // Personal expenses in current month
  const personalExpenses = await Expense.find({
    type: 'personal',
    createdBy: userId,
    expenseDate: { $gte: start, $lt: end },
    status: { $ne: 'cancelled' },
  }).select('amountInSmallestUnit');

  // Room expenses paid by user in current month
  const roomExpenses = await Expense.find({
    type: 'shared',
    paidBy: userId,
    expenseDate: { $gte: start, $lt: end },
    status: { $ne: 'cancelled' },
  }).select('amountInSmallestUnit');

  const personalPaise = personalExpenses.reduce((sum, e) => sum + (e.amountInSmallestUnit || 0), 0);
  const roomPaise = roomExpenses.reduce((sum, e) => sum + (e.amountInSmallestUnit || 0), 0);
  const totalPaise = personalPaise + roomPaise;

  return {
    month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
    monthName: start.toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
    personalExpensesRupees: personalPaise / 100,
    roomExpensesRupees: roomPaise / 100,
    totalExpensesRupees: totalPaise / 100,
    personalCount: personalExpenses.length,
    roomCount: roomExpenses.length,
  };
}