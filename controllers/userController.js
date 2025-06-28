const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Sync user from frontend (Clerk)
exports.syncUser = async (req, res) => {
  try {
    console.log("[BACKEND] /api/users/sync called. Body received:", req.body);
    const { clerkId, email, name, imageUrl } = req.body;
    if (!clerkId || !email) {
      console.error("[BACKEND] Missing required fields", req.body);
      return res.status(400).json({ error: 'Missing required fields' });
    }
    let user = await User.findOne({ clerkId });
    if (!user) {
      console.log("[BACKEND] No user found, creating new user...");
      user = await User.create({ clerkId, email, password: clerkId, name, imageUrl });
      console.log("[BACKEND] User created:", user);
    } else {
      console.log("[BACKEND] User found, updating...");
      user.email = email;
      user.password = clerkId;
      user.name = name;
      user.imageUrl = imageUrl;
      await user.save();
      console.log("[BACKEND] User updated:", user);
    }
    res.json({ success: true, user });
  } catch (err) {
    console.error("[BACKEND] Error in syncUser:", err);
    res.status(500).json({ error: err.message });
  }
};

// New user registration
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Create new user
    const user = await User.create({
      name,
      email,
      password, // In production, you should hash this password
      clerkId: 'local-' + Date.now(), // Placeholder for local auth users
    });
    
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
      createdAt: user.createdAt
    };
    
    res.json({ 
      success: true, 
      token, 
      user: userWithoutPassword
    });
  } catch (err) {
    console.error("Error in registerUser:", err);
    res.status(500).json({ error: err.message });
  }
};

// User login
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find user
    const user = await User.findOne({ email });
    
    // Check if user exists
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Check password (in production use proper comparison with hashed passwords)
    if (password !== user.password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
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
      createdAt: user.createdAt
    };
    
    res.json({ 
      success: true, 
      token, 
      user: userWithoutPassword
    });
  } catch (err) {
    console.error("Error in loginUser:", err);
    res.status(500).json({ error: err.message });
  }
};

// Get user profile
exports.getUserProfile = async (req, res) => {
  try {
    // Verify token and get userId from it
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      const userId = decoded.userId;
      
      // Find user
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Return user without password
      const userWithoutPassword = {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        imageUrl: user.imageUrl,
        createdAt: user.createdAt
      };
      
      res.json({ user: userWithoutPassword });
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (err) {
    console.error("Error in getUserProfile:", err);
    res.status(500).json({ error: err.message });
  }
};
