import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // room = flat/PG shared monthly, trip = travel with friends, group = anything else
    type: { type: String, enum: ['room', 'trip', 'group'], default: 'room' },
    startDate: { type: Date, default: null }, // trips
    endDate: { type: Date, default: null },
    // Monthly cycles (type "room"): Month 1 starts on cycleAnchor (defaults to createdAt)
    cycleAnchor: { type: Date, default: null },
    lastClosedCycle: { type: Number, default: 0 },
    cyclesBackfilled: { type: Boolean, default: false },
    // Trips/groups: owner "finished" it — no new expenses, payments still allowed
    isClosed: { type: Boolean, default: false },
    closedAt: { type: Date, default: null },
    description: { type: String, default: '' },
    address: { type: String, default: '', trim: true },
    monthlyRentInSmallestUnit: { type: Number, default: 0, min: 0 },
    customCategories: [{ type: String, trim: true }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    settings: {
      allowMemberInvite: { type: Boolean, default: true },
      // Shared expenses stay "pending" until every roommate in the split approves.
      requireApproval: { type: Boolean, default: true },
      defaultSplitMethod: {
        type: String,
        enum: ['equal', 'exact', 'percentage', 'shares'],
        default: 'equal',
      },
    },
  },
  { timestamps: true }
);

export const Room = mongoose.model('Room', roomSchema);