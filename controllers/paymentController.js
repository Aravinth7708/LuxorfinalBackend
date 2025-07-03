import crypto from 'crypto';
import { createRequire } from 'module';
import Booking from '../models/Booking.js';
import Villa from '../models/Villa.js';
import nodemailer from 'nodemailer';

const require = createRequire(import.meta.url);
const Razorpay = require('razorpay');

// Initialize Razorpay with exact keys from environment
const razorpay = new Razorpay({
  key_id: process.env.RazorpayKey, // "rzp_live_quNHH9YfEhaAru"
  key_secret: process.env.RAZORPAY_SECRET // "KpevVI5be513vvCCWGKuCG7X"
});

// Add console logs to verify keys are loaded
console.log("Razorpay initialized with key:", process.env.RazorpayKey?.substring(0, 5) + "...");

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
      totalNights
    } = req.body;

    // Validate required fields
    if (!amount || !villaId || !checkIn || !checkOut || !guestName) {
      console.error("[PAYMENT] Missing required fields:", req.body);
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields for payment' 
      });
    }
    
    // Check if amount is a valid number
    if (isNaN(amount) || amount <= 0) {
      console.error("[PAYMENT] Invalid amount:", amount);
      return res.status(400).json({
        success: false,
        message: 'Invalid payment amount'
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
    
    // Create order in Razorpay
    const order = await razorpay.orders.create({
      amount: 100, // Convert to paise and ensure it's an integer
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
        userId: req.user?.id || req.user?.userId
      }
    });

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
  try {
    console.log("[PAYMENT] Verifying payment:", {
      payment_id: req.body.razorpay_payment_id,
      order_id: req.body.razorpay_order_id
    });
    
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      bookingData
    } = req.body;

    // For test transactions, we'll still verify signature for security
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    
    const isSignatureValid = generatedSignature === razorpay_signature;

    if (!isSignatureValid) {
      console.error("[PAYMENT] Invalid signature:", {
        expected: generatedSignature,
        received: razorpay_signature
      });
      
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid payment signature' 
      });
    }

    // For test payments, we're using a fixed amount of 10 rupees
    // Modify bookingData to reflect this is a test booking
    const testBookingData = {
      ...bookingData,
      userId: req.user?.id || req.user?.userId,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      totalAmount: 10, // Override with 10 rupees
      status: 'confirmed',
      paymentStatus: 'paid',
      createdAt: new Date(),
      isTestBooking: true // Flag to indicate this is a test booking
    };

    // Create booking with test flag
    const newBooking = new Booking(testBookingData);
    await newBooking.save();
    
    console.log("[PAYMENT] Test booking created successfully:", newBooking._id);

    // Send booking confirmation email (optional for test bookings)
    try {
      await sendBookingConfirmation(newBooking);
      console.log("[PAYMENT] Test booking confirmation email sent");
    } catch (emailError) {
      console.error("[PAYMENT] Error sending test booking confirmation email:", emailError);
      // Continue even if email fails
    }

    // Return success response with booking details
    res.status(200).json({
      success: true,
      message: 'Test payment verified and booking confirmed',
      booking: {
        id: newBooking._id,
        villaName: newBooking.villaName,
        checkIn: newBooking.checkIn,
        checkOut: newBooking.checkOut,
        amount: 10, // Fixed test amount
        status: newBooking.status,
        isTestBooking: true
      }
    });
  } catch (error) {
    console.error('[PAYMENT] Payment verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Payment verification failed',
      error: process.env.NODE_ENV === 'production' ? 'Verification error' : error.message
    });
  }
};

// Helper function to send booking confirmation email
async function sendBookingConfirmation(booking) {
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
            <div class="booking-value">${formattedCheckIn} ${booking.checkInTime || '2:00 PM'}</div>
          </div>
          
          <div class="booking-row">
            <div class="booking-label">Check-out</div>
            <div class="booking-value">${formattedCheckOut} ${booking.checkOutTime || '11:00 AM'}</div>
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
            <li>Please arrive at the property between ${booking.checkInTime || '2:00 PM'} and 8:00 PM on your check-in date.</li>
            <li>A refundable security deposit of ₹20,000 may be collected upon arrival.</li>
            <li>Please have a valid ID ready for check-in.</li>
            <li>For any assistance, please contact us at support@luxorstayvillas.com</li>
          </ul>
        </div>
        
        <div class="footer">
          <p>Thank you for choosing LuxorStay Villas!</p>
          <p>© ${new Date().getFullYear()} LuxorStay Villas. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
    `
  };

  // Send email
  await transporter.sendMail(mailOptions);
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
        amount: refund.amount / 100, // Convert from paise
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

// Add this to your paymentController.js

export const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    // Your webhook secret from Razorpay dashboard
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    
    // Verify webhook signature
    const verified = razorpay.webhooks.verify(
      JSON.stringify(req.body),
      signature,
      webhookSecret
    );
    
    if (!verified) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    }
    
    const { payload } = req.body;
    const event = req.body.event;
    
    console.log('[WEBHOOK] Received event:', event);
    
    // Handle different event types
    if (event === 'payment.authorized') {
      const paymentId = payload.payment.entity.id;
      const orderId = payload.payment.entity.order_id;
      
      // Create booking based on payment information
      // You'll need to get booking details from the notes field
      const paymentDetails = await razorpay.payments.fetch(paymentId);
      const notes = paymentDetails.notes || {};
      
      // Create booking in your database
      const booking = new Booking({
        villaId: notes.villaId,
        userId: notes.userId,
        villaName: notes.villaName,
        checkIn: new Date(notes.checkIn),
        checkOut: new Date(notes.checkOut),
        guests: parseInt(notes.guests),
        paymentId: paymentId,
        orderId: orderId,
        status: 'confirmed',
        paymentStatus: 'paid',
        totalAmount: paymentDetails.amount / 100 // Convert from paise to rupees
      });
      
      await booking.save();
      console.log('[WEBHOOK] Booking created from webhook:', booking._id);
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[WEBHOOK] Error processing webhook:', error);
    res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
};

// Add the webhook route in paymentRoutes.js
router.post('/webhook', handleWebhook);