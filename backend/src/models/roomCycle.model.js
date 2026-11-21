import mongoose from 'mongoose';

/**
 * A closed monthly cycle of a room — the permanent history record.
 * `snapshot` is the settle-up exactly as it stood when the month closed;
 * `status` moves from "closed" to "settled" once all its payments are confirmed.
 */
const roomCycleSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    index: { type: Number, required: true, min: 1 },
    label: { type: String, default: '' },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    status: { type: String, enum: ['closed', 'settled'], default: 'closed' },
    closedEarly: { type: Boolean, default: false }, // owner settled before the month ended
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    closedAt: { type: Date, default: Date.now },
    settledAt: { type: Date, default: null },
    snapshot: {
      totalPaise: { type: Number, default: 0 },
      expenseCount: { type: Number, default: 0 },
      headCount: { type: Number, default: 0 },
      equalSharePaise: { type: Number, default: 0 },
      carriedOverCount: { type: Number, default: 0 },
      members: [
        {
          _id: false,
          userId: String,
          name: String,
          paidPaise: Number,
          sharePaise: Number,
          differencePaise: Number,
        },
      ],
      transfers: [
        {
          _id: false,
          from: String,
          fromName: String,
          to: String,
          toName: String,
          amountPaise: Number,
        },
      ],
      categories: [{ _id: false, category: String, amountPaise: Number, percentage: Number }],
    },
  },
  { timestamps: true },
);

roomCycleSchema.index({ roomId: 1, index: 1 }, { unique: true });

export const RoomCycle = mongoose.model('RoomCycle', roomCycleSchema);
