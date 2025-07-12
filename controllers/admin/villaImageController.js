import VillaImage from '../../models/VillaImage.js';
import Villa from '../../models/Villa.js';
import mongoose from 'mongoose';

// Get image by villa name
export const getImageByVillaName = async (req, res) => {
  try {
    const { villaName } = req.params;
    
    if (!villaName) {
      return res.status(400).json({
        success: false,
        error: "Villa name is required"
      });
    }
    
    const villaImage = await VillaImage.findOne({ villaName });
    
    if (!villaImage) {
      return res.status(404).json({
        success: false,
        error: "No image found for this villa"
      });
    }
    
    res.json({
      success: true,
      image: villaImage.imageBase64
    });
  } catch (error) {
    console.error("[VILLA IMAGES] Error fetching image:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch villa image",
      message: error.message
    });
  }
};

// Store or update villa image
export const storeVillaImage = async (req, res) => {
  try {
    const { villaName, imageBase64 } = req.body;
    
    if (!villaName || !imageBase64) {
      return res.status(400).json({
        success: false,
        error: "Villa name and image are required"
      });
    }
    
    // Check if the image is a valid base64 string
    if (!imageBase64.startsWith('data:image')) {
      return res.status(400).json({
        success: false,
        error: "Invalid image format. Must be a base64 encoded image."
      });
    }
    
    // Check if an image for this villa already exists
    let villaImage = await VillaImage.findOne({ villaName });
    
    if (villaImage) {
      // Update existing image
      villaImage.imageBase64 = imageBase64;
      await villaImage.save();
      
      console.log(`[VILLA IMAGES] Updated image for villa: ${villaName}`);
      
      return res.json({
        success: true,
        message: "Villa image updated successfully",
        villaName
      });
    } else {
      // Create new image
      villaImage = new VillaImage({
        villaName,
        imageBase64
      });
      
      await villaImage.save();
      
      console.log(`[VILLA IMAGES] Created new image for villa: ${villaName}`);
      
      return res.status(201).json({
        success: true,
        message: "Villa image stored successfully",
        villaName
      });
    }
  } catch (error) {
    console.error("[VILLA IMAGES] Error storing image:", error);
    res.status(500).json({
      success: false,
      error: "Failed to store villa image",
      message: error.message
    });
  }
};

// Get all villa images
export const getAllVillaImages = async (req, res) => {
  try {
    const villaImages = await VillaImage.find().select('villaName');
    
    res.json({
      success: true,
      count: villaImages.length,
      villaImages
    });
  } catch (error) {
    console.error("[VILLA IMAGES] Error fetching images:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch villa images",
      message: error.message
    });
  }
};

// Delete villa image
export const deleteVillaImage = async (req, res) => {
  try {
    const { villaName } = req.params;
    
    if (!villaName) {
      return res.status(400).json({
        success: false,
        error: "Villa name is required"
      });
    }
    
    const deletedImage = await VillaImage.findOneAndDelete({ villaName });
    
    if (!deletedImage) {
      return res.status(404).json({
        success: false,
        error: "No image found for this villa"
      });
    }
    
    console.log(`[VILLA IMAGES] Deleted image for villa: ${villaName}`);
    
    res.json({
      success: true,
      message: "Villa image deleted successfully",
      villaName
    });
  } catch (error) {
    console.error("[VILLA IMAGES] Error deleting image:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete villa image",
      message: error.message
    });
  }
};