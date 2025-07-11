import express from 'express';
import * as cancelRequestController from '../../controllers/admin/cancelRequestController.js';
import { authMiddleware, admin } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Submit a new cancel request
router.post('/', authMiddleware, cancelRequestController.submitCancelRequest);

// Get user's cancel requests
router.get('/user', authMiddleware, cancelRequestController.getUserCancelRequests);

// Get cancel request by ID
router.get('/:id', authMiddleware, cancelRequestController.getCancelRequestById);

// Admin routes
router.get('/', authMiddleware, admin, cancelRequestController.getAllCancelRequests);
router.put('/:id', authMiddleware, admin, cancelRequestController.processCancelRequest);

export default router;