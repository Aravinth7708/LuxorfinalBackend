import express from 'express';
import * as photoGalleryController from '../controllers/photoGalleryController.js';

const router = express.Router();

// Routes currently implemented in the controller
router.post('/save', photoGalleryController.saveGallery);
router.get('/:villaId', photoGalleryController.getGallery);

export default router;
