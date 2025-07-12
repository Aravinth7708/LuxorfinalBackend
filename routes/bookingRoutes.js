import express from "express"
import * as bookingController from "../controllers/bookingController.js"
import { protect, admin, authMiddleware } from "../middleware/authMiddleware.js"

const router = express.Router()

// Create a new booking
router.post("/create", authMiddleware, bookingController.createBooking)
// Add this to your existing routes
router.get('/guest-details', bookingController.getBookingGuestDetails);
// Search bookings by date range
router.get("/search", bookingController.searchBookings)

// Get user's bookings
router.get("/user-bookings", authMiddleware, bookingController.getUserBookings)

// Get user's address information from profile and previous bookings
router.get("/user-address-info", authMiddleware, bookingController.getUserAddressInfo)

// Get a specific booking by ID
router.get("/:id", authMiddleware, bookingController.getBookingById)

// Cancel a booking
router.post("/:id/cancel", authMiddleware, (req, res, next) => {
  console.log(`[ROUTE] Cancel booking request received for ID: ${req.params.id}`)
  console.log(`[ROUTE] Request body:`, req.body)
  console.log(`[ROUTE] User info:`, {
    id: req.user?.userId,
    email: req.user?.email,
    role: req.user?.role,
  })

  // Pass to the controller
  bookingController.cancelBooking(req, res, next)
})

// Check availability
router.get('/check-availability', authMiddleware, bookingController.checkAvailability);

// Get blocked dates for a specific villa
router.get("/blocked-dates/:villaId", bookingController.getBlockedDates)

// Admin routes for managing all bookings
router.get("/admin/all", protect, admin, bookingController.getAllBookings)

export default router
