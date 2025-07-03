import express from 'express';
import { authMiddleware as authenticate } from '../middleware/authMiddleware.js';
import { 
  createOrder, 
  verifyPayment, 
  getPaymentDetails,
  refundPayment 
} from '../controllers/paymentController.js';

const router = express.Router();

// Create Razorpay order
router.post('/create-order', authenticate, createOrder);

// Verify payment and create booking
router.post('/verify', authenticate, verifyPayment);

// Get payment details for a specific booking
router.get('/:bookingId', authenticate, getPaymentDetails);

// Process refund (admin only)
router.post('/refund/:bookingId', authenticate, refundPayment);

export default router;
