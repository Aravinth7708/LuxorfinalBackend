import express from 'express';
import * as authController from '../controllers/authController.js';
import  {authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// Authentication routes
router.post('/register', authController.register);
router.post('/verify-registration-otp', authController.verifyRegistrationOTP);
router.post('/verify-otp', authController.verifyRegistrationOTP);  // Alias for backward compatibility
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/refresh-token', authController.refreshToken);

// Google authentication (no OTP needed)
router.post('/google-auth', authController.handleGoogleAuth);

// Phone authentication (Firebase-based)
router.post('/phone-verify', authController.verifyPhoneAuth);

// Password management with OTP verification
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-reset-otp', authController.verifyResetOTP);
router.post('/resend-otp', authController.resendOTP);

// New routes for phone and email verification
router.post('/check-phone-user', authController.checkPhoneUser);
router.post('/phone-verify-with-email', authController.phoneVerifyWithEmail);
router.post('/send-email-verification', authController.sendEmailVerification);
router.post('/verify-email-otp', authController.verifyEmailOtp);

// Protected routes
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/profile', authMiddleware, authController.updateProfile);
router.post('/change-password', authMiddleware, authController.changePassword);
router.get('/verify-token', authMiddleware, authController.verifyToken);

// Export router
export default router;

