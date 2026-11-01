import mongoose from 'mongoose';

const roomMessageSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    isAnnouncement: { type: Boolean, default: false },
    category: {
      type: String,
      enum: ['chat', 'rent', 'bill', 'maintenance', 'general'],
      default: 'chat',
    },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

roomMessageSchema.index({ roomId: 1, createdAt: -1 });
roomMessageSchema.index({ roomId: 1, isAnnouncement: 1 });

export const RoomMessage = mongoose.model('RoomMessage', roomMessageSchema);
