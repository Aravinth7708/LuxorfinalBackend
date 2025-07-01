import mongoose from 'mongoose';

const facilitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String }
});

const villaSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  price: { type: Number, required: true },
  weekdayPrice: { type: Number },
  weekendPrice: { type: Number },
  description: { type: String },
  longDescription: { type: String },
  facilities: [facilitySchema],
  images: [{ type: String }],
  guests: { type: Number },
  maxGuests: { type: Number }, // For events/large groups
  bedrooms: { type: Number },
  bathrooms: { type: Number },
  events: { type: Boolean, default: false },
  eventPricing: { type: String },
  nearbyAttractions: [{ type: String }],
  specificRules: { type: String },
  securityDeposit: { type: Number },
  rating: { type: Number, default: 4.5 }
}, { collection: 'Villas' });

export default mongoose.model('Villa', villaSchema);
