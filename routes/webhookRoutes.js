import express from 'express';
import crypto from 'crypto';
import Booking from '../models/Booking.js';

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
    return res.status(400).json({ error: 'Invalid signature' });
  }

  console.log('✅ Webhook signature verified');
  next();
};

// Main webhook endpoint
router.post('/razorpay/webhook', captureRawBody, verifyWebhookSignature, async (req, res) => {
  try {
    const event = req.body;
    console.log(`📨 Received webhook event: ${event.event}`);

    switch (event.event) {
      case 'payment.captured':
        await handlePaymentCaptured(event.payload.payment.entity);
        break;

      case 'payment.failed':
        await handlePaymentFailed(event.payload.payment.entity);
        break;

      case 'order.paid':
        await handleOrderPaid(event.payload.order.entity);
        break;

      case 'payment.authorized':
        await handlePaymentAuthorized(event.payload.payment.entity);
        break;

      default:
        console.log(`⚠️ Unhandled webhook event: ${event.event}`);
    }

    res.status(200).json({ status: 'ok', message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Handle successful payment capture
const handlePaymentCaptured = async (payment) => {
  try {
    console.log('✅ Payment captured:', {
      paymentId: payment.id,
      orderId: payment.order_id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status
    });

    // Find booking by Razorpay order ID
    const booking = await Booking.findOne({ 
      'paymentDetails.razorpayOrderId': payment.order_id 
    });

    if (!booking) {
      console.error('❌ Booking not found for order ID:', payment.order_id);
      return;
    }

    // Update booking status
    booking.status = 'confirmed';
    booking.paymentStatus = 'paid';
    booking.paymentDetails = {
      ...booking.paymentDetails,
      razorpayPaymentId: payment.id,
      razorpayOrderId: payment.order_id,
      paymentCapturedAt: new Date(),
      paymentMethod: payment.method,
      bank: payment.bank,
      cardId: payment.card_id,
      wallet: payment.wallet,
      vpa: payment.vpa
    };

    await booking.save();
    console.log('✅ Booking updated successfully:', booking._id);

  } catch (error) {
    console.error('❌ Error handling payment captured:', error);
  }
};

// Handle failed payment
const handlePaymentFailed = async (payment) => {
  try {
    console.log('❌ Payment failed:', {
      paymentId: payment.id,
      orderId: payment.order_id,
      errorCode: payment.error_code,
      errorDescription: payment.error_description,
      status: payment.status
    });

    // Find booking by Razorpay order ID
    const booking = await Booking.findOne({ 
      'paymentDetails.razorpayOrderId': payment.order_id 
    });

    if (!booking) {
      console.error('❌ Booking not found for order ID:', payment.order_id);
      return;
    }

    // Update booking status
    booking.status = 'payment_failed';
    booking.paymentStatus = 'failed';
    booking.paymentDetails = {
      ...booking.paymentDetails,
      razorpayPaymentId: payment.id,
      razorpayOrderId: payment.order_id,
      paymentFailedAt: new Date(),
      errorCode: payment.error_code,
      errorDescription: payment.error_description
    };

    await booking.save();
    console.log('✅ Booking status updated to failed:', booking._id);

  } catch (error) {
    console.error('❌ Error handling payment failed:', error);
  }
};

// Handle order paid event
const handleOrderPaid = async (order) => {
  try {
    console.log('🧾 Order paid:', {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      status: order.status
    });

    // Find booking by Razorpay order ID
    const booking = await Booking.findOne({ 
      'paymentDetails.razorpayOrderId': order.id 
    });

    if (!booking) {
      console.error('❌ Booking not found for order ID:', order.id);
      return;
    }

    // Update booking with order details
    booking.paymentDetails = {
      ...booking.paymentDetails,
      razorpayOrderId: order.id,
      orderPaidAt: new Date(),
      orderAmount: order.amount,
      orderCurrency: order.currency
    };

    await booking.save();
    console.log('✅ Order paid event processed:', booking._id);

  } catch (error) {
    console.error('❌ Error handling order paid:', error);
  }
};

// Handle payment authorized (optional)
const handlePaymentAuthorized = async (payment) => {
  try {
    console.log('🔐 Payment authorized:', {
      paymentId: payment.id,
      orderId: payment.order_id,
      status: payment.status
    });

    // Find booking by Razorpay order ID
    const booking = await Booking.findOne({ 
      'paymentDetails.razorpayOrderId': payment.order_id 
    });

    if (!booking) {
      console.error('❌ Booking not found for order ID:', payment.order_id);
      return;
    }

    // Update booking with authorization details
    booking.paymentDetails = {
      ...booking.paymentDetails,
      razorpayPaymentId: payment.id,
      razorpayOrderId: payment.order_id,
      paymentAuthorizedAt: new Date()
    };

    await booking.save();
    console.log('✅ Payment authorization recorded:', booking._id);

  } catch (error) {
    console.error('❌ Error handling payment authorized:', error);
  }
};

// Health check endpoint for webhook
router.get('/razorpay/webhook/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Razorpay webhook endpoint is healthy',
    timestamp: new Date().toISOString()
  });
});

export default router; 