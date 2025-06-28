const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  clerkId: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  password: { type: String, required: true }, // ClerkID as password
  name: { type: String },
  imageUrl: { type: String },
  isVerified: { type: Boolean, default: false }, // Added verified status
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
