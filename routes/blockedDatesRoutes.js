import express from 'express';
import {
  getAllBlockedDates,
  getVillaBlockedDates,
  createBlockedDate,
  updateBlockedDate,
  deleteBlockedDate,
  checkVillaAvailability,
  getBlockedDatesSummary
} from '../controllers/blockedDatesController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { adminMiddleware } from '../middleware/adminMiddleware.js';

const router = express.Router();

// Public routes
router.get('/check-availability', checkVillaAvailability);
router.get('/villa/:villaId', getVillaBlockedDates);

// Admin-only routes
router.use(authMiddleware); // All routes below require authentication
router.use(adminMiddleware); // All routes below require admin privileges

router.get('/', getAllBlockedDates);
router.post('/', createBlockedDate);
router.get('/summary', getBlockedDatesSummary);
router.put('/:id', updateBlockedDate);
router.delete('/:id', deleteBlockedDate);

export default router;
