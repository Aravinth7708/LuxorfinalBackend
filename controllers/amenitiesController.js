import VillaAmenity from '../models/admin/VillaAmenity.js';

// User endpoint - Get amenities for a specific villa
export const getVillaAmenities = async (req, res) => {
  try {
    const { villaName } = req.params;
    
    console.log(`[AMENITIES] Fetching amenities for villa: ${villaName}`);
    
    if (!villaName) {
      return res.status(400).json({
        success: false,
        message: 'Villa name is required'
      });
    }

    // Find amenities by villa name (case-insensitive)
    const villaAmenities = await VillaAmenity.findOne({
      name: { $regex: new RegExp(`^${villaName}$`, 'i') }
    });

    if (!villaAmenities) {
      console.log(`[AMENITIES] No amenities found for villa: ${villaName}`);
      return res.status(404).json({
        success: false,
        message: 'Amenities not found for this villa',
        amenities: [] // Return empty array as fallback
      });
    }

    console.log(`[AMENITIES] Found ${villaAmenities.amenities.length} amenities for ${villaName}`);
    
    res.status(200).json({
      success: true,
      data: {
        villaName: villaAmenities.name,
        location: villaAmenities.location,
        amenities: villaAmenities.amenities
      }
    });
  } catch (error) {
    console.error('[AMENITIES] Error fetching villa amenities:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching amenities',
      error: error.message
    });
  }
};

// User endpoint - Get all villas and their amenities
export const getAllVillasAmenities = async (req, res) => {
  try {
    console.log('[AMENITIES] Fetching all villas amenities');
    
    const allVillasAmenities = await VillaAmenity.find()
      .select('name location amenities')
      .sort({ name: 1 });

    console.log(`[AMENITIES] Found amenities for ${allVillasAmenities.length} villas`);
    
    res.status(200).json({
      success: true,
      count: allVillasAmenities.length,
      data: allVillasAmenities
    });
  } catch (error) {
    console.error('[AMENITIES] Error fetching all villas amenities:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching amenities',
      error: error.message
    });
  }
};
