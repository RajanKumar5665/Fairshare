import mongoose from "mongoose";

const roomInvitationSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    invitedEmail: { type: String, lowercase: true, trim: true, default: null },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "expired", "revoked"],
      default: "pending",
    },
    revokedAt: { type: Date, default: null },
    // Shareable group invite (like a WhatsApp group link): one short code that
    // any number of friends can use until it expires or is reset.
    code: { type: String, default: null },
    maxUses: { type: Number, default: null }, // null = unlimited
    useCount: { type: Number, default: 0 },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

roomInvitationSchema.index({ tokenHash: 1 });
roomInvitationSchema.index({ roomId: 1, status: 1 });

export const RoomInvitation = mongoose.model(
  "RoomInvitation",
  roomInvitationSchema,
);
