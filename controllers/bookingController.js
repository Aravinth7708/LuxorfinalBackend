import Booking from "../models/Booking.js"
import Villa from "../models/Villa.js"
import nodemailer from "nodemailer"

// Import the necessary models
import UserProfile from "../models/UserProfile.js";
import User from "../models/User.js";
import PhoneUser from "../models/PhoneUser.js";

export const createBooking = async (req, res) => {
  try {
    console.log("[BOOKING] Received booking request:", req.body)
    console.log("[BOOKING] User from auth:", req.user)

    const { 
      villaId, email, guestName, checkIn, checkOut, checkInTime, checkOutTime, 
      guests, totalAmount, totalDays, infants, address 
    } = req.body

    if (!villaId || !email || !checkIn || !checkOut || !guests) {
      console.error("[BOOKING] Missing required fields", req.body)
      return res.status(400).json({ error: "Missing required fields" })
    }

    // Get userId from authenticated user
    const userId = req.user?.userId
    if (!userId) {
      console.error("[BOOKING] No userId found in auth token")
      return res.status(401).json({ error: "Authentication required" })
    }

    // Validate totalAmount
    let calculatedDays // Declare calculatedDays variable
    if (isNaN(totalAmount) || totalAmount <= 0) {
      console.error("[BOOKING] Invalid totalAmount:", totalAmount)
      const villa = await Villa.findById(villaId)
      if (!villa) {
        console.error("[BOOKING] Villa not found for id:", villaId)
        return res.status(404).json({ error: "Villa not found" })
      }

      // Calculate dates difference
      const start = new Date(checkIn)
      const end = new Date(checkOut)
      const diffTime = Math.abs(end - start)
      calculatedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      // Calculate total amount
      const basePrice = villa.price * calculatedDays
      const serviceFee = Math.round(basePrice * 0.05)
      const taxAmount = Math.round((basePrice + serviceFee) * 0.18)
      const calculatedTotalAmount = Math.round(basePrice + serviceFee + taxAmount)

      console.log("[BOOKING] Recalculated totalAmount:", calculatedTotalAmount)
      req.body.totalAmount = calculatedTotalAmount
    }

    console.log("[BOOKING] Looking for villa with id:", villaId)
    const villa = await Villa.findById(villaId)
    if (!villa) {
      console.error("[BOOKING] Villa not found for id:", villaId)
      return res.status(404).json({ error: "Villa not found" })
    }

    // Validate guest count against villa's maximum capacity
    if (guests > villa.guests) {
      console.error(`[BOOKING] Guest count (${guests}) exceeds villa's maximum capacity (${villa.guests})`)
      return res.status(400).json({ 
        error: "Guest limit exceeded", 
        message: `This villa allows a maximum of ${villa.guests} guests. You've selected ${guests} guests.` 
      })
    }

    console.log("[BOOKING] Creating booking for villa:", villa.name)
    const booking = await Booking.create({
      villaId,
      villaName: villa.name,
      userId, // Make sure to include userId
      email,
      guestName,
      checkIn,
      checkOut,
      checkInTime: checkInTime || "14:00", // Default to 2:00 PM
      checkOutTime: checkOutTime || "12:00", // Default to 12:00 PM
      guests,
      totalAmount: req.body.totalAmount || totalAmount,
      totalDays: totalDays || calculatedDays,
      infants: infants || 0,
      // Save address information if provided
      address: address || {
        street: "",
        country: "",
        state: "",
        city: "",
        zipCode: ""
      },
    })

    console.log("[BOOKING] Booking created with userId:", booking.userId)

    // Send confirmation email
    try {
      await sendBookingEmail(email, booking, villa)
      console.log("[BOOKING] Confirmation email sent to:", email)
    } catch (mailErr) {
      console.error("[BOOKING] Error sending confirmation email:", mailErr)
    }

    res.json({ success: true, booking })
  } catch (err) {
    console.error("[BOOKING] Error in createBooking:", err)
    res.status(500).json({ error: err.message })
  }
}

async function sendBookingEmail(email, booking, villa) {
  const transporter = nodemailer.createTransporter({
    service: "gmail",
    auth: {
      user: process.env.gmail,
      pass: process.env.pass,
    },
  })

  // Format dates
  const checkInDate = new Date(booking.checkIn)
  const checkOutDate = new Date(booking.checkOut)

  const formattedCheckIn = checkInDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  const formattedCheckOut = checkOutDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const bookingDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })

  const villaImageUrl =
    villa.images && villa.images.length > 0
      ? `${process.env.BASE_URL || "https://luxorstayvillas.com"}/img/${villa.images[0]}`
      : `${process.env.BASE_URL || "https://luxorstayvillas.com"}/img/default-villa.jpg`

  const basePrice = villa.price * booking.totalDays
  const serviceFee = Math.round(basePrice * 0.05)
  const taxAmount = Math.round((basePrice + serviceFee) * 0.18)
  const totalAmount = booking.totalAmount || basePrice + serviceFee + taxAmount

  const bookingNumber = String(booking._id).substring(0, 6).toUpperCase()

  const mailOptions = {
    from: process.env.gmail,
    to: email,
    subject: `Booking Confirmation #${bookingNumber} - ${villa.name}`,
    html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Confirmation</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 650px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .header { background-color: #1e3a8a; color: white; padding: 25px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
        .booking-details { padding: 25px 30px; }
        .booking-id { background-color: #f2f7ff; padding: 12px; border-radius: 6px; text-align: center; margin-bottom: 20px; }
        .booking-id span { font-weight: 700; color: #1e3a8a; font-size: 18px; }
        .footer { background-color: #f2f7ff; padding: 20px 30px; text-align: center; font-size: 14px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Booking Confirmation</h1>
          <p>Thank you for choosing LuxorStay Villas</p>
        </div>
        <div class="booking-details">
          <div class="booking-id">
            <span>Booking #${bookingNumber}</span>
          </div>
          <h2>${villa.name}</h2>
          <p><strong>Check-in:</strong> ${formattedCheckIn}</p>
          <p><strong>Check-out:</strong> ${formattedCheckOut}</p>
          <p><strong>Guests:</strong> ${booking.guests} guests</p>
          <p><strong>Total Amount:</strong> ₹${totalAmount?.toLocaleString() || "0"}</p>
          <p><strong>Status:</strong> Confirmed</p>
        </div>
        <div class="footer">
          <p>For questions, contact us at luxorholidayhomestays@gmail.com</p>
          <p>© ${new Date().getFullYear()} LuxorStay Villas. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
    `,
  }

  await transporter.sendMail(mailOptions)
}

export const searchBookings = async (req, res) => {
  try {
    const { checkIn, checkOut } = req.query
    if (!checkIn || !checkOut) {
      return res.status(400).json({ error: "checkIn and checkOut required" })
    }

    const bookings = await Booking.find({
      $or: [
        {
          checkIn: { $lte: new Date(checkOut) },
          checkOut: { $gte: new Date(checkIn) },
        },
      ],
    })

    res.json(bookings)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

export const getUserBookings = async (req, res) => {
  try {
    console.log("[BOOKING] Fetching user bookings with auth:", {
      userId: req.user?.userId,
      email: req.user?.email,
      hasUserObject: !!req.user,
    })

    if (!req.user) {
      console.error("[BOOKING] Authentication error: No user object in request")
      return res.status(401).json({
        error: "Authentication required",
        details: "User information not available",
      })
    }

    const userId = req.user.userId
    if (!userId) {
      console.error("[BOOKING] User ID not found in authentication data")
      return res.status(400).json({
        error: "Invalid user data",
        details: "User ID is required",
      })
    }

    let userEmail = req.user.email
    if (!userEmail) {
      console.log(`[BOOKING] Email not found in token, looking up user with ID: ${userId}`)
      const User = await import("../models/User.js")
      try {
        const user = await User.default.findById(userId)
        if (!user) {
          console.error(`[BOOKING] User not found for ID: ${userId}`)
          return res.status(404).json({
            error: "User not found",
            details: "The user associated with this token does not exist",
          })
        }
        userEmail = user.email
        console.log(`[BOOKING] Found user email: ${userEmail}`)
      } catch (err) {
        console.error(`[BOOKING] Error looking up user: ${err.message}`)
        return res.status(500).json({
          error: "Database error",
          details: "Error retrieving user information",
        })
      }
    }

    console.log(`[BOOKING] Looking for bookings with email: ${userEmail}`)
    const bookings = await Booking.find({ email: userEmail })
    console.log(`[BOOKING] Found ${bookings.length} bookings for email ${userEmail}`)

    res.json({
      success: true,
      count: bookings.length,
      bookings: bookings,
    })
  } catch (err) {
    console.error("[BOOKING] Error fetching user bookings:", err)
    res.status(500).json({
      error: "Failed to fetch bookings",
      message: err.message,
    })
  }
}

export const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params
    const { reason } = req.body
    const userId = req.user.userId
    const userEmail = req.user.email

    console.log("[BOOKING] Cancel request:", {
      bookingId: id,
      userId: userId,
      userEmail: userEmail,
      reason: reason,
    })

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Booking ID is required",
      })
    }

    // Find the booking
    const booking = await Booking.findById(id)
    if (!booking) {
      console.error("[BOOKING] Booking not found:", id)
      return res.status(404).json({
        success: false,
        error: "Booking not found",
      })
    }

    console.log("[BOOKING] Found booking:", {
      bookingId: booking._id,
      bookingUserId: booking.userId,
      bookingEmail: booking.email,
      currentStatus: booking.status,
    })

    // Check if booking is already cancelled
    if (booking.status === "cancelled") {
      return res.status(400).json({
        success: false,
        error: "Booking is already cancelled",
      })
    }

    // Authorization check - user can cancel if:
    // 1. They are the booking owner (by userId OR email)
    // 2. They are an admin
    const isOwnerByUserId = booking.userId && booking.userId.toString() === userId
    const isOwnerByEmail = booking.email === userEmail
    const isAdmin = req.user.role === "admin"

    if (!isOwnerByUserId && !isOwnerByEmail && !isAdmin) {
      console.error("[BOOKING] Unauthorized cancellation attempt:", {
        bookingUserId: booking.userId,
        bookingEmail: booking.email,
        requestUserId: userId,
        requestUserEmail: userEmail,
        isAdmin: isAdmin,
      })
      return res.status(403).json({
        success: false,
        error: "You are not authorized to cancel this booking",
      })
    }

    // Calculate refund amount based on cancellation policy
    let refundPercentage = 0
    const checkInDate = new Date(booking.checkIn)
    const now = new Date()
    const daysUntilCheckIn = Math.ceil((checkInDate - now) / (1000 * 60 * 60 * 24))

    console.log("[BOOKING] Cancellation timing:", {
      checkInDate: checkInDate,
      now: now,
      daysUntilCheckIn: daysUntilCheckIn,
    })

    if (daysUntilCheckIn > 30) {
      refundPercentage = 75
    } else if (daysUntilCheckIn > 15) {
      refundPercentage = 50
    } else {
      refundPercentage = 0
    }

    const refundAmount = Math.round((booking.totalAmount * refundPercentage) / 100)

    console.log("[BOOKING] Refund calculation:", {
      totalAmount: booking.totalAmount,
      refundPercentage: refundPercentage,
      refundAmount: refundAmount,
    })

    // Update booking status
    booking.status = "cancelled"
    booking.cancelReason = reason || "User initiated cancellation"
    booking.cancelledAt = new Date()
    booking.refundAmount = refundAmount
    booking.refundPercentage = refundPercentage

    // Add to cancellation history
    if (!booking.cancellationHistory) {
      booking.cancellationHistory = []
    }

    booking.cancellationHistory.push({
      cancelledAt: booking.cancelledAt,
      reason: booking.cancelReason,
      refundAmount: booking.refundAmount,
      refundPercentage: booking.refundPercentage,
      cancelledBy: userId || userEmail || "unknown",
    })

    await booking.save()

    console.log("[BOOKING] Booking cancelled successfully:", {
      bookingId: booking._id,
      status: booking.status,
      refundAmount: booking.refundAmount,
    })

    // Send cancellation confirmation email
    try {
      await sendCancellationEmail(booking.email, booking)
    } catch (emailError) {
      console.error("[BOOKING] Error sending cancellation email:", emailError)
    }

    res.json({
      success: true,
      message: "Booking cancelled successfully",
      booking: {
        id: booking._id,
        status: booking.status,
        cancelledAt: booking.cancelledAt,
        refundAmount: booking.refundAmount,
        refundPercentage: booking.refundPercentage,
      },
    })
  } catch (err) {
    console.error("[BOOKING] Cancel booking error:", err)
    res.status(500).json({
      success: false,
      error: "Failed to cancel booking",
      message: err.message,
    })
  }
}

async function sendCancellationEmail(email, booking) {
  const transporter = nodemailer.createTransporter({
    service: "gmail",
    auth: {
      user: process.env.gmail,
      pass: process.env.pass,
    },
  })

  const bookingNumber = String(booking._id).substring(0, 6).toUpperCase()

  const mailOptions = {
    from: process.env.gmail,
    to: email,
    subject: `Booking Cancellation Confirmation #${bookingNumber}`,
    html: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Booking Cancelled</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .footer { padding: 15px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Booking Cancelled</h1>
        </div>
        <div class="content">
          <h2>Booking #${bookingNumber} has been cancelled</h2>
          <p><strong>Villa:</strong> ${booking.villaName}</p>
          <p><strong>Cancelled on:</strong> ${booking.cancelledAt.toLocaleDateString()}</p>
          ${
            booking.refundAmount > 0
              ? `<p><strong>Refund Amount:</strong> ₹${booking.refundAmount.toLocaleString()} (${booking.refundPercentage}%)</p>`
              : "<p><strong>Refund:</strong> No refund applicable as per cancellation policy</p>"
          }
          <p>If you have any questions, please contact us at luxorholidayhomestays@gmail.com</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} LuxorStay Villas</p>
        </div>
      </div>
    </body>
    </html>
    `,
  }

  await transporter.sendMail(mailOptions)
}

export const getUserAddressInfo = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const userEmail = req.user?.email;
    
    console.log("[ADDRESS_INFO] Fetching address for user:", { 
      userId, 
      email: userEmail, 
      userType: req.user?.userType 
    });
    
    if (!userId && !userEmail) {
      console.log("[ADDRESS_INFO] No user identification provided");
      return res.status(401).json({ error: "Authentication required" });
    }
    
    let addressInfo = null;
    let addressSource = null;
    
    // 1. First, check user profile for address info (if regular user)
    if (req.user?.userType !== 'phone') {
      try {
        // Find the user profile
        const userProfile = await UserProfile.findOne({ userId });
        
        if (userProfile && (userProfile.address || userProfile.city)) {
          addressInfo = {
            street: userProfile.address || "",
            country: userProfile.country || "",
            state: userProfile.state || "",
            city: userProfile.city || "",
            zipCode: userProfile.zipCode || ""
          };
          addressSource = "profile";
          console.log("[ADDRESS_INFO] Found address in user profile");
        }
      } catch (err) {
        console.error("[ADDRESS_INFO] Error checking user profile:", err);
        // Continue to check other sources
      }
    }
    
    // 2. Check phone user (if phone user or no address found yet)
    if (!addressInfo) {
      try {
        let phoneUser = null;
        
        // If we have a userId and it's a phone user
        if (userId && req.user?.userType === 'phone') {
          phoneUser = await PhoneUser.findById(userId);
        } 
        // If we have an email and no userId or not explicitly a phone user
        else if (userEmail) {
          phoneUser = await PhoneUser.findOne({ email: userEmail });
        }
        
        if (phoneUser && (phoneUser.address || phoneUser.city)) {
          addressInfo = {
            street: phoneUser.address || "",
            country: phoneUser.country || "",
            state: phoneUser.state || "",
            city: phoneUser.city || "",
            zipCode: phoneUser.zipCode || ""
          };
          addressSource = "phoneUser";
          console.log("[ADDRESS_INFO] Found address in phone user profile");
        }
      } catch (err) {
        console.error("[ADDRESS_INFO] Error checking phone user:", err);
        // Continue to check bookings
      }
    }
    
    // 3. If still no address found, check previous bookings
    if (!addressInfo) {
      try {
        // Build query to find bookings by this user
        let query = {};
        
        if (userId) {
          query.userId = userId;
        } else if (userEmail) {
          query.email = userEmail;
        }
        
        // Get the most recent booking with address info
        const latestBooking = await Booking.findOne(query)
          .where('address.street').exists(true)
          .where('address.street').ne("")
          .sort({ createdAt: -1 });
        
        if (latestBooking && latestBooking.address && latestBooking.address.street) {
          addressInfo = latestBooking.address;
          addressSource = "booking";
          console.log("[ADDRESS_INFO] Found address in previous booking");
        }
      } catch (err) {
        console.error("[ADDRESS_INFO] Error checking previous bookings:", err);
      }
    }
    
    if (!addressInfo) {
      console.log("[ADDRESS_INFO] No address information found for user");
      return res.json({ 
        success: false,
        message: "No address information found" 
      });
    }
    
    return res.json({
      success: true,
      addressInfo,
      source: addressSource
    });
    
  } catch (err) {
    console.error("[ADDRESS_INFO] Error fetching user address:", err);
    return res.status(500).json({
      error: "Server error",
      message: err.message
    });
  }
};

export const getBookingById = async (req, res) => {
  try {
    const { id } = req.params
    console.log("[BOOKING] Fetching booking by ID:", id)

    if (!id) {
      return res.status(400).json({ error: "Booking ID is required" })
    }

    const booking = await Booking.findById(id)
    if (!booking) {
      console.error("[BOOKING] Booking not found:", id)
      return res.status(404).json({ error: "Booking not found" })
    }

    // Check authorization
    const userId = req.user?.userId
    const userEmail = req.user?.email
    const isAdmin = req.user?.role === "admin"

    const isOwnerByUserId = booking.userId && booking.userId.toString() === userId
    const isOwnerByEmail = booking.email === userEmail

    if (!isAdmin && !isOwnerByUserId && !isOwnerByEmail) {
      console.warn("[BOOKING] Unauthorized access attempt:", {
        bookingEmail: booking.email,
        userEmail: userEmail,
        userId: userId,
      })
      return res.status(403).json({
        error: "Unauthorized",
        details: "You do not have permission to view this booking",
      })
    }

    console.log("[BOOKING] Successfully retrieved booking:", booking._id)
    res.json(booking)
  } catch (err) {
    console.error("[BOOKING] Error fetching booking by ID:", err)
    res.status(500).json({ error: err.message })
  }
}

export const checkAvailability = async (req, res) => {
  try {
    const { villaId, checkIn, checkOut } = req.query

    if (!villaId) {
      return res.status(400).json({
        success: false,
        message: "villaId is required",
      })
    }

    const overlappingBookings = await Booking.find({
      villaId: villaId,
      status: { $ne: "cancelled" },
      $or: [
        {
          checkIn: { $lte: new Date(checkOut || "2999-12-31") },
          checkOut: { $gte: new Date(checkIn || "1900-01-01") },
        },
      ],
    })

    return res.status(200).json({
      success: true,
      blockedDates: overlappingBookings.map((b) => ({
        checkIn: b.checkIn,
        checkOut: b.checkOut,
      })),
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

export const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find().populate("villaId").populate("userId")
    res.json(bookings)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// Get blocked dates for a specific villa
export const getBlockedDates = async (req, res) => {
  try {
    const { villaId } = req.params

    const bookings = await Booking.find({
      villaId,
      status: { $in: ["confirmed", "pending"] }, // Only block if not cancelled
    }).select("checkIn checkOut -_id") // only need dates

    // Convert to an array of date ranges
    const blockedDates = bookings.map((booking) => ({
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
    }))

    res.status(200).json({ blockedDates })
  } catch (err) {
    res.status(500).json({ message: "Error fetching blocked dates", error: err.message })
  }
}

// Get booking guest details by email
export const getBookingGuestDetails = async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email parameter is required"
      });
    }

    console.log(`[BOOKING_GUEST] Fetching guest details for email: ${email}`);

    // Find phone user data
    let phoneUserData = null;
    try {
      phoneUserData = await PhoneUser.findOne({ email });
      console.log(`[BOOKING_GUEST] Phone user data found: ${!!phoneUserData}`);
    } catch (err) {
      console.error("[BOOKING_GUEST] Error fetching phone user data:", err);
    }

    // Find address from latest booking
    let bookingAddress = null;
    try {
      const latestBooking = await Booking.findOne({ email })
        .where('address.street').exists(true)
        .where('address.street').ne("")
        .sort({ createdAt: -1 });
      
      if (latestBooking && latestBooking.address) {
        bookingAddress = latestBooking.address;
        console.log(`[BOOKING_GUEST] Address found from booking: ${latestBooking._id}`);
      }
    } catch (err) {
      console.error("[BOOKING_GUEST] Error fetching booking address:", err);
    }

    // Find user profile data as fallback
    let userProfileData = null;
    try {
      // If email is provided by a regular user, find their profile
      const user = await User.findOne({ email });
      if (user) {
        userProfileData = await UserProfile.findOne({ userId: user._id });
        console.log(`[BOOKING_GUEST] User profile data found: ${!!userProfileData}`);
      }
    } catch (err) {
      console.error("[BOOKING_GUEST] Error fetching user profile data:", err);
    }

    // Combine data with priority
    const guestDetails = {
      // Contact information - prioritize phone user data
      name: phoneUserData?.name || userProfileData?.name || "",
      email: email,
      phone: phoneUserData?.phoneNumber || userProfileData?.phone || "",
      countryCode: phoneUserData?.countryCode || userProfileData?.countryCode || "+91",
      profileImage: phoneUserData?.profileImage || userProfileData?.profileImage || "",

      // Address information - prioritize booking address
      address: {
        street: bookingAddress?.street || userProfileData?.address || phoneUserData?.address || "",
        city: bookingAddress?.city || userProfileData?.city || phoneUserData?.city || "",
        state: bookingAddress?.state || userProfileData?.state || phoneUserData?.state || "",
        country: bookingAddress?.country || userProfileData?.country || phoneUserData?.country || "",
        zipCode: bookingAddress?.zipCode || userProfileData?.zipCode || phoneUserData?.zipCode || "",
      }
    };

    // Sources for auditing/debugging
    const dataSources = {
      hasPhoneUserData: !!phoneUserData,
      hasBookingAddress: !!bookingAddress,
      hasUserProfileData: !!userProfileData
    };

    return res.status(200).json({
      success: true,
      guestDetails,
      dataSources
    });
  } catch (err) {
    console.error("[BOOKING_GUEST] Error:", err);
    return res.status(500).json({
      success: false,
      message: "Error fetching guest details",
      error: err.message
    });
  }
};


