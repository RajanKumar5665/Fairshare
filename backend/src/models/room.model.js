import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    address: { type: String, default: '', trim: true },
    monthlyRentInSmallestUnit: { type: Number, default: 0, min: 0 },
    customCategories: [{ type: String, trim: true }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    settings: {
      allowMemberInvite: { type: Boolean, default: true },
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