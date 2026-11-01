import mongoose from 'mongoose';

const recurringBillSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    amountInSmallestUnit: { type: Number, required: true, min: 1 }, // paise
    category: { type: String, default: 'utilities' },
    frequency: {
      type: String,
      enum: ['monthly', 'weekly', 'quarterly', 'yearly'],
      default: 'monthly',
    },
    dueDay: { type: Number, min: 1, max: 31, default: 1 },
    nextDueDate: { type: Date, required: true },
    splitMethod: {
      type: String,
      enum: ['equal', 'exact', 'percentage', 'shares'],
      default: 'equal',
    },
    participants: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        shareValue: { type: Number, default: 1 },
      },
    ],
    isActive: { type: Boolean, default: true },
    lastGeneratedPeriod: { type: String, default: null }, // e.g. '2026-10' to prevent duplicate runs
    lastGeneratedAt: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

recurringBillSchema.index({ roomId: 1, isActive: 1 });
recurringBillSchema.index({ nextDueDate: 1 });

export const RecurringBill = mongoose.model('RecurringBill', recurringBillSchema);
