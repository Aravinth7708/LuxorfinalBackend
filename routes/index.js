/**
 * Main routes index file
 * This serves as a backup in case Express can't find a router module
 */

import express from 'express';
import authRoutes from './authRoutes.js';
import villaRoutes from './villaRoutes.js';
import bookingRoutes from './bookingRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import phoneProfileRoutes from './phoneProfileRoutes.js';
import blockedDatesRoutes from './blockedDatesRoutes.js';

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API is healthy',
    timestamp: new Date().toISOString()
  });
});

// Define all routes
router.use('/auth', authRoutes);
router.use('/villas', villaRoutes);
router.use('/bookings', bookingRoutes);
router.use('/payments', paymentRoutes);
router.use('/complete/profile', phoneProfileRoutes);
router.use('/admin/blocked-dates', blockedDatesRoutes);

export default router;
