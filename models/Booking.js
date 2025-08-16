import mongoose from "mongoose"

const bookingSchema = new mongoose.Schema(
  {
    villaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Villa",
      required: true,
    },
    villaName: {
      type: String,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // Make this required to ensure proper authorization
    },
    email: {
      type: String,
      required: true,
    },
    guestName: {
      type: String,
      required: true,
    },
    checkIn: {
      type: Date,
      required: true,
    },
    checkOut: {
      type: Date,
      required: true,
    },
    checkInTime: {
      type: String,
      default: "14:00", // 2:00 PM in 24-hour format
    },
    checkOutTime: {
      type: String,
      default: "12:00", // 12:00 PM in 24-hour format
    },
    guests: {
      type: Number,
      required: true,
    },
    infants: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      set: (value) => (isNaN(value) ? 0 : Math.round(value)),
    },
    totalDays: {
      type: Number,
      required: true,
    },
    // Address fields for the guest
    address: {
      street: String,
      country: String,
      state: String,
      city: String,
      zipCode: String,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed", "expired"],
      default: "confirmed",
    },
    paymentMethod: {
      type: String,
      default: "Pay at Hotel",
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    paymentId: {
      type: String,
      default: null,
    },
    orderId: {
      type: String,
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    paymentDetails: {
      razorpayPaymentId: String,
      razorpayOrderId: String,
      paymentCapturedAt: Date,
      paymentFailedAt: Date,
      paymentAuthorizedAt: Date,
      orderPaidAt: Date,
      paymentMethod: String,
      bank: String,
      cardId: String,
      wallet: String,
      vpa: String,
      errorCode: String,
      errorDescription: String,
      orderAmount: Number,
      orderCurrency: String,
    },
    bookingDate: {
      type: Date,
      default: Date.now,
    },
    location: String,

    // Cancellation fields
    cancelReason: String,
    cancelledAt: Date,
    refundAmount: {
      type: Number,
      default: 0,
    },
    refundPercentage: {
      type: Number,
      default: 0,
    },

    // Expiry fields
    expiredAt: {
      type: Date,
      default: null,
    },

    cancellationHistory: [
      {
        cancelledAt: Date,
        reason: String,
        refundAmount: Number,
        refundPercentage: Number,
        cancelledBy: String,
      },
    ],
  },
  {
    timestamps: true,
  },
)

// Add indexes for better query performance
bookingSchema.index({ userId: 1 })
bookingSchema.index({ email: 1 })
bookingSchema.index({ villaId: 1 })
bookingSchema.index({ status: 1 })
bookingSchema.index({ checkIn: 1, checkOut: 1 })
bookingSchema.index({ expiredAt: 1 })

// Static method to expire bookings that have passed their checkout date
bookingSchema.statics.expireBookings = async function() {
  const currentDate = new Date();
  
  try {
    const result = await this.updateMany(
      {
        status: { $in: ["confirmed", "pending"] },
        checkOut: { $lt: currentDate },
        expiredAt: null
      },
      {
        $set: {
          status: "expired",
          expiredAt: currentDate
        }
      }
    );
    
    console.log(`[BOOKING] Expired ${result.modifiedCount} bookings`);
    return result;
  } catch (error) {
    console.error("[BOOKING] Error expiring bookings:", error);
    throw error;
  }
};

// Pre-save hook to calculate total amount if it's missing
bookingSchema.pre("save", function (next) {
  if (isNaN(this.totalAmount) || this.totalAmount <= 0) {
    console.log("[BOOKING MODEL] Invalid totalAmount, attempting to fix:", this.totalAmount)
    if (this.totalDays && this.villaPrice) {
      const basePrice = this.villaPrice * this.totalDays
      const serviceFee = Math.round(basePrice * 0.05)
      const taxAmount = Math.round((basePrice + serviceFee) * 0.18)
      this.totalAmount = Math.round(basePrice + serviceFee + taxAmount)
      console.log("[BOOKING MODEL] Fixed totalAmount:", this.totalAmount)
    } else {
      this.totalAmount = 1000
      console.log("[BOOKING MODEL] Set fallback totalAmount:", this.totalAmount)
    }
  }
  next()
})

export default mongoose.model("Booking", bookingSchema)
