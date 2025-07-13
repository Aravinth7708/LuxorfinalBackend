import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Define Schemas
const villaAmenitySchema = new mongoose.Schema({
  name: String,
  location: String,
  amenities: [String]
});

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
  collection: 'VillaImages'
});

// Check if models exist before creating
const VillaAmenity = mongoose.models.VillaAmenity || mongoose.model('VillaAmenity', villaAmenitySchema);
const VillaImage = mongoose.models.VillaImage || mongoose.model('VillaImage', villaImageSchema);

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

// Villa image mapping
const villaImageMapping = {
  "Amrith Palace": "anandvilla1.jpg",
  "East Coast Villa": "EC1.jpg",
  "Ram Water Villa": "RW1.jpg",
  "Lavish Villa I": "lvone20.jpg",
  "Lavish Villa II": "lvtwo20.jpg",
  "Lavish Villa III": "lvthree5.jpg",
  "Empire Anand Villa Samudra": "anandvilla1.jpg"
};

// Function to read image file and convert to base64
function imageToBase64(imagePath) {
  try {
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      console.error(`Image file not found: ${imagePath}`);
      return null;
    }
    
    // Read file and convert to base64
    const imageBuffer = fs.readFileSync(imagePath);
    const imageBase64 = imageBuffer.toString('base64');
    
    // Get MIME type based on file extension
    const extension = path.extname(imagePath).toLowerCase();
    let mimeType = 'image/jpeg'; // default
    
    if (extension === '.png') {
      mimeType = 'image/png';
    } else if (extension === '.gif') {
      mimeType = 'image/gif';
    } else if (extension === '.webp') {
      mimeType = 'image/webp';
    }
    
    return `data:${mimeType};base64,${imageBase64}`;
  } catch (error) {
    console.error(`Error converting image to base64: ${error.message}`);
    return null;
  }
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


async function seedData() {
  try {
    // Check if there's existing villa amenities data
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
    
    // Insert villa amenities data
    const amenitiesResult = await VillaAmenity.insertMany(villas);
    console.log(`${amenitiesResult.length} villa amenities inserted successfully!`);
    
    // Check if there's existing villa images data
    const existingImagesCount = await VillaImage.countDocuments();
    console.log(`Found ${existingImagesCount} existing villa images records`);
    
    // Prepare villa image data
    const villaImagesData = [];
    
    for (const villa of villas) {
      const imageName = villaImageMapping[villa.name];
      if (!imageName) {
        console.warn(`No image mapping found for villa: ${villa.name}`);
        continue;
      }
      
      const imagePath = path.join(__dirname, 'img', imageName);
      const imageBase64 = imageToBase64(imagePath);
      
      if (imageBase64) {
        villaImagesData.push({
          villaName: villa.name,
          imageBase64: imageBase64
        });
      }
    }
    
    if (villaImagesData.length > 0) {
   
      if (existingImagesCount > 0) {
        await VillaImage.deleteMany({});
        console.log("Deleted existing villa images data");
      }
      
     
      const imagesResult = await VillaImage.insertMany(villaImagesData);
      console.log(`${imagesResult.length} villa images inserted successfully!`);
    } else {
      console.log("No villa image data to insert");
    }
    
  } catch (err) {
    console.error("Error seeding data:", err);
  } finally {
 
    mongoose.connection.close();
    console.log("MongoDB connection closed");
  }
}

// Run the seed function
seedData();
