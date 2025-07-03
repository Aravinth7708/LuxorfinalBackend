import Booking from '../models/Booking.js';
import Villa from '../models/Villa.js';
import nodemailer from 'nodemailer';

// import Ramwater from "./img/Rw"
export const createBooking = async (req, res) => {
  try {
    console.log("[BOOKING] Received booking request:", req.body);

    const { villaId, email, guestName, checkIn, checkOut, guests, totalAmount, totalDays, infants } = req.body;
    if (!villaId || !email || !checkIn || !checkOut || !guests) {
      console.error("[BOOKING] Missing required fields", req.body);
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate totalAmount
    if (isNaN(totalAmount) || totalAmount <= 0) {
      console.error("[BOOKING] Invalid totalAmount:", totalAmount);
      
      // Attempt to recalculate totalAmount from available data
      const villa = await Villa.findById(villaId);
      if (!villa) {
        console.error("[BOOKING] Villa not found for id:", villaId);
        return res.status(404).json({ error: 'Villa not found' });
      }
      
      // Calculate dates difference
      const start = new Date(checkIn);
      const end = new Date(checkOut);
      const diffTime = Math.abs(end - start);
      const calculatedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Calculate total amount
      const basePrice = villa.price * calculatedDays;
      const serviceFee = Math.round(basePrice * 0.05);
      const taxAmount = Math.round((basePrice + serviceFee) * 0.18);
      const calculatedTotalAmount = Math.round(basePrice + serviceFee + taxAmount);
      
      console.log("[BOOKING] Recalculated totalAmount:", calculatedTotalAmount);
      
      // Use the calculated amount
      req.body.totalAmount = calculatedTotalAmount;
    }

    console.log("[BOOKING] Looking for villa with id:", villaId);
    const villa = await Villa.findById(villaId);
    if (!villa) {
      console.error("[BOOKING] Villa not found for id:", villaId);
      return res.status(404).json({ error: 'Villa not found' });
    }

    console.log("[BOOKING] Creating booking for villa:", villa.name);
    const booking = await Booking.create({
      villaId,
      villaName: villa.name,
      email,
      guestName,
      checkIn,
      checkOut,
      guests,
      totalAmount: req.body.totalAmount || totalAmount,  // Use recalculated amount if needed
      totalDays: totalDays || calculatedDays,           // Use calculated days if totalDays not provided
      infants: infants || 0
    });

    console.log("[BOOKING] Booking created:", booking);

    // Send confirmation email with enhanced template
    try {
      await sendBookingEmail(email, booking, villa);
      console.log("[BOOKING] Confirmation email sent to:", email);
    } catch (mailErr) {
      console.error("[BOOKING] Error sending confirmation email:", mailErr);
    }

    res.json({ success: true, booking });
  } catch (err) {
    console.error("[BOOKING] Error in createBooking:", err);
    res.status(500).json({ error: err.message });
  }
};

async function sendBookingEmail(email, booking, villa) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.gmail,
      pass: process.env.pass
    }
  });

  // Format dates
  const checkInDate = new Date(booking.checkIn);
  const checkOutDate = new Date(booking.checkOut);
  
  // Format for display
  const formattedCheckIn = checkInDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formattedCheckOut = checkOutDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  
  // Current date for booking confirmation
  const bookingDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
  
  // Get villa image URL (using first image if available)
  const villaImageUrl = villa.images && villa.images.length > 0 
    ? `${process.env.BASE_URL || 'https://luxorstayvillas.com'}/img/${villa.images[0]}`
    : `${process.env.BASE_URL || 'https://luxorstayvillas.com'}/img/default-villa.jpg`;

  // Calculate amounts
  const basePrice = villa.price * booking.totalDays;
  const serviceFee = Math.round(basePrice * 0.05);
  const taxAmount = Math.round((basePrice + serviceFee) * 0.18);
  const totalAmount = booking.totalAmount || (basePrice + serviceFee + taxAmount);
  
  // Generate a 6-digit booking number
  const bookingNumber = String(booking._id).substring(0, 6).toUpperCase();
  
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
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
        
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
          background-color: #1e3a8a;
          color: white;
          padding: 25px 30px;
          text-align: center;
        }
        
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        
        .header p {
          margin: 5px 0 0;
          font-size: 16px;
          opacity: 0.9;
        }
        
        .villa-image {
          width: 100%;
          height: 200px;
          object-fit: cover;
          display: block;
        }
        
        .booking-details {
          padding: 25px 30px;
          border-bottom: 1px solid #eaeaea;
        }
        
        .booking-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        
        .booking-label {
          font-weight: 500;
          color: #666;
          width: 40%;
        }
        
        .booking-value {
          font-weight: 600;
          color: #333;
          width: 60%;
          text-align: right;
        }
        
        .section-title {
          font-size: 18px;
          font-weight: 600;
          color: #1e3a8a;
          margin: 0 0 15px 0;
          padding-bottom: 10px;
          border-bottom: 2px solid #eaeaea;
        }
        
        .booking-id {
          background-color: #f2f7ff;
          padding: 12px;
          border-radius: 6px;
          text-align: center;
          margin-bottom: 20px;
        }
        
        .booking-id span {
          font-weight: 700;
          color: #1e3a8a;
          font-size: 18px;
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
          font-size: 14px;
        }
        
        .price-label {
          color: #666;
        }
        
        .price-value {
          font-weight: 500;
        }
        
        .price-total {
          font-size: 18px;
          font-weight: 700;
          color: #1e3a8a;
          border-top: 2px solid #eaeaea;
          padding-top: 10px;
          margin-top: 10px;
        }
        
        .additional-info {
          padding: 20px 30px;
        }
        
        .info-item {
          display: flex;
          align-items: flex-start;
          margin-bottom: 12px;
        }
        
        .info-dot {
          width: 8px;
          height: 8px;
          background-color: #1e3a8a;
          border-radius: 50%;
          margin-top: 8px;
          margin-right: 10px;
          flex-shrink: 0;
        }
        
        .footer {
          background-color: #f2f7ff;
          padding: 20px 30px;
          text-align: center;
          font-size: 14px;
          color: #666;
        }
        
        .logo {
          max-width: 120px;
          margin-bottom: 15px;
        }
        
        .amenities {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 15px;
        }
        
        .amenity {
          background-color: #f2f7ff;
          color: #1e3a8a;
          font-size: 12px;
          padding: 5px 10px;
          border-radius: 4px;
        }
        
        @media only screen and (max-width: 600px) {
          .container {
            width: 100%;
            margin: 0;
            border-radius: 0;
          }
          
          .booking-row, .price-row {
            flex-direction: column;
          }
          
          .booking-value, .price-value {
            text-align: left;
            width: 100%;
          }
          
          .booking-label, .price-label {
            width: 100%;
            margin-bottom: 4px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Booking Confirmation</h1>
          <p>Thank you for choosing LuxorStay Villas</p>
        </div>
        
        <img src="${villaImageUrl}" alt="${villa.name}" class="villa-image">
        
        <div class="booking-details">
          <div class="booking-id">
            <span>Booking #${bookingNumber}</span>
          </div>
          
          <h2 class="section-title">${villa.name}</h2>
          
          <div class="booking-row">
            <div class="booking-label">Check-in</div>
            <div class="booking-value">${formattedCheckIn}</div>
          </div>
          
          <div class="booking-row">
            <div class="booking-label">Check-out</div>
            <div class="booking-value">${formattedCheckOut}</div>
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
            <div class="booking-label">Booking Date</div>
            <div class="booking-value">${bookingDate}</div>
          </div>
          
          <div class="booking-row">
            <div class="booking-label">Status</div>
            <div class="booking-value" style="color: #16a34a; font-weight: 700;">Confirmed</div>
          </div>
          
          <div class="booking-row">
            <div class="booking-label">Booked By</div>
            <div class="booking-value">${booking.guestName}</div>
          </div>
        </div>
        
        <div class="price-breakdown">
          <h2 class="section-title">Price Details</h2>
          
          <div class="price-row">
            <div class="price-label">₹${villa.price?.toLocaleString() || '0'} × ${booking.totalDays} nights</div>
            <div class="price-value">₹${basePrice?.toLocaleString() || '0'}</div>
          </div>
          
          <div class="price-row">
            <div class="price-label">Service fee (5%)</div>
            <div class="price-value">₹${serviceFee?.toLocaleString() || '0'}</div>
          </div>
          
          <div class="price-row">
            <div class="price-label">GST (18%)</div>
            <div class="price-value">₹${taxAmount?.toLocaleString() || '0'}</div>
          </div>
          
          <div class="price-row price-total">
            <div class="price-label">Total Amount</div>
            <div class="price-value">₹${totalAmount?.toLocaleString() || '0'}</div>
          </div>
        </div>
        
        <div class="additional-info">
          <h2 class="section-title">Villa Amenities</h2>
          
          <div class="amenities">
            ${villa.facilities?.map(facility => `<div class="amenity">${facility.name || facility}</div>`).join('') || 'Luxury Amenities'}
          </div>
          
          <h2 class="section-title" style="margin-top: 20px;">Additional Information</h2>
          
          <div class="info-item">
            <div class="info-dot"></div>
            <div>Check-in time is 2:00 PM and check-out time is 11:00 AM.</div>
          </div>
          
          <div class="info-item">
            <div class="info-dot"></div>
            <div>Free parking is available on-site.</div>
          </div>
          
          <div class="info-item">
            <div class="info-dot"></div>
            <div>Security deposit of ₹20,000 may be collected upon arrival and refunded at check-out.</div>
          </div>
          
          <div class="info-item">
            <div class="info-dot"></div>
            <div>Please present this confirmation at check-in.</div>
          </div>
        </div>
        
        <div class="footer">
          <p>For any questions or changes to your reservation, please contact us at support@luxorstayvillas.com</p>
          <p>© ${new Date().getFullYear()} LuxorStay Villas. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
    `
  };

  await transporter.sendMail(mailOptions);
}

// Search bookings that overlap with a date range
export const searchBookings = async (req, res) => {
  try {
    const { checkIn, checkOut } = req.query;
    if (!checkIn || !checkOut) {
      return res.status(400).json({ error: "checkIn and checkOut required" });
    }
    // Find bookings that overlap with the requested range
    const bookings = await Booking.find({
      $or: [
        {
          checkIn: { $lte: new Date(checkOut) },
          checkOut: { $gte: new Date(checkIn) }
        }
      ]
    });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Updated method to get user bookings - fetch by userId when email isn't available
export const getUserBookings = async (req, res) => {
  try {
    // Detailed logging for debugging
    console.log("[BOOKING] Fetching user bookings with auth:", {
      userId: req.user?.userId,
      email: req.user?.email,
      hasUserObject: !!req.user
    });
    
    // Check if user is properly authenticated
    if (!req.user) {
      console.error("[BOOKING] Authentication error: No user object in request");
      return res.status(401).json({ 
        error: 'Authentication required',
        details: 'User information not available'
      });
    }

    // Get user id from the authentication token
    const userId = req.user.userId;
    if (!userId) {
      console.error("[BOOKING] User ID not found in authentication data");
      return res.status(400).json({
        error: 'Invalid user data',
        details: 'User ID is required'
      });
    }
    
    let userEmail = req.user.email;
    
    // If email is not in token, look it up from the user database
    if (!userEmail) {
      console.log(`[BOOKING] Email not found in token, looking up user with ID: ${userId}`);
      
      // Import User model
      const User = await import('../models/User.js');
      
      try {
        // Find user by ID
        const user = await User.default.findById(userId);
        
        if (!user) {
          console.error(`[BOOKING] User not found for ID: ${userId}`);
          return res.status(404).json({ 
            error: 'User not found',
            details: 'The user associated with this token does not exist'
          });
        }
        
        userEmail = user.email;
        console.log(`[BOOKING] Found user email: ${userEmail}`);
      } catch (err) {
        console.error(`[BOOKING] Error looking up user: ${err.message}`);
        return res.status(500).json({ 
          error: 'Database error',
          details: 'Error retrieving user information'
        });
      }
    }
    
    console.log(`[BOOKING] Looking for bookings with email: ${userEmail}`);
    
    // Get bookings by user email
    const bookings = await Booking.find({ email: userEmail });
    console.log(`[BOOKING] Found ${bookings.length} bookings for email ${userEmail}`);
    
    // Return the bookings array with a success flag for easier frontend handling
    res.json({
      success: true,
      count: bookings.length,
      bookings: bookings
    });
  } catch (err) {
    console.error("[BOOKING] Error fetching user bookings:", err);
    res.status(500).json({ 
      error: 'Failed to fetch bookings',
      message: err.message 
    });
  }
};

// Cancel a booking
export const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    // Get user ID from auth middleware
    const userId = req.user.userId;
    
    console.log("[BOOKING] Attempting to cancel booking:", id);
    console.log("[BOOKING] Reason:", reason);
    
    // Find the booking
    const booking = await Booking.findById(id);
    
    if (!booking) {
      console.error("[BOOKING] Booking not found:", id);
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Check if user is authorized to cancel this booking
    if (booking.userId && booking.userId.toString() !== userId && req.user.role !== 'admin') {
      console.error("[BOOKING] Unauthorized cancellation attempt:", {
        bookingUserId: booking.userId,
        requestUserId: userId
      });
      return res.status(403).json({ error: 'You are not authorized to cancel this booking' });
    }
    
    // Calculate refund amount based on cancellation policy
    let refundPercentage = 0;
    const checkInDate = new Date(booking.checkIn);
    const daysUntilCheckIn = Math.ceil((checkInDate - new Date()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilCheckIn > 30) {
      refundPercentage = 75; // 75% refund if cancelled more than 30 days before
    } else if (daysUntilCheckIn > 15) {
      refundPercentage = 50; // 50% refund if cancelled 15-30 days before
    }
    
    const refundAmount = Math.round((booking.totalAmount * refundPercentage) / 100);
    
    // Update booking status
    booking.status = 'cancelled';
    booking.cancelReason = reason || 'User initiated cancellation';
    booking.cancelledAt = new Date();
    booking.refundAmount = refundPercentage > 0 ? refundAmount : 0;
    booking.refundPercentage = refundPercentage;
    
    await booking.save();
    
    // Send cancellation confirmation email if possible
    try {
      // You can add email sending logic here
    } catch (emailError) {
      console.error("[BOOKING] Error sending cancellation email:", emailError);
    }
    
    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      booking: {
        id: booking._id,
        status: booking.status,
        cancelledAt: booking.cancelledAt,
        refundAmount: booking.refundAmount,
        refundPercentage: booking.refundPercentage
      }
    });
    
  } catch (err) {
    console.error("[BOOKING] Cancel booking error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Get booking by ID
export const getBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("[BOOKING] Fetching booking by ID:", id);
    
    if (!id) {
      return res.status(400).json({ error: "Booking ID is required" });
    }

    const booking = await Booking.findById(id);
    
    if (!booking) {
      console.error("[BOOKING] Booking not found:", id);
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Check if user is authorized to view this booking
    const userId = req.user?.userId;
    const userEmail = req.user?.email;
    
    if (req.user.role !== 'admin' && booking.email !== userEmail) {
      // This isn't the user's booking
      console.warn("[BOOKING] Unauthorized access attempt:", {
        bookingEmail: booking.email,
        userEmail: userEmail,
        userId: userId
      });
      
      return res.status(403).json({ 
        error: 'Unauthorized',
        details: 'You do not have permission to view this booking'
      });
    }
    
    console.log("[BOOKING] Successfully retrieved booking:", booking._id);
    res.json(booking);
  } catch (err) {
    console.error("[BOOKING] Error fetching booking by ID:", err);
    res.status(500).json({ error: err.message });
  }
};

// Add this function to check for date availability
export const checkAvailability = async (req, res) => {
  try {
    const { villaId, checkIn, checkOut } = req.query;
    
    if (!villaId || !checkIn || !checkOut) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required parameters: villaId, checkIn and checkOut dates are required' 
      });
    }

    console.log("[BOOKING] Checking availability for villa:", villaId);
    console.log("[BOOKING] Date range:", { checkIn, checkOut });
    
    // Find any bookings that overlap with the requested date range
    const overlappingBookings = await Booking.find({
      villaId: villaId,
      status: { $ne: 'cancelled' }, // Exclude cancelled bookings
      $or: [
        // Case 1: Check-in date falls within existing booking
        {
          checkIn: { $lte: new Date(checkOut) },
          checkOut: { $gte: new Date(checkIn) }
        }
      ]
    });

    const isAvailable = overlappingBookings.length === 0;
    
    console.log("[BOOKING] Villa availability:", {
      isAvailable,
      overlappingBookingsCount: overlappingBookings.length
    });

    // Return availability status and blocked dates
    return res.status(200).json({
      success: true,
      isAvailable,
      blockedDates: overlappingBookings.map(booking => ({
        checkIn: booking.checkIn,
        checkOut: booking.checkOut
      }))
    });
  } catch (error) {
    console.error("[BOOKING] Error checking availability:", error);
    return res.status(500).json({
      success: false,
      message: "Error checking availability",
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
};
