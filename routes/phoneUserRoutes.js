import express from 'express';
import { getAllPhoneUsers, getPhoneUserById, createPhoneUser, updatePhoneUser, deletePhoneUser } from '../controllers/phoneUserController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public route for registration
router.post('/register', createPhoneUser);

// Protected routes (require authentication)
router.get('/', authMiddleware, getAllPhoneUsers);
router.get('/:id', authMiddleware, getPhoneUserById);
router.put('/:id', authMiddleware, updatePhoneUser);
router.delete('/:id', authMiddleware, deletePhoneUser);

export default router;