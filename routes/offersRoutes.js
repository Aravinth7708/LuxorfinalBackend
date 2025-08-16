import express from 'express';
import {
  getVillaOffers,
  getVillaOfferForDate,
  getVillaOffersForDateRange,
  getAllActiveOffers
} from '../controllers/offersController.js';

const router = express.Router();

// Get active offers for a specific villa
router.get('/villa/:villaName', getVillaOffers);

// Get offer for a specific villa and date
router.get('/villa/:villaName/date', getVillaOfferForDate);

// Get offers for a villa within a date range
router.get('/villa/:villaName/date-range', getVillaOffersForDateRange);

// Get all active offers
router.get('/active', getAllActiveOffers);

export default router;
