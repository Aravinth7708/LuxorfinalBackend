import express from 'express';
import * as photoGalleryController from '../controllers/photoGalleryController.js';
import { authMiddleware, adminMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', photoGalleryController.getAllPhotos);
router.get('/featured', photoGalleryController.getFeaturedPhotos);
router.get('/category/:category', photoGalleryController.getPhotosByCategory);
router.get('/:id', photoGalleryController.getPhotoById);

// Admin routes with authentication and admin middleware
router.post('/', authMiddleware, adminMiddleware, photoGalleryController.addPhoto);
router.put('/:id', authMiddleware, adminMiddleware, photoGalleryController.updatePhoto);
router.delete('/:id', authMiddleware, adminMiddleware, photoGalleryController.deletePhoto);

export default router;
