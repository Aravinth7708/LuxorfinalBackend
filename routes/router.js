/**
 * Express router module
 * Ensures Express can always find a router module
 */

import express from 'express';
const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    platform: 'Vercel'
  });
});

// Router check endpoint
router.get('/router-check', (req, res) => {
  res.json({ message: 'Express router is working' });
});

export default router;
