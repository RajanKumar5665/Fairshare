import mongoose from 'mongoose';

const adminNoticeSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    status: { type: String, enum: ['sent', 'resolved'], default: 'sent' },
  },
  { timestamps: true },
);

adminNoticeSchema.index({ roomId: 1, createdAt: -1 });

export const AdminNotice = mongoose.model('AdminNotice', adminNoticeSchema);
