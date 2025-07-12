import express from 'express';
import * as villaImageController from '../../controllers/admin/villaImageController.js';
import { authMiddleware, admin } from '../../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication and admin privileges
router.use(authMiddleware);
router.use(admin);

// GET image by villa name
router.get('/:villaName', villaImageController.getImageByVillaName);

// GET all villa images (names only, not the base64 data)
router.get('/', villaImageController.getAllVillaImages);

// POST create or update villa image
router.post('/', villaImageController.storeVillaImage);

// DELETE villa image
router.delete('/:villaName', villaImageController.deleteVillaImage);

export default router;