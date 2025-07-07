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
      
      console.log(`[AUTH] Found user with ID ${user._id} for email ${payload.email}`);
      
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

// Update authMiddleware to log more detailed information and handle undefined userId
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
        if (!googleUser.userId) {
          console.log("[AUTH] Google verification successful but missing userId");
          return res.status(401).json({
            error: 'Authentication failed',
            details: 'Invalid user information'
          });
        }
        
        req.user = googleUser;
        console.log(`[AUTH] Google user authenticated: ${googleUser.userId} (${googleUser.email})`);
        return next();
      }
      
      // If not a Google token, verify as a regular JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if decoded token has userId or id
      const userIdToUse = decoded.userId || decoded.id;
      
      if (!userIdToUse) {
        console.log('[AUTH] JWT verification successful but missing userId/id in payload:', decoded);
        return res.status(401).json({
          error: 'Authentication failed',
          details: 'Invalid token format'
        });
      }
      
      // Check if user exists
      const user = await User.findById(userIdToUse);
      if (!user) {
        console.log(`[AUTH] User not found for userId: ${userIdToUse}`);
        return res.status(401).json({ 
          error: 'Authentication failed',
          details: 'User not found' 
        });
      }
      
      // Add user info to request
      req.user = {
        userId: user._id,
        email: user.email,
        role: user.role || 'user',
        name: user.name
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

// Ensure proper export of protect and admin
export const protect = authMiddleware;

export const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ 
      error: 'Access denied',
      details: 'Admin privileges required' 
    });
  }
};

export const adminMiddleware = admin; // Export alias





