import express from 'express';
import { authMiddleware, admin } from '../../middleware/authMiddleware.js';
import {
  getAllPhoneUsers,
  getPhoneUserById,
  createPhoneUser,
  updatePhoneUser,
  deletePhoneUser
} from '../../controllers/phoneUserController.js';

const router = express.Router();

// Require both authentication and admin role for all routes in this router
router.use(authMiddleware);
router.use(admin);

// Connect routes to controller functions
router.get('/phone-users', getAllPhoneUsers);
router.get('/phone-users/:id', getPhoneUserById);
router.post('/phone-users', createPhoneUser);
router.put('/phone-users/:id', updatePhoneUser);
router.delete('/phone-users/:id', deletePhoneUser);

export default router;
