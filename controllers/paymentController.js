import crypto from 'crypto';
import { createRequire } from 'module';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Villa from '../models/Villa.js';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const require = createRequire(import.meta.url);
const Razorpay = require('razorpay');

// Update the Razorpay initialization to use the correct environment variable names
const razorpay = new Razorpay({
  key_id: process.env.RAZORpAY_KEY_ID,     // Match the case from .env
  key_secret: process.env.RAZORPAY_SECRET  // Make sure this matches .env
});

// Add console logs to verify keys are loaded
console.log("Razorpay initialized with key:", process.env.RAZORpAY_KEY_ID ? "[key exists]" : "[key missing]");

const router = require('express').Router();
export const createOrder = async (req, res) => {
  try {
    console.log("[PAYMENT] Creating new order:", req.body);
    
    const {
      amount,
      currency = 'INR',
      villaName,
      villaId,
      guestName,
      email,
      checkIn,
      checkOut,
      checkInTime,
      checkOutTime,
      guests,
      infants,
      totalDays,
      totalNights,
      originalCalculatedAmount // For storing the real booking amount
    } = req.body;

    // Validate required fields
    if (!amount || !villaId || !checkIn || !checkOut || !guestName) {
      console.error("[PAYMENT] Missing required fields:", req.body);
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields for payment' 
      });
    }
    
    // Convert amount to number and validate
    const numericAmount = Number(amount);
    console.log("[PAYMENT] Amount validation:", { 
      originalAmount: amount, 
      numericAmount: numericAmount,
      isValid: !isNaN(numericAmount) && numericAmount > 0
    });

    // Check if amount is a valid number and reasonable
    if (isNaN(numericAmount) || numericAmount <= 0) {
      console.error("[PAYMENT] Invalid amount:", amount);
      return res.status(400).json({
        success: false,
        message: 'Invalid payment amount'
      });
    }

    // Additional validation for amount range
    if (numericAmount < 1) { // Minimum ₹100
      console.error("[PAYMENT] Amount too small:", numericAmount);
      return res.status(400).json({
        success: false,
        message: 'Payment amount is too small (minimum ₹100)'
      });
    }

    if (numericAmount > 1000000) { // Maximum ₹10 lakh
      console.error("[PAYMENT] Amount too large:", numericAmount);
      return res.status(400).json({
        success: false,
        message: 'Payment amount is too large (maximum ₹10,00,000)'
      });
    }

    // Check villa availability for the selected dates
    const overlappingBookings = await Booking.find({
      villaId: villaId,
      status: { $ne: 'cancelled' }, // Exclude cancelled bookings
      $or: [
        // Check for date range overlaps
        {
          checkIn: { $lte: new Date(checkOut) },
          checkOut: { $gte: new Date(checkIn) }
        }
      ]
    });

    if (overlappingBookings.length > 0) {
      console.error("[PAYMENT] Villa not available for selected dates:", {
        villaId,
        checkIn,
        checkOut,
        overlappingBookingsCount: overlappingBookings.length
      });
      
      return res.status(409).json({
        success: false,
        message: 'Villa is already booked for the selected dates',
        conflictingDates: overlappingBookings.map(booking => ({
          checkIn: booking.checkIn,
          checkOut: booking.checkOut
        }))
      });
    }

    // Check if villa exists
    const villa = await Villa.findById(villaId);
    if (!villa) {
      console.error("[PAYMENT] Villa not found:", villaId);
      return res.status(404).json({
        success: false,
        message: 'Villa not found'
      });
    }

    // Create unique receipt ID
    const receiptId = `luxorstay_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Use the actual amount for orders (not test amount)
    const orderAmount = Math.round(numericAmount * 100); // Convert to paise for Razorpay
    
    console.log("[PAYMENT] Creating order with amount:", {
      originalAmount: numericAmount,
      razorpayAmount: orderAmount,
      currency: currency
    });
    
    // Create order in Razorpay
    const order = await razorpay.orders.create({
      amount: orderAmount, // Actual amount in paise
      currency,
      receipt: receiptId,
      notes: {
        villaName,
        villaId,
        guestName,
        email,
        checkIn,
        checkOut,
        checkInTime,
        checkOutTime,
        guests,
        userId: req.user?.id || req.user?.userId,
        actualAmount: numericAmount // Store original amount for reference
      }
    });
    
    console.log(`[PAYMENT] Created order for ₹${numericAmount} (${orderAmount} paise)`);

    console.log("[PAYMENT] Order created successfully:", order.id);

    // Return order details to client
    res.status(200).json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status
      }
    });
  } catch (error) {
    console.error('[PAYMENT] Create order error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create payment order',
      error: process.env.NODE_ENV === 'production' ? 'Payment processing error' : error.message
    });
  }
};

// Verify Razorpay payment and create booking
export const verifyPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    console.log("[PAYMENT] Verification request received:", req.body);
    
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      bookingId 
    } = req.body;
    
    if ((!razorpay_order_id && !bookingId) || !razorpay_payment_id || !razorpay_signature) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: 'Missing required payment verification data'
      });
    }

    // Verify the payment signature
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_SECRET)
      .update(`${razorpay_order_id || ''}|${razorpay_payment_id}`)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      console.error("[PAYMENT] Invalid signature:", {
        expected: generated_signature,
        received: razorpay_signature
      });
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature'
      });
    }

    // Find the booking - try multiple ways
    let booking = null;
    let query = {};
    
    // First try with direct bookingId if provided
    if (bookingId && mongoose.Types.ObjectId.isValid(bookingId)) {
      query = { _id: bookingId };
    } else if (razorpay_order_id) {
      // Fallback to orderId if bookingId is not present
      query = { orderId: razorpay_order_id };
    }

    if (Object.keys(query).length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: 'Cannot find booking without a valid bookingId or orderId'
      });
    }

    booking = await Booking.findOne(query).session(session);

    if (!booking) {
      console.error('[PAYMENT] Booking not found with query:', query);
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // Update booking with payment details
    booking.paymentId = razorpay_payment_id;
    booking.orderId = razorpay_order_id;
    booking.isPaid = true;
    booking.status = 'confirmed';
    booking.paymentStatus = 'paid';
    booking.paymentDate = new Date();
    
    // Save the updated booking with the session
    const updatedBooking = await booking.save({ session });
    
    if (!updatedBooking) {
      throw new Error('Failed to update booking with payment details');
    }
    
    console.log('[PAYMENT] Updated booking with payment details:', {
      bookingId: updatedBooking._id,
      paymentId: updatedBooking.paymentId,
      orderId: updatedBooking.orderId,
      status: updatedBooking.status
    });

    // Fetch the associated villa to pass to the confirmation email
    const villa = await Villa.findById(booking.villaId).session(session);
    if (!villa) {
      // Even if the villa isn't found, the booking is still successful.
      // Log the error but don't fail the transaction.
      console.error(`[PAYMENT] Villa with ID ${booking.villaId} not found for booking ${booking._id}`);
    } else {
      // Send confirmation email
      try {
        await sendBookingConfirmation(booking, villa);
        console.log(`[PAYMENT] Confirmation email sent for booking ${booking._id}`);
      } catch (emailError) {
        console.error(`[PAYMENT] Failed to send confirmation email for booking ${booking._id}:`, emailError);
        // Do not abort the transaction if the email fails
      }
    }

    await session.commitTransaction();
    session.endSession();

    console.log(`[PAYMENT] Successfully verified payment and updated booking ${booking._id}`);

    res.status(200).json({
      success: true,
      message: 'Payment verified and booking confirmed',
      bookingId: booking._id
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('[PAYMENT] Verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Payment verification failed',
      details: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
};

// Get directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper function to send booking confirmation email with PDF attachment
async function sendBookingConfirmation(booking) {
  try {
    // Get villa details
    const villa = await Villa.findById(booking.villaId);
    if (!villa) {
      throw new Error('Villa not found');
    }

    // Format dates
    const checkInDate = new Date(booking.checkIn);
    const checkOutDate = new Date(booking.checkOut);
    const formattedCheckIn = checkInDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const formattedCheckOut = checkOutDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    // Create booking number (use first 6 chars of ID)
    const bookingNumber = String(booking._id).substring(0, 6).toUpperCase();
    
    // Setup email transport
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.gmail,
        pass: process.env.pass
      }
    });

    // Create email content
    const mailOptions = {
      from: process.env.gmail,
      to: booking.email,
      subject: `Booking Confirmation #${bookingNumber} - ${villa.name}`,
      html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Confirmation</title>
        <style>
          body {
            font-family: 'Poppins', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
          }
          
          .container {
            max-width: 650px;
            margin: 20px auto;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
          }
          
          .header {
            background-color: #16a34a;
            color: white;
            padding: 25px 30px;
            text-align: center;
          }
          
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
          }
          
          .booking-details {
            padding: 25px 30px;
            border-bottom: 1px solid #eaeaea;
          }
          
          .booking-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
          }
          
          .booking-label {
            font-weight: 500;
            color: #666;
          }
          
          .booking-value {
            font-weight: 600;
            color: #333;
            text-align: right;
          }
          
          .booking-id {
            background-color: #f2f7ff;
            padding: 12px;
            border-radius: 6px;
            text-align: center;
            margin-bottom: 20px;
          }
          
          .price-breakdown {
            background-color: #f9f9f9;
            padding: 20px 30px;
            border-bottom: 1px solid #eaeaea;
          }
          
          .price-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
          }
          
          .price-total {
            font-size: 18px;
            font-weight: 700;
            color: #16a34a;
            border-top: 2px solid #eaeaea;
            padding-top: 10px;
            margin-top: 10px;
          }
          
          .footer {
            background-color: #f2f7ff;
            padding: 20px 30px;
            text-align: center;
            font-size: 14px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Booking Confirmation</h1>
            <p>Payment Successful! Your villa is booked.</p>
          </div>
          
          <div class="booking-details">
            <div class="booking-id">
              <span style="font-weight: 700; color: #16a34a; font-size: 18px;">Booking #${bookingNumber}</span>
            </div>
            
            <h2 style="margin-bottom: 20px; color: #16a34a;">${villa.name}</h2>
            
            <div class="booking-row">
              <div class="booking-label">Check-in</div>
              <div class="booking-value">${formattedCheckIn} ${formatTimeFor12Hour(booking.checkInTime)}</div>
            </div>
            
            <div class="booking-row">
              <div class="booking-label">Check-out</div>
              <div class="booking-value">${formattedCheckOut} ${formatTimeFor12Hour(booking.checkOutTime)}</div>
            </div>
            
            <div class="booking-row">
              <div class="booking-label">Guests</div>
              <div class="booking-value">${booking.guests} guests${booking.infants > 0 ? `, ${booking.infants} infants` : ''}</div>
            </div>
            
            <div class="booking-row">
              <div class="booking-label">Location</div>
              <div class="booking-value">${villa.location || 'Luxury Location'}</div>
            </div>
            
            <div class="booking-row">
              <div class="booking-label">Status</div>
              <div class="booking-value" style="color: #16a34a; font-weight: 700;">Confirmed & Paid</div>
            </div>
            
            <div class="booking-row">
              <div class="booking-label">Booked By</div>
              <div class="booking-value">${booking.guestName}</div>
            </div>
            
            <div class="booking-row">
              <div class="booking-label">Payment ID</div>
              <div class="booking-value">${booking.paymentId}</div>
            </div>
          </div>
          
          <div class="price-breakdown">
            <h3 style="margin-top: 0;">Price Details</h3>
            
            <div class="price-row">
              <div class="booking-label">Villa Price</div>
              <div class="booking-value">₹${Math.round(booking.totalAmount * 0.8).toLocaleString()}</div>
            </div>
            
            <div class="price-row">
              <div class="booking-label">Taxes & Fees</div>
              <div class="booking-value">₹${Math.round(booking.totalAmount * 0.2).toLocaleString()}</div>
            </div>
            
            <div class="price-row price-total">
              <div class="booking-label">Total Amount Paid</div>
              <div class="booking-value">₹${booking.totalAmount.toLocaleString()}</div>
            </div>
          </div>
          
          <div style="padding: 20px 30px;">
            <h3 style="color: #16a34a;">Important Information</h3>
            <ul style="padding-left: 20px;">
              <li>Please arrive at the property between ${formatTimeFor12Hour(booking.checkInTime)} and 8:00 PM on your check-in date.</li>
              <li>A refundable security deposit of ₹20,000 may be collected upon arrival.</li>
              <li>Please have a valid ID ready for check-in.</li>
              <li>For any assistance, please contact us at luxorholidayhomestays@gmail.com</li>
            </ul>
          </div>
          
          <div class="footer">
            <p>Thank you for choosing LuxorStay Villas!</p>
            <p> LuxorStay Villas. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
      `
    };

    // Send email without PDF attachment
    await transporter.sendMail(mailOptions);
    
    console.log(`[EMAIL] Booking confirmation sent to ${booking.email}`);
    
  } catch (error) {
    console.error("[EMAIL] Error sending booking confirmation:", error);
    throw error;
  }
}

// Function to generate PDF booking ticket with improved alignment and design
async function generateBookingTicketPDF(booking, villa, formattedCheckIn, formattedCheckOut, bookingNumber) {
  return new Promise((resolve, reject) => {
    try {
      // Create a PDF document
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
      });

      // Ensure temp directory exists
      const tempDir = path.join(__dirname, "../temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Set PDF file path
      const pdfFileName = `booking_${booking._id}.pdf`;
      const pdfPath = path.join(tempDir, pdfFileName);
      
      // Pipe PDF to file
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);

      // Calculate nights
      const totalNights = booking.totalDays || Math.ceil((new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24));
      
      // Calculate financial details
      const basePrice = Math.round(booking.totalAmount * 0.8);
      const taxesAndFees = Math.round(booking.totalAmount * 0.2);
      const totalAmount = booking.totalAmount;

      // -------- HEADER SECTION --------
      doc.font("Helvetica-Bold")
         .fontSize(22)
         .fillColor("#16a34a") // Green color for the header
         .text("Booking Confirmation", { align: "center" });
      
      // -------- BOOKING ID SECTION --------
      doc.moveDown(0.5);
      doc.fontSize(12)
         .fillColor("#666666")
         .text("Booking Reference", { align: "left" });
      
      doc.font("Helvetica-Bold")
         .fontSize(16)
         .fillColor("#f59e0b") // Amber color for the booking number
         .text(`#${bookingNumber}`, { align: "left" });
      
      doc.moveDown(1);
      
      // -------- VILLA & MAIN INFO SECTION --------
      // Create a light gray background for the villa card
      const villaCardY = doc.y;
      doc.rect(40, villaCardY, doc.page.width - 80, 90)
         .fillColor("#f9fafb") // Very light gray background
         .fill();
      
      // Add villa name and location
      doc.fillColor("#111827") // Dark text color
         .font("Helvetica-Bold")
         .fontSize(18)
         .text(villa.name, 50, villaCardY + 15);
      
      if (villa.location) {
        doc.font("Helvetica")
           .fontSize(12)
           .fillColor("#4b5563") // Gray text for location
           .text(villa.location, 50, villaCardY + 38);
      }
      
      // -------- BOOKING DETAILS SECTION --------
      doc.moveDown(3);
      
      // Create a clean table layout with two columns
      const startY = doc.y;
      const colWidth = (doc.page.width - 90) / 2;
      
      // First row - Check-in and Check-out
      doc.font("Helvetica-Bold")
         .fontSize(11)
         .fillColor("#6b7280") // Gray text for labels
         .text("Check-in", 50, startY);
      
      doc.font("Helvetica-Bold")
         .fontSize(11)
         .fillColor("#6b7280")
         .text("Check-out", 50 + colWidth, startY);
      
      doc.moveDown(0.3);
      
      // Calendar icon and date
      doc.font("Helvetica-Bold")
         .fontSize(12)
         .fillColor("#111827") // Dark text for values
         .text(`${formattedCheckIn.split(',')[0]}, ${formattedCheckIn.split(',')[1]}`, 50, doc.y);
      
      doc.font("Helvetica")
         .fontSize(11)
         .fillColor("#6b7280")
         .text(`${formatTimeFor12Hour(booking.checkInTime)}`, 50, doc.y + 15);
      
      // Check-out date on the right
      doc.font("Helvetica-Bold")
         .fontSize(12)
         .fillColor("#111827")
         .text(`${formattedCheckOut.split(',')[0]}, ${formattedCheckOut.split(',')[1]}`, 50 + colWidth, startY + 18);
      
      doc.font("Helvetica")
         .fontSize(11)
         .fillColor("#6b7280")
         .text(`${formatTimeFor12Hour(booking.checkOutTime)}`, 50 + colWidth, doc.y - 15);
      
      doc.moveDown(1.5);
      
      // Second row - Guests and Duration
      const secondRowY = doc.y;
      
      doc.font("Helvetica-Bold")
         .fontSize(11)
         .fillColor("#6b7280")
         .text("Guests", 50, secondRowY);
      
      doc.font("Helvetica-Bold")
         .fontSize(11)
         .fillColor("#6b7280")
         .text("Duration", 50 + colWidth, secondRowY);
      
      doc.moveDown(0.3);
      
      // Guests count
      doc.font("Helvetica-Bold")
         .fontSize(12)
         .fillColor("#111827")
         .text(`${booking.guests} Guest${booking.guests > 1 ? 's' : ''}`, 50, doc.y);
      
      // Duration on the right
      doc.font("Helvetica-Bold")
         .fontSize(12)
         .fillColor("#111827")
         .text(`${totalNights} Night${totalNights > 1 ? 's' : ''}`, 50 + colWidth, doc.y);
      
      doc.moveDown(1.5);
      
      // Third row - Total Amount
      const thirdRowY = doc.y;
      
      doc.font("Helvetica-Bold")
         .fontSize(11)
         .fillColor("#6b7280")
         .text("Total Amount", 50, thirdRowY);
      
      doc.font("Helvetica-Bold")
         .fontSize(11)
         .fillColor("#6b7280")
         .text("Status", 50 + colWidth, thirdRowY);
      
      doc.moveDown(0.3);
      
      // Total Amount with rupee symbol
      doc.font("Helvetica-Bold")
         .fontSize(12)
         .fillColor("#111827")
         .text(`₹${totalAmount}`, 50, doc.y);
      
      // Show status with confirmed - FIX: Don't use radius method
      // Instead, just draw a filled rectangle
      doc.fillColor("#d1fae5") // Light green background
         .rect(50 + colWidth, doc.y - 5, 80, 22)
         .fill();
      
      doc.font("Helvetica-Bold")
         .fontSize(12)
         .fillColor("#10b981") // Green text for confirmed
         .text("Confirmed", 50 + colWidth + 10, doc.y);
      
      doc.moveDown(2);
      
      // -------- GUEST INFORMATION SECTION --------
      doc.font("Helvetica-Bold")
         .fontSize(14)
         .fillColor("#111827")
         .text("Guest Information");
      
      doc.moveDown(0.5);
      
      // Create a table for guest details
      const guestInfoY = doc.y;
      
      // Guest Contact Information header
      doc.font("Helvetica")
         .fontSize(10)
         .fillColor("#6b7280")
         .text("Guest Contact Information", 50, guestInfoY);
      
      doc.moveDown(0.3);
      
      // Guest name 
      doc.font("Helvetica-Bold")
         .fontSize(12)
         .fillColor("#111827")
         .text(booking.guestName, 50, doc.y);
      
      doc.moveDown(0.8);
      
      // Email label and value
      doc.font("Helvetica")
         .fontSize(10)
         .fillColor("#6b7280")
         .text("Email", 50, doc.y);
      
      doc.moveDown(0.3);
      
      doc.font("Helvetica")
         .fontSize(11)
         .fillColor("#111827")
         .text(booking.email, 50, doc.y);
      
      doc.moveDown(0.8);
      
      // Contact Number label and value
      doc.font("Helvetica")
         .fontSize(10)
         .fillColor("#6b7280")
         .text("Contact Number", 50, doc.y);
      
      doc.moveDown(0.3);
      
      // Show phone with verified tag if available
      if (booking.phone) {
        doc.font("Helvetica")
           .fontSize(11)
           .fillColor("#111827")
           .text(booking.phone, 50, doc.y);
        
        // Verified pill for phone - FIX: Don't use radius method
        doc.fillColor("#dcfce7") // Very light green
           .rect(110, doc.y - 2, 58, 18)
           .fill();
        
        doc.font("Helvetica")
           .fontSize(9)
           .fillColor("#16a34a") // Green text
           .text("Verified", 118, doc.y);
      } else {
        doc.font("Helvetica")
           .fontSize(11)
           .fillColor("#6b7280")
           .text("Not provided", 50, doc.y);
      }
      
      // If booking has address, show it
      if (booking.address && (booking.address.street || booking.address.city)) {
        doc.moveDown(0.8);
        
        doc.font("Helvetica")
           .fontSize(10)
           .fillColor("#6b7280")
           .text("Contact Address", 50, doc.y);
        
        doc.moveDown(0.3);
        
        const addressParts = [
          booking.address.street,
          booking.address.city,
          booking.address.state,
          booking.address.country,
          booking.address.zipCode
        ].filter(Boolean);
        
        doc.font("Helvetica")
           .fontSize(11)
           .fillColor("#111827")
           .text(addressParts.join(", "), 50, doc.y, {
             width: doc.page.width - 100,
             align: 'left'
           });
      }
      
      doc.moveDown(0.8);
      
      // Account Type
      doc.font("Helvetica")
         .fontSize(10)
         .fillColor("#6b7280")
         .text("Account Type", 50, doc.y);
      
      doc.moveDown(0.3);
      
      doc.font("Helvetica")
         .fontSize(11)
         .fillColor("#111827")
         .text(booking.phone ? "Phone Verified User" : "Email User", 50, doc.y);
      
      doc.moveDown(2);
      
      // -------- PAYMENT DETAILS SECTION --------
      doc.font("Helvetica-Bold")
         .fontSize(14)
         .fillColor("#111827")
         .text("Payment Details");
      
      doc.moveDown(0.5);
      
      const paymentY = doc.y;
      
      // Base Price
      doc.font("Helvetica")
         .fontSize(12)
         .fillColor("#6b7280")
         .text(`Base Price × ${totalNights} nights`, 50, paymentY);
      
      doc.font("Helvetica")
         .fontSize(12)
         .fillColor("#111827")
         .text(`₹${basePrice}`, doc.page.width - 60, paymentY, { align: "right" });
      
      // Service Fee
      doc.font("Helvetica")
         .fontSize(12)
         .fillColor("#6b7280")
         .text("Service Fee (5%)", 50, paymentY + 25);
      
      doc.font("Helvetica")
         .fontSize(12)
         .fillColor("#111827")
         .text(`₹${Math.round(booking.totalAmount * 0.05)}`, doc.page.width - 60, paymentY + 25, { align: "right" });
      
      // Taxes
      doc.font("Helvetica")
         .fontSize(12)
         .fillColor("#6b7280")
         .text("Taxes (15%)", 50, paymentY + 50);
      
      doc.font("Helvetica")
         .fontSize(12)
         .fillColor("#111827")
         .text(`₹${taxesAndFees - Math.round(booking.totalAmount * 0.05)}`, doc.page.width - 60, paymentY + 50, { align: "right" });
      
      // Line before total
      doc.moveTo(50, paymentY + 75).lineTo(doc.page.width - 40, paymentY + 75).strokeColor("#e5e7eb").stroke();
      
      // Total Amount
      doc.font("Helvetica-Bold")
         .fontSize(13)
         .fillColor("#111827")
         .text("Total Amount", 50, paymentY + 85);
      
      doc.font("Helvetica-Bold")
         .fontSize(13)
         .fillColor("#f59e0b") // Amber color for the total
         .text(`₹${totalAmount}`, doc.page.width - 60, paymentY + 85, { align: "right" });
      
      doc.moveDown(0.8);
      
      // Payment status and method section
      const statusY = doc.y + 10;
      
      doc.rect(40, statusY, doc.page.width - 80, 50)
         .fillColor("#f9fafb") // Very light gray background
         .fill();
      
      // Payment Status
      doc.font("Helvetica-Bold")
         .fontSize(11)
         .fillColor("#4b5563")
         .text("Payment Status:", 50, statusY + 15);
      
      doc.font("Helvetica-Bold")
         .fontSize(11)
         .fillColor("#16a34a") // Green color for paid
         .text("Paid", 150, statusY + 15);
      
      // Payment Method
      doc.font("Helvetica-Bold")
         .fontSize(11)
         .fillColor("#4b5563")
         .text("Payment Method:", 50, statusY + 35);
      
      doc.font("Helvetica")
         .fontSize(11)
         .fillColor("#111827")
         .text(booking.paymentMethod || "UPI", 150, statusY + 35);
      
      // Payment ID on the right
      doc.font("Helvetica-Bold")
         .fontSize(11)
         .fillColor("#4b5563")
         .text("Transaction ID:", doc.page.width / 2, statusY + 15);
      
      // Cut payment ID if too long
      let paymentId = booking.paymentId || "pay_OnlyQxhxCITXFI";
      if (paymentId.length > 20) {
        paymentId = paymentId.substring(0, 20) + "...";
      }
      
      doc.font("Helvetica")
         .fontSize(11)
         .fillColor("#111827")
         .text(paymentId, doc.page.width / 2 + 85, statusY + 15);
      
      doc.moveDown(4);
      
      // -------- IMPORTANT INFORMATION SECTION --------
      doc.font("Helvetica-Bold")
         .fontSize(14)
         .fillColor("#111827")
         .text("Important Information");
      
      doc.moveDown(0.5);
      
      // Create bullet points like the mobile image
      const bulletPoints = [
        `Please arrive at the property between ${formatTimeFor12Hour(booking.checkInTime)} and 8:00 PM on your check-in date.`,
        `Check-out time is before ${formatTimeFor12Hour(booking.checkOutTime)}.`,
        `A refundable security deposit of ₹20,000 may be collected upon arrival.`,
        `Please present this confirmation along with a valid ID at check-in.`,
        `For any assistance, contact us at +91 79040 40739 or luxorholidayhomestays@gmail.com`
      ];
      
      bulletPoints.forEach((point, i) => {
        const bulletY = doc.y;
        
        // Draw bullet point
        doc.font("Helvetica")
           .fontSize(10)
           .fillColor("#111827")
           .text("•", 50, bulletY);
        
        // Draw text with wrapping
        doc.font("Helvetica")
           .fontSize(10)
           .fillColor("#111827")
           .text(point, 65, bulletY, {
             width: doc.page.width - 105,
             align: 'left'
           });
        
        doc.moveDown(0.5);
      });
      
      // -------- FOOTER SECTION --------
      const footerY = doc.page.height - 30;
      doc.font("Helvetica")
         .fontSize(9)
         .fillColor("#6b7280")
         .text("Thank you for choosing Luxor Stay Villas!", { align: "center" });
      
      // Finalize the PDF
      doc.end();
      
      // Wait for stream to finish
      stream.on("finish", () => {
        resolve(pdfPath);
      });
      
      stream.on("error", (err) => {
        reject(err);
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

// Get payment details for a specific booking
export const getPaymentDetails = async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    // Get booking with payment details
    const booking = await Booking.findById(bookingId);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    
    // Check authorization - only the booking user or admin can access
    if (booking.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }
    
    // Get payment details from Razorpay if available
    let paymentDetails = null;
    if (booking.paymentId) {
      try {
        const payment = await razorpay.payments.fetch(booking.paymentId);
        paymentDetails = payment;
      } catch (razorpayError) {
        console.error("[PAYMENT] Error fetching payment from Razorpay:", razorpayError);
        // Continue without Razorpay details
      }
    }
    
    res.status(200).json({
      success: true,
      booking: {
        id: booking._id,
        paymentId: booking.paymentId,
        orderId: booking.orderId,
        amount: booking.totalAmount,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        createdAt: booking.createdAt
      },
      paymentDetails
    });
  } catch (error) {
    console.error('[PAYMENT] Get payment details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment details',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};

// Refund a payment
export const refundPayment = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { amount, notes } = req.body;
    
    // Only admin can process refunds
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Only administrators can process refunds'
      });
    }
    
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    
    // Check if booking has a payment ID and is not already refunded
    if (!booking.paymentId || booking.paymentStatus === 'refunded') {
      return res.status(400).json({
        success: false,
        message: booking.paymentStatus === 'refunded' 
          ? 'Payment already refunded' 
          : 'No payment ID found for this booking'
      });
    }
    
    // Process refund via Razorpay
    const refund = await razorpay.payments.refund(booking.paymentId, {
      amount: amount ? amount * 100 : undefined, // Convert to paise if partial refund
      notes: {
        bookingId: bookingId,
        reason: notes || 'Customer requested refund',
        processedBy: req.user.name || req.user.email
      }
    });
    
    // Update booking status
    booking.paymentStatus = amount && amount < booking.totalAmount ? 'partially_refunded' : 'refunded';
    booking.refundAmount = amount || booking.totalAmount;
    booking.refundId = refund.id;
    booking.refundDate = new Date();
    booking.refundNotes = notes;
    booking.status = 'cancelled';
    
    await booking.save();
    
    res.status(200).json({
      success: true,
      message: 'Refund processed successfully',
      refund: {
        id: refund.id,
        amount: refund.amount ,// 100, // Convert from paise
        status: refund.status,
        speedProcessed: refund.speed_processed
      }
    });
  } catch (error) {
    console.error('[PAYMENT] Refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process refund',
      error: process.env.NODE_ENV === 'production' ? 'Refund processing failed' : error.message
    });
  }
};

// Webhook handler for Razorpay
export const handleRazorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const payload = JSON.stringify(req.body);
    
    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('Invalid webhook signature');
      return res.status(400).json({ success: false, error: 'Invalid signature' });
    }

    const event = req.body.event;
    const payment = req.body.payload.payment?.entity;
    const order = req.body.payload.order?.entity;

    if (event === 'payment.captured') {
      // Handle successful payment
      const bookingId = order.notes?.bookingId;
      
      if (!bookingId) {
        console.error('No booking ID found in order notes');
        return res.status(400).json({ success: false, error: 'No booking ID found' });
      }

      // Update booking status
      const booking = await Booking.findByIdAndUpdate(
        bookingId,
        {
          paymentStatus: 'paid',
          paymentId: payment.id,
          paymentMethod: payment.method,
          paymentDate: new Date(payment.created_at * 1000),
          status: 'confirmed'
        },
        { new: true }
      );

      if (!booking) {
        console.error('Booking not found:', bookingId);
        return res.status(404).json({ success: false, error: 'Booking not found' });
      }

      // Send booking confirmation email
      await sendBookingConfirmation(booking);
      
      console.log('Payment captured and booking updated:', bookingId);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Helper function to format time from 24-hour to 12-hour format
function formatTimeFor12Hour(time24) {
  if (!time24) return "2:00 PM"; // Default fallback
  
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours);
  const minute = minutes || '00';
  
  if (hour === 0) {
    return `12:${minute} AM`;
  } else if (hour < 12) {
    return `${hour}:${minute} AM`;
  } else if (hour === 12) {
    return `12:${minute} PM`;
  } else {
    return `${hour - 12}:${minute} PM`;
  }
}

// Add this to your paymentController.js
export const logPaymentError = async (req, res) => {
  try {
    const { error, paymentId, orderId } = req.body;
    
    console.error("[PAYMENT ERROR LOG]", {
      timestamp: new Date(),
      error,
      paymentId,
      orderId,
      userId: req.user?.userId,
    });
    
    // Here you could also save this to a database if needed
    
    res.status(200).json({
      success: true,
      message: 'Error logged successfully'
    });
  } catch (err) {
    console.error("[PAYMENT] Error logging payment error:", err);
    res.status(500).json({ success: false });
  }
};

// Update the storePaymentDetails function in paymentController.js
export const storePaymentDetails = async (req, res) => {
  try {
    const { 
      razorpay_payment_id, 
      razorpay_order_id, 
      razorpay_signature,
      bookingDetails 
    } = req.body;
    
    console.log("[PAYMENT] Received payment and booking details:", {
      paymentId: razorpay_payment_id,
      bookingDetails: {
        ...bookingDetails,
        // Don't log full details for privacy
        email: bookingDetails.email ? '✓ Present' : '✗ Missing',
        phone: bookingDetails.phone ? '✓ Present' : '✗ Missing'
      }
    });
    
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing payment details'
      });
    }

    // Find user info from token
    const userId = req.user?.userId;
    let userEmail = null;
    
    // If we have a userId, try to get the user's email
    if (userId) {
      try {
        const user = await User.findById(userId);
        if (user && user.email) {
          userEmail = user.email;
        }
      } catch (err) {
        console.log("[PAYMENT] Couldn't fetch user email:", err.message);
      }
    }

    // Ensure required fields have default values or use user data when available
    const sanitizedDetails = {
      ...bookingDetails,
      userId: userId,
      checkIn: bookingDetails.checkIn || new Date(),
      checkOut: bookingDetails.checkOut || new Date(Date.now() + 24*60*60*1000),
      guestName: bookingDetails.guestName || 'Guest',
      // Use email from booking details, fall back to user email, then use placeholder
      email: bookingDetails.email || userEmail || 'guest@example.com',
      totalDays: bookingDetails.totalDays || 1,
      // Ensure totalAmount is properly validated and stored
      totalAmount: Number(bookingDetails.totalAmount) || 0,
      guests: bookingDetails.guests || 1
    };

    // Validate the totalAmount before creating booking
    if (!sanitizedDetails.totalAmount || sanitizedDetails.totalAmount <= 0) {
      console.error("[PAYMENT] Invalid totalAmount in booking details:", sanitizedDetails.totalAmount);
      return res.status(400).json({
        success: false,
        error: 'Invalid total amount in booking details'
      });
    }

    console.log("[PAYMENT] Creating booking with validated amount:", {
      totalAmount: sanitizedDetails.totalAmount,
      guestName: sanitizedDetails.guestName,
      email: sanitizedDetails.email
    });

    // Create new booking with payment details
    const booking = new Booking({
      ...sanitizedDetails,
      payment: {
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature,
        status: 'captured'
      },
      status: 'confirmed',
      paymentStatus: 'paid',
      paymentDate: new Date(),
      paymentMethod: 'Razorpay'
    });

    await booking.save();

    // Send confirmation in the background
    try {
      if (sanitizedDetails.email && sanitizedDetails.email !== 'guest@example.com') {
        // sendBookingConfirmationEmail(booking).catch(console.error);
        console.log("[PAYMENT] Will send confirmation email to:", sanitizedDetails.email);
      } else {
        console.log("[PAYMENT] No valid email to send confirmation");
      }
    } catch (emailError) {
      console.error("[PAYMENT] Email sending error (non-critical):", emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Payment details stored and booking created successfully',
      bookingId: booking._id
    });
  } catch (error) {
    console.error('[PAYMENT] Error storing payment details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to store payment details',
      details: error.message
    });
  }
};

export default router;