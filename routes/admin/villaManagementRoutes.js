import express from 'express';
import * as villaManagementController from '../../controllers/admin/villaManagementController.js';
import { authMiddleware, admin } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Create villa endpoint
router.post('/', villaManagementController.createVilla);

// Get all villas endpoint
router.get('/', villaManagementController.getAllVillas);

// Get villa by ID endpoint
router.get('/:id', villaManagementController.getVillaById);

// Update villa endpoint
router.put('/:id', villaManagementController.updateVilla);

// DELETE villa endpoint - Make sure this is added
router.delete('/:id', villaManagementController.deleteVilla);

export default router;