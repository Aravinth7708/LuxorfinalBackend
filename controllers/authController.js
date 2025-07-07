import User from '../models/User.js';
import OTP from '../models/OTP.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { generateOTP, sendOTPEmail } from '../utils/mailService.js';
import { OAuth2Client } from 'google-auth-library';

dotenv.config();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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
        // User exists but not verified - send new OTP
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
    
    // Update last login time
    user.lastLogin = new Date();
    await user.save();
    
    // Return user without password
    const userWithoutPassword = {
      _id: user._id,
      id: user._id,
      name: user.name,
      email: user.email,
      profileImage: user.profileImage,
      isVerified: user.isVerified,
      createdAt: user.createdAt
    };
    
    res.json({ 
      success: true, 
      token, 
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
    
    console.log(`[AUTH] Successful Google auth for user: ${user._id} (${user.email}), role: ${user.role}`);
    
    // Return user data and token
    return res.status(200).json({
      token: jwtToken,
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
      message: 'Authentication failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

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
  // With JWT, logout is handled client-side by discarding the token.
  // We still provide an endpoint so the client can hit it and clear cookies/localStorage if needed.
  return res.json({ success: true, message: 'Logged out' });
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
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ success: true, user });
  } catch (err) {
    console.error('Error in getProfile:', err);
    return res.status(500).json({ error: err.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?._id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { name, profileImage } = req.body;
    const user = await User.findByIdAndUpdate(
      userId,
      { name, profileImage },
      { new: true, runValidators: true }
    ).select('-password');
    return res.json({ success: true, user });
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
    
    if (!userId) {
      console.log('[AUTH] Missing userId in verified token');
      return res.status(401).json({ 
        error: 'Authentication failed', 
        details: 'Invalid user information' 
      });
    }
    
    // Get fresh user data
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      console.log(`[AUTH] User not found for verified userId: ${userId}`);
      return res.status(401).json({ 
        error: 'Authentication failed', 
        details: 'User not found' 
      });
    }
    
    // Log successful verification
    console.log(`[AUTH] Token verified for user: ${user._id} (${user.email})`);
    
    // Return user data
    return res.status(200).json({ 
      success: true, 
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified || true
      }
    });
  } catch (error) {
    console.error('[AUTH] Error in verifyToken:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};
