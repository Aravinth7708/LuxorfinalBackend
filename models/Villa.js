import mongoose from 'mongoose';

const villaSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  price: { type: Number, required: true },
  weekdayPrice: { type: Number },
  // weekendPrice: { type: Number }, // Standardized property name with capital P
  weekendprice: { type: Number }, // Legacy field, kept for backward compatibility
  description: { type: String },
  longDescription: { type: String },
  amenities: [{ type: String }], // Amenities list
  guests: { type: Number },
  bedrooms: { type: Number },
  bathrooms: { type: Number },
  rating: { type: Number, default: 4.5 }
}, { collection: 'Villas' });

export default mongoose.model('Villa', villaSchema);
