import mongoose from 'mongoose';

const villaAmenitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  amenities: {
    type: [String],
    required: true,
    validate: [array => array && array.length > 0, 'At least one amenity is required']
  }
}, {
  timestamps: true
});

export default mongoose.model('VillaAmenity', villaAmenitySchema);
