import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema({
  villaName: {
    type: String,
    required: true,
    index: true
  },
  offerAmount: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  offerDateFrom: {
    type: Date,
    required: true,
    index: true
  },
  offerDateTo: {
    type: Date,
    required: true,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  title: {
    type: String,
    default: 'Special Offer'
  },
  description: {
    type: String,
    default: 'Limited time offer'
  },
  createdBy: {
    type: String,
    default: 'Admin'
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
offerSchema.index({ villaName: 1, offerDateFrom: 1, offerDateTo: 1 });
offerSchema.index({ villaName: 1, isActive: 1 });

// Method to check if offer is valid for a given date
offerSchema.methods.isValidForDate = function(date) {
  const checkDate = new Date(date);
  return this.isActive && 
         checkDate >= this.offerDateFrom && 
         checkDate <= this.offerDateTo &&
         this.offerAmount > 0;
};

// Static method to find active offer for villa and date
offerSchema.statics.findActiveOfferForVillaAndDate = async function(villaName, date) {
  const checkDate = new Date(date);
  return await this.findOne({
    villaName: villaName,
    isActive: true,
    offerDateFrom: { $lte: checkDate },
    offerDateTo: { $gte: checkDate },
    offerAmount: { $gt: 0 }
  }).sort({ createdAt: -1 }); // Get the latest offer if multiple exist
};

// Static method to find active offers for villa within date range
offerSchema.statics.findActiveOffersForVillaAndDateRange = async function(villaName, startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  return await this.find({
    villaName: villaName,
    isActive: true,
    offerAmount: { $gt: 0 },
    $or: [
      // Offer starts within the range
      { offerDateFrom: { $gte: start, $lte: end } },
      // Offer ends within the range
      { offerDateTo: { $gte: start, $lte: end } },
      // Offer spans the entire range
      { offerDateFrom: { $lte: start }, offerDateTo: { $gte: end } }
    ]
  }).sort({ offerDateFrom: 1 });
};

// Pre-save validation
offerSchema.pre('save', function(next) {
  // Ensure offerDateTo is after offerDateFrom
  if (this.offerDateTo <= this.offerDateFrom) {
    const error = new Error('Offer end date must be after start date');
    return next(error);
  }
  
  // Ensure offer dates are not in the past (only for new offers)
  if (this.isNew && this.offerDateFrom < new Date()) {
    console.warn('[OFFER] Warning: Offer start date is in the past');
  }
  
  next();
});

export default mongoose.model('Offer', offerSchema);
