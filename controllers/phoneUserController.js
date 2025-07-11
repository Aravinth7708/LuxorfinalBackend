import PhoneUser from '../models/PhoneUser.js';

// Get all phone users
export const getAllPhoneUsers = async (req, res) => {
  try {
    const phoneUsers = await PhoneUser.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      users: phoneUsers
    });
  } catch (error) {
    console.error('Error fetching phone users:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch phone users', 
      message: error.message 
    });
  }
};

// Get phone user by ID
export const getPhoneUserById = async (req, res) => {
  try {
    const phoneUser = await PhoneUser.findById(req.params.id);
    if (!phoneUser) {
      return res.status(404).json({ 
        success: false, 
        error: 'Phone user not found' 
      });
    }
    res.status(200).json({
      success: true,
      user: phoneUser
    });
  } catch (error) {
    console.error('Error fetching phone user:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch phone user', 
      message: error.message 
    });
  }
};

// Create a new phone user
export const createPhoneUser = async (req, res) => {
  try {
    const { name, phoneNumber, email, role, isEmailVerified, profilePicture, firebaseUid } = req.body;
    
    // Check if phone number already exists
    const existingUser = await PhoneUser.findOne({ phoneNumber });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        error: 'Phone number already registered' 
      });
    }
    
    // Check if email exists if provided
    if (email) {
      const emailExists = await PhoneUser.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ 
          success: false, 
          error: 'Email already registered' 
        });
      }
    }

    const newPhoneUser = new PhoneUser({
      name,
      phoneNumber,
      email,
      role: role || 'user',
      isEmailVerified: isEmailVerified || false,
      profilePicture,
      firebaseUid,
      lastLogin: new Date()
    });

    await newPhoneUser.save();
    res.status(201).json({ 
      success: true, 
      message: 'Phone user created successfully', 
      user: newPhoneUser 
    });
  } catch (error) {
    console.error('Error creating phone user:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create phone user', 
      message: error.message 
    });
  }
};

// Update an existing phone user
export const updatePhoneUser = async (req, res) => {
  try {
    const { name, phoneNumber, email, role, isEmailVerified, profilePicture } = req.body;
    
    // Check if phone user exists
    const phoneUser = await PhoneUser.findById(req.params.id);
    if (!phoneUser) {
      return res.status(404).json({ 
        success: false, 
        error: 'Phone user not found' 
      });
    }
    
    // Check if new phone number already exists with a different user
    if (phoneNumber && phoneNumber !== phoneUser.phoneNumber) {
      const phoneExists = await PhoneUser.findOne({ phoneNumber });
      if (phoneExists) {
        return res.status(400).json({ 
          success: false, 
          error: 'Phone number already registered to another user' 
        });
      }
    }
    
    // Check if new email already exists with a different user
    if (email && email !== phoneUser.email) {
      const emailExists = await PhoneUser.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ 
          success: false, 
          error: 'Email already registered to another user' 
        });
      }
    }

    // Update the phone user
    const updatedPhoneUser = await PhoneUser.findByIdAndUpdate(
      req.params.id, 
      { 
        name, 
        phoneNumber, 
        email, 
        role, 
        isEmailVerified, 
        profilePicture 
      },
      { new: true }
    );

    res.status(200).json({ 
      success: true, 
      message: 'Phone user updated successfully', 
      user: updatedPhoneUser 
    });
  } catch (error) {
    console.error('Error updating phone user:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update phone user', 
      message: error.message 
    });
  }
};

// Delete a phone user
export const deletePhoneUser = async (req, res) => {
  try {
    const phoneUser = await PhoneUser.findById(req.params.id);
    if (!phoneUser) {
      return res.status(404).json({ 
        success: false, 
        error: 'Phone user not found' 
      });
    }
    
    await PhoneUser.findByIdAndDelete(req.params.id);
    res.status(200).json({ 
      success: true, 
      message: 'Phone user deleted successfully',
      id: req.params.id
    });
  } catch (error) {
    console.error('Error deleting phone user:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete phone user', 
      message: error.message 
    });
  }
};
