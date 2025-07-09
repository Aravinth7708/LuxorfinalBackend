import express from 'express';
import * as phoneProfileController from '../controllers/phoneProfileController.js';

const router = express.Router();

// Routes for phone user profile completion
router.post('/email/verify', phoneProfileController.sendProfileVerificationEmail);
router.post('/email/update', phoneProfileController.verifyAndUpdateProfile);

export default router;