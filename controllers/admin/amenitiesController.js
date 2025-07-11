import VillaAmenity from '../../models/admin/VillaAmenity.js';
import mongoose from 'mongoose';

// Get all villa amenities
export const getAllAmenities = async (req, res) => {
  try {
    console.log("[AMENITIES] Fetching all amenities");
    
    const amenities = await VillaAmenity.find().sort({ name: 1 });
    
    res.json({
      success: true,
      count: amenities.length,
      amenities
    });
  } catch (error) {
    console.error("[AMENITIES] Error fetching amenities:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch amenities",
      message: error.message
    });
  }
};

// Get a single villa amenity by ID
export const getAmenityById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid amenity ID format"
      });
    }
    
    const amenity = await VillaAmenity.findById(id);
    
    if (!amenity) {
      return res.status(404).json({
        success: false,
        error: "Amenity not found"
      });
    }
    
    res.json({
      success: true,
      amenity
    });
  } catch (error) {
    console.error("[AMENITIES] Error fetching amenity:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch amenity",
      message: error.message
    });
  }
};

// Create a new villa amenity
export const createAmenity = async (req, res) => {
  try {
    const { name, location, amenities } = req.body;
    
    // Validate required fields
    if (!name || !location || !amenities || !Array.isArray(amenities) || amenities.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Name, location, and at least one amenity are required"
      });
    }
    
    // Check if amenity with same name and location already exists
    const existingAmenity = await VillaAmenity.findOne({ name, location });
    if (existingAmenity) {
      return res.status(409).json({
        success: false,
        error: "An amenity with this name and location already exists"
      });
    }
    
    // Create new amenity
    const newAmenity = new VillaAmenity({
      name,
      location,
      amenities
    });
    
    await newAmenity.save();
    
    res.status(201).json({
      success: true,
      message: "Villa amenity created successfully",
      amenity: newAmenity
    });
  } catch (error) {
    console.error("[AMENITIES] Error creating amenity:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create amenity",
      message: error.message
    });
  }
};

// Update an existing villa amenity
export const updateAmenity = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location, amenities } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid amenity ID format"
      });
    }
    
    // Validate required fields
    if ((!name && !location && !amenities) || 
        (amenities && (!Array.isArray(amenities) || amenities.length === 0))) {
      return res.status(400).json({
        success: false,
        error: "At least one field (name, location, or amenities) must be provided, and amenities must be a non-empty array"
      });
    }
    
    // Check if updating to a name and location that already exists (excluding the current one)
    if (name && location) {
      const existingAmenity = await VillaAmenity.findOne({
        name,
        location,
        _id: { $ne: id }
      });
      
      if (existingAmenity) {
        return res.status(409).json({
          success: false,
          error: "Another amenity with this name and location already exists"
        });
      }
    }
    
    // Build update object with only provided fields
    const updateFields = {};
    if (name) updateFields.name = name;
    if (location) updateFields.location = location;
    if (amenities) updateFields.amenities = amenities;
    
    // Update the amenity
    const updatedAmenity = await VillaAmenity.findByIdAndUpdate(
      id,
      updateFields,
      { new: true, runValidators: true }
    );
    
    if (!updatedAmenity) {
      return res.status(404).json({
        success: false,
        error: "Amenity not found"
      });
    }
    
    res.json({
      success: true,
      message: "Amenity updated successfully",
      amenity: updatedAmenity
    });
  } catch (error) {
    console.error("[AMENITIES] Error updating amenity:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update amenity",
      message: error.message
    });
  }
};

// Delete a villa amenity
export const deleteAmenity = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid amenity ID format"
      });
    }
    
    const deletedAmenity = await VillaAmenity.findByIdAndDelete(id);
    
    if (!deletedAmenity) {
      return res.status(404).json({
        success: false,
        error: "Amenity not found"
      });
    }
    
    res.json({
      success: true,
      message: "Amenity deleted successfully",
      id
    });
  } catch (error) {
    console.error("[AMENITIES] Error deleting amenity:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete amenity",
      message: error.message
    });
  }
};

// Get amenities by location
export const getAmenitiesByLocation = async (req, res) => {
  try {
    const { location } = req.params;
    
    if (!location) {
      return res.status(400).json({
        success: false,
        error: "Location parameter is required"
      });
    }
    
    const amenities = await VillaAmenity.find({
      location: { $regex: location, $options: 'i' }
    }).sort({ name: 1 });
    
    res.json({
      success: true,
      count: amenities.length,
      amenities
    });
  } catch (error) {
    console.error("[AMENITIES] Error fetching amenities by location:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch amenities",
      message: error.message
    });
  }
};