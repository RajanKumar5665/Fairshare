import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // one of email/mobile is always present, but not both are required
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    mobile: { type: String, unique: true, sparse: true, trim: true },

    passwordHash: { type: String, default: null }, // null for google/mobile-only accounts
    role: { type: String, enum: ["user", "admin"], default: "user" },
    googleId: { type: String, unique: true, sparse: true },

    avatar: { type: String, default: "" },
    authProviders: [{ type: String, enum: ["local", "google", "mobile"] }],
    mobileVerified: { type: Boolean, default: false },

    preferences: {
      theme: { type: String, enum: ["light", "dark"], default: "light" },
      currency: { type: String, default: "INR" },
    },
    roomSubscription: {
      status: { type: String, enum: ["none", "active", "expired"], default: "none" },
      plan: { type: String, default: "starter_1rs" },
      amountPaid: { type: Number, default: 0 },
      validUntil: { type: Date, default: null },
      upiRef: { type: String, default: "" },
      paymentMethod: { type: String, default: "UPI" },
      razorpayPaymentId: { type: String, default: "" },
      razorpayOrderId: { type: String, default: "" },
      razorpaySignature: { type: String, default: "" },
      paidAt: { type: Date, default: null },
    },
  },
  { timestamps: true },
);

userSchema.index(
  { role: 1 },
  { unique: true, partialFilterExpression: { role: "admin" } },
);

export const User = mongoose.model("User", userSchema);
