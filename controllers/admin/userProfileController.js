import UserProfile from '../../models/UserProfile.js';
import User from '../../models/User.js';

// Get all user profiles
export const getAllUserProfiles = async (req, res) => {
  try {
    console.log("[USER PROFILES] Fetching all profiles");
    
    const userProfiles = await UserProfile.find()
      .populate('userId', 'email role isActive')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: userProfiles.length,
      profiles: userProfiles
    });
  } catch (error) {
    console.error("[USER PROFILES] Error fetching profiles:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch user profiles",
      message: error.message
    });
  }
};

// Get user profile by ID
export const getUserProfileById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const userProfile = await UserProfile.findById(id).populate('userId', 'email role isActive');
    
    if (!userProfile) {
      return res.status(404).json({
        success: false,
        error: "User profile not found"
      });
    }
    
    res.json({
      success: true,
      profile: userProfile
    });
  } catch (error) {
    console.error("[USER PROFILES] Error fetching profile:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch user profile",
      message: error.message
    });
  }
};

// Update user profile
export const updateUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, countryCode, address, city, state, country, zipCode } = req.body;
    
    const userProfile = await UserProfile.findById(id);
    
    if (!userProfile) {
      return res.status(404).json({
        success: false,
        error: "User profile not found"
      });
    }
    
    // Update fields if provided
    if (name !== undefined) userProfile.name = name;
    if (phone !== undefined) userProfile.phone = phone;
    if (countryCode !== undefined) userProfile.countryCode = countryCode;
    if (address !== undefined) userProfile.address = address;
    if (city !== undefined) userProfile.city = city;
    if (state !== undefined) userProfile.state = state;
    if (country !== undefined) userProfile.country = country;
    if (zipCode !== undefined) userProfile.zipCode = zipCode;
    
    // Handle profile image separately to avoid overwriting with undefined
    if (req.body.profileImage !== undefined) {
      userProfile.profileImage = req.body.profileImage;
    }
    
    await userProfile.save();
    
    res.json({
      success: true,
      message: "User profile updated successfully",
      profile: userProfile
    });
  } catch (error) {
    console.error("[USER PROFILES] Error updating profile:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update user profile",
      message: error.message
    });
  }
};

// Delete user profile
export const deleteUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedProfile = await UserProfile.findByIdAndDelete(id);
    
    if (!deletedProfile) {
      return res.status(404).json({
        success: false,
        error: "User profile not found"
      });
    }
    
    res.json({
      success: true,
      message: "User profile deleted successfully",
      id
    });
  } catch (error) {
    console.error("[USER PROFILES] Error deleting profile:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete user profile",
      message: error.message
    });
  }
};

// Create user profile (admin function)
export const createUserProfile = async (req, res) => {
  try {
    const { userId, name, phone, countryCode, address, city, state, country, zipCode, profileImage } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required"
      });
    }
    
    // Check if user exists
    const userExists = await User.findById(userId);
    if (!userExists) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }
    
    // Check if profile already exists for this user
    const existingProfile = await UserProfile.findOne({ userId });
    if (existingProfile) {
      return res.status(409).json({
        success: false,
        error: "Profile already exists for this user",
        profileId: existingProfile._id
      });
    }
    
    // Create new profile
    const newProfile = new UserProfile({
      userId,
      name,
      phone,
      countryCode: countryCode || "+91",
      address,
      city,
      state,
      country,
      zipCode,
      profileImage
    });
    
    await newProfile.save();
    
    res.status(201).json({
      success: true,
      message: "User profile created successfully",
      profile: newProfile
    });
  } catch (error) {
    console.error("[USER PROFILES] Error creating profile:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create user profile",
      message: error.message
    });
  }
};

// Get profile by user ID
export const getProfileByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const userProfile = await UserProfile.findOne({ userId });
    
    if (!userProfile) {
      return res.status(404).json({
        success: false,
        error: "Profile not found for this user"
      });
    }
    
    res.json({
      success: true,
      profile: userProfile
    });
  } catch (error) {
    console.error("[USER PROFILES] Error fetching profile by user ID:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch profile",
      message: error.message
    });
  }
};