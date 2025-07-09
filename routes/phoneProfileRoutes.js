import express from 'express';
import { sendProfileVerificationEmail, verifyAndUpdateProfile } from '../controllers/phoneProfileController.js';

const router = express.Router();

// Routes for phone user profile completion
router.post('/email/verify', sendProfileVerificationEmail);
router.post('/email/update', verifyAndUpdateProfile);

export default router;