import jwt from 'jsonwebtoken';
import User from '../models/User.js';

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
    
    // Verify token
    try {
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
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Authentication failed',
          details: 'Token expired' 
        });
      }
      
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          error: 'Authentication failed',
          details: 'Invalid token' 
        });
      }
      
      throw jwtError; // Re-throw unexpected errors
    }
  } catch (error) {
    console.error('[AUTH] Auth middleware error:', error.message);
    
    res.status(500).json({ 
      error: 'Server error',
      details: 'Authentication process failed' 
    });
  }
};

export const adminMiddleware = (req, res, next) => {
  // Check if user is authenticated and has admin role
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Access denied',
      details: 'Admin privileges required'
    });
  }




  
  next();
};



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

// Admin middleware - verify user is admin
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

