import express from 'express';
import { 
  getAllSubscribers, 
  addSubscriber, 
  updateSubscriber, 
  deleteSubscriber, 
  exportSubscribersCSV 
} from '../../controllers/newsletterController.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { adminMiddleware } from '../../middleware/adminMiddleware.js';

const router = express.Router();

// All routes require authentication and admin privileges
router.use(authMiddleware);
router.use(adminMiddleware);

// Admin newsletter routes
router.get('/', getAllSubscribers);
router.post('/', addSubscriber);
router.put('/:id', updateSubscriber);
router.delete('/:id', deleteSubscriber);
router.get('/export/csv', exportSubscribersCSV);

export default router;