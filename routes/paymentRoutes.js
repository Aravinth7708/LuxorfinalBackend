import express from 'express';
import { body } from 'express-validator';
import { authMiddleware as authenticate } from '../middleware/authMiddleware.js';
import { 
  createOrder, 
  verifyPayment, 
  getPaymentDetails,
  refundPayment,
  handleRazorpayWebhook as handleWebhook,
  logPaymentError,
  storePaymentDetails
} from '../controllers/paymentController.js';

const router = express.Router();

// Razorpay webhook (no authentication required for webhook)
router.post('/webhook', 
  express.raw({ type: 'application/json' }), 
  handleWebhook
);

// Create Razorpay order
router.post('/create-order', 
  authenticate,
  [
    body('amount').isNumeric().withMessage('Amount must be a number'),
    body('currency').optional().isString().isLength({ min: 3, max: 3 }),
    body('receipt').isString().withMessage('Receipt ID is required'),
    body('notes').optional().isObject()
  ],
  createOrder
);

// Verify payment and update booking
router.post('/verify', 
  authenticate,
  [
    body('razorpay_payment_id').isString().notEmpty(),
    body('razorpay_order_id').optional().isString(),
    body('razorpay_signature').isString().notEmpty(),
    body('bookingId').optional().isMongoId()
  ],
  (req, res, next) => {
    // Ensure at least one of razorpay_order_id or bookingId is provided
    if (!req.body.razorpay_order_id && !req.body.bookingId) {
      return res.status(400).json({
        success: false,
        error: 'Either razorpay_order_id or bookingId is required'
      });
    }
    next();
  },
  verifyPayment
);

// Get payment details for a specific booking
router.get('/:bookingId', 
  authenticate,
  getPaymentDetails
);

// Process refund (admin only)
router.post('/refund', 
  authenticate,
  [
    body('paymentId').isString().notEmpty(),
    body('amount').isNumeric(),
    body('bookingId').isMongoId()
  ],
  refundPayment
);

// Log payment error
router.post('/error-log', 
  authenticate,
  logPaymentError
);

// Store payment details and create booking
router.post('/store-payment', 
  authenticate, 
  storePaymentDetails
);

export default router;
