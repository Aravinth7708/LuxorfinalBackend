import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './utils/dbConnect.js';

dotenv.config();

import userRoutes from './routes/userRoutes.js';
import villaRoutes from './routes/villaRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import authRoutes from './routes/authRoutes.js';
import photoGalleryRoutes from './routes/photoGalleryRoutes.js';
import newsletterRoutes from './routes/newsletterRoutes.js';
import contactRoutes from './routes/contactRoutes.js';


connectDB()
  .then(() => console.log('Database connection established'))
  .catch(err => {
    console.error('Failed to connect to database:', err.message);
    process.exit(1); // Exit if database connection fails
  });

const app = express();

// Force Express to use router.js (before other middleware)
app.set('case sensitive routing', false);
app.set('strict routing', false);

// Create a basic router instance that Express can use internally
const basicRouter = express.Router();
app.use(basicRouter);

// Make sure express.Router exists and is properly initialized
if (!express.Router) {
  console.error("ERROR: express.Router is not defined!");
  // Create a basic polyfill for Router
  express.Router = function() {
    return basicRouter;
  };
}

// Improved error handling for serverless environments
const isVercel = process.env.VERCEL === '1';

// Add request logging middleware for better debugging on Vercel
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Enhanced CORS configuration with better error handling
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173', 
      'https://luxor-home-stays.vercel.app', 
      
      undefined  // Allow requests with no origin (like mobile apps, curl, etc)
    ];
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  exposedHeaders: ['Content-Range', 'X-Total-Count'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '2mb' })); // Increase JSON payload limit

// Root health check endpoint with more robust error handling
app.get('/', (req, res) => {
  try {
    res.json({
      status: 'ok',
      message: 'LuxorStay API is running',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in root endpoint:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Server encountered an error processing the request',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
});


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

// Export the Express app
export default app;

// Start the server only when this file is executed directly (not when imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (${process.env.NODE_ENV || 'unset'})`);
  });
}