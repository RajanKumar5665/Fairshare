import mongoose from "mongoose";

const expenseParticipantSchema = new mongoose.Schema(
  {
    expenseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Expense",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    owedAmountInSmallestUnit: { type: Number, required: true }, // paise
    splitValue: { type: Number, default: null }, // % or shares, for reference/editing
    reviewStatus: {
      type: String,
      enum: ["pending", "accepted", "disputed"],
      default: "pending",
    },
  },
  { timestamps: true },
);

expenseParticipantSchema.index({ expenseId: 1 });
expenseParticipantSchema.index({ userId: 1 });

export const ExpenseParticipant = mongoose.model(
  "ExpenseParticipant",
  expenseParticipantSchema,
);
