import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import PhoneUser from '../models/PhoneUser.js';


const verifyGoogleToken = async (token) => {
  try {

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }
    
 
    const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
    
    if (header.alg === 'RS256') {
  
      console.log('[AUTH] Detected Google/Firebase token');
      
 
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      
      if (!payload.email) {
        throw new Error('No email found in token');
      }
      
   
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
    

    return null;
  } catch (error) {
    console.error('[AUTH] Google token verification error:', error.message);
    throw error;
  }
};


export const authMiddleware = async (req, res, next) => {
  try {
    // Get token from cookie or Authorization header
    let token = req.cookies.token;
    
    // If no token in cookies, check Authorization header
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
        console.log("[AUTH] Token found in Authorization header");
      }
    } else {
      console.log("[AUTH] Token found in cookies");
    }
    
    if (!token) {
      console.log("[AUTH] No token found in cookies or Authorization header");
      return res.status(401).json({ 
        error: 'Authentication required',
        details: 'No authentication token provided'
      });
    }
    
    // Check for simple admin token format (admin-token-timestamp)
    if (token.startsWith('admin-token-')) {
      console.log('[AUTH] Admin token detected');
      req.user = {
        userId: 'admin',
        email: 'admin@gmail.com',
        role: 'admin',
        name: 'Admin',
        userType: 'admin'
      };
      console.log('[AUTH] Admin authentication successful');
      return next();
    }
    
    // Log truncated token for debugging
    const truncatedToken = token.length > 10 ? 
      `${token.substring(0, 10)}...` : 'invalid-token';
    console.log(`[AUTH] Validating token from cookie: ${truncatedToken}`);
    
    try {
  
      const googleUser = await verifyGoogleToken(token);
      
      if (googleUser) {
   
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
      
   
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
    
      const userIdToUse = decoded.userId || decoded.id;
      
      if (!userIdToUse) {
        console.log('[AUTH] JWT verification successful but missing userId/id in payload:', decoded);
        return res.status(401).json({
          error: 'Authentication failed',
          details: 'Invalid token format'
        });
      }
      
      // Check user type and find user in appropriate collection
      let user;
      let userType = decoded.userType || 'regular'; // Default to regular user
      
      if (userType === 'phone') {
        // Look for phone user by ID or phoneNumber
        if (decoded.phoneNumber) {
          user = await PhoneUser.findOne({ phoneNumber: decoded.phoneNumber });
          console.log(`[AUTH] Looking for phone user with phoneNumber: ${decoded.phoneNumber}`);
        }
        
        // If not found by phone number, try by ID
        if (!user) {
          user = await PhoneUser.findById(userIdToUse);
          console.log(`[AUTH] Looking for phone user with ID: ${userIdToUse}`);
        }
      } else {
        // Look for regular user first
        user = await User.findById(userIdToUse);
        console.log(`[AUTH] Looking for regular user with ID: ${userIdToUse}`);
        
        // If not found and no userType specified, also check phone users for backward compatibility
        if (!user && !decoded.userType) {
          user = await PhoneUser.findById(userIdToUse);
          if (user) {
            userType = 'phone';
            console.log(`[AUTH] Found user in phone collection: ${userIdToUse}`);
          }
        }
      }
      
      if (!user) {
        console.log(`[AUTH] User not found for userId: ${userIdToUse} (type: ${userType})`);
        return res.status(401).json({ 
          error: 'Authentication failed',
          details: 'User not found' 
        });
      }
      
      // Add user info to request
      req.user = {
        userId: user._id,
        email: user.email,
        phoneNumber: user.phoneNumber || null,
        role: user.role || 'user',
        name: user.name,
        userType: userType
      };
      
      console.log(`[AUTH] User authenticated: ${user._id} (${user.email || user.phoneNumber}) - Type: ${userType}`);
      next();
      
    } catch (jwtError) {
      console.error('[AUTH] JWT verification error:', jwtError.message);
      
      return res.status(401).json({ 
        error: 'Authentication failed',
        details: 'Invalid token' 
      });
    }
  } catch (error) {
    console.error('[AUTH] Auth middleware error:', error);
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





