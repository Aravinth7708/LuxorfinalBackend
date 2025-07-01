import mongoose from 'mongoose';
import bcrypt from 'bcrypt';


const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: function() {
      // Either email or phoneNumber must be provided
      return !this.phoneNumber;
    },
    unique: true,
    sparse: true // Allows null values (for phone-only users)
  },
  phoneNumber: {
    type: String,
    required: function() {
      // Either email or phoneNumber must be provided
      return !this.email;
    },
    unique: true,
    sparse: true // Allows null values (for email-only users)
  },
  password: { 
    type: String,
    // Password not required for OAuth or phone users
    required: function() {
      return !this.googleId && !this.phoneAuthOnly;
    }
  },
  name: { type: String },
  firstName: { type: String },
  lastName: { type: String },
  profileImage: { type: String },
  
  // Google authentication fields
  googleId: { type: String, sparse: true, unique: true },
  isGoogleUser: { type: Boolean, default: false },
  
  // Phone authentication
  phoneAuthOnly: { type: Boolean, default: false },
  phoneVerified: { type: Boolean, default: false },
  
  // User status
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  
  // Role management
  role: { 
    type: String, 
    enum: ['user', 'admin'],
    default: 'user'
  },
  
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date }
});

// Pre-save hook for password hashing (when password changes)
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password') || !this.password) return next();
  
  try {
    // Generate salt and hash the password
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
