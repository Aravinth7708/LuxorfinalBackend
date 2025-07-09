import PhoneUser from '../models/PhoneUser.js';

// Get all phone users (admin only)
export const getAllPhoneUsers = async (req, res) => {
  try {
    // Check if requester is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    // Get all phone users
    const users = await PhoneUser.find({})
      .sort({ createdAt: -1 }) // Newest first
      .select('-__v'); // Exclude version field
    
    return res.status(200).json({ 
      success: true, 
      count: users.length,
      users 
    });
  } catch (error) {
    console.error('[ADMIN] Error fetching phone users:', error);
    return res.status(500).json({ 
      error: 'Server error', 
      message: 'Failed to fetch phone users'
    });
  }
};

// Get single phone user by ID (admin only)
export const getPhoneUserById = async (req, res) => {
  try {
    // Check if requester is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    const { id } = req.params;
    
    // Find the user
    const user = await PhoneUser.findById(id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    return res.status(200).json({ 
      success: true, 
      user 
    });
  } catch (error) {
    console.error('[ADMIN] Error fetching phone user:', error);
    return res.status(500).json({ 
      error: 'Server error', 
      message: 'Failed to fetch phone user details'
    });
  }
};

// Update phone user details (admin only)
export const updatePhoneUser = async (req, res) => {
  try {
    // Check if requester is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    const { id } = req.params;
    const { name, email, isEmailVerified, role } = req.body;
    
    // Find and update the user
    const user = await PhoneUser.findById(id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update fields if provided
    if (name) user.name = name;
    if (email) user.email = email;
    if (isEmailVerified !== undefined) user.isEmailVerified = isEmailVerified;
    if (role) user.role = role;
    
    await user.save();
    
    return res.status(200).json({ 
      success: true, 
      message: 'User updated successfully',
      user 
    });
  } catch (error) {
    console.error('[ADMIN] Error updating phone user:', error);
    return res.status(500).json({ 
      error: 'Server error', 
      message: 'Failed to update phone user'
    });
  }
};

// Create a new phone user (admin only)
export const createPhoneUser = async (req, res) => {
  try {
    // Check if requester is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    const { name, phoneNumber, email, role, isEmailVerified } = req.body;
    
    // Validation
    if (!name || !phoneNumber) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        message: 'Name and phone number are required' 
      });
    }
    
    // Check if phone number already exists
    const existingUserByPhone = await PhoneUser.findOne({ phoneNumber });
    if (existingUserByPhone) {
      return res.status(409).json({ 
        error: 'Validation failed', 
        message: 'Phone number is already registered' 
      });
    }
    
    // Check if email already exists (if provided)
    if (email) {
      const existingUserByEmail = await PhoneUser.findOne({ email });
      if (existingUserByEmail) {
        return res.status(409).json({ 
          error: 'Validation failed', 
          message: 'Email is already registered' 
        });
      }
    }
    
    // Create new phone user
    const newUser = new PhoneUser({
      name,
      phoneNumber,
      email,
      role: role || 'user',
      isEmailVerified: isEmailVerified || false,
      isPhoneVerified: true, // Admin-created users have verified phone
      isVerified: true,
      lastLogin: null
    });
    
    await newUser.save();
    
    return res.status(201).json({ 
      success: true, 
      message: 'Phone user created successfully',
      user: newUser 
    });
  } catch (error) {
    console.error('[ADMIN] Error creating phone user:', error);
    return res.status(500).json({ 
      error: 'Server error', 
      message: 'Failed to create phone user'
    });
  }
};

// Delete phone user (admin only)
export const deletePhoneUser = async (req, res) => {
  try {
    // Check if requester is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    const { id } = req.params;
    
    // Find and delete the user
    const user = await PhoneUser.findById(id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await PhoneUser.deleteOne({ _id: id });
    
    return res.status(200).json({ 
      success: true, 
      message: 'User deleted successfully',
      id 
    });
  } catch (error) {
    console.error('[ADMIN] Error deleting phone user:', error);
    return res.status(500).json({ 
      error: 'Server error', 
      message: 'Failed to delete phone user'
    });
  }
};
