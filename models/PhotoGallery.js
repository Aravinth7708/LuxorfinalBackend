import mongoose from 'mongoose';

const photoGallerySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  imageUrl: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Villa', 'Room', 'Exterior', 'Amenities', 'Other']
  },
  featured: {
    type: Boolean,
    default: false
  },
  dateAdded: {
    type: Date,
    default: Date.now
  }
}, { collection: 'PhotoGallery' });

export default mongoose.model('PhotoGallery', photoGallerySchema);
