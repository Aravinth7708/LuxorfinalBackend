import express from 'express';
import * as villaController from '../controllers/villaController.js';

const router = express.Router();

router.post('/add', villaController.addVillas); // Add one or many villas
router.get('/', villaController.getAllVillas); // Get all villas
router.get('/search', villaController.searchVillas); // Search/filter villas
router.get('/:id', villaController.getVillaById); // Get villa by ID

export default router;
