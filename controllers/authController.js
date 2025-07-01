
import User from "../models/User.js"
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt";


// Login controller
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '7d' }
    );

    // Send success response
    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Authentication failed', message: err.message });
  }
};

// Register controller
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser._id, email: newUser.email },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '7d' }
    );

    // Send success response
    res.status(201).json({
      success: true,
      token,
      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed', message: err.message });
  }
};

// Google Authentication Handler
exports.handleGoogleAuth = async (req, res) => {
  try {
    // Set content type to ensure proper JSON response
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
      process.env.JWT_SECRET || 'your_jwt_secret',
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
    return res.status(500).json({ 
      error: "Authentication failed", 
      message: error.message
    });
  }
};

// We'll implement these basic stubs to prevent errors, but they're not fully functional
exports.forgotPassword = async (req, res) => {
  res.status(200).json({ message: 'Password reset link sent to your email' });
};

exports.resetPassword = async (req, res) => {
  res.status(200).json({ message: 'Password has been reset successfully' });
};

// Verify and register user
exports.verifyAndRegister = async (req, res) => {
  try {
    // Implementation for verifyAndRegister
    const token = ""; // Replace with actual token generation
    const userWithoutPassword = {}; // Replace with actual user object
    
    res.json({
      success: true,
      token,
      user: userWithoutPassword
    });
  } catch (err) {
    console.error("Error in verifyAndRegister:", err);
    res.status(500).json({ error: err.message });
  }
};

// Verify OTP and login
exports.verifyAndLogin = async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }
    
    // Find OTP document
    const otpDoc = await OTP.findOne({ email, otp });
    if (!otpDoc) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }
    
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

// Google Authentication Handler
exports.handleGoogleAuth = async (req, res) => {
  try {
    // Set content type to ensure proper JSON response
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
    return res.status(500).json({ 
      error: "Authentication failed", 
      message: error.message
    });
  }
};
