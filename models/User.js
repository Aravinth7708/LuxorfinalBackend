import mongoose from 'mongoose';
import bcrypt from 'bcrypt';


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
      return !this.googleId; // Password is required unless it's a Google user
    }
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
  }
}, { timestamps: true });

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


export default mongoose.model('User', userSchema);
