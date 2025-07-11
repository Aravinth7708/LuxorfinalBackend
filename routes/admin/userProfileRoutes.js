import express from 'express';
import * as userProfileController from '../../controllers/admin/userProfileController.js';
import { authMiddleware, admin } from '../../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication and admin privileges
router.use(authMiddleware);
router.use(admin);

// GET all user profiles
router.get('/', userProfileController.getAllUserProfiles);

// GET user profile by ID
router.get('/:id', userProfileController.getUserProfileById);

// GET profile by user ID
router.get('/user/:userId', userProfileController.getProfileByUserId);

// POST create new profile
router.post('/', userProfileController.createUserProfile);

// PUT update profile
router.put('/:id', userProfileController.updateUserProfile);

// DELETE profile
router.delete('/:id', userProfileController.deleteUserProfile);

export default router;