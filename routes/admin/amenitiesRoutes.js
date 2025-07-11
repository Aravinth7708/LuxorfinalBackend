import express from 'express';
import * as amenitiesController from '../../controllers/admin/amenitiesController.js';
import { authMiddleware, admin } from '../../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication and admin privileges
router.use(authMiddleware);
router.use(admin);

// GET all amenities
router.get('/', amenitiesController.getAllAmenities);

// GET amenity by ID
router.get('/:id', amenitiesController.getAmenityById);

// GET amenities by location
router.get('/location/:location', amenitiesController.getAmenitiesByLocation);

// POST create new amenity
router.post('/', amenitiesController.createAmenity);

// PUT update amenity
router.put('/:id', amenitiesController.updateAmenity);

// DELETE amenity
router.delete('/:id', amenitiesController.deleteAmenity);

export default router;