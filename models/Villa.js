const mongoose = require('mongoose');

const villaSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String },
  price: { type: Number },
  description: { type: String },
  images: [String],
  facilities: [{ name: String, image: String }],
  guests: { type: Number },
  bedrooms: { type: Number },
  bathrooms: { type: Number },
 
}, { collection: 'Villas' });

module.exports = mongoose.model('Villa', villaSchema);
