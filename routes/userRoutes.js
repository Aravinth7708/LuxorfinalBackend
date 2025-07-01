import express from 'express';
import * as userController from '../controllers/userController.js';

const router = express.Router();

router.post('/sync', userController.syncUser);
router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);
router.get('/profile', userController.getUserProfile);

export default router;
