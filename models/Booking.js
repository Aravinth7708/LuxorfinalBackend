import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
  villaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Villa',
    required: true
  },
  villaName: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  email: {
    type: String,
    required: true
  },
  guestName: {
    type: String,
    required: true
  },
  checkIn: {
    type: Date,
    required: true
  },
  checkOut: {
    type: Date,
    required: true
  },
  guests: {
    type: Number,
    required: true
  },
  infants: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    set: function(value) {
      // Ensure the value is a valid number
      return isNaN(value) ? 0 : Math.round(value);
    }
  },
  totalDays: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'confirmed'
  },
  paymentMethod: {
    type: String,
    default: 'Pay at Hotel'
  },
  isPaid: {
    type: Boolean,
    default: false
  },
  bookingDate: {
    type: Date,
    default: Date.now
  },
  location: String
}, { timestamps: true });

// Add a pre-save hook to calculate total amount if it's missing
bookingSchema.pre('save', function(next) {
  if (isNaN(this.totalAmount) || this.totalAmount <= 0) {
    console.log("[BOOKING MODEL] Invalid totalAmount, attempting to fix:", this.totalAmount);
    
    // Try to get a valid number
    if (this.totalDays && this.villaPrice) {
      const basePrice = this.villaPrice * this.totalDays;
      const serviceFee = Math.round(basePrice * 0.05);
      const taxAmount = Math.round((basePrice + serviceFee) * 0.18);
      this.totalAmount = Math.round(basePrice + serviceFee + taxAmount);
      console.log("[BOOKING MODEL] Fixed totalAmount:", this.totalAmount);
    } else {
      // If we can't calculate, set a minimum amount
      this.totalAmount = 1000;
      console.log("[BOOKING MODEL] Set fallback totalAmount:", this.totalAmount);
    }
  }
  next();
});

export default mongoose.model('Booking', bookingSchema);
module.exports = mongoose.model('Booking', bookingSchema);
