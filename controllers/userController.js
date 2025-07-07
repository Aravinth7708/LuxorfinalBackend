import User from '../models/User.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Register a new user
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create new user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role: role || 'user',
      isVerified: true
    });

    await user.save();

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified
    });
  } catch (err) {
    console.error('Error in registerUser: ', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Login user
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User does not exist', code: 'USER_NOT_FOUND' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid password', code: 'INVALID_PASSWORD' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified
      }
    });
  } catch (err) {
    console.error('Error in loginUser: ', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get all users - NEW
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    console.error('Error in getAllUsers: ', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get user by ID - NEW
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (err) {
    console.error('Error in getUserById: ', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update user role - NEW
export const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (err) {
    console.error('Error in updateUserRole: ', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete user - NEW
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error in deleteUser: ', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update user details - NEW
export const updateUser = async (req, res) => {
  try {
    const { name, email, isVerified } = req.body;
    
    // Build update object
    const updateObj = {};
    if (name) updateObj.name = name;
    if (email) updateObj.email = email;
    if (isVerified !== undefined) updateObj.isVerified = isVerified;
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateObj,
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (err) {
    console.error('Error in updateUser: ', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get user profile
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error('Error in getUserProfile: ', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Sync user data (for auth)
export const syncUser = async (req, res) => {
  try {
    const { email, name } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Find or create user
    let user = await User.findOne({ email });
    
    if (!user) {
      // Create new user
      user = new User({
        email,
        name: name || email.split('@')[0],
        isGoogleUser: true,
        isVerified: true,
        role: 'user'
      });
      
      await user.save();
      console.log(`[AUTH] Created new user via sync: ${user._id}`);
    }
    
    // Generate token with userId (not id)
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.status(200).json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: true
      }
    });
    
  } catch (error) {
    console.error('[AUTH] Sync user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
