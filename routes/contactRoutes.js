import express from 'express';
import * as contactController from '../controllers/contactController.js';

const router = express.Router();

// POST /api/contact - Submit contact form (handle both paths)
router.post('/', contactController.submitContactForm);

// Also keep the /submit endpoint for backward compatibility
router.post('/submit', contactController.submitContactForm);

export default router;
