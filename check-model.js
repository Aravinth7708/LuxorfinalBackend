
import mongoose from "mongoose";
import VillaImage from "./models/VillaImage.js";
import dotenv from "dotenv";

dotenv.config();

async function checkModel() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");
    
    console.log("VillaImage schema paths:", Object.keys(VillaImage.schema.paths));
    
    const sample = await VillaImage.findOne();
    console.log("Sample document:", sample ? 
      { villaName: sample.villaName, villaId: sample.villaId, hasImage: !!sample.imageBase64 } : 
      "No documents found");
    
    mongoose.connection.close();
  } catch (error) {
    console.error("Error checking model:", error);
  }
}

checkModel();

