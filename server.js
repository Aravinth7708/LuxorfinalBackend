import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './utils/dbConnect.js';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { securityHeaders } from './middleware/securityMiddleware.js';
import { basicLimiter, authLimiter } from './middleware/rateLimitMiddleware.js';
import { csrfProtection, handleCSRFError } from './middleware/csrfMiddleware.js';
import helmet from 'helmet';
import { validateEnv } from './utils/validateEnv.js';
import bodyParser from 'body-parser';
import { rateLimit } from 'express-rate-limit';
import cookieParser from 'cookie-parser';

// ES module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
import webhookRoutes from './routes/webhookRoutes.js';
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

if (!express.Router) {
  console.error("ERROR: express.Router is not defined!");
  // Create a basic polyfill for Router
  express.Router = function() {
    return basicRouter;
  };
}


const isVercel = process.env.VERCEL === '1';

// Add request logging middleware for better debugging on Vercel
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        styleSrcElem: ["'self'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "http:"],
        connectSrc: [
          "'self'",
          "https://api.razorpay.com",
          "https://luxorholidayhomestays.com",
          "https://www.luxorholidayhomestays.com",
          "https://luxorfinalbackend.onrender.com"
        ],
        frameSrc: ["'self'", "https://checkout.razorpay.com"],
        formAction: ["'self'", "https://checkout.razorpay.com"]
      }
    },
    frameguard: { action: "sameorigin" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    permissionsPolicy: {
      features: {
        geolocation: ["'none'"],
        microphone: ["'none'"]
      }
    }
  })
);


app.use(securityHeaders);

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : ['http://localhost:5173', 'https://www.luxorholidayhomestays.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-razorpay-signature']
};

app.use(cors(corsOptions));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, 
  max: 500, 
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

app.use(apiLimiter);
app.use('/api/auth', authLimiter);

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(cookieParser());

// Special handling for webhook - raw body is needed for signature verification
app.use('/api/payments/webhook', bodyParser.raw({ type: 'application/json' }));

// CSRF protection (exclude API routes and webhooks)
// app.use((req, res, next) => {
//   if (req.path.startsWith('/api/') || req.path.startsWith('/webhook')) {
//     return next();
//   }
//   return csrfProtection(req, res, next);
// });

app.use(handleCSRFError);

// Logging middleware for development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    next();
  });
}

// API Routes
app.use('/api/profile', profileRoutes);
app.use('/api/users', userRoutes);
app.use('/api/villas', villaRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/photo-gallery', photoGalleryRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/complete/profile', phoneProfileRoutes);

// Payment routes - mount before catch-all routes
app.use('/api/payments', paymentRoutes);

// Webhook routes - mount before catch-all routes
app.use('/api/webhook', webhookRoutes);

// Admin routes
app.use('/api/admin', adminPhoneUserRoutes);
app.use('/api/cancel-requests', cancelRequestRoutes);
app.use('/api/admin/amenities', amenitiesRoutes);
app.use('/api/admin/newsletter', adminNewsletterRoutes);
app.use('/api/admin/user-profiles', userProfileRoutes);
app.use('/api/admin/manual-bookings', manualBookingRoutes);
app.use('/api/admin/villa-images', villaImageRoutes);
app.use('/api/villas', villaManagementRoutes);

app.get('/api/rooms/:id', (req, res) => {
  const villaId = req.params.id;
  // Redirect to the villas endpoint
  res.redirect(`/api/villas/${villaId}`);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: err.message
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
      message: 'Please log in again'
    });
  }

  // Handle Razorpay errors
  if (err.error && err.error.error) {
    return res.status(400).json({
      success: false,
      error: 'Payment Error',
      message: err.error.error.description || 'Payment processing failed'
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
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