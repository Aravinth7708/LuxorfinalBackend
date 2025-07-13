import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';


const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: function() {
      return !this.googleId; // Name is required unless it's a Google user
    }
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId && !this.phoneNumber; // Password is required unless it's a Google user or phone user
    },
    minlength: [8, 'Password should be at least 8 characters long'],
    select: false // Don't include password in query results by default
  },
  googleId: {
    type: String
  },
  phoneNumber: {
    type: String,
    unique: true,
    sparse: true, // Allow null values but enforce uniqueness for non-null values
    trim: true
  },
  profilePicture: {
    type: String
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  firebaseUid: {
    type: String,
    sparse: true // Allow null values but enforce uniqueness for non-null values
  },
  passwordResetToken: String,
  passwordResetExpires: Date,
  lastPasswordChange: Date
}, { timestamps: true });

// Pre-save hook for password hashing (when password changes)
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password') || !this.password) return next();
  
  try {
    // Generate salt and hash the password - increasing salt rounds for better security
    const salt = await bcrypt.genSalt(12); // Increase from 10 to 12 for stronger security
    this.password = await bcrypt.hash(this.password, salt);
    
    // Update the lastPasswordChange field
    this.lastPasswordChange = Date.now();
    
    next();
  } catch (error) {
    console.error('Password hashing error:', error);
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Static method to find user by credentials (for login)
userSchema.statics.findByCredentials = async function(email, password) {
  // Include password field explicitly since we've set select: false
  const user = await this.findOne({ email }).select('+password');
  
  if (!user) {
    return null;
  }
  
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return null;
  }
  
  return user;
};

// Method to generate JWT token with enhanced security
userSchema.methods.generateAuthToken = function() {
  const token = jwt.sign(
    { 
      userId: this._id, 
      role: this.role,
      version: this.lastPasswordChange ? this.lastPasswordChange.getTime() : Date.now()
    },
    process.env.JWT_SECRET || 'your-default-secret-key',
    { 
      expiresIn: '7d', 
      algorithm: 'HS256',
      issuer: 'luxorstay-api',
      audience: 'luxorstay-client'
    }
  );
  return token;
};


export default mongoose.model('User', userSchema);
