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
    // Month (YYYY-MM, IST) this payment settles. Set when paying from the
    // month-end settle-up screen; falls back to settledAt when null.
    forMonth: { type: String, default: null },
    // Monthly cycle this payment settles (rooms only)
    cycle: { type: Number, default: null },
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
settlementSchema.index({ roomId: 1, forMonth: 1 });
settlementSchema.index({ roomId: 1, cycle: 1 });
settlementSchema.index({ paidBy: 1 });
settlementSchema.index({ paidTo: 1 });

export const Settlement = mongoose.model("Settlement", settlementSchema);
