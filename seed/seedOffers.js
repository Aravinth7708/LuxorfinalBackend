import mongoose from 'mongoose';
import Offer from '../models/Offer.js';
import Villa from '../models/Villa.js';
import dotenv from 'dotenv';

dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected for seeding offers...');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Sample offers data
const offersData = [
  {
    villaName: "Amrith Palace",
    offerAmount: 10000,
    offerDateFrom: new Date('2025-08-20'),
    offerDateTo: new Date('2025-09-15'),
    isActive: true,
    title: "Early Bird Discount",
    description: "Early bird discount for luxury stay at Amrith Palace",
    createdBy: "Admin"
  },
  {
    villaName: "Ram Water Villa",
    offerAmount: 8000,
    offerDateFrom: new Date('2025-08-25'),
    offerDateTo: new Date('2025-09-30'),
    isActive: true,
    title: "Monsoon Special",
    description: "Monsoon special offer for Ram Water Villa",
    createdBy: "Admin"
  },
  {
    villaName: "East Coast Villa",
    offerAmount: 5000,
    offerDateFrom: new Date('2025-08-18'),
    offerDateTo: new Date('2025-08-31'),
    isActive: true,
    title: "Weekend Getaway",
    description: "Weekend getaway special at East Coast Villa",
    createdBy: "Admin"
  },
  {
    villaName: "Lavish Villa I",
    offerAmount: 6000,
    offerDateFrom: new Date('2025-09-01'),
    offerDateTo: new Date('2025-09-30'),
    isActive: true,
    title: "September Special",
    description: "September special at Lavish Villa I",
    createdBy: "Admin"
  },
  {
    villaName: "Lavish Villa II",
    offerAmount: 7000,
    offerDateFrom: new Date('2025-08-22'),
    offerDateTo: new Date('2025-09-10'),
    isActive: true,
    title: "Limited Time Offer",
    description: "Limited time offer at Lavish Villa II",
    createdBy: "Admin"
  },
  {
    villaName: "Lavish Villa III",
    offerAmount: 5500,
    offerDateFrom: new Date('2025-08-16'),
    offerDateTo: new Date('2025-09-05'),
    isActive: true,
    title: "Summer End Special",
    description: "Summer end special at Lavish Villa III",
    createdBy: "Admin"
  },
  {
    villaName: "Empire Anand Villa Samudra",
    offerAmount: 12000,
    offerDateFrom: new Date('2025-08-30'),
    offerDateTo: new Date('2025-10-15'),
    isActive: true,
    title: "Premium Villa Exclusive",
    description: "Premium villa exclusive offer",
    createdBy: "Admin"
  }
];

// Function to get villa ID by name
const getVillaIdByName = async (villaName) => {
  try {
    const villa = await Villa.findOne({ 
      $or: [
        { name: { $regex: villaName, $options: 'i' } },
        { title: { $regex: villaName, $options: 'i' } }
      ]
    });
    
    if (villa) {
      console.log(`Found villa: ${villa.name || villa.title} with ID: ${villa._id}`);
      return villa._id;
    } else {
      console.warn(`Villa not found: ${villaName}`);
      return null;
    }
  } catch (error) {
    console.error(`Error finding villa ${villaName}:`, error);
    return null;
  }
};

// Seed offers
const seedOffers = async () => {
  try {
    console.log('Starting to seed offers...');
    
    // Clear existing offers
    await Offer.deleteMany({});
    console.log('Cleared existing offers');
    
    // Create offers directly with villa names
    const createdOffers = await Offer.insertMany(offersData);
    console.log(`Successfully created ${createdOffers.length} offers:`);
    
    createdOffers.forEach((offer, index) => {
      console.log(`${index + 1}. Offer for ${offer.villaName}: ${offer.description} - ₹${offer.offerAmount} off`);
    });
    
  } catch (error) {
    console.error('Error seeding offers:', error);
  }
};

// Main execution
const main = async () => {
  await connectDB();
  await seedOffers();
  
  console.log('Offers seeding completed!');
  process.exit(0);
};

// Run the seeder
main();
