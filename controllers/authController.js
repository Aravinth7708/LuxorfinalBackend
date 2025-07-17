import User from '../models/User.js';
import PhoneUser from '../models/PhoneUser.js';
import OTP from '../models/OTP.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { generateOTP, sendOTPEmail } from '../utils/mailService.js';
import { OAuth2Client } from 'google-auth-library';
import nodemailer from 'nodemailer';
import cookieParser from 'cookie-parser';

// Handle Firebase Admin import gracefully
let admin = null;
try {
  const firebaseAdmin = await import('../config/firebase-admin.js');
  admin = firebaseAdmin.admin;
} catch (error) {
  console.warn('Firebase Admin not available - phone auth will use fallback mode:', error.message);
}

dotenv.config();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Helper function to set secure cookie
const setTokenCookie = (res, token) => {
  // Set HTTP-only cookie
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // true in production
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/'
  });
};

// Modified to start registration process with OTP
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please provide all required fields' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (existingUser.isVerified) {
        return res.status(400).json({ error: 'User already exists with this email' });
      } else {
      
        const otp = generateOTP();
        
        // Delete any existing OTPs for this email
        await OTP.deleteMany({ email });
        
        // Create new OTP document
        await OTP.create({
          email,
          otp,
          purpose: 'registration',
          userData: { name, password } // Store user data to use after verification
        });
        
        // Send OTP email
        await sendOTPEmail(email, otp);
        
        return res.status(200).json({
          message: 'Account already exists but not verified. New verification code sent to your email.',
          requiresVerification: true,
          email
        });
      }
    }
    
    // Generate OTP for new registration
    const otp = generateOTP();
    
    // Store OTP and user data for verification
    await OTP.create({
      email,
      otp,
      purpose: 'registration',
      userData: { name, password }
    });
    
    // Send verification email
    await sendOTPEmail(email, otp);
    
    res.status(200).json({ 
      message: 'Verification code sent to your email',
      requiresVerification: true,
      email
    });
  } catch (err) {
    console.error("Error in register:", err);
    res.status(500).json({ error: err.message });
  }
};

// New endpoint to verify OTP and complete registration
export const verifyRegistrationOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }
    
    // Find OTP document
    const otpDoc = await OTP.findOne({ 
      email, 
      otp, 
      purpose: 'registration'
    });
    
    if (!otpDoc) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }
    
    // Get stored user data
    const { name, password } = otpDoc.userData;
    
    // Check if user already exists but is unverified
    let user = await User.findOne({ email });
    
    if (user) {
      if (user.isVerified) {
        return res.status(400).json({ error: 'User already exists and is verified' });
      }
      
      // Update existing unverified user
      user.name = name;
      user.password = password; // Will be hashed by pre-save hook
      user.isVerified = true;
    } else {
      // Create new verified user
      user = new User({
        name,
        email,
        password, // Will be hashed by pre-save hook
        isVerified: true
      });
    }
    
    // Save the user
    await user.save();
    
    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { 
        expiresIn: '7d',
        algorithm: 'HS256' // Explicitly state the algorithm
      }
    );
    
    // Delete the OTP document
    await OTP.deleteMany({ email });
    
    // Return user without password
    const userWithoutPassword = {
      _id: user._id,
      id: user._id,
      name: user.name,
      email: user.email,
      isVerified: user.isVerified,
      createdAt: user.createdAt
    };
    
    res.status(201).json({ 
      success: true, 
      message: 'Registration completed successfully',
      token, 
      user: userWithoutPassword
    });
  } catch (err) {
    console.error("Error in verifyRegistrationOTP:", err);
    res.status(500).json({ error: err.message });
  }
};

// Login remains mostly the same, but add a check for verification
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }
    
    // Find user
    const user = await User.findOne({ email });
    
    // Check if user exists
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Check if user is verified
    if (!user.isVerified && !user.isGoogleUser) {
      // Generate a new OTP for verification
      const otp = generateOTP();
      
      // Delete any existing OTPs
      await OTP.deleteMany({ email });
      
      // Create new OTP document
      await OTP.create({
        email,
        otp,
        purpose: 'registration',
        userData: { name: user.name, password: user.password }
      });
      
      // Send OTP email
      await sendOTPEmail(email, otp);
      
      return res.status(403).json({
        error: 'Account not verified',
        message: 'Please verify your email. A new verification code has been sent.',
        requiresVerification: true,
        email
      });
    }
    
    // Check password
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { 
        expiresIn: '7d',
        algorithm: 'HS256' // Explicitly state the algorithm
      }
    );
    
    // Set token in cookie
    setTokenCookie(res, token);
    
    // Return user without including token in response body
    const userWithoutPassword = {
      _id: user._id,
      name: user.name,
      email: user.email,
      profileImage: user.profileImage,
      isVerified: user.isVerified,
      createdAt: user.createdAt
    };
    
    res.json({ 
      success: true,
      user: userWithoutPassword
    });
  } catch (err) {
    console.error("Error in login:", err);
    res.status(500).json({ error: err.message });
  }
};

// Fix the handleGoogleAuth function to use userId instead of id
export const handleGoogleAuth = async (req, res) => {
  try {
    const { token, email, name, photoURL } = req.body;
    
    let userEmail, userName, userPicture, googleId;
    
    // Handle different input formats
    if (email) {
      userEmail = email;
      userName = name || email.split('@')[0];
      userPicture = photoURL;
      googleId = 'firebase-auth';
      console.log('[AUTH] Using provided email/name:', userEmail);
    } 
    else if (token) {
      try {
        const ticket = await client.verifyIdToken({
          idToken: token,
          audience: process.env.GOOGLE_CLIENT_ID
        });
        
        const payload = ticket.getPayload();
        userEmail = payload.email;
        userName = payload.name;
        userPicture = payload.picture;
        googleId = payload.sub;
        console.log('[AUTH] Successfully verified Google token for:', userEmail);
      } catch (error) {
        console.error("Error verifying Google token:", error);
        return res.status(400).json({ error: 'Invalid Google token' });
      }
    } else {
      return res.status(400).json({ error: 'Email or token is required' });
    }
    
    if (!userEmail) {
      return res.status(400).json({ error: 'No email found in Google auth data' });
    }
    
    // Check if user exists
    let user = await User.findOne({ email: userEmail });
    let isNewUser = false;
    
    if (!user) {
      console.log(`[AUTH] Creating new user for email: ${userEmail}`);
      isNewUser = true;
      
      // Create new user
      user = new User({
        name: userName || userEmail.split('@')[0],
        email: userEmail,
        googleId: googleId,
        profilePicture: userPicture,
        isVerified: true,
        isGoogleUser: true,
        role: 'user'
      });
      
      try {
        await user.save();
        console.log(`[AUTH] Successfully created new Google user with ID: ${user._id}`);
      } catch (saveError) {
        console.error('[AUTH] Error saving new Google user:', saveError);
        return res.status(500).json({ error: 'Failed to create user account' });
      }
    } else {
      // Update existing user with Google info if needed
      let needsUpdate = false;
      
      if (!user.googleId && googleId) {
        user.googleId = googleId;
        needsUpdate = true;
      }
      
      if (!user.isVerified) {
        user.isVerified = true;
        needsUpdate = true;
      }
      
      if (!user.profilePicture && userPicture) {
        user.profilePicture = userPicture;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await user.save();
        console.log(`[AUTH] Updated existing user with Google info: ${user._id}`);
      }
    }
    
    // Generate JWT token - FIX HERE by using userId instead of id
    const jwtToken = jwt.sign(
      { userId: user._id, role: user.role }, // Change to userId here
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    // Set token in cookie
    setTokenCookie(res, jwtToken);
    
    console.log(`[AUTH] Successful Google auth for user: ${user._id} (${user.email}), role: ${user.role}`);
    
    // Return user data and token
    return res.status(200).json({
      success: true,
      isNewUser,
      isAdmin: user.role === 'admin',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture,
        isVerified: true
      }
    });
    
  } catch (error) {
    console.error('[AUTH] Google auth error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Authentication failed'
    });
  }
};

// Phone authentication with Firebase - Enhanced with fallback
export const verifyPhoneAuth = async (req, res) => {
  try {
    const { idToken, phoneNumber, name } = req.body;

    console.log('[PHONE_AUTH] Phone verification request received');
    console.log('[PHONE_AUTH] Phone number:', phoneNumber);
    console.log('[PHONE_AUTH] Name:', name);
    console.log('[PHONE_AUTH] Has ID token:', !!idToken);

    if (!idToken || !phoneNumber) {
      return res.status(400).json({ error: 'ID token and phone number are required' });
    }

    let decodedToken;
    let verificationMode = 'production';

    // Try Firebase Admin verification first (only if properly configured)
    const isFirebaseAdminConfigured = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (admin && isFirebaseAdminConfigured) {
      try {
        console.log('[PHONE_AUTH] Attempting Firebase Admin token verification...');
        decodedToken = await admin.auth().verifyIdToken(idToken);
        console.log('[PHONE_AUTH] Firebase Admin verification successful');
        console.log('[PHONE_AUTH] Verified phone:', decodedToken.phone_number);
        verificationMode = 'firebase-admin';
      } catch (firebaseError) {
        console.error('[PHONE_AUTH] Firebase Admin verification failed:', firebaseError.message);
        
        // Check for session expired or token invalid errors
        if (firebaseError.message.includes('session-expired') ||
            firebaseError.message.includes('auth/session-expired') ||
            firebaseError.message.includes('expired')) {
          console.log('[PHONE_AUTH] Session expired error detected');
          return res.status(401).json({ 
            error: 'Your verification session has expired',
            code: 'SESSION_EXPIRED',
            details: 'Please request a new verification code.'
          });
        }
        
        // Fall back to basic validation for development
        console.log('[PHONE_AUTH] Using development fallback mode');
        verificationMode = 'development';
      }
    } else {
      console.log('[PHONE_AUTH] Firebase Admin not properly configured - using development mode');
      verificationMode = 'development';
    }

    // Development/fallback mode - basic token structure validation
    if (verificationMode === 'development') {
      try {
        // Basic JWT structure validation (for development)
        const tokenParts = idToken.split('.');
        if (tokenParts.length !== 3) {
          throw new Error('Invalid token structure');
        }
        
        // Decode the payload (without verification for development)
        const payload = JSON.parse(atob(tokenParts[1]));
        
        decodedToken = {
          phone_number: phoneNumber, // Use the provided phone number
          uid: payload.sub || `phone_${phoneNumber.replace(/[^0-9]/g, '')}`,
          ...payload
        };
        
        console.log('[PHONE_AUTH] Development mode verification successful');
      } catch (devError) {
        console.error('[PHONE_AUTH] Development mode validation failed:', devError);
        
        // Check if this might be a session expiration error
        if (idToken.includes('SESSION_EXPIRED') || 
            (typeof idToken === 'string' && idToken.length > 20 && idToken.length < 100)) {
          // This is likely an expired or malformed token
          return res.status(401).json({
            error: 'Your verification session has expired',
            code: 'SESSION_EXPIRED',
            details: 'Please request a new verification code.'
          });
        }
        
        return res.status(400).json({ error: 'Invalid token format' });
      }
    }

    // Validate phone number match
    const verifiedPhoneNumber = decodedToken.phone_number || phoneNumber;
    
    if (!verifiedPhoneNumber) {
      return res.status(400).json({ error: 'Phone number not found in token' });
    }

    // For strict verification, check if token phone matches provided phone
    if (verificationMode === 'firebase-admin' && decodedToken.phone_number !== phoneNumber) {
      return res.status(400).json({ error: 'Phone number mismatch' });
    }

    console.log('[PHONE_AUTH] Using phone number:', verifiedPhoneNumber);

    // Check if user already exists with this phone number in PhoneUser collection
    let user = await PhoneUser.findOne({ phoneNumber: verifiedPhoneNumber });
    let isNewUser = false;

    if (!user) {
      // Create new phone user
      isNewUser = true;
      console.log('[PHONE_AUTH] Creating new phone user for phone:', verifiedPhoneNumber);
      
      user = new PhoneUser({
        name: name || `User_${verifiedPhoneNumber.slice(-4)}`,
        phoneNumber: verifiedPhoneNumber,
        email: `${decodedToken.uid}@phone.luxor.com`,
        isVerified: true,
        isPhoneVerified: true,
        role: 'user',
        firebaseUid: decodedToken.uid
      });

      try {
        await user.save();
        console.log(`[PHONE_AUTH] Successfully created new phone user with ID: ${user._id}`);
      } catch (saveError) {
        console.error('[PHONE_AUTH] Error saving new phone user:', saveError);
        
        // Handle duplicate email error
        if (saveError.code === 11000) {
          if (saveError.keyPattern?.email) {
            let emailCounter = 1;
            let uniqueEmail;
            let emailExists = true;
            
            while (emailExists) {
              uniqueEmail = `${verifiedPhoneNumber.replace(/[^0-9]/g, '')}_${emailCounter}@phone.luxor.com`;
              const existingUser = await PhoneUser.findOne({ email: uniqueEmail });
              if (!existingUser) {
                emailExists = false;
              } else {
                emailCounter++;
              }
            }
            
            user.email = uniqueEmail;
            await user.save();
            console.log('[PHONE_AUTH] Phone user created with unique email:', uniqueEmail);
          } else if (saveError.keyPattern?.phoneNumber) {
            return res.status(400).json({ error: 'Phone number already registered' });
          } else {
            return res.status(500).json({ error: 'Failed to create user account' });
          }
        } else {
          return res.status(500).json({ error: 'Failed to create user account' });
        }
      }
    } else {
      // Update existing phone user if needed
      console.log('[PHONE_AUTH] Updating existing phone user:', user._id);
      
      let needsUpdate = false;
      
      if (!user.isVerified) {
        user.isVerified = true;
        needsUpdate = true;
      }
      
      if (!user.isPhoneVerified) {
        user.isPhoneVerified = true;
        needsUpdate = true;
      }
      
      if (!user.firebaseUid && decodedToken.uid) {
        user.firebaseUid = decodedToken.uid;
        needsUpdate = true;
      }
      
      // Update name if provided and user doesn't have one
      if (name && (!user.name || user.name.startsWith('User_'))) {
        user.name = name;
        needsUpdate = true;
      }
      
      // Update last login
      user.lastLogin = new Date();
      needsUpdate = true;
      
      if (needsUpdate) {
        await user.save();
        console.log('[PHONE_AUTH] Updated existing phone user');
      }
    }

    // Generate JWT token with phone user identifier
    const jwtToken = jwt.sign(
      { 
        userId: user._id, 
        role: user.role,
        userType: 'phone', // Add user type to distinguish from regular users
        phoneNumber: user.phoneNumber
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log(`[PHONE_AUTH] Successful phone auth for user: ${user._id} (${user.phoneNumber}) - Mode: ${verificationMode}`);

    // Return user data and token
    return res.status(200).json({
      token: jwtToken,
      success: true,
      isNewUser,
      verificationMode, // Include for debugging
      userType: 'phone',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        isVerified: true,
        isPhoneVerified: true,
        isEmailVerified: user.isEmailVerified || false,
        emailVerified: user.isEmailVerified || false,
        needsProfileUpdate: !user.isEmailVerified || user.email.includes('@phone.luxor.com'),
        userType: 'phone'
      }
    });

  } catch (error) {
    console.error('[PHONE_AUTH] Phone auth error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Phone authentication failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Phone verification endpoint (alternative name for the same function)
export const handlePhoneVerification = verifyPhoneAuth;

// Resend OTP email for either registration or password reset
export const resendOTP = async (req, res) => {
  try {
    const { email, purpose = 'registration' } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Delete any existing OTPs
    await OTP.deleteMany({ email });
    
    // Generate new OTP
    const otp = generateOTP();
    
    // Find user for password reset (not needed for registration as we already have the data)
    if (purpose === 'password-reset') {
      const user = await User.findOne({ email });
      
      if (!user) {
        return res.status(404).json({ error: 'No account found with this email' });
      }
      
      // Create new OTP document for password reset
      await OTP.create({
        email,
        otp,
        purpose: 'password-reset'
      });
      
      // Send OTP email for password reset
      await sendOTPEmail(email, otp, true);
    } else {
      // For registration, check if user exists
      const user = await User.findOne({ email });
      
      if (!user) {
        return res.status(404).json({ error: 'No pending registration found with this email' });
      }
      
      // Create new OTP document for registration
      await OTP.create({
        email,
        otp,
        purpose: 'registration',
        userData: { name: user.name, password: user.password }
      });
      
      // Send OTP email for registration
      await sendOTPEmail(email, otp);
    }
    
    res.json({
      success: true,
      message: `Verification code sent to ${email}`,
      email
    });
  } catch (err) {
    console.error(`Error in resendOTP (${req.body.purpose || 'registration'}):`, err);
    res.status(500).json({ error: err.message });
  }
};

// Request password reset by sending OTP
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'No account found with this email' });
    }
    
    // Generate OTP
    const otp = generateOTP();
    
    // Delete any existing OTPs
    await OTP.deleteMany({ email, purpose: 'password-reset' });
    
    // Create new OTP document
    await OTP.create({
      email,
      otp,
      purpose: 'password-reset'
    });
    
    // Send OTP email for password reset
    await sendOTPEmail(email, otp, true);
    
    res.json({ 
      success: true, 
      message: 'Password reset instructions sent to your email',
      email
    });
  } catch (err) {
    console.error("Error in forgotPassword:", err);
    res.status(500).json({ error: err.message });
  }
};

// Verify OTP and reset password
export const verifyResetOTP = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, OTP, and new password are required' });
    }
    
    // Find OTP document
    const otpDoc = await OTP.findOne({ 
      email, 
      otp, 
      purpose: 'password-reset'
    });
    
    if (!otpDoc) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update password
    user.password = newPassword; // Will be hashed by pre-save hook
    await user.save();
    
    // Delete the OTP document
    await OTP.deleteMany({ email, purpose: 'password-reset' });
    
    res.json({ 
      success: true, 
      message: 'Password has been reset successfully' 
    });
  } catch (err) {
    console.error("Error in verifyResetOTP:", err);
    res.status(500).json({ error: err.message });
  }
};

// --- Additional Auth Controller handlers ---
export const logout = (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  });
  return res.json({ success: true, message: 'Logged out successfully' });
};

export const refreshToken = (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Token required' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const newToken = jwt.sign(
      { userId: payload.userId },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    return res.json({ success: true, token: newToken });
  } catch (err) {
    console.error('Error in refreshToken:', err);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const getProfile = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?._id;
    const userType = req.user?.userType || 'regular';
    
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    
    let user;
    if (userType === 'phone') {
      user = await PhoneUser.findById(userId);
    } else {
      user = await User.findById(userId).select('-password');
    }
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    return res.json({ 
      success: true, 
      user: {
        ...user.toObject(),
        userType: userType
      }
    });
  } catch (err) {
    console.error('Error in getProfile:', err);
    return res.status(500).json({ error: err.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?._id;
    const userType = req.user?.userType || 'regular';
    
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    
    const { name, profileImage } = req.body;
    let user;
    
    if (userType === 'phone') {
      user = await PhoneUser.findByIdAndUpdate(
        userId,
        { name, profilePicture: profileImage },
        { new: true, runValidators: true }
      );
    } else {
      user = await User.findByIdAndUpdate(
        userId,
        { name, profileImage },
        { new: true, runValidators: true }
      ).select('-password');
    }
    
    return res.json({ 
      success: true, 
      user: {
        ...user.toObject(),
        userType: userType
      }
    });
  } catch (err) {
    console.error('Error in updateProfile:', err);
    return res.status(500).json({ error: err.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?._id;
    const { currentPassword, newPassword } = req.body;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Current password incorrect' });

    user.password = newPassword;
    await user.save();
    return res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    console.error('Error in changePassword:', err);
    return res.status(500).json({ error: err.message });
  }
};

export const verifyToken = async (req, res) => {
  try {
    // The authMiddleware already verified the token and added user to req
    // So if we get here, the token is valid
    const userId = req.user?.userId || req.user?._id;
    const userType = req.user?.userType || 'regular';
    
    if (!userId) {
      console.log('[AUTH] Missing userId in verified token');
      return res.status(401).json({ 
        error: 'Authentication failed', 
        details: 'Invalid user information' 
      });
    }
    
    // Get fresh user data from appropriate collection
    let user;
    if (userType === 'phone') {
      user = await PhoneUser.findById(userId);
    } else {
      user = await User.findById(userId).select('-password');
    }
    
    if (!user) {
      console.log(`[AUTH] User not found for verified userId: ${userId} (type: ${userType})`);
      return res.status(401).json({ 
        error: 'Authentication failed', 
        details: 'User not found' 
      });
    }
    
    // Log successful verification
    console.log(`[AUTH] Token verified for user: ${user._id} (${user.email || user.phoneNumber}) - Type: ${userType}`);
    
    // Return user data
    return res.status(200).json({ 
      success: true, 
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber || null,
        role: user.role,
        isVerified: user.isVerified || true,
        userType: userType
      }
    });
  } catch (error) {
    console.error('[AUTH] Error in verifyToken:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Add to authController.js
export const checkPhoneUser = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    
    // We need the PhoneUser model
    const PhoneUser = mongoose.model('PhoneUser');
    
    // Check if user exists in the database
    const user = await PhoneUser.findOne({ phoneNumber });
    
    return res.status(200).json({
      isNewUser: !user,
      hasEmail: user ? !!user.email : false,
      hasName: user ? !!user.name : false
    });
    
  } catch (error) {
    console.error('[CHECK_PHONE] Error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Add this function to update a phone user with email and name
export const phoneVerifyWithEmail = async (req, res) => {
  try {
    const { idToken, phoneNumber, email, name, isEmailVerified = false } = req.body;
    
    if (!idToken || !phoneNumber || !email || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Use the existing token verification from verifyPhoneAuth
    let decodedToken;
    let verificationMode = 'production';
    
    // Try Firebase Admin verification first (only if properly configured)
    const isFirebaseAdminConfigured = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (admin && isFirebaseAdminConfigured) {
      try {
        console.log('[PHONE_EMAIL] Attempting Firebase Admin token verification...');
        decodedToken = await admin.auth().verifyIdToken(idToken);
        console.log('[PHONE_EMAIL] Firebase Admin verification successful');
        console.log('[PHONE_EMAIL] Verified phone:', decodedToken.phone_number);
        verificationMode = 'firebase-admin';
      } catch (firebaseError) {
        console.error('[PHONE_EMAIL] Firebase Admin verification failed:', firebaseError.message);
        
        // Fall back to basic validation for development
        if (firebaseError.message.includes('credential') || 
            firebaseError.message.includes('GOOGLE_APPLICATION_CREDENTIALS') ||
            firebaseError.code === 'auth/invalid-credential') {
          console.log('[PHONE_EMAIL] Using development fallback mode');
          verificationMode = 'development';
        } else {
          return res.status(400).json({ 
            error: 'Firebase ID token verification failed',
            details: firebaseError.message 
          });
        }
      }
    } else {
      console.log('[PHONE_EMAIL] Firebase Admin not available - using development mode');
      verificationMode = 'development';
    }

    // Development/fallback mode - basic token structure validation
    if (verificationMode === 'development') {
      try {
        // Basic JWT structure validation (for development)
        const tokenParts = idToken.split('.');
        if (tokenParts.length !== 3) {
          throw new Error('Invalid token structure');
        }
        
        // Decode the payload (without verification for development)
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        
        decodedToken = {
          phone_number: phoneNumber, // Use the provided phone number
          uid: payload.sub || `phone_${phoneNumber.replace(/[^0-9]/g, '')}`,
          ...payload
        };
        
        console.log('[PHONE_EMAIL] Development mode verification successful');
      } catch (devError) {
        console.error('[PHONE_EMAIL] Development mode validation failed:', devError);
        return res.status(400).json({ error: 'Invalid token format' });
      }
    }

    // Validate phone number match
    const verifiedPhoneNumber = decodedToken.phone_number || phoneNumber;
    
    if (!verifiedPhoneNumber) {
      return res.status(400).json({ error: 'Phone number not found in token' });
    }

    // For strict verification, check if token phone matches provided phone
    if (verificationMode === 'firebase-admin' && decodedToken.phone_number !== phoneNumber) {
      return res.status(400).json({ error: 'Phone number mismatch' });
    }

    console.log('[PHONE_EMAIL] Using phone number:', verifiedPhoneNumber);
    
    // We need the PhoneUser model
    const PhoneUser = mongoose.model('PhoneUser');
    
    // Check if user already exists with this phone number
    let user = await PhoneUser.findOne({ phoneNumber: verifiedPhoneNumber });
    let isNewUser = false;

    if (!user) {
      // Create new user
      isNewUser = true;
      console.log('[PHONE_EMAIL] Creating new user for phone:', verifiedPhoneNumber);
      
      user = new PhoneUser({
        name: name,
        email: email,
        phoneNumber: verifiedPhoneNumber,
        isVerified: true,
        isPhoneVerified: true,
        isEmailVerified: isEmailVerified,
        role: 'user',
        firebaseUid: decodedToken.uid
      });

      await user.save();
      console.log(`[PHONE_EMAIL] Successfully created new phone user with ID: ${user._id}`);
      
    } else {
      // Update existing user with the new email and name
      console.log(`[PHONE_EMAIL] Updating existing user: ${user._id}`);
      user.name = name;
      user.email = email;
      user.isEmailVerified = isEmailVerified;
      
      await user.save();
      console.log(`[PHONE_EMAIL] Successfully updated user: ${user._id}`);
    }

    // Generate JWT token
    const jwtToken = jwt.sign(
      { 
        userId: user._id, 
        role: user.role,
        userType: 'phone',
        phoneNumber: user.phoneNumber
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log(`[PHONE_EMAIL] Successful auth for user: ${user._id} (${user.phoneNumber}) - Mode: ${verificationMode}`);

    // Return user data and token
    return res.status(200).json({
      token: jwtToken,
      success: true,
      isNewUser,
      verificationMode,
      userType: 'phone',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        isVerified: true,
        isPhoneVerified: true,
        isEmailVerified: user.isEmailVerified,
        emailVerified: user.isEmailVerified,
        needsProfileUpdate: !user.isEmailVerified || user.email.includes('@phone.luxor.com'),
        userType: 'phone'
      }
    });
    
  } catch (error) {
    console.error('[PHONE_EMAIL] Error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Add this to your authController.js file
export const sendEmailVerification = async (req, res) => {
  try {
    const { email, phoneNumber, name } = req.body;
    
    if (!email || !phoneNumber) {
      return res.status(400).json({ error: 'Email and phone number are required' });
    }
    
    console.log('[EMAIL_VERIFY] Sending verification email to:', email);
    
    // Check if email is already in use by another user
    try {
      const User = mongoose.model('User');
      const PhoneUser = mongoose.model('PhoneUser');
      
      const existingUser = await User.findOne({ email });
      const existingPhoneUser = await PhoneUser.findOne({ 
        email, 
        phoneNumber: { $ne: phoneNumber }
      });
      
      if (existingUser || existingPhoneUser) {
        console.log('[EMAIL_VERIFY] Email already in use:', email);
        return res.status(400).json({ error: 'Email is already in use by another account' });
      }
    } catch (dbError) {
      console.error('[EMAIL_VERIFY] Database error checking existing email:', dbError);
      // Continue even if DB check fails
    }
    
    // Generate a simple OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('[EMAIL_VERIFY] Generated OTP for email verification:', otp);
    
    // Store OTP for verification
    try {
      const OTP = mongoose.model('OTP');
      await OTP.create({
        email,
        otp,
        purpose: 'phone-email-verification',
        userData: { name, phoneNumber },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes expiration
      });
      console.log('[EMAIL_VERIFY] OTP stored in database');
    } catch (otpError) {
      console.error('[EMAIL_VERIFY] Error storing OTP:', otpError);
      return res.status(500).json({ error: 'Failed to process verification. Please try again.' });
    }
    
    // Send OTP email using nodemailer
    try {
      // Create a transporter with proper configuration
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.gmail,
          pass: process.env.pass
        },
        tls: {
          rejectUnauthorized: false // For development environments
        }
      });
      
      // Create mail options
      const mailOptions = {
        from: `"Luxor Stay Homes" <${process.env.gmail}>`,
        to: email,
        subject: 'Verify your email for Luxor',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <h2 style="color: #4a4a4a;">Email Verification</h2>
            <p>Thank you for registering with Luxor Stay Homes. To verify your email address, please use the following code:</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; font-size: 24px; letter-spacing: 5px; font-weight: bold; margin: 20px 0;">
              ${otp}
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this verification, please ignore this email.</p>
            <p style="margin-top: 30px; font-size: 12px; color: #888;">
              This is an automated email. Please do not reply.
            </p>
          </div>
        `
      };
      
      // Send email
      console.log('[EMAIL_VERIFY] Attempting to send email...');
      const info = await transporter.sendMail(mailOptions);
      console.log('[EMAIL_VERIFY] Email sent successfully:', info.messageId);
      
    } catch (emailError) {
      console.error('[EMAIL_VERIFY] Error sending email:', emailError);
      return res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Verification code sent to email'
    });
    
  } catch (error) {
    console.error('[EMAIL_VERIFY] Error sending email verification:', error);
    return res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
  }
};

export const verifyEmailOtp = async (req, res) => {
  try {
    const { email, otp, phoneNumber } = req.body;
    
    if (!email || !otp || !phoneNumber) {
      return res.status(400).json({ error: 'Email, OTP, and phone number are required' });
    }
    
    console.log('[VERIFY_OTP] Verifying OTP for email:', email);
    
    // Find the OTP in the database
    const OTP = mongoose.model('OTP');
    const otpDoc = await OTP.findOne({ 
      email,
      otp,
      purpose: 'phone-email-verification'
    });
    
    if (!otpDoc) {
      console.log('[VERIFY_OTP] Invalid OTP for email:', email);
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }
    
    // Check if OTP is expired
    if (otpDoc.expiresAt && otpDoc.expiresAt < new Date()) {
      console.log('[VERIFY_OTP] Expired OTP for email:', email);
      await OTP.deleteMany({ email, purpose: 'phone-email-verification' });
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }
    
    // Delete the OTP
    await OTP.deleteMany({ email, purpose: 'phone-email-verification' });
    
    return res.status(200).json({
      success: true,
      isEmailVerified: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('[VERIFY_OTP] Error verifying email OTP:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};
