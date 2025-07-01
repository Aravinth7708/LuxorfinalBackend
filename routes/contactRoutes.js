import express from 'express';
import * as contactController from '../controllers/contactController.js';

const router = express.Router();

// POST /api/contact/submit - Submit contact form
router.post('/submit', contactController.submitContactForm);

export default router;
