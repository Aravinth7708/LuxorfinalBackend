import mongoose from 'mongoose';

const UserProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  name: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  countryCode: {
    type: String,
    trim: true,
    default: "+91"
  },
  address: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  state: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    trim: true
  },
  zipCode: {
    type: String,
    trim: true
  },
  profileImage: {
    type: String, // Store as base64 string
  }
}, {
  timestamps: true
});

// Create index for faster lookups
UserProfileSchema.index({ userId: 1 });

// Validate image size before saving
UserProfileSchema.pre('save', function(next) {
  if (this.profileImage && this.profileImage.length > 5242880) { // 5MB limit
    next(new Error('Profile image is too large (max 5MB)'));
  } else {
    next();
  }
});

export default mongoose.model('UserProfile', UserProfileSchema);