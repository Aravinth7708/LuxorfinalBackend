import CancelRequest from '../../models/admin/CancelRequest.js';
import Booking from '../../models/Booking.js';
import User from '../../models/User.js';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';


dotenv.config();


const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.gmail, // Using your existing env variable
    pass: process.env.pass   // Using your existing env variable
  },
  tls: {
    rejectUnauthorized: false 
  }
});


transporter.verify(function (error, success) {
  if (error) {
    console.error("Email configuration error:", error);
  } else {
    console.log("Email server is ready to send messages");
  }
});


const sendEmail = async (options) => {
  try {
    const info = await transporter.sendMail({
      from: `"Luxor Holiday Home Stays" <${process.env.gmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html
    });
    console.log(`[EMAIL] Email sent: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[EMAIL] Error sending email to ${options.to}:`, error);
    return { success: false, error };
  }
};


export const submitCancelRequest = async (req, res) => {
  try {
    const { bookingId, reason } = req.body;
    const userId = req.user?.userId;
    const userEmail = req.user?.email;

    console.log("[CANCEL REQUEST] New request:", {
      bookingId: bookingId,
      userId: userId,
      userEmail: userEmail,
      reason: reason
    });

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        error: "Booking ID is required"
      });
    }

    // Find the booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      console.error("[CANCEL REQUEST] Booking not found:", bookingId);
      return res.status(404).json({
        success: false,
        error: "Booking not found"
      });
    }

    console.log("[CANCEL REQUEST] Found booking:", {
      bookingId: booking._id,
      bookingUserId: booking.userId,
      bookingEmail: booking.email,
      currentStatus: booking.status
    });

    // Check if booking is already cancelled
    if (booking.status === "cancelled") {
      return res.status(400).json({
        success: false,
        error: "Booking is already cancelled"
      });
    }

    // Check if there's already a pending cancel request for this booking
    const existingRequest = await CancelRequest.findOne({ 
      bookingId: bookingId, 
      status: 'pending' 
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        error: "A cancellation request for this booking is already pending"
      });
    }

    // Authorization check - user can cancel if:
    // 1. They are the booking owner (by userId OR email)
    // 2. They are an admin
    const isOwnerByUserId = booking.userId && booking.userId.toString() === userId;
    const isOwnerByEmail = booking.email === userEmail;
    const isAdmin = req.user.role === "admin";

    if (!isOwnerByUserId && !isOwnerByEmail && !isAdmin) {
      console.error("[CANCEL REQUEST] Unauthorized cancellation attempt:", {
        bookingUserId: booking.userId,
        bookingEmail: booking.email,
        requestUserId: userId,
        requestUserEmail: userEmail,
        isAdmin: isAdmin
      });
      
      return res.status(403).json({
        success: false,
        error: "You are not authorized to cancel this booking"
      });
    }

    // Calculate refund amount based on cancellation policy
    let refundPercentage = 0;
    const checkInDate = new Date(booking.checkIn);
    const now = new Date();
    const daysUntilCheckIn = Math.ceil((checkInDate - now) / (1000 * 60 * 60 * 24));

    if (daysUntilCheckIn > 30) {
      refundPercentage = 75;
    } else if (daysUntilCheckIn > 15) {
      refundPercentage = 50;
    } else {
      refundPercentage = 0;
    }

    const refundAmount = Math.round((booking.totalAmount * refundPercentage) / 100);

    // Create cancel request
    const cancelRequest = await CancelRequest.create({
      bookingId: bookingId,
      userId: userId,
      userEmail: userEmail || booking.email,
      reason: reason || "User initiated cancellation",
      villaName: booking.villaName,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      status: 'pending',
      refundAmount: refundAmount,
      refundPercentage: refundPercentage
    });

    // Send notification email to admin
    try {
      const adminEmail = process.env.ADMIN_EMAIL || process.env.gmail || 'luxorholidayhomestays@gmail.com';
      
      await sendEmail({
        to: adminEmail,
        subject: 'New Booking Cancellation Request',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e4; border-radius: 5px;">
            <h2 style="color: #D4AF37; text-align: center;">New Cancellation Request Received</h2>
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p style="margin: 5px 0;"><strong>Booking ID:</strong> ${booking._id}</p>
              <p style="margin: 5px 0;"><strong>Villa:</strong> ${booking.villaName}</p>
              <p style="margin: 5px 0;"><strong>Guest:</strong> ${booking.guestName || 'Not specified'}</p>
              <p style="margin: 5px 0;"><strong>Email:</strong> ${userEmail || booking.email}</p>
              <p style="margin: 5px 0;"><strong>Check-in Date:</strong> ${new Date(booking.checkIn).toLocaleDateString()}</p>
              <p style="margin: 5px 0;"><strong>Cancellation Reason:</strong> ${reason || "No reason provided"}</p>
              <p style="margin: 5px 0;"><strong>Potential Refund:</strong> ₹${refundAmount} (${refundPercentage}%)</p>
            </div>
            <p style="text-align: center;">
              <a href="${process.env.ADMIN_URL || 'https://www.luxorholidayhomestays.com'}/cancel-requests" 
                style="background-color: #D4AF37; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                View in Admin Panel
              </a>
            </p>
          </div>
        `
      });

      console.log("[CANCEL REQUEST] Notification email sent to admin");
    } catch (emailErr) {
      console.error("[CANCEL REQUEST] Error sending admin notification:", emailErr);
    }

    res.status(201).json({
      success: true,
      message: "Cancellation request submitted successfully. Please wait for admin approval.",
      cancelRequest: {
        id: cancelRequest._id,
        status: cancelRequest.status,
        refundAmount: cancelRequest.refundAmount,
        refundPercentage: cancelRequest.refundPercentage
      }
    });

  } catch (err) {
    console.error("[CANCEL REQUEST] Error in submitCancelRequest:", err);
    res.status(500).json({
      success: false,
      error: "Failed to submit cancellation request",
      message: err.message
    });
  }
};

// Get all cancel requests (admin only)
export const getAllCancelRequests = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: "Unauthorized. Admin access required."
      });
    }

    // Get query parameters for filtering
    const { status } = req.query;
    
    // Build filter object
    const filter = {};
    if (status) {
      filter.status = status;
    }

    // Get cancel requests with populated booking details
    const requests = await CancelRequest.find(filter)
      .sort({ createdAt: -1 }) // Most recent first
      .populate('bookingId', 'villaName checkIn checkOut guests totalAmount status')
      .populate('userId', 'name email');

    res.json({
      success: true,
      count: requests.length,
      requests
    });

  } catch (error) {
    console.error("[CANCEL REQUEST] Error getting cancel requests:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch cancellation requests"
    });
  }
};

// Get cancel request by ID
export const getCancelRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const request = await CancelRequest.findById(id)
      .populate('bookingId')
      .populate('userId', 'name email');

    if (!request) {
      return res.status(404).json({
        success: false,
        error: "Cancellation request not found"
      });
    }

    // If not admin, check if the request belongs to the user
    if (req.user.role !== 'admin') {
      const userEmail = req.user.email;
      const userId = req.user.userId;
      
      if (request.userEmail !== userEmail && (!request.userId || request.userId.toString() !== userId)) {
        return res.status(403).json({
          success: false,
          error: "Unauthorized access to this cancellation request"
        });
      }
    }

    res.json({
      success: true,
      request
    });

  } catch (error) {
    console.error("[CANCEL REQUEST] Error getting cancel request:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch cancellation request"
    });
  }
};

// Process a cancel request (admin only)
export const processCancelRequest = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: "Unauthorized. Admin access required."
      });
    }

    const { id } = req.params;
    const { status, adminResponse } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Status must be either 'approved' or 'rejected'"
      });
    }

    // Find the cancel request
    const cancelRequest = await CancelRequest.findById(id);
    if (!cancelRequest) {
      return res.status(404).json({
        success: false,
        error: "Cancellation request not found"
      });
    }

    if (cancelRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `This request has already been ${cancelRequest.status}`
      });
    }

    // Update the cancel request
    cancelRequest.status = status;
    cancelRequest.adminResponse = adminResponse || '';
    cancelRequest.adminActionDate = new Date();
    await cancelRequest.save();

    // Find the booking
    const booking = await Booking.findById(cancelRequest.bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: "Associated booking not found"
      });
    }

    // If approved, update booking status
    if (status === 'approved') {
      // Update booking status
      booking.status = "cancelled";
      booking.cancelReason = cancelRequest.reason;
      booking.cancelledAt = new Date();
      booking.refundAmount = cancelRequest.refundAmount;
      booking.refundPercentage = cancelRequest.refundPercentage;

      // Add to cancellation history
      if (!booking.cancellationHistory) {
        booking.cancellationHistory = [];
      }

      booking.cancellationHistory.push({
        cancelledAt: new Date(),
        reason: cancelRequest.reason,
        refundAmount: cancelRequest.refundAmount,
        refundPercentage: cancelRequest.refundPercentage,
        cancelledBy: req.user.name || req.user.email || "admin"
      });

      await booking.save();
    }

    // Send email notification to user
    try {
      const emailSubject = status === 'approved' 
        ? 'Your Booking Cancellation Request Has Been Approved' 
        : 'Your Booking Cancellation Request Has Been Declined';

      let emailContent = '';
      
      if (status === 'approved') {
        emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e4; border-radius: 5px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <img src="https://www.luxorholidayhomestays.com/logo.png" alt="Luxor Holiday Home Stays" style="max-width: 200px;">
            </div>
            
            <h2 style="color: #D4AF37; text-align: center;">Booking Cancellation Approved</h2>
            
            <p>Dear Guest,</p>
            
            <p>Your request to cancel booking <strong>#${booking._id}</strong> for <strong>${booking.villaName}</strong> has been approved.</p>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p style="margin: 5px 0;"><strong>Check-in Date:</strong> ${new Date(booking.checkIn).toLocaleDateString()}</p>
              <p style="margin: 5px 0;"><strong>Check-out Date:</strong> ${new Date(booking.checkOut).toLocaleDateString()}</p>
              <p style="margin: 5px 0;"><strong>Villa:</strong> ${booking.villaName}</p>
              <p style="margin: 5px 0;"><strong>Booking ID:</strong> ${booking._id}</p>
              <p style="margin: 5px 0;"><strong>Original Amount:</strong> ₹${booking.totalAmount.toLocaleString()}</p>
            </div>
            
            <div style="background-color: #EDF7ED; border-left: 4px solid #4CAF50; padding: 15px; margin: 15px 0;">
              <h3 style="color: #4CAF50; margin-top: 0;">Refund Details</h3>
              <p style="margin: 5px 0;"><strong>Refund Amount:</strong> ₹${cancelRequest.refundAmount.toLocaleString()}</p>
              <p style="margin: 5px 0;"><strong>Refund Percentage:</strong> ${cancelRequest.refundPercentage}% of original payment</p>
              <p style="margin: 5px 0;">The refund will be processed to your original payment method and may take 5-7 business days to reflect in your account.</p>
            </div>
            
            ${adminResponse ? `
            <div style="background-color: #FFF8E1; border-left: 4px solid #FFC107; padding: 15px; margin: 15px 0;">
              <h3 style="color: #FFA000; margin-top: 0;">Note from Luxor</h3>
              <p style="font-style: italic;">${adminResponse}</p>
            </div>
            ` : ''}
            
            <p>Thank you for choosing Luxor Holiday Home Stays. We hope to serve you again in the future.</p>
            
            <p style="margin-top: 20px;">Warm regards,<br>The Luxor Team</p>
            
            <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e4e4e4; text-align: center; color: #888; font-size: 12px;">
              <p>© ${new Date().getFullYear()} Luxor Holiday Home Stays. All rights reserved.</p>
              <p>
                <a href="https://www.luxorholidayhomestays.com/contact" style="color: #D4AF37; text-decoration: none; margin: 0 10px;">Contact Us</a> | 
                <a href="https://www.luxorholidayhomestays.com/privacy" style="color: #D4AF37; text-decoration: none; margin: 0 10px;">Privacy Policy</a>
              </p>
            </div>
          </div>
        `;
      } else {
        emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e4; border-radius: 5px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <img src="https://www.luxorholidayhomestays.com/logo.png" alt="Luxor Holiday Home Stays" style="max-width: 200px;">
            </div>
            
            <h2 style="color: #D4AF37; text-align: center;">Booking Cancellation Request Declined</h2>
            
            <p>Dear Guest,</p>
            
            <p>Your request to cancel booking <strong>#${booking._id}</strong> for <strong>${booking.villaName}</strong> could not be approved at this time.</p>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p style="margin: 5px 0;"><strong>Check-in Date:</strong> ${new Date(booking.checkIn).toLocaleDateString()}</p>
              <p style="margin: 5px 0;"><strong>Check-out Date:</strong> ${new Date(booking.checkOut).toLocaleDateString()}</p>
              <p style="margin: 5px 0;"><strong>Villa:</strong> ${booking.villaName}</p>
              <p style="margin: 5px 0;"><strong>Booking ID:</strong> ${booking._id}</p>
            </div>
            
            ${adminResponse ? `
            <div style="background-color: #FEEBEF; border-left: 4px solid #F44336; padding: 15px; margin: 15px 0;">
              <h3 style="color: #D32F2F; margin-top: 0;">Reason for Decline</h3>
              <p style="font-style: italic;">${adminResponse}</p>
            </div>
            ` : `
            <div style="background-color: #FEEBEF; border-left: 4px solid #F44336; padding: 15px; margin: 15px 0;">
              <h3 style="color: #D32F2F; margin-top: 0;">Cancellation Policy</h3>
              <p>This could be due to our cancellation policy or specific terms related to your booking.</p>
            </div>
            `}
            
            <p>Your booking remains active and we look forward to welcoming you. If you would like to discuss this further, please contact our customer service team at <strong>+91 7904040739</strong>.</p>
            
            <p style="margin-top: 20px;">Warm regards,<br>The Luxor Team</p>
            
            <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e4e4e4; text-align: center; color: #888; font-size: 12px;">
              <p>© ${new Date().getFullYear()} Luxor Holiday Home Stays. All rights reserved.</p>
              <p>
                <a href="https://www.luxorholidayhomestays.com/contact" style="color: #D4AF37; text-decoration: none; margin: 0 10px;">Contact Us</a> | 
                <a href="https://www.luxorholidayhomestays.com/privacy" style="color: #D4AF37; text-decoration: none; margin: 0 10px;">Privacy Policy</a>
              </p>
            </div>
          </div>
        `;
      }

      // Make sure we have a valid email to send to
      const userEmail = cancelRequest.userEmail || booking.email;
      if (!userEmail) {
        throw new Error("No email address available for this user");
      }

      // Send the email using our helper function
      const emailResult = await sendEmail({
        to: userEmail,
        subject: emailSubject,
        html: emailContent
      });

      console.log(`[CANCEL REQUEST] Email notification sent to user: ${userEmail}`, emailResult);
      
      // If approved, also send a separate confirmation of refund
      if (status === 'approved' && cancelRequest.refundAmount > 0) {
        await sendEmail({
          to: userEmail,
          subject: 'Your Refund Information',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e4; border-radius: 5px;">
              <div style="text-align: center; margin-bottom: 20px;">
                <img src="https://www.luxorholidayhomestays.com/logo.png" alt="Luxor Holiday Home Stays" style="max-width: 200px;">
              </div>
              
              <h2 style="color: #D4AF37; text-align: center;">Refund Information</h2>
              
              <p>Dear Guest,</p>
              
              <p>As your booking cancellation has been approved, we want to provide you with information about your refund.</p>
              
              <div style="background-color: #EDF7ED; border-left: 4px solid #4CAF50; padding: 15px; margin: 15px 0">
                <h3 style="color: #4CAF50; margin-top: 0">Refund Details</h3>
                <p style="margin: 5px 0"><strong>Booking ID:</strong> ${booking._id}</p>
                <p style="margin: 5px 0"><strong>Villa:</strong> ${booking.villaName}</p>
                <p style="margin: 5px 0"><strong>Original Amount Paid:</strong> ₹${booking.totalAmount.toLocaleString()}</p>
                <p style="margin: 5px 0"><strong>Refund Amount:</strong> ₹${cancelRequest.refundAmount.toLocaleString()}</p>
                <p style="margin: 5px 0"><strong>Refund Percentage:</strong> ${cancelRequest.refundPercentage}%</p>
              </div>
              
              <p>Please note that refunds typically take 5-7 business days to reflect in your account, depending on your bank or payment provider.</p>
              
              <p>If you have any questions about your refund, please reply to this email or contact our customer service team at <strong>+91 7904040739</strong>.</p>
              
              <p style="margin-top: 20px">Thank you for your understanding,<br>The Luxor Team</p>
              
              <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e4e4e4; text-align: center; color: #888; font-size: 12px;">
                <p>© ${new Date().getFullYear()} Luxor Holiday Home Stays. All rights reserved.</p>
              </div>
            </div>
          `
        });
        
        console.log(`[CANCEL REQUEST] Refund details email sent to user: ${userEmail}`);
      }
      
    } catch (emailErr) {
      console.error("[CANCEL REQUEST] Error sending user notification:", emailErr);
      // We don't want to fail the API call if the email sending fails
      // Just log the error and continue
    }

    res.json({
      success: true,
      message: `Cancellation request ${status}`,
      cancelRequest: {
        id: cancelRequest._id,
        status: cancelRequest.status,
        adminResponse: cancelRequest.adminResponse,
        adminActionDate: cancelRequest.adminActionDate
      }
    });

  } catch (error) {
    console.error("[CANCEL REQUEST] Error processing cancel request:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process cancellation request",
      message: error.message
    });
  }
};

// Get user's cancel requests
export const getUserCancelRequests = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const userEmail = req.user?.email;

    if (!userId && !userEmail) {
      return res.status(401).json({
        success: false,
        error: "Authentication required"
      });
    }

    // Build query to find by userId OR userEmail
    const query = {
      $or: []
    };
    
    if (userId) {
      query.$or.push({ userId });
    }
    
    if (userEmail) {
      query.$or.push({ userEmail });
    }

    const requests = await CancelRequest.find(query)
      .sort({ createdAt: -1 })
      .populate('bookingId', 'villaName checkIn checkOut guests totalAmount status');

    res.json({
      success: true,
      count: requests.length,
      requests
    });

  } catch (error) {
    console.error("[CANCEL REQUEST] Error getting user cancel requests:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch your cancellation requests"
    });
  }
};