import User from '../models/User.js';
import UserProfile from '../models/UserProfile.js';
import PhoneUser from '../models/PhoneUser.js';

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

// Update user profile
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?._id;
    const userType = req.user?.userType || 'regular';
    
    if (!userId) {
      console.log("[PROFILE] Missing userId in request:", req.user);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log(`[PROFILE] Updating profile for user: ${userId} (type: ${userType})`);
    console.log(`[PROFILE] Update data:`, req.body);

    const { name, phone, address, city, state, zipCode, profileImage } = req.body;
    
    // Basic validation
    if (profileImage && profileImage.length > 5242880) {
      return res.status(400).json({ error: 'Profile image is too large (max 5MB)' });
    }

    // Handle differently based on user type
    if (userType === 'phone') {
      // For phone users, update PhoneUser model
      // Note: Don't allow updating phone number as it's the primary identifier
      const phoneUser = await PhoneUser.findById(userId);
      
      if (!phoneUser) {
        console.log(`[PROFILE] Phone user not found for ID: ${userId}`);
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Only update name and profilePicture for phone users
      if (name) phoneUser.name = name;
      if (profileImage) phoneUser.profilePicture = profileImage;
      
      await phoneUser.save();
      
      return res.status(200).json({ 
        message: 'Profile updated successfully',
        user: {
          name: phoneUser.name,
          phone: phoneUser.phoneNumber, // Don't allow changing phone number
          email: phoneUser.email,
          profileImage: phoneUser.profilePicture || '',
          // Other fields are not applicable for phone users
          address: '',
          city: '',
          state: '',
          zipCode: ''
        }
      });
    }
    
    // For regular users, continue with UserProfile model
    // Check if profile exists, create if not
    let profile = await UserProfile.findOne({ userId });
    
    if (profile) {
      // Update existing profile
      profile.name = name || profile.name;
      profile.phone = phone !== undefined ? phone : profile.phone;
      profile.address = address !== undefined ? address : profile.address;
      profile.city = city !== undefined ? city : profile.city;
      profile.state = state !== undefined ? state : profile.state;
      profile.zipCode = zipCode !== undefined ? zipCode : profile.zipCode;
      
      // Only update image if a new one is provided
      if (profileImage) {
        profile.profileImage = profileImage;
      }
      
      await profile.save();
      console.log(`[PROFILE] Updated existing profile for user: ${userId}`);
    } else {
      // Create new profile
      profile = new UserProfile({
        userId,
        name,
        phone,
        address,
        city,
        state,
        zipCode,
        profileImage
      });
      
      await profile.save();
      console.log(`[PROFILE] Created new profile for user: ${userId}`);
    }
    
    // Also update name in the user document if provided
    if (name) {
      await User.findByIdAndUpdate(userId, { name });
    }
    
    return res.status(200).json({ 
      message: 'Profile updated successfully',
      user: {
        name: name,
        phone: profile.phone,
        address: profile.address,
        city: profile.city,
        state: profile.state,
        zipCode: profile.zipCode,
        profileImage: profile.profileImage
      }
    });
    
  } catch (err) {
    console.error('[PROFILE] Error updating profile:', err);
    return res.status(500).json({ 
      error: 'Server error', 
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