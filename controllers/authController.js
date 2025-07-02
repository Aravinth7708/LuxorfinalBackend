import User from '../models/User.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

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
    
    // Return user without password
    const userWithoutPassword = {
      _id: user._id,
      id: user._id,
      name: user.name,
      email: user.email,
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

// Update only the register function to ensure no clerkId is used:
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please provide all required fields' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }
    
    // Create new user - make sure we only pass the fields defined in the schema
    const user = new User({
      name,
      email,
      password,
      isVerified: false,
      role: 'user'
    });
    
    await user.save();
    
    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    // Return user without password
    const userWithoutPassword = {
      _id: user._id,
      id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt
    };
    
    res.status(201).json({ 
      success: true, 
      token, 
      user: userWithoutPassword
    });
  } catch (err) {
    console.error("Error in register:", err);
    res.status(500).json({ error: err.message });
  }
};

// Also update the Google auth handler to not reference clerkId:
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
        isVerified: true
      });
      await user.save();
    } else {
      // Update existing user with Google info if needed
      if (!user.googleId || user.googleId !== uid) {
        user.googleId = uid;
        user.isGoogleUser = true;
        user.isVerified = true;
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
    
    // Return user data
    const userData = {
      _id: user._id,
      id: user._id,
      name: user.name,
      email: user.email,
      profileImage: user.profileImage,
      isGoogleUser: true
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

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Generate password reset token (implement your token logic here)
    // Send password reset email
    
    res.json({ 
      success: true, 
      message: 'Password reset instructions sent to your email' 
    });
  } catch (err) {
    console.error("Error in forgotPassword:", err);
    res.status(500).json({ error: err.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    
    // Validate token and find user (implement your validation logic)
    // const user = await User.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
    
    // if (!user) {
    //   return res.status(400).json({ error: 'Password reset token is invalid or has expired' });
    // }
    
    // Update password
    // user.password = newPassword;
    // user.resetPasswordToken = undefined;
    // user.resetPasswordExpires = undefined;
    // await user.save();
    
    res.json({ 
      success: true, 
      message: 'Password has been reset successfully' 
    });
  } catch (err) {
    console.error("Error in resetPassword:", err);
    res.status(500).json({ error: err.message });
  }
};

export const verifyAndLogin = async (req, res) => {
  try {
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Mark user as verified if not already
    if (!user.isVerified) {
      user.isVerified = true;
      await user.save();
    }
    
    // Delete OTP document
    await OTP.deleteMany({ email });
    
    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    // Return user without password
    const userWithoutPassword = {
      _id: user._id,
      id: user._id,
      name: user.name,
      email: user.email,
      isVerified: user.isVerified,
      createdAt: user.createdAt
    };
    
    res.json({ 
      success: true, 
      token, 
      user: userWithoutPassword
    });
  } catch (err) {
    console.error("Error in verifyAndLogin:", err);
    res.status(500).json({ error: err.message });
  }
};

/*
    res.setHeader('Content-Type', 'application/json');
    
    const { email, name, imageUrl, uid } = req.body;
    
    if (!email || !uid) {
      return res.status(400).json({ 
        error: "Missing required fields",
        details: "Email and uid are required"
      });
    }
    
    console.log("Google auth request received:", { email, name, uid });
    
    // Check if user already exists
    let user = await User.findOne({ email });
    
    if (!user) {
      // Create new user if doesn't exist
      console.log("Creating new user with Google credentials");
      user = new User({
        email,
        name: name || email.split('@')[0],
        googleId: uid,
        profileImage: imageUrl || null,
        isGoogleUser: true
      });
      
      await user.save();
      console.log("New Google user created:", user);
    } else {
      // Update existing user with Google info if not already set
      if (!user.googleId) {
        user.googleId = uid;
        user.isGoogleUser = true;
        if (imageUrl && !user.profileImage) {
          user.profileImage = imageUrl;
        }
        await user.save();
        console.log("Existing user updated with Google credentials");
      }
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || "your_jwt_secret",
      { expiresIn: '7d' }
    );
    
    console.log("Google auth successful, sending response");
    
    // Send success response
    return res.status(200).json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage
      }
    });
    
  } catch (error) {
    console.error("Google auth error:", error);
    
    // Ensure we always return JSON, even in error cases
*/

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
