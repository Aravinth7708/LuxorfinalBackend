import mongoose from 'mongoose';

const villaImageSchema = new mongoose.Schema({
  villaName: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  imageBase64: {
    type: String,
    required: true
  }
}, {
  timestamps: true,
  collection: 'VillaImages'
});

export default mongoose.model('VillaImage', villaImageSchema);