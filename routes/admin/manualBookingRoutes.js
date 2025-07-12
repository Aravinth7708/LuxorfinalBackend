import express from 'express';
import * as manualBookingController from '../../controllers/admin/manualBookingController.js';
import { authMiddleware, adminMiddleware } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Add this new route - place it before any routes with :id parameters
router.get('/blocked-dates', authMiddleware, adminMiddleware, manualBookingController.getVillaBlockedDates);

// Keep your existing routes
router.post('/', authMiddleware, adminMiddleware, manualBookingController.createManualBooking);
router.get('/', authMiddleware, adminMiddleware, manualBookingController.getAllManualBookings);
router.get('/check-availability', authMiddleware, adminMiddleware, manualBookingController.checkVillaAvailability);

export default router;