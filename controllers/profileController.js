import UserProfile from "../models/UserProfile.js"
import PhoneUser from "../models/PhoneUser.js"
import Booking from "../models/Booking.js"
import User from "../models/User.js";
export const checkaddressinbooking = async (req, res) => {
  const { gmail } = req.body

  if (!gmail) {
    return res.status(400).json({ error: "Email required" })
  }
  

  try {
    const address = await Booking.findOne({ email: `${gmail}` })
    if (!address) {
      return res.status(404).json({ error: "Address not found" })
    }

    const nameandphone = await PhoneUser.findOne({ email: `${gmail}` })
    if (!nameandphone) {
      return res.status(404).json({ error: "Name and phone number not found" })
    }

    return res.status(200).json({ address, nameandphone })
  } catch (error) {
    console.error("Error checking address in booking:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

// Get user profile with existing booking and phone data
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?._id
    const userEmail = req.user?.email

    if (!userId || !userEmail) {
      return res.status(401).json({ error: "Authentication required" })
    }

    // Check if profile data exists in different sources
    const bookingData = await Booking.findOne({ email: userEmail })
    const phoneUserData = await PhoneUser.findOne({ email: userEmail })
    const userProfileData = await UserProfile.findOne({ userId: userId })

    // Determine data availability
    const hasBookingData = !!bookingData
    const hasPhoneData = !!phoneUserData
    const hasProfileData = !!userProfileData

    // If no data exists at all
    if (!hasBookingData && !hasPhoneData && !hasProfileData) {
      return res.status(200).json({
        success: true,
        hasData: false,
        message: "No profile data found. Please complete your profile.",
        user: {
          name: "",
          email: userEmail,
          phone: "",
          countryCode: "+91",
          address: "",
          city: "",
          state: "",
          country: "",
          zipCode: "",
          profileImage: "",
        },
      })
    }

    // Merge data from all available sources (priority: UserProfile > PhoneUser > Booking)
    const profileData = {
      name: userProfileData?.name || phoneUserData?.name || "",
      email: userEmail,
      phone: userProfileData?.phone || phoneUserData?.phoneNumber || "",
      countryCode: userProfileData?.countryCode || phoneUserData?.countryCode || "+91",
      address: userProfileData?.address || bookingData?.address?.street || "",
      city: userProfileData?.city || bookingData?.address?.city || "",
      state: userProfileData?.state || bookingData?.address?.state || "",
      country: userProfileData?.country || bookingData?.address?.country || "",
      zipCode: userProfileData?.zipCode || bookingData?.address?.zipCode || bookingData?.postalCode || "",
      profileImage: userProfileData?.profileImage || phoneUserData?.profileImage || "",
    }

    return res.status(200).json({
      success: true,
      hasData: true,
      dataSource: {
        hasBookingData,
        hasPhoneData,
        hasProfileData,
      },
      user: profileData,
    })
  } catch (err) {
    console.error("Error getting profile:", err)
    return res.status(500).json({
      error: "Server error",
      message: err.message,
    })
  }
}

// Update profile data
export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?._id
    const userEmail = req.user?.email
    const profileData = req.body

    if (!userId || !userEmail) {
      return res.status(401).json({ error: "Authentication required" })
    }

    console.log("Updating profile with data:", profileData);

    // Clean phone number if provided
    if (profileData.phone) {
      profileData.phone = profileData.phone.replace(/\s+/g, '').replace(/[-+()]/g, '');
    }

    // Ensure country field is included in the update
    const updateData = {
      userId: userId,
      email: userEmail,
      ...profileData,
      updatedAt: new Date(),
      // Make sure these fields are explicitly included
      country: profileData.country || "",
      state: profileData.state || "",
      city: profileData.city || "",
      zipCode: profileData.zipCode || "",
      countryCode: profileData.countryCode || "+91",
      phone: profileData.phone || ""
    };

    // Update or create UserProfile
    const updatedProfile = await UserProfile.findOneAndUpdate(
      { userId: userId },
      updateData,
      {
        upsert: true,
        new: true,
        runValidators: true,
      }
    )

    console.log("Profile updated successfully:", updatedProfile);

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedProfile,
    })
  } catch (error) {
    console.error("Error updating profile:", error)
    return res.status(500).json({
      error: "Failed to update profile",
      message: error.message,
    })
  }
}

// Upload profile image - Fixed to handle base64 properly
export const uploadProfileImage = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?._id
    const { imageData } = req.body

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" })
    }

    if (!imageData) {
      return res.status(400).json({ error: "Image data is required" })
    }

    // Validate base64 format
    if (!imageData.startsWith("data:image/")) {
      return res.status(400).json({ error: "Invalid image format" })
    }

    // Check image size (base64 is ~33% larger than original)
    const imageSizeBytes = (imageData.length * 3) / 4
    if (imageSizeBytes > 5 * 1024 * 1024) {
      // 5MB limit
      return res.status(400).json({ error: "Image size too large (max 5MB)" })
    }

    // Update profile with new image
    const updatedProfile = await UserProfile.findOneAndUpdate(
      { userId: userId },
      {
        profileImage: imageData,
        updatedAt: new Date(),
      },
      {
        upsert: true,
        new: true,
      },
    )

    return res.status(200).json({
      success: true,
      message: "Profile image updated successfully",
      imageData: imageData,
    })
  } catch (error) {
    console.error("Error uploading image:", error)
    return res.status(500).json({
      error: "Failed to upload image",
      message: error.message,
    })
  }
}

// Update phone number
export const updatePhoneNumber = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?._id
    const { phone, countryCode } = req.body

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" })
    }

    if (!phone || !countryCode) {
      return res.status(400).json({ error: "Phone number and country code are required" })
    }

    // Ensure phone number is stored correctly without any formatting issues
    const cleanedPhone = phone.replace(/\s+/g, '').replace(/[-+()]/g, '');

    // Update profile with new phone number
    const updatedProfile = await UserProfile.findOneAndUpdate(
      { userId: userId },
      {
        phone: cleanedPhone, // Store clean phone number
        countryCode: countryCode,
        updatedAt: new Date(),
      },
      {
        upsert: true,
        new: true,
      }
    )

    return res.status(200).json({
      success: true,
      message: "Phone number updated successfully",
      user: updatedProfile,
    })
  } catch (error) {
    console.error("Error updating phone number:", error)
    return res.status(500).json({
      error: "Failed to update phone number",
      message: error.message,
    })
  }
}


export const checkPhoneExists = async (req, res) => {
  try {
    const { phoneNumber } = req.query;
    
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }
    
    console.log(`[PHONE CHECK] Checking if phone number exists: ${phoneNumber}`);
    
    // Check in PhoneUser collection
    const phoneUser = await PhoneUser.findOne({ phoneNumber });
    
    // Also check if another regular user has this phone number
    // Look in both phone and phoneNumber fields for maximum compatibility
    const regularUser = await User.findOne({ 
      $or: [
        { phone: phoneNumber },
        { phoneNumber: phoneNumber }
      ] 
    });
    
    const userProfile = await UserProfile.findOne({ phone: phoneNumber });
    
    const exists = !!phoneUser || !!regularUser || !!userProfile;
    
    console.log(`[PHONE CHECK] Phone ${phoneNumber} exists: ${exists}`);
    
    // Return whether the phone exists or not
    res.status(200).json({
      success: true,
      exists: exists,
      // Don't include user details for security reasons
    });
  } catch (error) {
    console.error('Error checking phone:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: error.message
    });
  }
};