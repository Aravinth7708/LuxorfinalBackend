import express from 'express';
import * as villaManagementController from '../controllers/villaManagementController.js';
import { authMiddleware, adminMiddleware } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Create a new villa (admin only)
router.post('/', authMiddleware, adminMiddleware, villaManagementController.createVilla);

// Get all villas (admin view)
router.get('/', authMiddleware, adminMiddleware, villaManagementController.getAllVillas);

// Get villa by ID
router.get('/:id', authMiddleware, adminMiddleware, villaManagementController.getVillaById);

// Update villa (admin only)
router.put('/:id', authMiddleware, adminMiddleware, villaManagementController.updateVilla);

// Delete villa (admin only)
router.delete('/:id', authMiddleware, adminMiddleware, villaManagementController.deleteVilla);

export default router;