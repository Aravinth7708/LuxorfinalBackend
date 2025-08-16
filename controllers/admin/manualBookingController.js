import Booking from '../../models/Booking.js';
import Villa from '../../models/Villa.js';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.gmail,
    pass: process.env.pass
  },
  tls: {
    rejectUnauthorized: false 
  }
});

// Verify email configuration
transporter.verify(function (error, success) {
  if (error) {
    console.error("[MANUAL BOOKING] Email configuration error:", error);
  } else {
    console.log("[MANUAL BOOKING] Email server is ready to send messages");
  }
});

// Send booking confirmation email
const sendBookingConfirmationEmail = async (booking) => {
  try {
    // Create a reference code using part of the ID and a timestamp
    const referenceCode = `${booking._id.toString().substring(booking._id.toString().length - 6).toUpperCase()}-${new Date().getTime().toString().substring(7)}`;
    
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e4; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="https://www.luxorholidayhomestays.com/logo.png" alt="Luxor Holiday Home Stays" style="max-width: 200px;">
        </div>
        
        <h2 style="color: #D4AF37; text-align: center;">Booking Confirmation</h2>
        
        <p>Dear ${booking.guestName},</p>
        
        <p>Thank you for booking with Luxor Holiday Home Stays. We're pleased to confirm your reservation:</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <p style="margin: 5px 0;"><strong>Reference Code:</strong> ${referenceCode}</p>
          <p style="margin: 5px 0;"><strong>Villa:</strong> ${booking.villaName}</p>
          <p style="margin: 5px 0;"><strong>Check-in:</strong> ${new Date(booking.checkIn).toLocaleDateString()} (${booking.checkInTime})</p>
          <p style="margin: 5px 0;"><strong>Check-out:</strong> ${new Date(booking.checkOut).toLocaleDateString()} (${booking.checkOutTime})</p>
          <p style="margin: 5px 0;"><strong>Guests:</strong> ${booking.guests}</p>
          <p style="margin: 5px 0;"><strong>Total Amount:</strong> ₹${booking.totalAmount.toLocaleString()}</p>
          <p style="margin: 5px 0;"><strong>Payment Status:</strong> ${booking.isPaid ? 'Paid' : 'Payment due at check-in'}</p>
        </div>
        
        <p>For security reasons, you can view your complete booking details by visiting our website and logging into your account.</p>
        
        <p style="text-align: center;">
          <a href="${process.env.FRONTEND_URL || 'https://www.luxorholidayhomestays.com'}/booking/${booking._id}" 
            style="background-color: #D4AF37; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View Booking Details
          </a>
        </p>
        
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e4e4e4; font-size: 14px; color: #777;">
          <p>If you have any questions or need assistance, please don't hesitate to contact us:</p>
          <p>Phone: +91 79040 40739</p>
          <p>Email: support@luxorstay.com</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"Luxor Holiday Home Stays" <${process.env.gmail}>`,
      to: booking.email,
      subject: "Your Booking Confirmation - Luxor Holiday Home Stays",
      html: emailContent
    });

    console.log(`[MANUAL BOOKING] Confirmation email sent to ${booking.email}`);
    return { success: true };
  } catch (error) {
    console.error(`[MANUAL BOOKING] Error sending confirmation email:`, error);
    return { success: false, error };
  }
};

// Create a manual booking
export const createManualBooking = async (req, res) => {
  try {
    // Extract booking details from request body
    const bookingData = req.body;
    
    console.log("[MANUAL BOOKING] Creating booking with data:", bookingData);

    // Use the provided system user ID instead of the admin's ID
    const SYSTEM_USER_ID = "686b8a5f29d0d1ac7d4b6492";
    bookingData.userId = SYSTEM_USER_ID;
    
    console.log("[MANUAL BOOKING] Using system userId:", SYSTEM_USER_ID);

    // Create the booking
    const booking = await Booking.create(bookingData);
    
    console.log("[MANUAL BOOKING] Successfully created booking with ID:", booking._id);

    // Try to send a confirmation email
    let emailSent = false;
    try {
      // Email configuration for booking confirmation
      const mailOptions = {
        from: `"Luxor Holiday Homestays" <${process.env.gmail}>`,
        to: booking.email,
        subject: `Booking Confirmation - ${booking.villaName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Booking Confirmation</h2>
            <p>Dear ${booking.guestName},</p>
            <p>Thank you for your booking with Luxor Holiday Homestays.</p>
            <h3>Booking Details:</h3>
            <ul>
              <li><strong>Booking ID:</strong> ${booking._id}</li>
              <li><strong>Villa:</strong> ${booking.villaName}</li>
              <li><strong>Check-in:</strong> ${new Date(booking.checkIn).toLocaleDateString()} (${booking.checkInTime})</li>
              <li><strong>Check-out:</strong> ${new Date(booking.checkOut).toLocaleDateString()} (${booking.checkOutTime})</li>
              <li><strong>Guests:</strong> ${booking.guests}</li>
              <li><strong>Total Amount:</strong> ₹${booking.totalAmount.toLocaleString()}</li>
              <li><strong>Payment Status:</strong> ${booking.isPaid ? 'Paid' : 'Not Paid'}</li>
            </ul>
            <p>If you have any questions, please contact us.</p>
            <p>We look forward to hosting you!</p>
            <p>Regards,<br>Luxor Holiday Homestays Team</p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      emailSent = true;
      console.log("[MANUAL BOOKING] Confirmation email sent to", booking.email);
    } catch (emailError) {
      console.error("[MANUAL BOOKING] Error sending confirmation email:", emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Manual booking created successfully',
      booking,
      emailSent
    });
  } catch (error) {
    console.error("[MANUAL BOOKING] Error creating booking:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create booking",
      message: error.message
    });
  }
};

// Get all manual bookings
export const getAllManualBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100); // Limit to most recent 100 bookings
    
    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings
    });
  } catch (error) {
    console.error("[MANUAL BOOKING] Error fetching bookings:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch bookings",
      message: error.message
    });
  }
};

// Check villa availability for a given date range
export const checkVillaAvailability = async (req, res) => {
  try {
    const { villaId, checkIn, checkOut } = req.query;

    console.log("[MANUAL BOOKING] Checking availability for villa:", villaId, "from", checkIn, "to", checkOut);

    if (!villaId || !checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        error: "Villa ID, check-in and check-out dates are required"
      });
    }

    // Validate that villaId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(villaId)) {
      console.error("[MANUAL BOOKING] Invalid villaId format:", villaId);
      return res.status(400).json({
        success: false,
        message: "Invalid villa ID format"
      });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    // Validate dates
    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: "Invalid date format"
      });
    }

    // Find overlapping bookings
    const overlappingBookings = await Booking.find({
      villaId,
      status: { $ne: "cancelled" },
      $or: [
        {
          checkIn: { $lt: checkOutDate },
          checkOut: { $gt: checkInDate }
        }
      ]
    }).select('checkIn checkOut _id');

    console.log(`[MANUAL BOOKING] Found ${overlappingBookings.length} overlapping bookings for villa ${villaId}`);

    res.status(200).json({
      success: true,
      isAvailable: overlappingBookings.length === 0,
      overlappingBookings: overlappingBookings.map(booking => ({
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        bookingId: booking._id.toString()
      }))
    });
  } catch (error) {
    console.error("[MANUAL BOOKING] Error checking availability:", error);
    res.status(500).json({
      success: false,
      error: "Failed to check availability",
      message: error.message
    });
  }
};

// Get blocked dates for a villa
export const getVillaBlockedDates = async (req, res) => {
  try {
    const { villaId } = req.query;
    
    console.log("[MANUAL BOOKING] Getting blocked dates for villa:", villaId);

    if (!villaId) {
      return res.status(400).json({
        success: false,
        message: "villaId parameter is required"
      });
    }

    // Validate that villaId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(villaId)) {
      console.error("[MANUAL BOOKING] Invalid villaId format:", villaId);
      return res.status(400).json({
        success: false,
        message: "Invalid villa ID format"
      });
    }

    // Find villa to verify it exists
    const villa = await Villa.findById(villaId);
    if (!villa) {
      return res.status(404).json({
        success: false,
        message: "Villa not found"
      });
    }
    
    console.log("[MANUAL BOOKING] Found villa:", villa.name);

    // First, expire any bookings that have passed their checkout date
    await Booking.expireBookings();

    // Find all confirmed bookings for this villa (exclude cancelled and expired)
    const bookings = await Booking.find({
      villaId,
      status: { $in: ["confirmed", "pending"] }
    }).select('checkIn checkOut _id');

    console.log(`[MANUAL BOOKING] Found ${bookings.length} bookings for villa ${villaId}`);

    // Format the blocked dates for response
    const blockedDates = bookings.map(booking => ({
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      bookingId: booking._id.toString()
    }));

    return res.status(200).json({
      success: true,
      villaName: villa.name,
      blockedDates
    });
  } catch (error) {
    console.error("[MANUAL BOOKING] Error fetching blocked dates:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching blocked dates",
      error: error.message
    });
  }
};