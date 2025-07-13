import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './utils/dbConnect.js';
import https from 'https';
import fs from 'fs';
import { securityHeaders } from './middleware/securityMiddleware.js';
import { basicLimiter, authLimiter } from './middleware/rateLimitMiddleware.js';
import { csrfProtection, handleCSRFError } from './middleware/csrfMiddleware.js';
import helmet from 'helmet';
import { validateEnv } from './utils/validateEnv.js';

dotenv.config();

// Validate environment variables before starting server
validateEnv();

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

// Apply security middleware early in the chain
app.use(helmet()); // Add this after installing helmet package
app.use(securityHeaders);

// Apply rate limiting
app.use(basicLimiter);
app.use('/api/auth', authLimiter);

// Enable CORS with strict options
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://luxorholidayhomestays.com', 'https://www.luxorholidayhomestays.com']
    : 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400
}));

app.use(express.json({ limit: '100kb' })); // Increase JSON payload limit
app.use(express.urlencoded({ extended: true, limit: '100kb' })); // Support URL-encoded bodies


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
  // Use HTTPS in production
if (process.env.NODE_ENV === 'production') {
  try {
    const privateKey = fs.readFileSync('/path/to/privkey.pem', 'utf8');
    const certificate = fs.readFileSync('/path/to/cert.pem', 'utf8');
    const ca = fs.readFileSync('/path/to/chain.pem', 'utf8');

    const credentials = {
      key: privateKey,
      cert: certificate,
      ca: ca
    };

    const httpsServer = https.createServer(credentials, app);
    
    httpsServer.listen(process.env.HTTPS_PORT || 443, () => {
      console.log(`HTTPS Server running on port ${process.env.HTTPS_PORT || 443}`);
    });
  } catch (error) {
    console.error('Failed to start HTTPS server:', error);
    // Fall back to HTTP if certificate files are not available
    startHttpServer();
  }
} else {
  startHttpServer();
}

function startHttpServer() {
  app.listen(process.env.PORT || 5000, () => {
    console.log(`HTTP Server running on port ${process.env.PORT || 5000}`);
  });
}
}