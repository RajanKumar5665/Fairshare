import { RecurringBill } from '../../models/recurringBill.model.js';
import { Expense } from '../../models/expense.model.js';
import { ExpenseParticipant } from '../../models/expenseParticipant.model.js';
import { RoomMember } from '../../models/roomMember.js';
import { calculateSplit } from '../../utils/splitCalculator.js';
import { rupeesToPaise } from '../../utils/money.js';

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function createRecurringBill(userId, roomId, data) {
  const amountPaise = rupeesToPaise(data.amountRupees);

  // Active members who haven't moved out
  const activeMembers = await RoomMember.find({ roomId, status: 'active' }).select('userId');
  const activeUserIds = activeMembers.map((m) => m.userId.toString());

  let participants = data.participants;
  if (!participants || participants.length === 0) {
    participants = activeUserIds.map((uid) => ({ userId: uid, shareValue: 1 }));
  }

  // Calculate next due date
  const now = new Date();
  const dueDay = Number(data.dueDay) || 1;
  let nextDueDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), dueDay));
  if (nextDueDate <= now) {
    nextDueDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, dueDay));
  }

  const bill = await RecurringBill.create({
    roomId,
    title: data.title,
    description: data.description || '',
    amountInSmallestUnit: amountPaise,
    category: data.category || 'utilities',
    frequency: data.frequency || 'monthly',
    dueDay,
    nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : nextDueDate,
    splitMethod: data.splitMethod || 'equal',
    participants,
    isActive: true,
    createdBy: userId,
  });

  return bill.populate('participants.userId', 'name mobile avatar');
}

export async function listRecurringBills(roomId) {
  return RecurringBill.find({ roomId })
    .populate('participants.userId', 'name mobile avatar')
    .populate('createdBy', 'name')
    .sort({ nextDueDate: 1 })
    .lean();
}

export async function updateRecurringBill(userId, roomId, billId, data) {
  const bill = await RecurringBill.findOne({ _id: billId, roomId });
  if (!bill) throw new AppError('Recurring bill not found', 404);

  if (data.title) bill.title = data.title;
  if (data.description !== undefined) bill.description = data.description;
  if (data.amountRupees) bill.amountInSmallestUnit = rupeesToPaise(data.amountRupees);
  if (data.category) bill.category = data.category;
  if (data.frequency) bill.frequency = data.frequency;
  if (data.dueDay) bill.dueDay = data.dueDay;
  if (data.splitMethod) bill.splitMethod = data.splitMethod;
  if (data.participants) bill.participants = data.participants;
  if (data.isActive !== undefined) bill.isActive = data.isActive;
  if (data.nextDueDate) bill.nextDueDate = new Date(data.nextDueDate);

  await bill.save();
  return bill.populate('participants.userId', 'name mobile avatar');
}

export async function deleteRecurringBill(userId, roomId, billId) {
  const bill = await RecurringBill.findOne({ _id: billId, roomId });
  if (!bill) throw new AppError('Recurring bill not found', 404);

  await RecurringBill.deleteOne({ _id: billId });
  return { success: true, message: 'Recurring bill removed' };
}

export async function generateDueExpense(userId, roomId, billId) {
  const bill = await RecurringBill.findOne({ _id: billId, roomId });
  if (!bill) throw new AppError('Recurring bill not found', 404);

  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Prevent duplicate generation for same period
  if (bill.lastGeneratedPeriod === currentPeriod) {
    throw new AppError(`This bill was already generated for ${currentPeriod}.`, 409);
  }

  // Check eligible participants considering move-in / move-out dates
  const activeMembers = await RoomMember.find({
    roomId,
    status: 'active',
  }).select('userId membershipStartDate membershipEndDate');

  const eligibleIds = new Set(
    activeMembers
      .filter((m) => {
        const started = !m.membershipStartDate || m.membershipStartDate <= now;
        const notEnded = !m.membershipEndDate || m.membershipEndDate >= now;
        return started && notEnded;
      })
      .map((m) => m.userId.toString())
  );

  let finalParticipants = bill.participants.filter((p) =>
    eligibleIds.has(p.userId?.toString() || p.userId?._id?.toString())
  );

  if (finalParticipants.length === 0) {
    // Fallback to all currently active members
    finalParticipants = Array.from(eligibleIds).map((id) => ({ userId: id, shareValue: 1 }));
  }

  // Calculate split amounts
  const splitInput = finalParticipants.map((p) => ({
    userId: p.userId.toString(),
    shares: p.shareValue || 1,
  }));

  const splitResult = calculateSplit(bill.amountInSmallestUnit, bill.splitMethod, splitInput);

  // Create authoritative expense
  const expense = await Expense.create({
    title: `${bill.title} (${now.toLocaleString('default', { month: 'short', year: 'numeric' })})`,
    description: `Generated from recurring schedule: ${bill.title}`,
    amountInSmallestUnit: bill.amountInSmallestUnit,
    type: 'shared',
    category: bill.category,
    paidBy: userId,
    roomId,
    splitMethod: bill.splitMethod,
    expenseDate: now,
    status: 'active',
    createdBy: userId,
  });

  const participantDocs = splitResult.map((p) => ({
    expenseId: expense._id,
    userId: p.userId,
    owedAmountInSmallestUnit: p.owedAmountPaise,
    splitMethod: bill.splitMethod,
    shareValue: p.shareValue || 1,
  }));
  await ExpenseParticipant.insertMany(participantDocs);

  // Update bill cycle
  bill.lastGeneratedPeriod = currentPeriod;
  bill.lastGeneratedAt = now;
  // Advance nextDueDate by 1 month
  const next = new Date(bill.nextDueDate);
  next.setMonth(next.getMonth() + 1);
  bill.nextDueDate = next;
  await bill.save();

  return expense.populate('paidBy', 'name mobile');
}
