import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current file directory to properly resolve relative paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Import the Villa model - using dynamic import for ES modules
const Villa = mongoose.model('Villa', new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  price: { type: Number, required: true },
  weekdayPrice: { type: Number },
  weekendPrice: { type: Number },
  description: { type: String },
  longDescription: { type: String },
  facilities: [{ 
    name: { type: String, required: true },
    image: { type: String }
  }],
  images: [{ type: String }],
  guests: { type: Number },
  maxGuests: { type: Number },
  bedrooms: { type: Number },
  bathrooms: { type: Number },
  events: { type: Boolean, default: false },
  eventPricing: { type: String },
  nearbyAttractions: [{ type: String }],
  specificRules: { type: String },
  securityDeposit: { type: Number },
  rating: { type: Number, default: 4.5 }
}, { collection: 'Villas' }));

// Updated villa data based on text descriptions
const villaUpdates = [
  {
    name: "Amrith Palace",
    location: "Pattipulam ECR, Chennai",
    price: 45000,
    weekdayPrice: 45000,
    weekendPrice: 65000,
    description: "9BHK private villa with private swimming pool, 800mtr beach opposite side, perfect for large gatherings and events.",
    longDescription: "9BHK private villa with private swimming pool, 9AC rooms with 1AC Hall, 800mtr beach opposite side, Parking, Wifi, Basic kitchen facilities, Fridge, TV, Caretaker service, Security camera. Luxury category villa with outdoor games available. Suitable for family gatherings, bachelor parties, marriage events, corporate events, shootings and birthday events.",
    guests: 35,
    maxGuests: 35,
    bedrooms: 9,
    bathrooms: 9,
    events: true,
    eventPricing: "Event pricing varies depending on the type of event",
    securityDeposit: 15000,
    facilities: [
      { name: "Private Pool", image: "Pool" },
      { name: "Free Parking", image: "Parking" },
      { name: "AC", image: "Ac" },
      { name: "WiFi", image: "Wifi" },
      { name: "Kitchen", image: "Kitchen" },
      { name: "TV", image: "TV" },
      { name: "Fridge", image: "Fridge" },
      { name: "Caretaker", image: "Caretaker" },
      { name: "Security Camera", image: "Security" },
      { name: "Outdoor Games", image: "Games" }
    ]
  },
  {
    name: "Ram Water Villa",
    location: "Perur ECR, Chennai",
    price: 25000, // Assuming this as no price was given in text
    description: "5BHK private villa with private swimming pool and private beach access.",
    longDescription: "5BHK private villa with private swimming pool, 5AC rooms with Hall AC, TV, Party speaker, Fridge, Basic kitchen facilities, Wifi, Caretaker service, private beach access. Luxury category villa perfect for a relaxing getaway.",
    guests: 15,
    maxGuests: 20,
    bedrooms: 5,
    bathrooms: 5,
    facilities: [
      { name: "Private Pool", image: "Pool" },
      { name: "Private Beach Access", image: "Beach" },
      { name: "Free Parking", image: "Parking" },
      { name: "AC", image: "Ac" },
      { name: "WiFi", image: "Wifi" },
      { name: "Kitchen", image: "Kitchen" },
      { name: "TV", image: "TV" },
      { name: "Party Speaker", image: "Speaker" },
      { name: "Fridge", image: "Fridge" },
      { name: "Caretaker", image: "Caretaker" }
    ]
  },
  {
    name: "Lavish Villa I",
    location: "Serenity Beach, Pondicherry",
    price: 18000,
    weekdayPrice: 18000,
    weekendPrice: 25000,
    description: "3BHK private villa with private swimming pool within walkable distance to the beach.",
    longDescription: "3BHK private villa with private swimming pool. Beach walkable distance, basic kitchen facilities, fridge, wifi, and power backup DG. Located near Serenity Beach (800m) and Auroville (3km).",
    guests: 15,
    maxGuests: 15,
    bedrooms: 3,
    bathrooms: 3,
    facilities: [
      { name: "Private Pool", image: "Pool" },
      { name: "Free Parking", image: "Parking" },
      { name: "AC", image: "Ac" },
      { name: "WiFi", image: "Wifi" },
      { name: "Kitchen", image: "Kitchen" },
      { name: "Fridge", image: "Fridge" },
      { name: "Power Backup", image: "PowerBackup" }
    ],
    nearbyAttractions: ["Serenity Beach - 800m", "Auroville - 3km"]
  },
  {
    name: "Lavish Villa II",
    location: "Serenity Beach, Pondicherry",
    price: 18000,
    weekdayPrice: 18000,
    weekendPrice: 25000,
    description: "3BHK private villa with private swimming pool within walkable distance to the beach.",
    longDescription: "3BHK private villa with private swimming pool. Beach walkable distance, basic kitchen facilities, fridge, wifi, and power backup DG. Located near Serenity Beach (800m) and Auroville (3km).",
    guests: 15,
    maxGuests: 15,
    bedrooms: 3,
    bathrooms: 3,
    facilities: [
      { name: "Private Pool", image: "Pool" },
      { name: "Free Parking", image: "Parking" },
      { name: "AC", image: "Ac" },
      { name: "WiFi", image: "Wifi" },
      { name: "Kitchen", image: "Kitchen" },
      { name: "Fridge", image: "Fridge" },
      { name: "Power Backup", image: "PowerBackup" }
    ],
    nearbyAttractions: ["Serenity Beach - 800m", "Auroville - 3km"]
  },
  {
    name: "Lavish Villa III",
    location: "Serenity Beach, Pondicherry",
    price: 16000,
    weekdayPrice: 16000,
    weekendPrice: 23000,
    description: "3BHK private villa with private swimming pool within walkable distance to the beach.",
    longDescription: "3BHK private villa with private swimming pool. Beach walkable distance, basic kitchen facilities, fridge, wifi, and power backup DG. Located near Serenity Beach (800m) and Auroville (3km).",
    guests: 15,
    maxGuests: 15,
    bedrooms: 3,
    bathrooms: 3,
    facilities: [
      { name: "Private Pool", image: "Pool" },
      { name: "Free Parking", image: "Parking" },
      { name: "AC", image: "Ac" },
      { name: "WiFi", image: "Wifi" },
      { name: "Kitchen", image: "Kitchen" },
      { name: "Fridge", image: "Fridge" },
      { name: "Power Backup", image: "PowerBackup" }
    ],
    nearbyAttractions: ["Serenity Beach - 800m", "Auroville - 3km"]
  },
  {
    name: "East Coast Villa",
    location: "Perur ECR, Chennai",
    price: 15000,
    weekdayPrice: 15000,
    weekendPrice: 25000,
    description: "3BHK Private villa with private swimming pool, perfect for small gatherings and events.",
    longDescription: "3BHK Private villa with private swimming pool. 3 rooms AC with Hall AC, basic kitchen facilities, fridge, TV, wifi, power backup DG, caretaker service, JBL party speaker, BBQ setup, and compact party lawn.",
    guests: 15,
    maxGuests: 15,
    bedrooms: 3,
    bathrooms: 3,
    events: true,
    eventPricing: "Event pricing varies depending on the type of event",
    facilities: [
      { name: "Private Pool", image: "Pool" },
      { name: "Free Parking", image: "Parking" },
      { name: "AC", image: "Ac" },
      { name: "WiFi", image: "Wifi" },
      { name: "Kitchen", image: "Kitchen" },
      { name: "TV", image: "TV" },
      { name: "Fridge", image: "Fridge" },
      { name: "Power Backup", image: "PowerBackup" },
      { name: "Caretaker", image: "Caretaker" },
      { name: "Party Speaker", image: "Speaker" },
      { name: "BBQ Setup", image: "BBQ" },
      { name: "Party Lawn", image: "PartyLawn" }
    ]
  },
  {
    name: "Empire Anand Villa Samudra",
    location: "Kovalam ECR, Chennai",
    price: 40000,
    weekdayPrice: 40000,
    weekendPrice: 60000,
    description: "Luxurious 6BHK private villa with private beach access, perfect for a serene coastal getaway.",
    longDescription: "Empire Villa is a luxurious 6BHK private villa located in Kovalam (ECR). It offers private beach access, making it perfect for a serene coastal getaway. The villa features spacious, modern interiors equipped with high-end amenities. A private swimming pool is available. Each bedroom is elegantly designed with en-suite facilities. The villa boasts a fully equipped kitchen, dining area, and expansive living area that provides stunning sea views, ideal for relaxation or events. Perfect for friends and families.",
    guests: 15,
    maxGuests: 20,
    bedrooms: 6,
    bathrooms: 6,
    securityDeposit: 15000,
    facilities: [
      { name: "Private Pool", image: "Pool" },
      { name: "Private Beach Access", image: "Beach" },
      { name: "Free Parking", image: "Parking" },
      { name: "AC", image: "Ac" },
      { name: "WiFi", image: "Wifi" },
      { name: "Kitchen", image: "Kitchen" },
      { name: "Dining Area", image: "Dining" },
      { name: "Sea View", image: "SeaView" }
    ]
  }
];

const updateVillaData = async () => {
  try {
    // Update each villa in the database
    for (const update of villaUpdates) {
      const villa = await Villa.findOne({ name: update.name });
      
      if (villa) {
        console.log(`Updating villa: ${update.name}`);
        
        // Update all fields
        Object.keys(update).forEach(key => {
          villa[key] = update[key];
        });
        
        await villa.save();
        console.log(`Updated villa: ${update.name}`);
      } else {
        console.log(`Villa not found: ${update.name}. Creating new villa.`);
        await Villa.create(update);
        console.log(`Created new villa: ${update.name}`);
      }
    }
    
    console.log("Villa data update complete!");
    process.exit(0);
  } catch (err) {
    console.error("Error updating villa data:", err);
    process.exit(1);
  }
};

// Run the update function
updateVillaData();
