import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  token: { type: String, required: true, unique: true },
  family: { type: String, required: true }, // to detect reuse
  used: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }, // TTL = expiresAt field
}, { timestamps: true });

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
