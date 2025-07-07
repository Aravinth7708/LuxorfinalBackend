import express from 'express';
import { getUserProfile, updateProfile, deleteProfileImage } from '../controllers/profileController.js';
import { authMiddleware} from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Profile routes
router.get('/profile', getUserProfile);
router.put('/profile', updateProfile);
router.delete('/profile/image', deleteProfileImage);

export default router;