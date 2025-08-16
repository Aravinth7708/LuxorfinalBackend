import express from 'express';
import { getVillaAmenities, getAllVillasAmenities } from '../controllers/amenitiesController.js';

const router = express.Router();

// Public routes - no authentication required for users to view amenities
router.get('/villa/:villaName', getVillaAmenities);
router.get('/all', getAllVillasAmenities);

export default router;
