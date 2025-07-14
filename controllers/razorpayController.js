import Razorpay from 'razorpay';
import crypto from 'crypto';
import Booking from '../models/Booking.js';
import { sendBookingConfirmationEmail } from '../utils/email.js';

// Initialize Razorpay with your API keys
const razorpay = new Razorpay({
  key_id: process.env.RAZORpAY_KEY_ID,     // Note the lowercase 'p' to match .env
  key_secret: process.env.RAZORPAY_SECRET
});

/**
 * Create a Razorpay order
 */
export const createOrder = async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt, notes } = req.body;

    if (!amount || !receipt) {
      return res.status(400).json({
        success: false,
        error: 'Amount and receipt are required'
      });
    }

    const options = {
      amount: Math.round(amount), // amount in the smallest currency unit (paise for INR)
      currency,
      receipt,
      notes,
      payment_capture: 1 // Auto-capture payment
    };

    const order = await razorpay.orders.create(options);

    res.status(201).json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment order'
    });
  }
};

/**
 * Verify payment signature and update booking
 */
export const verifyPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      bookingId
    } = req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !bookingId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    // Verify the payment signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature'
      });
    }

    // Find and update the booking
    const booking = await Booking.findById(bookingId).session(session);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // Update booking status and payment details
    booking.paymentStatus = 'paid';
    booking.status = 'confirmed';
    booking.payment = {
      ...booking.payment,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      status: 'captured',
      method: 'razorpay',
      capturedAt: new Date()
    };

    await booking.save({ session });
    await session.commitTransaction();
    session.endSession();

    // Send booking confirmation email (in background)
    sendBookingConfirmationEmail(booking).catch(console.error);

    res.status(200).json({
      success: true,
      message: 'Payment verified and booking confirmed',
      bookingId: booking._id
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error verifying payment'
    });
  }
};

/**
 * Handle Razorpay webhook events
 */
export const handleWebhook = async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  // Verify webhook signature
  const generatedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (generatedSignature !== signature) {
    console.error('Invalid webhook signature');
    return res.status(400).json({ status: 'invalid signature' });
  }

  const event = req.body.event;
  const payment = req.body.payload?.payment?.entity;
  const order = req.body.payload?.order?.entity;

  console.log(`Processing webhook event: ${event}`);

  try {
    switch (event) {
      case 'payment.captured':
        await handlePaymentCaptured(payment, order);
        break;
      
      case 'payment.failed':
        await handlePaymentFailed(payment);
        break;
      
      case 'order.paid':
        // This is a fallback in case payment.captured is missed
        if (payment && payment.status === 'captured') {
          await handlePaymentCaptured(payment, order);
        }
        break;
      
      default:
        console.log(`Unhandled event type: ${event}`);
    }

    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ status: 'error', error: error.message });
  }
};

// Helper function to handle successful payment capture
async function handlePaymentCaptured(payment, order) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const bookingId = order?.notes?.bookingId;
    
    if (!bookingId) {
      throw new Error('No booking ID found in order notes');
    }

    const booking = await Booking.findById(bookingId).session(session);
    
    if (!booking) {
      throw new Error(`Booking not found: ${bookingId}`);
    }

    // Only update if not already updated
    if (booking.paymentStatus !== 'paid') {
      booking.paymentStatus = 'paid';
      booking.status = 'confirmed';
      booking.payment = {
        ...booking.payment,
        paymentId: payment.id,
        orderId: order.id,
        status: 'captured',
        method: payment.method,
        cardId: payment.card_id,
        bank: payment.bank,
        wallet: payment.wallet,
        vpa: payment.vpa,
        email: payment.email,
        contact: payment.contact,
        capturedAt: new Date()
      };

      await booking.save({ session });
      
      // Update villa availability if needed
      if (booking.villa) {
        await Villa.findByIdAndUpdate(
          booking.villa,
          { $addToSet: { bookedDates: { $each: booking.dates } } },
          { session }
        );
      }

      await session.commitTransaction();
      
      // Send confirmation email (in background)
      sendBookingConfirmationEmail(booking).catch(console.error);
      
      console.log(`✅ Payment ${payment.id} captured for booking ${booking._id}`);
    }
  } catch (error) {
    await session.abortTransaction();
    console.error('Error in handlePaymentCaptured:', error);
    throw error;
  } finally {
    session.endSession();
  }
}

// Helper function to handle failed payments
async function handlePaymentFailed(payment) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await Booking.findOne({ 'payment.orderId': payment.order_id })
      .session(session);

    if (booking) {
      booking.paymentStatus = 'failed';
      booking.payment = {
        ...booking.payment,
        status: 'failed',
        errorCode: payment.error_code,
        errorDescription: payment.error_description,
        errorSource: payment.error_source,
        errorStep: payment.error_step,
        errorReason: payment.error_reason,
        failedAt: new Date()
      };

      await booking.save({ session });
      await session.commitTransaction();
      
      console.log(`❌ Payment ${payment.id} failed for booking ${booking._id}`);
    }
  } catch (error) {
    await session.abortTransaction();
    console.error('Error in handlePaymentFailed:', error);
    throw error;
  } finally {
    session.endSession();
  }
}

// Get payment details for a booking
export const getPaymentDetails = async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    const booking = await Booking.findById(bookingId)
      .select('payment paymentStatus status')
      .lean();

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        payment: booking.payment,
        paymentStatus: booking.paymentStatus,
        bookingStatus: booking.status
      }
    });
  } catch (error) {
    console.error('Error getting payment details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get payment details'
    });
  }
};

// Process refund for a booking
export const refundPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { bookingId } = req.params;
    const { amount, reason = 'Refund by request', speed = 'normal' } = req.body;

    // Find the booking
    const booking = await Booking.findById(bookingId).session(session);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // Check if payment exists and was captured
    if (!booking.payment?.paymentId || booking.payment?.status !== 'captured') {
      return res.status(400).json({
        success: false,
        error: 'No captured payment found for this booking'
      });
    }

    // Calculate refund amount (default to full amount if not specified)
    const refundAmount = amount || booking.payment.amount;

    // Create refund with Razorpay
    const refund = await razorpay.payments.refund(
      booking.payment.paymentId,
      {
        amount: Math.round(refundAmount * 100), // Convert to paise
        speed: speed,
        notes: {
          reason: reason,
          bookingId: booking._id.toString(),
          requestedBy: req.user?.id || 'system'
        }
      }
    );

    // Update booking with refund details
    booking.payment.refund = {
      ...booking.payment.refund,
      refundId: refund.id,
      amount: refund.amount / 100, // Convert back to rupees
      currency: refund.currency,
      status: refund.status,
      speedRequested: speed,
      processedAt: new Date(),
      reason: reason
    };

    // Update booking status if full refund
    if (refundAmount >= (booking.payment.amount - (booking.payment.refund?.amount || 0))) {
      booking.status = 'cancelled';
      booking.paymentStatus = 'refunded';
    } else {
      booking.paymentStatus = 'partially_refunded';
    }

    await booking.save({ session });
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Refund processed successfully',
      refundId: refund.id,
      amount: refund.amount / 100,
      status: refund.status
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Refund error:', error);
    
    // Handle Razorpay specific errors
    if (error.error) {
      return res.status(400).json({
        success: false,
        error: error.error.description || 'Refund processing failed',
        code: error.error.code
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to process refund'
    });
  }
};

export default {
  createOrder,
  verifyPayment,
  handleWebhook,
  getPaymentDetails,
  refundPayment
};
