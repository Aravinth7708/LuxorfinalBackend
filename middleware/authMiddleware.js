import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Authentication required',
        details: 'No authentication token provided'
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication failed',
        details: 'Invalid token format' 
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user exists
    const user = await User.findById(decoded.userId);
    if (!user) {
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
    
    next();
  } catch (error) {
    console.error('[AUTH] Auth error:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Authentication failed',
        details: 'Token expired' 
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Authentication failed',
        details: 'Invalid token' 
      });
    }
    
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
