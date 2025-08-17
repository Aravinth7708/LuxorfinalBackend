import mongoose from 'mongoose';

const blockedDateSchema = new mongoose.Schema({
  villaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Villa',
    required: true
  },
  villaName: {
    type: String,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  reason: {
    type: String,
    enum: ['Maintenance', 'Private Event', 'Renovation', 'Owner Use', 'Seasonal Closure', 'Other'],
    default: 'Maintenance'
  },
  description: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
blockedDateSchema.index({ villaId: 1, startDate: 1, endDate: 1 });
blockedDateSchema.index({ startDate: 1, endDate: 1 });

// Pre-save middleware to update the updatedAt field
blockedDateSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to check if a villa is blocked for a specific date range
blockedDateSchema.statics.isVillaBlocked = async function(villaId, checkIn, checkOut) {
  const blocked = await this.findOne({
    villaId: villaId,
    isActive: true,
    $or: [
      // Check if any blocked period overlaps with the requested period
      {
        startDate: { $lte: new Date(checkOut) },
        endDate: { $gte: new Date(checkIn) }
      }
    ]
  });
  
  return !!blocked;
};

// Static method to get all blocked dates for a villa
blockedDateSchema.statics.getVillaBlockedDates = async function(villaId) {
  return await this.find({
    villaId: villaId,
    isActive: true,
    endDate: { $gte: new Date() } // Only future and current blocked dates
  }).sort({ startDate: 1 });
};

// Static method to get all active blocked dates
blockedDateSchema.statics.getAllActiveBlockedDates = async function() {
  return await this.find({
    isActive: true,
    endDate: { $gte: new Date() } // Only future and current blocked dates
  }).populate('villaId', 'name location').sort({ startDate: 1 });
};

// Instance method to check if this blocked date is currently active
blockedDateSchema.methods.isCurrentlyActive = function() {
  const now = new Date();
  return this.startDate <= now && this.endDate >= now;
};

// Instance method to check if this blocked date is in the future
blockedDateSchema.methods.isFuture = function() {
  return this.startDate > new Date();
};

// Instance method to check if this blocked date is in the past
blockedDateSchema.methods.isPast = function() {
  return this.endDate < new Date();
};

const BlockedDate = mongoose.model('BlockedDate', blockedDateSchema);

export default BlockedDate;
