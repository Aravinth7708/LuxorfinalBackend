const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const userRoutes = require('./routes/userRoutes');
const villaRoutes = require('./routes/villaRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const authRoutes = require('./routes/authRoutes');
const photoGalleryRoutes = require('./routes/photoGalleryRoutes');
const newsletterRoutes = require('./routes/newsletterRoutes');
const contactRoutes = require('./routes/contactRoutes');

const app = express();

// Improved error handling for serverless environments
const isVercel = process.env.VERCEL === '1';

// Add request logging middleware for better debugging on Vercel
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Enhanced CORS configuration with better error handling
app.use(cors({
  origin: ['http://localhost:5173', 'https://luxor-home-stays.vercel.app', 'https://luxorhomestays.com'],
  credentials: true,
  exposedHeaders: ['Content-Range', 'X-Total-Count'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '2mb' })); // Increase JSON payload limit

// Root health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'LuxorStay API is running',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/users', userRoutes);
app.use('/api/villas', villaRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/photo-gallery', photoGalleryRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/contact', contactRoutes);

// Special redirect for /rooms/:id to /villas/:id for backward compatibility
app.get('/api/rooms/:id', (req, res) => {
  const villaId = req.params.id;
  // Redirect to the villas endpoint
  res.redirect(`/api/villas/${villaId}`);
});

// Global error handler - improved for serverless environments
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  // Format error for API response
  const statusCode = err.status || 500;
  const errorResponse = {
    error: err.message || 'Internal server error',
    status: statusCode,
    path: req.path,
    timestamp: new Date().toISOString()
  };
  
  // Add stack trace in development
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.stack = err.stack;
  }
  
  res.status(statusCode).json(errorResponse);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `The requested endpoint ${req.path} does not exist`
  });
});

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/luxor';

// Enhanced MongoDB connection with retry logic for serverless environment
const connectWithRetry = async (retries = 5, delay = 5000) => {
  let lastError;
  
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`MongoDB connection attempt ${i + 1}/${retries}`);
      await mongoose.connect(MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 10000, // Timeout after 10s
        socketTimeoutMS: 45000, // Socket timeout after 45s
      });
      console.log('MongoDB connected successfully');
      return;
    } catch (err) {
      console.error(`MongoDB connection attempt ${i + 1} failed:`, err.message);
      lastError = err;
      
      if (i < retries - 1) {
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`Failed to connect to MongoDB after ${retries} attempts: ${lastError.message}`);
};

// Handle connection differently based on environment
if (isVercel) {
  // For Vercel serverless environment, connect before handling requests
  connectWithRetry()
    .then(() => {
      console.log('MongoDB connected for Vercel serverless environment');
    })
    .catch(err => {
      console.error('Fatal: MongoDB connection failed in serverless environment:', err);
      // Don't exit the process in serverless, as it will restart anyway
    });
  
  // Export the app for serverless function
  module.exports = app;
} else {
  // For traditional environment, start server after connecting
  connectWithRetry()
    .then(() => {
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch(err => {
      console.error('Fatal: MongoDB connection failed:', err);
      process.exit(1);
    });
}