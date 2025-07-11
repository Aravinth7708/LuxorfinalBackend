import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './utils/dbConnect.js';

dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error('ERROR: JWT_SECRET environment variable is not set!');
  process.exit(1);
}

import userRoutes from './routes/userRoutes.js';
import villaRoutes from './routes/villaRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import authRoutes from './routes/authRoutes.js';
import photoGalleryRoutes from './routes/photoGalleryRoutes.js';
import newsletterRoutes from './routes/newsletterRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import phoneProfileRoutes from './routes/phoneProfileRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import adminPhoneUserRoutes from './routes/admin/adminPhoneUserRoutes.js';
import cancelRequestRoutes from './routes/admin/cancelRequestRoutes.js'; // Add this import with your other imports
import amenitiesRoutes from './routes/admin/amenitiesRoutes.js'; // Add this import with your other imports
import userProfileRoutes from './routes/admin/userProfileRoutes.js';
import adminNewsletterRoutes from './routes/admin/newsletterRoutes.js';
import manualBookingRoutes from './routes/admin/manualBookingRoutes.js'; // Add this import with your other imports
import villaImageRoutes from './routes/admin/villaImageRoutes.js'; // Add this import with your other imports
import villaManagementRoutes from './routes/admin/villaManagementRoutes.js'; // Add this import with your other imports

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
  origin:
    [
      'http://localhost:5173', 
      'http://localhost:5174',
      'https://luxor-omega.vercel.app', 
      'http://localhost:5176',
      'https://www.luxorholidayhomestays.com',
      'https://luxorholidayhomesstays.vercel.app',
      
      undefined  
    ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  credentials: true,
  exposedHeaders: ['Content-Range', 'X-Total-Count'],
  maxAge: 86400, // Cache preflight response for 24 hours
  optionsSuccessStatus: 204, // Use 204 for successful OPTIONS requests

}));

app.use(express.json({ limit: '2mb' })); // Increase JSON payload limit
app.use(express.urlencoded({ extended: true })); // Support URL-encoded bodies

// Add this middleware to serve uploaded images
app.use('/uploads', express.static('uploads'));

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



// Then add this line with your other route registrations
app.use('/api/profile', profileRoutes);
app.use('/api/users', userRoutes);
app.use('/api/villas', villaRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/photo-gallery', photoGalleryRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api', profileRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/complete/profile', phoneProfileRoutes); // No auth middleware
app.use('/api/admin', adminPhoneUserRoutes); // Admin-only routes for phone user management
app.use('/api/cancel-requests', cancelRequestRoutes); // Add this line with your other route registrations
app.use('/api/admin/amenities', amenitiesRoutes); // Add this line with your other route registrations
app.use('/api/admin/newsletter', adminNewsletterRoutes);
app.use('/api/admin/user-profiles', userProfileRoutes);
app.use('/api/admin/manual-bookings', manualBookingRoutes); // Add this line with your other route registrations
app.use('/api/admin/villa-images', villaImageRoutes); // Add this line with your other route registrations
app.use('/api/villas', villaManagementRoutes); // Add this line with your other route registrations

app.get('/api/rooms/:id', (req, res) => {
  const villaId = req.params.id;
  // Redirect to the villas endpoint
  res.redirect(`/api/villas/${villaId}`);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server error', error: err.message });
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
  const PORT =  5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (${process.env.NODE_ENV || 'unset'})`);
  });
}