import express from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { adminMiddleware } from '../../middleware/adminMiddleware.js';
import {
  createOffer,
  getAllOffers,
  getOfferById,
  updateOffer,
  deleteOffer,
  toggleOfferStatus
} from '../../controllers/admin/offersController.js';

const router = express.Router();

// All routes require authentication and admin privileges
router.use(authMiddleware);
router.use(adminMiddleware);

// CRUD operations for offers
router.post('/', createOffer);
router.get('/', getAllOffers);
router.get('/:id', getOfferById);
router.put('/:id', updateOffer);
router.delete('/:id', deleteOffer);
router.patch('/:id/toggle-status', toggleOfferStatus);

export default router;
