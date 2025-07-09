import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import PhoneUser from '../models/PhoneUser.js';
import OTP from '../models/OTP.js';

dotenv.config();

// Send verification email for phone user profile completion
export const sendProfileVerificationEmail = async (req, res) => {
  try {
    const { email, phoneNumber, name } = req.body;
    
    if (!email || !phoneNumber) {
      return res.status(400).json({ error: 'Email and phone number are required' });
    }
    
    console.log('[PROFILE_EMAIL] Sending verification email to:', email);
    
    // Check if email is already in use by another user
    try {
      const User = mongoose.model('User');
      const existingUser = await User.findOne({ email });
      const existingPhoneUser = await PhoneUser.findOne({ 
        email, 
        phoneNumber: { $ne: phoneNumber }
      });
      
      if (existingUser || existingPhoneUser) {
        console.log('[PROFILE_EMAIL] Email already in use:', email);
        return res.status(400).json({ error: 'Email is already in use by another account' });
      }
    } catch (dbError) {
      console.error('[PROFILE_EMAIL] Database error checking existing email:', dbError);
    }
    
    // Generate a simple OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('[PROFILE_EMAIL] Generated OTP:', otp);
    
    // Store OTP for verification
    try {
      await OTP.create({
        email,
        otp,
        purpose: 'profile-completion',
        userData: { name, phoneNumber },
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes expiration
      });
      console.log('[PROFILE_EMAIL] OTP stored in database');
    } catch (otpError) {
      console.error('[PROFILE_EMAIL] Error storing OTP:', otpError);
      return res.status(400).json({ error: 'Failed to process verification' });
    }
    
    // Send OTP email using nodemailer
    try {
      // Create a transporter
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.gmail,
          pass: process.env.pass
        }
      });
      
      // Create mail options
      const mailOptions = {
        from: `"Luxor Stay Homes" <${process.env.gmail}>`,
        to: email,
        subject: 'Complete Your Luxor Profile',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
            <h2 style="color: #4a4a4a;">Profile Verification</h2>
            <p>Hello${name ? ' ' + name : ''},</p>
            <p>To verify your email address and complete your profile, please use the following code:</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; font-size: 24px; letter-spacing: 5px; font-weight: bold; margin: 20px 0;">
              ${otp}
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this verification, please ignore this email.</p>
          </div>
        `
      };
      
      // Send email
      await transporter.sendMail(mailOptions);
      console.log('[PROFILE_EMAIL] Email sent successfully to:', email);
      
    } catch (emailError) {
      console.error('[PROFILE_EMAIL] Error sending email:', emailError);
      return res.status(400).json({ error: 'Failed to send verification email' });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Verification code sent to email'
    });
    
  } catch (error) {
    console.error('[PROFILE_EMAIL] Error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Verify OTP and update phone user profile
export const verifyAndUpdateProfile = async (req, res) => {
  try {
    const { email, otp, phoneNumber, name, skipVerification = false } = req.body;
    
    if (!email || !phoneNumber) {
      return res.status(400).json({ error: 'Email and phone number are required' });
    }
    
    console.log('[PROFILE_UPDATE] Processing profile update for:', phoneNumber);
    
    // Verify OTP if not skipping verification
    if (!skipVerification && otp) {
      const otpDoc = await OTP.findOne({
        email,
        otp,
        purpose: 'profile-completion'
      });
      
      if (!otpDoc) {
        console.log('[PROFILE_UPDATE] Invalid OTP for email:', email);
        return res.status(400).json({ error: 'Invalid verification code' });
      }
      
      // Check if OTP is expired
      if (otpDoc.expiresAt && otpDoc.expiresAt < new Date()) {
        console.log('[PROFILE_UPDATE] Expired OTP for email:', email);
        await OTP.deleteMany({ email, purpose: 'profile-completion' });
        return res.status(400).json({ error: 'Verification code has expired' });
      }
      
      // Delete the OTP documents
      await OTP.deleteMany({ email, purpose: 'profile-completion' });
    }
    
    // Find and update the phone user
    const user = await PhoneUser.findOne({ phoneNumber });
    
    if (!user) {
      console.log('[PROFILE_UPDATE] User not found for phone number:', phoneNumber);
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update the user profile
    user.name = name || user.name;
    user.email = email;
    user.isEmailVerified = !skipVerification; // Mark as verified only if not skipping verification
    
    await user.save();
    console.log('[PROFILE_UPDATE] Profile updated successfully for user:', user._id);
    
    // Generate a token for the user
    const token = jwt.sign(
      { 
        id: user._id, 
        userId: user._id,
        email: user.email, 
        phoneNumber: user.phoneNumber,
        name: user.name,
        role: user.role,
        userType: 'phone',
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified 
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' } // 30 days expiration
    );
    
    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      token, // Include the token in the response
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error('[PROFILE_UPDATE] Error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};