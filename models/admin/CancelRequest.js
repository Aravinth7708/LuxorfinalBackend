import mongoose from 'mongoose';

const cancelRequestSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  userEmail: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    default: 'User initiated cancellation'
  },
  villaName: {
    type: String
  },
  checkIn: {
    type: Date
  },
  checkOut: {
    type: Date
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  adminResponse: {
    type: String
  },
  adminActionDate: {
    type: Date
  },
  refundAmount: {
    type: Number,
    default: 0
  },
  refundPercentage: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

export default mongoose.model('CancelRequest', cancelRequestSchema);