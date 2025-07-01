import PhotoGallery from '../models/PhotoGallery.js';

// Add or update gallery for a villa
exports.saveGallery = async (req, res) => {
  try {
    const { villaId, images } = req.body;
    if (!villaId || !images || !Array.isArray(images)) {
      return res.status(400).json({ error: 'villaId and images[] required' });
    }
    let gallery = await PhotoGallery.findOneAndUpdate(
      { villaId },
      { images },
      { upsert: true, new: true }
    );
    res.json({ success: true, gallery });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get gallery by villaId
exports.getGallery = async (req, res) => {
  try {
    const { villaId } = req.params;
    const gallery = await PhotoGallery.findOne({ villaId });
    if (!gallery) return res.status(404).json({ error: 'Gallery not found' });
    res.json(gallery);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
