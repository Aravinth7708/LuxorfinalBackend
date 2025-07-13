import Villa from '../../models/Villa.js';
import VillaImage from '../../models/VillaImage.js';
import mongoose from 'mongoose';

// Create a new villa - updated to match your model
export const createVilla = async (req, res) => {
  try {
    console.log("[VILLA MGMT] Creating new villa with data:", req.body);
    
    const {
      name,
      location,
      price,
      description,
      maxGuests,
      bedrooms,
      bathrooms
    } = req.body;
    
    // Validate required fields
    if (!name || !location || !price) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, location, and price are required' 
      });
    }
    
    // Create new villa - match your model structure
    const villa = new Villa({
      name,
      location,
      price: Number(price),
      description: description || '',
      guests: Number(maxGuests) || 2, // For backward compatibility
      maxGuests: Number(maxGuests) || 2, 
      bedrooms: Number(bedrooms) || 1,
      bathrooms: Number(bathrooms) || 1,
      rating: 4.5 // Default value
    });
    
    await villa.save();
    console.log(`[VILLA MGMT] Successfully created villa: ${villa.name}`);
    
    // Handle the main image upload separately
    
    res.status(201).json({
      success: true,
      villa: {
        _id: villa._id,
        name: villa.name,
        location: villa.location,
        price: villa.price,
        description: villa.description,
        maxGuests: villa.maxGuests,
        bedrooms: villa.bedrooms,
        bathrooms: villa.bathrooms
      }
    });
  } catch (err) {
    console.error('[VILLA MGMT] Error creating villa:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get all villas (admin view)
export const getAllVillas = async (req, res) => {
  try {
    const villas = await Villa.find().select('name location price images bedrooms bathrooms guests maxGuests');
    
    res.json({
      success: true,
      count: villas.length,
      villas
    });
  } catch (err) {
    console.error('[VILLA MGMT] Error getting villas:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get villa by ID
export const getVillaById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid villa ID'
      });
    }
    
    const villa = await Villa.findById(id);
    
    if (!villa) {
      return res.status(404).json({
        success: false,
        message: 'Villa not found'
      });
    }
    
    res.json({
      success: true,
      villa
    });
  } catch (err) {
    console.error('[VILLA MGMT] Error getting villa:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update villa - updated to match your model
export const updateVilla = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid villa ID'
      });
    }
    
    const updateData = req.body;
    
    // Remove any fields that aren't in your model
    const validFields = [
      'name', 'location', 'price', 'description', 
      'maxGuests', 'bedrooms', 'bathrooms'
    ];
    
    const cleanedData = {};
    Object.keys(updateData).forEach(key => {
      if (validFields.includes(key)) {
        cleanedData[key] = updateData[key];
      }
    });
    
    // Also update the 'guests' field if 'maxGuests' is provided (for backward compatibility)
    if (cleanedData.maxGuests) {
      cleanedData.guests = cleanedData.maxGuests;
    }
    
    // Update villa document
    const villa = await Villa.findByIdAndUpdate(
      id,
      cleanedData,
      { new: true, runValidators: true }
    );
    
    if (!villa) {
      return res.status(404).json({
        success: false,
        message: 'Villa not found'
      });
    }
    
    res.json({
      success: true,
      villa
    });
  } catch (err) {
    console.error('[VILLA MGMT] Error updating villa:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete villa
export const deleteVilla = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if ID is a valid MongoDB ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid villa ID format'
      });
    }
    
    console.log(`[VILLA MGMT] Attempting to delete villa with ID: ${id}`);
    
    // Find the villa first to get its name
    const villa = await Villa.findById(id);
    
    if (!villa) {
      return res.status(404).json({
        success: false,
        message: 'Villa not found'
      });
    }
    
    // Store villa name for VillaImage deletion
    const villaName = villa.name;
    
    // Delete the villa
    await Villa.findByIdAndDelete(id);
    console.log(`[VILLA MGMT] Successfully deleted villa: ${villaName}`);
    
    // Also delete associated image if it exists
    try {
      await VillaImage.findOneAndDelete({ villaName });
      console.log(`[VILLA MGMT] Also deleted associated image for villa: ${villaName}`);
    } catch (imageError) {
      console.error(`[VILLA MGMT] Error deleting villa image: ${imageError}`);
      // Continue with success response even if image deletion fails
    }
    
    res.status(200).json({
      success: true,
      message: 'Villa deleted successfully'
    });
  } catch (err) {
    console.error(`[VILLA MGMT] Error deleting villa: ${err.message}`);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};