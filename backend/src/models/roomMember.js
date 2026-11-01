import mongoose from "mongoose";

const roomMemberSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["owner", "admin", "member"],
      default: "member",
    },
    status: {
      type: String,
      enum: ["active", "left", "removed"],
      default: "active",
    },
    joinedAt: { type: Date, default: Date.now },
    membershipStartDate: { type: Date, default: Date.now },
    membershipEndDate: { type: Date, default: null },
    leftAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// prevent duplicate membership
roomMemberSchema.index({ roomId: 1, userId: 1 }, { unique: true });
roomMemberSchema.index({ roomId: 1, status: 1 });

export const RoomMember = mongoose.model("RoomMember", roomMemberSchema);
