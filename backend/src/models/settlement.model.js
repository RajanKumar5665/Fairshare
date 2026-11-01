import mongoose from "mongoose";

/**
 * A settlement is a direct payment between two members in a room to clear
 * outstanding balances (e.g., A pays B ₹800 to settle debt).
 */
const settlementSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    paidTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amountInSmallestUnit: { type: Number, required: true, min: 1 }, // paise
    paymentMethod: {
      type: String,
      enum: ["upi", "cash", "bank_transfer", "other"],
      default: "upi",
    },
    transactionRef: { type: String, default: "" },
    note: { type: String, default: "" },
    settledAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["completed", "pending", "rejected", "reversed"],
      default: "completed",
    },
    confirmedAt: { type: Date, default: null },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reversalReason: { type: String, default: "" },
    reversedAt: { type: Date, default: null },
    reversedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

settlementSchema.index({ roomId: 1, settledAt: -1 });
settlementSchema.index({ roomId: 1, status: 1 });
settlementSchema.index({ paidBy: 1 });
settlementSchema.index({ paidTo: 1 });

export const Settlement = mongoose.model("Settlement", settlementSchema);
