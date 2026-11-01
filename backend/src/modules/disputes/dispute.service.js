import { Dispute } from '../../models/dispute.model.js';
import { Expense } from '../../models/expense.model.js';
import { RoomMember } from '../../models/roomMember.js';

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function raiseDispute(userId, roomId, expenseId, data) {
  const expense = await Expense.findOne({ _id: expenseId, roomId });
  if (!expense) throw new AppError('Expense not found in this room', 404);

  if (expense.status === 'cancelled') {
    throw new AppError('Cannot dispute a cancelled expense', 400);
  }

  // Update expense status to disputed
  expense.status = 'disputed';
  await expense.save();

  const dispute = await Dispute.create({
    roomId,
    expenseId,
    raisedBy: userId,
    reason: data.reason,
    status: 'open',
  });

  return dispute.populate([
    { path: 'raisedBy', select: 'name mobile avatar' },
    { path: 'expenseId', select: 'title amountInSmallestUnit paidBy category expenseDate' },
  ]);
}

export async function listDisputes(roomId) {
  return Dispute.find({ roomId })
    .populate('raisedBy', 'name mobile avatar')
    .populate('resolvedBy', 'name')
    .populate({
      path: 'expenseId',
      select: 'title amountInSmallestUnit paidBy category expenseDate status',
      populate: { path: 'paidBy', select: 'name' },
    })
    .populate('comments.userId', 'name mobile avatar')
    .sort({ createdAt: -1 })
    .lean();
}

export async function addComment(userId, roomId, disputeId, data) {
  const dispute = await Dispute.findOne({ _id: disputeId, roomId });
  if (!dispute) throw new AppError('Dispute not found', 404);

  dispute.comments.push({
    userId,
    text: data.text,
    createdAt: new Date(),
  });
  await dispute.save();

  return dispute.populate('comments.userId', 'name mobile avatar');
}

export async function resolveDispute(userId, roomId, disputeId, data) {
  const dispute = await Dispute.findOne({ _id: disputeId, roomId }).populate('expenseId');
  if (!dispute) throw new AppError('Dispute not found', 404);

  const membership = await RoomMember.findOne({ roomId, userId, status: 'active' });
  const isAdminOrOwner = membership && ['owner', 'admin'].includes(membership.role);
  const isPayer = dispute.expenseId?.paidBy?.toString() === userId.toString();

  if (!isAdminOrOwner && !isPayer) {
    throw new AppError('Only the payer or room admin can resolve disputes', 403);
  }

  const { action, resolutionNote } = data; // 'resolve' | 'reject' | 'cancel_expense'

  if (action === 'cancel_expense') {
    if (dispute.expenseId) {
      dispute.expenseId.status = 'cancelled';
      await dispute.expenseId.save();
    }
    dispute.status = 'resolved';
  } else if (action === 'resolve') {
    if (dispute.expenseId) {
      dispute.expenseId.status = 'active';
      await dispute.expenseId.save();
    }
    dispute.status = 'resolved';
  } else if (action === 'reject') {
    if (dispute.expenseId) {
      dispute.expenseId.status = 'active';
      await dispute.expenseId.save();
    }
    dispute.status = 'rejected';
  }

  dispute.resolutionNote = resolutionNote || `Dispute marked as ${dispute.status}`;
  dispute.resolvedBy = userId;
  dispute.resolvedAt = new Date();
  await dispute.save();

  return dispute.populate([
    { path: 'raisedBy', select: 'name mobile avatar' },
    { path: 'resolvedBy', select: 'name' },
    { path: 'expenseId', select: 'title amountInSmallestUnit status' },
  ]);
}
