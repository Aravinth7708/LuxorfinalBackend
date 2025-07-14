import User from '../models/User.js';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.gmail,
    pass: process.env.pass
  }
});

// In-memory storage for OTPs (in production, use Redis or another database)
const otpStore = {};

// Send email OTP
export const sendEmailOtp = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Check if email already exists for another user
    const existingUser = await User.findOne({ email, _id: { $ne: userId } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email is already associated with another account'
      });
    }

    // Generate a random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP with expiration (15 minutes)
    otpStore[`${userId}-${email}`] = {
      otp,
      expiry: Date.now() + 15 * 60 * 1000,
      attempts: 0
    };

    // Send email with OTP
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verify Your Email for LuxorStay',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #D4AF37; margin-bottom: 10px;">LuxorStay Email Verification</h2>
            <p style="color: #555;">Please use the verification code below to complete your email change</p>
          </div>
          <div style="background-color: #f8f8f8; padding: 20px; text-align: center; border-radius: 5px; margin-bottom: 20px;">
            <h1 style="font-family: monospace; letter-spacing: 5px; font-size: 32px; margin: 0; color: #333;">${otp}</h1>
          </div>
          <div style="text-align: center; color: #777; font-size: 14px;">
            <p>This code will expire in 15 minutes.</p>
            <p>If you didn't request this email, please ignore it.</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully to your email',
      email: email
    });
  } catch (error) {
    console.error('Error sending email OTP:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send OTP email',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
};

// Verify email OTP and update email
export const verifyEmailOtp = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }

    const otpData = otpStore[`${userId}-${email}`];

    // Check if OTP exists and is valid
    if (!otpData) {
      return res.status(400).json({
        success: false,
        message: 'OTP not found or expired. Please request a new OTP'
      });
    }

    // Check if OTP is expired
    if (Date.now() > otpData.expiry) {
      delete otpStore[`${userId}-${email}`];
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new OTP'
      });
    }

    // Check if too many attempts
    if (otpData.attempts >= 3) {
      delete otpStore[`${userId}-${email}`];
      return res.status(400).json({
        success: false,
        message: 'Too many invalid attempts. Please request a new OTP'
      });
    }

    // Check if OTP matches
    if (otpData.otp !== otp) {
      otpData.attempts++;
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Please try again',
        attemptsLeft: 3 - otpData.attempts
      });
    }

    // OTP is valid, update user's email
    const user = await User.findByIdAndUpdate(
      userId,
      { email: email, emailVerified: true },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Clean up OTP data
    delete otpStore[`${userId}-${email}`];

    // Send confirmation email
    const confirmationMailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Email Successfully Updated - LuxorStay',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #D4AF37; margin-bottom: 10px;">Email Successfully Updated</h2>
            <p style="color: #555;">Your LuxorStay account email has been successfully updated to ${email}</p>
          </div>
          <div style="background-color: #f8f8f8; padding: 20px; text-align: center; border-radius: 5px; margin-bottom: 20px;">
            <p style="margin: 0; color: #333;">If you did not make this change, please contact our support team immediately.</p>
          </div>
          <div style="text-align: center; color: #777; font-size: 14px;">
            <p>Thank you for choosing LuxorStay!</p>
          </div>
        </div>
      `
    };

    transporter.sendMail(confirmationMailOptions).catch(error => {
      console.error('Error sending confirmation email:', error);
    });

    return res.status(200).json({
      success: true,
      message: 'Email updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified
      }
    });
  } catch (error) {
    console.error('Error verifying email OTP:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify OTP',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
};