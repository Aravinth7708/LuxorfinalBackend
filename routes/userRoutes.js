import express from 'express';
import * as userController from '../controllers/userController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { sendEmailOtp, verifyEmailOtp } from '../controllers/userProfileController.js';

const router = express.Router();

// Public routes
router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);
router.post('/sync', userController.syncUser);

// Protected routes (require authentication)
router.get('/profile',  userController.getUserProfile);

// Admin routes (require admin role)
router.get('/',  userController.getAllUsers);
router.get('/:id',  userController.getUserById);
router.put('/:id',  userController.updateUser);
router.put('/:id/role',  userController.updateUserRole);
router.delete('/:id',  userController.deleteUser);

// New routes for email OTP
router.post('/send-email-otp', authMiddleware, sendEmailOtp);
router.post('/verify-email-otp', authMiddleware, verifyEmailOtp);

export default router;
