import express from 'express';
import * as profileController from '../controllers/profileController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// Check if address and phone exists in booking/profile
router.get('/check-address-phone-number-exists-inbooking-profile', authMiddleware, profileController.checkaddressinbooking);

// Get user profile data
router.get('/', authMiddleware, profileController.getUserProfile);

// Update user profile
router.put('/update', authMiddleware, profileController.updateUserProfile);

// Upload profile image
router.post('/upload-image', authMiddleware, profileController.uploadProfileImage);

// Add the missing route for updating phone number
router.post('/update-phone', authMiddleware, profileController.updatePhoneNumber);

export default router;