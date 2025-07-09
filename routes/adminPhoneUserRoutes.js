import express from 'express';
import { getAllPhoneUsers, getPhoneUserById, updatePhoneUser, createPhoneUser, deletePhoneUser } from '../controllers/phoneUserController.js';
import { authMiddleware, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication and admin privileges
router.use(authMiddleware);
router.use(admin);

// Phone user management routes
router.get('/phone-users', getAllPhoneUsers);
router.get('/phone-users/:id', getPhoneUserById);
router.put('/phone-users/:id', updatePhoneUser);
router.post('/phone-users', createPhoneUser);
router.delete('/phone-users/:id', deletePhoneUser);

export default router;
