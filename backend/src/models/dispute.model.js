import mongoose from 'mongoose';

const disputeCommentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: { type: String, required: true, trim: true, maxlength: 500 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const disputeSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },
    expenseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Expense',
      required: true,
    },
    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: { type: String, required: true, trim: true, minlength: 3, maxlength: 500 },
    status: {
      type: String,
      enum: ['open', 'resolved', 'rejected'],
      default: 'open',
    },
    resolutionNote: { type: String, default: '' },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedAt: { type: Date, default: null },
    comments: [disputeCommentSchema],
  },
  { timestamps: true }
);

disputeSchema.index({ roomId: 1, status: 1 });
disputeSchema.index({ expenseId: 1 });

export const Dispute = mongoose.model('Dispute', disputeSchema);
