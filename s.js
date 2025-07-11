import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get MongoDB URI from environment variables
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("Error: MONGO_URI is not defined in environment variables");
  process.exit(1);
}

// Connect to MongoDB using the URI from .env
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("MongoDB connected to:", MONGO_URI.split('@')[1]))
  .catch(err => console.error("MongoDB connection error:", err));

// Define Schema
const villaAmenitySchema = new mongoose.Schema({
  name: String,
  location: String,
  amenities: [String]
});

// Check if model exists before creating
const VillaAmenity = mongoose.models.VillaAmenity || mongoose.model('VillaAmenity', villaAmenitySchema);

// Standard amenities list
const standardAmenities = [
  "Private Pool", "Free Parking", "Free Street Parking", "AC", "WiFi", "Garden",
  "Microwave", "Refrigerator", "Stove", "Dishes", "Cooking Basics", "Coffee Maker",
  "Washing machine", "Geyser", "Oven", "Baby Crib", "TV", "Shampoo", "Essentials",
  "Hanger", "Room Dark Shades", "Patio"
];

// Helper to pick 12 random amenities
function pickRandomAmenities() {
  const shuffled = [...standardAmenities].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 12);
}

// Villas to insert (with corrected names)
const villas = [
  { name: "Ram Water Villa", location: "Chennai" },
  { name: "Lavish Villa I", location: "Pondicherry" },
  { name: "Lavish Villa II", location: "Pondicherry" },
  { name: "Lavish Villa III", location: "Pondicherry" },
  { name: "Empire Anand Villa Samudra", location: "Chennai" },
  { name: "Amrith Palace", location: "Chennai" },
  { name: "East Coast Villa", location: "Chennai" }
].map(villa => ({
  ...villa,
  amenities: pickRandomAmenities()
}));

// Function to seed data
async function seedData() {
  try {
    // Check if there's existing data
    const existingCount = await VillaAmenity.countDocuments();
    console.log(`Found ${existingCount} existing villa amenities records`);
    
    if (existingCount > 0) {
      // Ask for confirmation to delete existing data
      console.log("Warning: You have existing villa amenity data");
      console.log("1. Delete existing data and insert new data");
      console.log("2. Keep existing data and add new data");
      console.log("3. Cancel operation");
      
      // For now, we'll just add new data
      console.log("Adding new villa amenity data...");
    }
    
    // Insert data
    const result = await VillaAmenity.insertMany(villas);
    console.log(`${result.length} villa amenities inserted successfully!`);
  } catch (err) {
    console.error("Error seeding villa amenities:", err);
  } finally {
    // Close DB connection
    mongoose.connection.close();
    console.log("MongoDB connection closed");
  }
}

// Run the seed function
seedData();
