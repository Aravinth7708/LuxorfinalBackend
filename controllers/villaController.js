const Villa = require('../models/Villa');

// Add one or many villas
exports.addVillas = async (req, res) => {
  try {
    const villas = Array.isArray(req.body) ? req.body : [req.body];
    const result = await Villa.insertMany(villas);
    res.json({ success: true, villas: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all villas
exports.getAllVillas = async (req, res) => {
  try {
    const villas = await Villa.find();
    
    // For debugging - log the first villa's image format
    if (villas.length > 0 && Array.isArray(villas[0].images) && villas[0].images.length > 0) {
      const firstImage = villas[0].images[0];
      console.log('First villa image type:', typeof firstImage);
      console.log('First image starts with:', typeof firstImage === 'string' ? 
        firstImage.substring(0, Math.min(50, firstImage.length)) + '...' : 'Not a string');
    }
    
    res.json(villas); // Send the complete villa data with images intact
  } catch (err) {
    console.error('Error fetching villas:', err);
    res.status(500).json({ error: err.message });
  }
};

// Filter/search villas
exports.searchVillas = async (req, res) => {
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

