import { RecurringBill } from '../../models/recurringBill.model.js';
import { RoomMember } from '../../models/roomMember.js';
import { createSharedExpense } from '../expenses/expense.service.js';
import { monthKey } from '../../utils/month.js';
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
  const currentPeriod = monthKey(now);

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

  const label = new Date(now.getTime() + 330 * 60 * 1000).toLocaleString('en-IN', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  // Goes through the same approval flow as any other shared expense.
  const expense = await createSharedExpense({
    roomId,
    payerId: userId,
    creatorId: userId,
    title: `${bill.title} (${label})`,
    description: `Generated from recurring schedule: ${bill.title}`,
    amountPaise: bill.amountInSmallestUnit,
    category: bill.category,
    expenseDate: now,
    splitMethod: 'shares',
    participants: finalParticipants.map((p) => ({
      userId: (p.userId?._id || p.userId).toString(),
      shares: bill.splitMethod === 'shares' ? p.shareValue || 1 : 1,
    })),
  });

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
