import Villa from '../models/Villa.js';

// Add one or many villas
export const addVillas = async (req, res) => {
  try {
    const villas = Array.isArray(req.body) ? req.body : [req.body];
    const result = await Villa.insertMany(villas);
    res.json({ success: true, villas: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update villa details
export const updateVilla = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedData = req.body;
    
    console.log("[VILLA] Updating villa:", id);
    console.log("[VILLA] Update data:", updatedData);
    
    const villa = await Villa.findByIdAndUpdate(id, updatedData, { new: true });
    
    if (!villa) {
      return res.status(404).json({ error: 'Villa not found' });
    }
    
    res.json(villa);
  } catch (err) {
    console.error("[VILLA] Update error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Get all villas with expanded details
export const getAllVillas = async (req, res) => {
  try {
    const villas = await Villa.find();
    
    // Add display prices for weekday/weekend if they exist
    const enhancedVillas = villas.map(villa => {
      const villaObj = villa.toObject();
      
      // Set default prices if not present
      if (!villaObj.weekdayPrice) villaObj.weekdayPrice = villaObj.price;
      if (!villaObj.weekendPrice) villaObj.weekendPrice = Math.round(villaObj.price * 1.5);
      
      return villaObj;
    });
    
    res.json(enhancedVillas);
  } catch (err) {
    console.error("[VILLA] Error getting villas:", err);
    res.status(500).json({ error: err.message });
  }
};

// Filter/search villas
export const searchVillas = async (req, res) => {
  try {
    const { name, location, minPrice, maxPrice } = req.query;
    let filter = {};
    if (name) filter.name = { $regex: name, $options: 'i' };
    if (location) {
      // Partial match (case-insensitive) for location
      filter.location = { $regex: location, $options: 'i' };
    }
    if (minPrice || maxPrice) filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
    const villas = await Villa.find(filter);
    res.json(villas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get villa by ID
export const getVillaById = async (req, res) => {
  try {
    const villaId = req.params.id;
    console.log(`[VILLA] Fetching villa with ID: ${villaId}`);
    
    const villa = await Villa.findById(villaId);
    
    if (!villa) {
      console.log(`[VILLA] Villa not found with ID: ${villaId}`);
      return res.status(404).json({ error: 'Villa not found' });
    }
    
    console.log(`[VILLA] Found villa: ${villa.name}`);
    res.json(villa);
  } catch (err) {
    console.error('Error fetching villa by ID:', err);
    res.status(500).json({ error: err.message });
  }
};

// Create new villa
export const createVilla = async (req, res) => {
  try {
    const newVilla = new Villa(req.body);
    const savedVilla = await newVilla.save();
    res.status(201).json(savedVilla);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete villa
export const deleteVilla = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedVilla = await Villa.findByIdAndDelete(id);
    
    if (!deletedVilla) {
      return res.status(404).json({ error: 'Villa not found' });
    }
    
    res.json({ message: 'Villa deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

