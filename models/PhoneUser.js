import mongoose from 'mongoose';

const phoneUserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    unique: true,
    sparse: true, // Allow null values but enforce uniqueness for non-null values
    trim: true
  },
  firebaseUid: {
    type: String,
    unique: true,
    sparse: true
  },
  isVerified: {
    type: Boolean,
    default: true // Phone users are verified through Firebase
  },
  isPhoneVerified: {
    type: Boolean,
    default: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  profilePicture: {
    type: String
  },
  lastLogin: {
    type: Date
  }
}, { 
  timestamps: true,
  collection: 'phoneusers' // Explicit collection name
});

// Index for better query performance
phoneUserSchema.index({ phoneNumber: 1 });
phoneUserSchema.index({ firebaseUid: 1 });
phoneUserSchema.index({ email: 1 });

export default mongoose.model('PhoneUser', phoneUserSchema);
