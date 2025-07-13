import crypto from 'crypto';
import { createRequire } from 'module';
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


const razorpay = new Razorpay({
  key_id: process.env.RazorpayKey, 
  key_secret: process.env.RAZORPAY_SECRET 
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

    // Fetch payment details from Razorpay to get the payment method
    let paymentMethod = "Online Payment"; // Default fallback
    let paymentDetails = null;
    
    try {
      console.log("[PAYMENT] Fetching payment details from Razorpay for payment ID:", razorpay_payment_id);
      paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
      console.log("[PAYMENT] Payment details from Razorpay:", JSON.stringify(paymentDetails, null, 2));
      
      // Extract payment method from Razorpay response
      if (paymentDetails && paymentDetails.method) {
        console.log("[PAYMENT] Raw payment method from Razorpay:", paymentDetails.method);
        
        switch (paymentDetails.method) {
          case 'upi':
            paymentMethod = 'UPI';
            break;
          case 'card':
            paymentMethod = 'Card';
            break;
          case 'netbanking':
            paymentMethod = 'Net Banking';
            break;
          case 'wallet':
            paymentMethod = 'Wallet';
            break;
          case 'bank_transfer':
            paymentMethod = 'Bank Transfer';
            break;
          case 'emi':
            paymentMethod = 'EMI';
            break;
          default:
            paymentMethod = `Online Payment (${paymentDetails.method})`;
        }
        
        // If it's UPI, try to get more specific info
        if (paymentDetails.method === 'upi' && paymentDetails.acquirer_data && paymentDetails.acquirer_data.upi) {
          const upiData = paymentDetails.acquirer_data.upi;
          console.log("[PAYMENT] UPI data:", upiData);
          if (upiData.vpa) {
            const upiProvider = upiData.vpa.split('@')[1] || 'UPI';
            paymentMethod = `UPI (${upiProvider})`;
          }
        }
        
        // If it's card, get card network
        if (paymentDetails.method === 'card' && paymentDetails.card) {
          console.log("[PAYMENT] Card data:", paymentDetails.card);
          const cardNetwork = paymentDetails.card.network || '';
          const cardType = paymentDetails.card.type || '';
          if (cardNetwork && cardType) {
            paymentMethod = `${cardNetwork} ${cardType} Card`.trim();
          } else if (cardNetwork) {
            paymentMethod = `${cardNetwork} Card`;
          } else {
            paymentMethod = 'Card';
          }
        }
        
        // If it's wallet, get wallet name
        if (paymentDetails.method === 'wallet' && paymentDetails.wallet) {
          console.log("[PAYMENT] Wallet data:", paymentDetails.wallet);
          paymentMethod = `Wallet (${paymentDetails.wallet})`;
        }
        
        // If it's netbanking, get bank name
        if (paymentDetails.method === 'netbanking' && paymentDetails.bank) {
          console.log("[PAYMENT] Bank data:", paymentDetails.bank);
          paymentMethod = `Net Banking (${paymentDetails.bank})`;
        }
      }
    } catch (paymentFetchError) {
      console.error("[PAYMENT] Error fetching payment details from Razorpay:", paymentFetchError);
      console.error("[PAYMENT] Error details:", {
        message: paymentFetchError.message,
        stack: paymentFetchError.stack
      });
      // Continue with default payment method
      console.log("[PAYMENT] Continuing with default payment method:", paymentMethod);
    }

    console.log("[PAYMENT] Determined payment method:", paymentMethod);

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
      paymentMethod: paymentMethod, // Set the actual payment method
      isPaid: true, // Mark as paid since payment is successful
      checkInTime: bookingData.checkInTime || "14:00", // Default to 2:00 PM
      checkOutTime: bookingData.checkOutTime || "12:00", // Default to 12:00 PM
      createdAt: new Date(),
      isTestBooking: true, // Flag to indicate this is a test booking
      // Store payment details for webhook compatibility
      paymentDetails: {
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        paymentCapturedAt: new Date(),
        paymentMethod: paymentMethod,
        bank: paymentDetails?.bank || null,
        cardId: paymentDetails?.card?.id || null,
        wallet: paymentDetails?.wallet || null,
        vpa: paymentDetails?.acquirer_data?.upi?.vpa || null,
        orderAmount: paymentDetails?.amount || 1000, // Amount in paise
        orderCurrency: paymentDetails?.currency || 'INR'
      }
    };

    // Create booking with test flag
    const newBooking = new Booking(testBookingData);
    await newBooking.save();
    
    console.log("[PAYMENT] Test booking created successfully:", newBooking._id);
    console.log("[PAYMENT] Payment method set to:", newBooking.paymentMethod);

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
    
    // Generate PDF booking ticket
    const pdfPath = await generateBookingTicketPDF(booking, villa, formattedCheckIn, formattedCheckOut, bookingNumber);

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
              <li><strong>Your booking ticket is attached as a PDF.</strong> Please save or print it for your records.</li>
            </ul>
          </div>
          
          <div class="footer">
            <p>Thank you for choosing LuxorStay Villas!</p>
            <p>© ${new Date().getFullYear()} LuxorStay Villas. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
      `,
      attachments: [
        {
          filename: `LuxorStay_Booking_${bookingNumber}.pdf`,
          path: pdfPath,
          contentType: 'application/pdf'
        }
      ]
    };

    // Send email with PDF attachment
    await transporter.sendMail(mailOptions);
    
    // Clean up - remove temporary PDF file
    fs.unlinkSync(pdfPath);
    
    console.log(`[EMAIL] Booking confirmation with PDF ticket sent to ${booking.email}`);
    
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

// Note: Webhook handling has been moved to dedicated webhookRoutes.js
// This provides better separation of concerns and more comprehensive webhook handling

// Helper function to format time from 24-hour to 12-hour format
const formatTimeFor12Hour = (time24) => {
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
};