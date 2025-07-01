/**
 * Main routes index file
 * This serves as a backup in case Express can't find a router module
 */

import express from 'express';
const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API is healthy',
    timestamp: new Date().toISOString()
  });
});

export default router;
