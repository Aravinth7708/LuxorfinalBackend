import Villa from '../models/Villa.js';
import mongoose from 'mongoose';

// Create a new villa
export const createVilla = async (req, res) => {
  try {
    console.log("[VILLA MGMT] Creating new villa");
    
    const {
      name,
      location,
      price,
      weekdayPrice,
      weekendPrice,
      description,
      longDescription,
      guests,
      maxGuests,
      bedrooms,
      bathrooms,
      facilities,
      images,
      events,
      eventPricing,
      securityDeposit,
      nearbyAttractions
    } = req.body;
    
    // Validate required fields
    if (!name || !location || !price) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, location, and price are required' 
      });
    }
    
    // Process base64 images if provided
    let processedImages = [];
    if (Array.isArray(images) && images.length > 0) {
      // Filter out non-base64 strings and limit to 10 images
      processedImages = images
        .filter(img => typeof img === 'string' && img.startsWith('data:image'))
        .slice(0, 10); // Limit to 10 images
    }
    
    // Create new villa
    const villa = new Villa({
      name,
      location,
      price,
      weekdayPrice: weekdayPrice || price,
      weekendPrice: weekendPrice || Math.round(price * 1.5),
      description,
      longDescription,
      guests: guests || maxGuests,
      maxGuests: maxGuests || guests,
      bedrooms: bedrooms || 1,
      bathrooms: bathrooms || 1,
      facilities: facilities || [],
      images: processedImages,
      events: events || false,
      eventPricing,
      securityDeposit: securityDeposit || 0,
      nearbyAttractions: nearbyAttractions || []
    });
    
    await villa.save();
    
    console.log(`[VILLA MGMT] Successfully created villa: ${villa.name}`);
    
    res.status(201).json({
      success: true,
      villa: {
        _id: villa._id,
        name: villa.name,
        location: villa.location,
        price: villa.price,
        images: villa.images.length > 0 ? [villa.images[0]] : []
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

// Update villa
export const updateVilla = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid villa ID'
      });
    }
    
    const updateData = { ...req.body };
    
    // Process base64 images if provided
    if (Array.isArray(updateData.images) && updateData.images.length > 0) {
      // Filter out non-base64 strings and limit to 10 images
      updateData.images = updateData.images
        .filter(img => typeof img === 'string')
        .slice(0, 10); // Limit to 10 images
    }
    
    const villa = await Villa.findByIdAndUpdate(
      id,
      updateData,
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
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid villa ID'
      });
    }
    
    const villa = await Villa.findByIdAndDelete(id);
    
    if (!villa) {
      return res.status(404).json({
        success: false,
        message: 'Villa not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Villa deleted successfully'
    });
  } catch (err) {
    console.error('[VILLA MGMT] Error deleting villa:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};