import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    amountInSmallestUnit: { type: Number, required: true, min: 1 }, // paise
    currency: { type: String, default: "INR" },
    type: { type: String, enum: ["personal", "shared"], required: true },
    category: { type: String, default: "general" },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      default: null,
    },
    splitMethod: {
      type: String,
      enum: ["equal", "exact", "percentage", "shares", null],
      default: null,
    },
    receiptUrl: { type: String, default: null }, // optional image URL / base64 data-url
    expenseDate: { type: Date, default: Date.now },
    status: {
      type: String,
      // pending_review: waiting for every participant to approve; not counted in balances yet
      enum: ["active", "pending_review", "rejected", "disputed", "cancelled", "settled"],
      default: "active",
    },
    approvedAt: { type: Date, default: null },
    // Monthly cycle of the room this expense belongs to (rooms only; null for trips/groups)
    cycle: { type: Number, default: null },
    carriedOver: { type: Boolean, default: false }, // moved from a closed month while still pending
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectionReason: { type: String, default: "" },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

expenseSchema.index({ roomId: 1, expenseDate: -1 });
expenseSchema.index({ createdBy: 1, expenseDate: -1 });
expenseSchema.index({ roomId: 1, status: 1 });
expenseSchema.index({ roomId: 1, cycle: 1 });

export const Expense = mongoose.model("Expense", expenseSchema);
