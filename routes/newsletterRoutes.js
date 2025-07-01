import express from 'express';
import * as newsletterController from '../controllers/newsletterController.js';
import { authMiddleware, adminMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/subscribe', newsletterController.subscribe);
router.post('/unsubscribe', newsletterController.unsubscribe);

// Protected admin routes
router.get('/subscribers', authMiddleware, adminMiddleware, newsletterController.getAllSubscribers);
router.post('/send', authMiddleware, adminMiddleware, newsletterController.sendNewsletter);

export default router;
