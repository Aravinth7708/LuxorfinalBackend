import express from 'express';
import mongoose from 'mongoose';
import Villa from '../models/Villa';

const router = express.Router();

// Debug route to check MongoDB connection status
router.get('/mongo-status', async (req, res) => {
  try {
    const state = mongoose.connection.readyState;
    const stateMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
      99: 'uninitialized'
    };
    
    res.json({
      isConnected: state === 1,
      state: stateMap[state] || 'unknown',
      databaseName: mongoose.connection.name,
      host: mongoose.connection.host
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Debug route to check image formats in database
router.get('/image-test', async (req, res) => {
  try {
    // Find a villa with images
    const villa = await Villa.findOne({ 
      images: { $exists: true, $ne: [] }
    });
    
    if (!villa || !villa.images || villa.images.length === 0) {
      return res.json({ 
        success: false, 
        message: 'No villas with images found' 
      });
    }
    
    // Get info about the first image
    const firstImage = villa.images[0];
    const imageInfo = {
      villaId: villa._id,
      villaName: villa.name,
      imageType: typeof firstImage,
      isBase64: typeof firstImage === 'string' && 
        (firstImage.startsWith('data:image') || 
         firstImage.length > 100), // Rough check if it could be base64
      preview: typeof firstImage === 'string' ? 
        firstImage.substring(0, 100) + '...' : 'Not a string',
      imageCount: villa.images.length
    };
    
    res.json({
      success: true,
      imageInfo
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Debug routes for testing and monitoring
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Debug API is working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

router.get('/env', (req, res) => {
  // Only return safe environment variables
  const safeEnvVars = {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    SERVER_URL: process.env.SERVER_URL,
    API_VERSION: process.env.API_VERSION || '1.0.0',
  };
  
  res.json({
    success: true,
    environment: safeEnvVars
  });
});

router.get('/error', (req, res, next) => {
  // Deliberately trigger an error for testing error handling
  try {
    throw new Error('Test error triggered via debug endpoint');
  } catch (error) {
    next(error);
  }
});

export default router;
