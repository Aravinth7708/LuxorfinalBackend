import User from '../models/User.js';
import OTP from '../models/OTP.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { generateOTP, sendOTPEmail } from '../utils/mailService.js';

dotenv.config();

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
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
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
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
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

// For Google auth, we don't need OTP verification
export const handleGoogleAuth = async (req, res) => {
  try {
    const { email, name, imageUrl, uid } = req.body;
    
    if (!email || !uid) {
      return res.status(400).json({ error: 'Invalid Google auth data' });
    }
    
    // Check if user exists
    let user = await User.findOne({ email });
    
    if (!user) {
      // Create new user if doesn't exist - explicitly specify only valid fields
      user = new User({
        email,
        name,
        googleId: uid,
        profileImage: imageUrl,
        isGoogleUser: true,
        isVerified: true // Google users are automatically verified
      });
      await user.save();
    } else {
      // Update existing user with Google info if needed
      if (!user.googleId || user.googleId !== uid) {
        user.googleId = uid;
        user.isGoogleUser = true;
        user.isVerified = true; // Ensure the user is verified
        if (imageUrl) user.profileImage = imageUrl;
        await user.save();
      }
    }
    
    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    // Update last login time
    user.lastLogin = new Date();
    await user.save();
    
    // Return user data
    const userData = {
      _id: user._id,
      id: user._id,
      name: user.name,
      email: user.email,
      profileImage: user.profileImage,
      isGoogleUser: true,
      isVerified: true
    };
    
    res.json({ 
      success: true, 
      token, 
      user: userData
    });
  } catch (err) {
    console.error("Error in Google auth:", err);
    res.status(500).json({ error: err.message });
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
