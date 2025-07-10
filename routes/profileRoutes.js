import express from 'express';
import * as profileController from '../controllers/profileController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get user profile
router.get('/', authMiddleware, profileController.getUserProfile);

// Update user profile
router.put('/update', authMiddleware, profileController.updateProfile);

// Delete profile image
router.delete('/profile-image', authMiddleware, profileController.deleteProfileImage);

// Update phone number
router.post('/update-phone', authMiddleware, profileController.updatePhone);

// Email OTP routes
router.post('/send-email-otp', authMiddleware, profileController.sendEmailOtp);
router.post('/verify-email-otp', authMiddleware, profileController.verifyEmailOtp);

// Image upload route for base64 images
router.post('/upload-image', authMiddleware, profileController.uploadProfileImage);

export default router;