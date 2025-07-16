import express from 'express';
import crypto from 'crypto';
import Booking from '../models/Booking.js';
import Villa from '../models/Villa.js';
import emailService from '../utils/email.js';

const router = express.Router();

// Razorpay webhook secret - should be stored in environment variables
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'luxorSecret123';

// Middleware to capture raw body for signature verification
const captureRawBody = (req, res, next) => {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', chunk => {
    data += chunk;
  });
  req.on('end', () => {
    req.rawBody = data;
    next();
  });
};

// Verify Razorpay webhook signature
const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['x-razorpay-signature'];
  
  if (!signature) {
    console.error('❌ Webhook signature missing');
    return res.status(400).json({ error: 'Webhook signature missing' });
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest('hex');
    
  if (signature !== expectedSignature) {
    console.error('❌ Invalid webhook signature');
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }
  
  console.log('✅ Webhook signature verified');
  next();
};

// Main webhook endpoint for Razorpay
router.post('/razorpay/webhook', 
  captureRawBody,
  verifyWebhookSignature,
  express.json(),
  async (req, res) => {
    try {
      console.log('📨 Received webhook event:', req.body.event);
      
      const event = req.body;
      let result;

      // Route to appropriate handler based on event type
      switch (event.event) {
        case 'payment.captured':
          result = await handlePaymentCaptured(event.payload.payment.entity);
          break;
        case 'payment.failed':
          result = await handlePaymentFailed(event.payload.payment.entity);
          break;
        case 'order.paid':
          result = await handleOrderPaid(event.payload.order.entity);
          break;
        case 'payment.authorized':
          result = await handlePaymentAuthorized(event.payload.payment.entity);
          break;
        default:
          console.log(`ℹ️ Unhandled event type: ${event.event}`);
          return res.status(200).json({ status: 'unhandled_event' });
      }

      if (result && !result.success) {
        console.error('❌ Webhook handler error:', result.error);
        return res.status(400).json({ 
          status: 'error',
          error: result.error 
        });
      }

      console.log(`✅ Successfully processed ${event.event} event`);
      res.status(200).json({ status: 'success' });
      
    } catch (error) {
      console.error('❌ Webhook processing error:', error);
      res.status(500).json({ 
        status: 'error',
        error: 'Internal server error' 
      });
    }
  }
);

// Handle successful payment capture
async function handlePaymentCaptured(payment) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    console.log(`✅ Processing payment captured: ${payment.id}`);
    
    // Find the booking using the payment ID
    const booking = await Booking.findOne({ 'payment.paymentId': payment.id })
      .session(session)
      .populate('villa');

    if (!booking) {
      throw new Error(`No booking found for payment ID: ${payment.id}`);
    }

    // Update booking status
    booking.paymentStatus = 'paid';
    booking.status = 'confirmed';
    booking.payment = {
      ...booking.payment,
      status: 'captured',
      capturedAt: new Date(),
      method: payment.method,
      cardId: payment.card_id,
      bank: payment.bank,
      wallet: payment.wallet,
      vpa: payment.vpa,
      email: payment.email,
      contact: payment.contact
    };

    await booking.save({ session });
    
    // Update villa availability if needed
    if (booking.villa) {
      await Villa.findByIdAndUpdate(
        booking.villa._id,
        { $addToSet: { bookedDates: { $each: booking.dates } } },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    // Send confirmation email
    await emailService.sendBookingConfirmation(booking);
    
    console.log(`✅ Payment ${payment.id} captured and booking ${booking._id} updated`);
    return { success: true };
    
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('❌ Error in handlePaymentCaptured:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

// Handle failed payment
async function handlePaymentFailed(payment) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    console.log(`❌ Processing failed payment: ${payment.id}`);
    
    // Find the booking using the payment ID
    const booking = await Booking.findOne({ 'payment.paymentId': payment.id })
      .session(session);

    if (!booking) {
      throw new Error(`No booking found for failed payment ID: ${payment.id}`);
    }

    // Update booking status
    booking.paymentStatus = 'failed';
    booking.status = 'cancelled';
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
    
    // No need to update villa availability since the booking wasn't confirmed
    await session.commitTransaction();
    session.endSession();

    console.log(`❌ Payment ${payment.id} failed for booking ${booking._id}`);
    return { success: true };
    
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('❌ Error in handlePaymentFailed:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

async function handleOrderPaid(order) {
  try {
    console.log(`✅ Order paid: ${order.id}`);
    
  
    const existingBooking = await Booking.findOne({ 'payment.orderId': order.id });
    
    if (existingBooking && existingBooking.paymentStatus === 'paid') {
      console.log(`Order ${order.id} already processed`);
      return { success: true };
    }
    
    // Process the payment if not already done
    if (order.payments && order.payments.length > 0) {
      const payment = order.payments[0];
      if (payment.status === 'captured') {
        return await handlePaymentCaptured(payment);
      }
    }
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error in handleOrderPaid:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

// Handle payment authorized (optional)
async function handlePaymentAuthorized(payment) {
  try {
    console.log(`🔒 Payment authorized: ${payment.id}`);
    
    // For subscriptions or manual capture flows
    // You might want to update the booking status to 'authorized'
    // and capture the payment later
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error in handlePaymentAuthorized:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

// Health check endpoint for webhook
router.get('/razorpay/webhook/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    webhookSecretConfigured: !!process.env.RAZORPAY_WEBHOOK_SECRET
  });
});

// Error handling middleware
router.use((err, req, res, next) => {
  console.error('❌ Webhook error middleware:', err);
  
  if (res.headersSent) {
    return next(err);
  }
  
  res.status(500).json({
    status: 'error',
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

export default router;