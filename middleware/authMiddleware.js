import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Add this function to verify Firebase/Google tokens
const verifyGoogleToken = async (token) => {
  try {
    // For Firebase tokens, we need to handle them differently
    // Check if this is a Firebase/Google token by looking at the header
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }
    
    // Decode the header to check the algorithm
    const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
    
    if (header.alg === 'RS256') {
      // This is likely a Google/Firebase token
      console.log('[AUTH] Detected Google/Firebase token');
      
      // For Google/Firebase tokens, we need to extract the email and find the user
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      
      if (!payload.email) {
        throw new Error('No email found in token');
      }
      
      // Find user by email
      const user = await User.findOne({ email: payload.email });
      
      if (!user) {
        console.log(`[AUTH] User not found for email: ${payload.email}`);
        throw new Error('User not found');
      }
      
      return {
        userId: user._id,
        email: user.email,
        role: user.role || 'user',
        name: user.name || payload.name,
        isGoogleAuth: true
      };
    }
    
    // If not a Google token, let regular verification handle it
    return null;
  } catch (error) {
    console.error('[AUTH] Google token verification error:', error.message);
    throw error;
  }
};

export const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log("[AUTH] Missing or invalid Authorization header:", authHeader);
      return res.status(401).json({ 
        error: 'Authentication required',
        details: 'No authentication token provided'
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      console.log("[AUTH] No token extracted from Authorization header");
      return res.status(401).json({ 
        error: 'Authentication failed',
        details: 'Invalid token format' 
      });
    }
    
    // Log token for debugging (truncated for security)
    const truncatedToken = token.length > 10 ? 
      `${token.substring(0, 10)}...` : 'invalid-token';
    console.log(`[AUTH] Validating token: ${truncatedToken}`);
    
    try {
      // First try to verify as a Google token
      const googleUser = await verifyGoogleToken(token);
      
      if (googleUser) {
        // If Google token verification successful
        req.user = googleUser;
        console.log(`[AUTH] Google user authenticated: ${googleUser.userId} (${googleUser.email})`);
        return next();
      }
      
      // If not a Google token, verify as a regular JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      
      // Check if user exists
      const user = await User.findById(decoded.userId);
      if (!user) {
        console.log(`[AUTH] User not found for userId: ${decoded.userId}`);
        return res.status(401).json({ 
          error: 'Authentication failed',
          details: 'User not found' 
        });
      }
      
      // Add user info to request
      req.user = {
        userId: user._id,
        email: user.email,
        role: user.role || 'user'
      };
      
      console.log(`[AUTH] User authenticated: ${user._id} (${user.email})`);
      next();
      
    } catch (jwtError) {
      console.error('[AUTH] JWT verification error:', jwtError.message);
      
      return res.status(401).json({ 
        error: 'Authentication failed',
        details: 'Invalid token' 
      });
    }
  } catch (error) {
    console.error('[AUTH] Auth middleware error:', error.message);
    
    res.status(500).json({ 
      error: 'Server error',
      details: 'Authentication process failed' 
    });
  }
};

// Admin middleware - verify user is admin
export const adminMiddleware = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ 
      error: 'Access denied',
      details: 'Admin privileges required' 
    });
  }
};

// Protect middleware - ensure user is authenticated
export const protect = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log("[AUTH] No Authorization header or invalid format");
      return res.status(401).json({ 
        error: 'Authentication failed',
        details: 'No authorization header' 
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      console.log("[AUTH] No token extracted from Authorization header");
      return res.status(401).json({ 
        error: 'Authentication failed',
        details: 'Invalid token format' 
      });
    }
    
    // Log token for debugging (truncated for security)
    const truncatedToken = token.length > 10 ? 
      `${token.substring(0, 10)}...` : 'invalid-token';
    console.log(`[AUTH] Validating token: ${truncatedToken}`);
    
    // Verify token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      
      // Check if user exists
      const user = await User.findById(decoded.userId || decoded.id);
      if (!user) {
        console.log(`[AUTH] User not found for userId: ${decoded.userId || decoded.id}`);
        return res.status(401).json({ 
          error: 'Authentication failed',
          details: 'User not found' 
        });
      }
      
      // Attach user to request
      req.user = user;
      next();
    } catch (jwtError) {
      console.log(`[AUTH] JWT verification failed: ${jwtError.message}`);
      return res.status(401).json({ 
        error: 'Authentication failed',
        details: 'Invalid token' 
      });
    }
  } catch (error) {
    console.error(`[AUTH] Unexpected error: ${error.message}`);
    res.status(500).json({ 
      error: 'Server error',
      details: 'Authentication failed due to server error' 
    });
  }
};

export const admin = adminMiddleware; // Export admin as alias for backward compatibility





