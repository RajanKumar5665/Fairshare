import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      unique: true,
    },
    plan: { type: String, default: 'pro_room' },
    priceInRupees: { type: Number, default: 50 }, // Configurable ₹50/month
    status: {
      type: String,
      enum: ['active', 'trial', 'expired'],
      default: 'trial',
    },
    billingScope: {
      type: String,
      enum: ['room', 'member'],
      default: 'room',
    },
    currentPeriodStart: { type: Date, default: Date.now },
    currentPeriodEnd: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30-day trial
    },
    isTrial: { type: Boolean, default: true },
    paymentHistory: [
      {
        transactionId: String,
        amountRupees: Number,
        paidAt: { type: Date, default: Date.now },
        paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],
  },
  { timestamps: true }
);

subscriptionSchema.index({ roomId: 1, status: 1 });

export const Subscription = mongoose.model('Subscription', subscriptionSchema);
