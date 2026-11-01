import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  mobile: { type: String, required: true, index: true },
  code: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  verified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: 600 }, // TTL 10 min
});

export const Otp = mongoose.model('Otp', otpSchema);
