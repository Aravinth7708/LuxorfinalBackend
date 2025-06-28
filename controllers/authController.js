const User = require('../models/User');
const OTP = require('../models/OTP');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

// Email service configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Verify JWT token
exports.verifyToken = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      return res.json({ success: true, userId: decoded.userId });
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
};

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP via email
const sendOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your Verification Code for Luxor Stay',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #16a34a;">Luxor Stay Verification</h2>
        </div>
        <div style="padding: 20px; background-color: #f9fafb; border-radius: 8px;">
          <p style="margin-bottom: 15px; font-size: 16px;">Hello,</p>
          <p style="margin-bottom: 15px; font-size: 16px;">Your verification code for Luxor Stay is:</p>
          <div style="text-align: center; margin: 25px 0;">
            <div style="font-size: 32px; letter-spacing: 8px; font-weight: bold; background-color: #ffffff; padding: 15px; border-radius: 6px; border: 1px dashed #16a34a;">${otp}</div>
          </div>
          <p style="margin-bottom: 15px; font-size: 16px;">This code will expire in 10 minutes.</p>
          <p style="margin-bottom: 15px; font-size: 16px;">If you didn't request this code, please ignore this email.</p>
        </div>
        <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px;">
          <p>&copy; ${new Date().getFullYear()} Luxor Holiday Home Stays. All rights reserved.</p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

// Send OTP for registration
exports.sendRegistrationOTP = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Generate and save OTP
    const otp = generateOTP();
    
    // Delete any existing OTP for this email
    await OTP.deleteMany({ email });
    
    // Create new OTP document
    await OTP.create({ email, otp });
    
    // Send OTP via email
    await sendOTPEmail(email, otp);
    
    res.json({ success: true, message: 'OTP sent to email' });
  } catch (err) {
    console.error('Error sending OTP:', err);
    res.status(500).json({ error: err.message });
  }
};

// Send OTP for login
exports.sendLoginOTP = async (req, res) => {
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
    
    // Generate and save OTP
    const otp = generateOTP();
    
    // Delete any existing OTP for this email
    await OTP.deleteMany({ email });
    
    // Create new OTP document
    await OTP.create({ email, otp });
    
    // Send OTP via email
    await sendOTPEmail(email, otp);
    
    res.json({ success: true, message: 'OTP sent to email' });
  } catch (err) {
    console.error('Error sending OTP:', err);
    res.status(500).json({ error: err.message });
  }
};

// Verify OTP and register user
exports.verifyAndRegister = async (req, res) => {
  try {
    const { name, email, password, otp } = req.body;
    
    if (!email || !otp || !name || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Find OTP document
    const otpDoc = await OTP.findOne({ email, otp });
    if (!otpDoc) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }
    
    // Create user
    const user = await User.create({
      name,
      email,
      password, // In production, hash this password
      clerkId: 'local-' + Date.now(), // Placeholder for local auth users
      isVerified: true
    });
    
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
