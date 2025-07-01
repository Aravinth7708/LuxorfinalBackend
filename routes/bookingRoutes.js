const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Create a new booking
router.post('/create', authMiddleware, bookingController.createBooking);

// Search bookings by date range
router.get('/search', bookingController.searchBookings);

// Get user's bookings
router.get('/user-bookings', authMiddleware, bookingController.getUserBookings);

// Get a specific booking by ID
router.get('/:id', authMiddleware, bookingController.getBookingById);

// Cancel a booking
router.post('/:id/cancel', authMiddleware, bookingController.cancelBooking);

module.exports = router;
