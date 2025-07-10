import User from '../models/User.js';
import UserProfile from '../models/UserProfile.js';
import PhoneUser from '../models/PhoneUser.js';
import fs from 'fs';
import path from 'path';

// Get user profile
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?._id;
    const userType = req.user?.userType || 'regular';
    
    if (!userId) {
      console.log("[PROFILE] Missing userId in request:", req.user);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let user;
    let profile;

    // Check user type and retrieve from appropriate collection
    if (userType === 'phone') {
      // For phone users, get data from PhoneUser model
      user = await PhoneUser.findById(userId);
      if (user) {
        // Phone users have their profile data in the same document
        profile = {
          phone: user.phoneNumber,
          name: user.name
        };
      }
    } else {
      // For regular users, get from User model
      user = await User.findById(userId).select('-password');
      
      // Get the detailed profile data if it exists
      profile = user ? await UserProfile.findOne({ userId }) : null;
    }
    
    if (!user) {
      console.log(`[PROFILE] User not found for ID: ${userId} (type: ${userType})`);
      return res.status(404).json({ error: 'User not found' });
    }

    // Extract email and phone
    const email = user.email || req.user.email || '';
    const phoneNumber = user.phoneNumber || req.user.phoneNumber || (profile && profile.phone) || '';

    // Combine user and profile data
    const userData = {
      user: {
        _id: userId,
        name: user.name || (profile && profile.name) || '',
        email: email,
        role: user.role || req.user.role || 'user',
        phone: phoneNumber,
        address: profile ? profile.address : '',
        city: profile ? profile.city : '',
        state: profile ? profile.state : '',
        zipCode: profile ? profile.zipCode : '',
        profileImage: profile ? profile.profileImage : '',
        createdAt: user.createdAt,
        userType: userType
      }
    };

    console.log(`[PROFILE] Successfully retrieved profile for user: ${userId}`);
    return res.status(200).json(userData);
  } catch (err) {
    console.error('[PROFILE] Error getting profile:', err);
    return res.status(500).json({ 
      error: 'Server error', 
      message: err.message 
    });
  }
};

// Update the profile endpoint to match what your frontend expects

// Add email OTP endpoints
export const sendEmailOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }
    
    // Generate OTP (6-digit number)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP in database or cache (for demo, we'll just return success)
    // In a real app, you'd send this via email service like SendGrid, Nodemailer, etc.
    
    console.log(`Email OTP for ${email}: ${otp}`); // For development
    
    return res.json({
      success: true,
      message: 'Verification code sent to your email'
    });
    
  } catch (err) {
    console.error('Error sending email OTP:', err);
    return res.status(500).json({ 
      error: 'Failed to send verification code',
      message: err.message 
    });
  }
};

export const verifyEmailOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }
    
    // In a real app, you'd verify the OTP against stored value
    // For demo purposes, we'll accept any 6-digit code
    if (otp.length === 6) {
      // Update user profile with new email
      let userProfile = await UserProfile.findOne({ userId });
      
      if (!userProfile) {
        userProfile = new UserProfile({ userId });
      }
      
      userProfile.email = email;
      await userProfile.save();
      
      return res.json({
        success: true,
        message: 'Email verified and updated successfully'
      });
    } else {
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    
  } catch (err) {
    console.error('Error verifying email OTP:', err);
    return res.status(500).json({ 
      error: 'Failed to verify email',
      message: err.message 
    });
  }
};

// Make sure you have these endpoints in your profileController.js

// Update the profile endpoint to match what your frontend expects
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?._id;
    const updateData = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Find and update user profile
    let userProfile = await UserProfile.findOne({ userId });
    
    if (!userProfile) {
      // Create new profile if it doesn't exist
      userProfile = new UserProfile({ userId, ...updateData });
    } else {
      // Update existing profile
      Object.assign(userProfile, updateData);
    }
    
    await userProfile.save();
    
    return res.json({
      success: true,
      message: 'Profile updated successfully',
      profileData: userProfile
    });
    
  } catch (err) {
    console.error('Error updating profile:', err);
    return res.status(500).json({ 
      error: 'Failed to update profile',
      message: err.message 
    });
  }
};

// Delete profile image
export const deleteProfileImage = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?._id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const profile = await UserProfile.findOne({ userId });
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    // Remove profile image
    profile.profileImage = '';
    await profile.save();
    
    return res.status(200).json({ 
      message: 'Profile image removed successfully' 
    });
    
  } catch (err) {
    console.error('Error in deleteProfileImage:', err);
    return res.status(500).json({ 
      error: 'Server error', 
      message: process.env.NODE_ENV === 'production' ? 'Failed to delete profile image' : err.message 
    });
  }
};

// Add this function if it's not already there
export const updatePhone = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { phone } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    
    // Find user profile
    let userProfile = await UserProfile.findOne({ userId });
    
    if (!userProfile) {
      // Create profile if it doesn't exist
      userProfile = new UserProfile({ userId });
    }
    
    // Update phone number
    userProfile.phone = phone;
    await userProfile.save();
    
    // If there's a PhoneUser with this phone, link it to this user
    try {
      const phoneUser = await PhoneUser.findOne({ phone });
      if (phoneUser) {
        // Update the phoneUser with this userId for linking
        phoneUser.linkedUserId = userId;
        await phoneUser.save();
      }
    } catch (err) {
      console.error('Error linking phone user:', err);
      // Continue anyway
    }
    
    return res.json({
      success: true,
      message: 'Phone number updated successfully'
    });
    
  } catch (err) {
    console.error('Error updating phone number:', err);
    return res.status(500).json({ 
      error: 'Failed to update phone number',
      message: err.message 
    });
  }
};

// Upload profile image as base64
export const uploadProfileImage = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?._id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { imageData } = req.body;
    
    if (!imageData) {
      return res.status(400).json({ error: 'No image data provided' });
    }
    
    // Validate base64 image format
    const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
    if (!base64Regex.test(imageData)) {
      return res.status(400).json({ error: 'Invalid image format. Only JPEG, PNG, GIF, and WebP are allowed.' });
    }
    
    // Extract file extension from base64 string
    const matches = imageData.match(/^data:image\/([a-zA-Z0-9]+);base64,/);
    const fileExtension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    
    // Remove the data:image/[type];base64, part
    const base64Data = imageData.replace(/^data:image\/[a-zA-Z0-9]+;base64,/, '');
    
    // Check base64 data size (roughly 5MB limit)
    const sizeInBytes = (base64Data.length * 3) / 4;
    const maxSizeInBytes = 5 * 1024 * 1024; // 5MB
    
    if (sizeInBytes > maxSizeInBytes) {
      return res.status(400).json({ error: 'Image size too large. Maximum size is 5MB.' });
    }
    
    // Create uploads directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), 'uploads', 'profile-images');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${userId}_${timestamp}.${fileExtension}`;
    const filePath = path.join(uploadDir, filename);
    
    // Get or create user profile
    let userProfile = await UserProfile.findOne({ userId });
    
    if (!userProfile) {
      userProfile = new UserProfile({ userId });
    }
    
    // Delete old profile image if it exists
    if (userProfile.profileImage) {
      const oldImagePath = path.join(process.cwd(), userProfile.profileImage.replace(/^\//, ''));
      if (fs.existsSync(oldImagePath)) {
        try {
          fs.unlinkSync(oldImagePath);
          console.log('Old profile image deleted:', oldImagePath);
        } catch (err) {
          console.error('Error deleting old image:', err);
        }
      }
    }
    
    // Convert base64 to buffer and save file
    const imageBuffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, imageBuffer);
    
    // Update profile with new image URL
    const imageUrl = `/uploads/profile-images/${filename}`;
    userProfile.profileImage = imageUrl;
    
    await userProfile.save();
    
    console.log(`Profile image uploaded for user ${userId}: ${imageUrl}`);
    
    return res.status(200).json({
      success: true,
      message: 'Profile image uploaded successfully',
      imageUrl: imageUrl,
      profileData: userProfile
    });
    
  } catch (err) {
    console.error('Error uploading profile image:', err);
    
    return res.status(500).json({
      error: 'Failed to upload profile image',
      message: process.env.NODE_ENV === 'production' ? 'Upload failed' : err.message
    });
  }
};