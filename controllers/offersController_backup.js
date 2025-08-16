import Offer from '../models/Offer.js';

// Get active offers for a specific villa
export const getVillaOffers = async (req, res) => {
  try {
    const { villaName } = req.params;
    const currentDate = new Date();

    const offers = await Offer.find({
      villaName: { $regex: villaName, $options: 'i' },
      isActive: true,
      offerDateFrom: { $lte: currentDate },
      offerDateTo: { $gte: currentDate }
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      offers,
      count: offers.length
    });
  } catch (error) {
    console.error('Error fetching villa offers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch villa offers'
    });
  }
};

// Get offer for a specific villa and date
export const getVillaOfferForDate = async (req, res) => {
  try {
    const { villaName } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date parameter is required'
      });
    }

    const checkDate = new Date(date);
    
    const offer = await Offer.findOne({
      villaName: { $regex: villaName, $options: 'i' },
      isActive: true,
      offerDateFrom: { $lte: checkDate },
      offerDateTo: { $gte: checkDate }
    });

    if (offer) {
      res.status(200).json({
        success: true,
        hasOffer: true,
        offer
      });
    } else {
      res.status(200).json({
        success: true,
        hasOffer: false,
        offer: null
      });
    }
  } catch (error) {
    console.error('Error fetching villa offer for date:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch villa offer'
    });
  }
};

// Get all active offers
export const getAllActiveOffers = async (req, res) => {
  try {
    const currentDate = new Date();

    const offers = await Offer.find({
      isActive: true,
      offerDateFrom: { $lte: currentDate },
      offerDateTo: { $gte: currentDate }
    }).sort({ villaName: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      offers,
      count: offers.length
    });
  } catch (error) {
    console.error('Error fetching active offers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active offers'
    });
  }
};

// Calculate pricing with offers
export const calculatePricingWithOffers = async (originalPrice, villaName, date) => {
  try {
    const checkDate = new Date(date);
    
    const offer = await Offer.findOne({
      villaName: { $regex: villaName, $options: 'i' },
      isActive: true,
      offerDateFrom: { $lte: checkDate },
      offerDateTo: { $gte: checkDate }
    });

    if (offer && offer.offerAmount) {
      const finalPrice = Math.max(0, originalPrice - offer.offerAmount);
      return {
        hasOffer: true,
        originalPrice: originalPrice,
        finalPrice: finalPrice,
        discountAmount: offer.offerAmount,
        savings: originalPrice - finalPrice,
        offerDetails: {
          title: offer.title,
          description: offer.description
        }
      };
    }

    return {
      hasOffer: false,
      originalPrice: originalPrice,
      finalPrice: originalPrice,
      discountAmount: 0,
      savings: 0
    };
  } catch (error) {
    console.error('Error calculating pricing with offers:', error);
    return {
      hasOffer: false,
      originalPrice: originalPrice,
      finalPrice: originalPrice,
      discountAmount: 0,
      savings: 0
    };
  }
};;

// User endpoint - Get active offers for a villa within a date range
export const getVillaOffersForDateRange = async (req, res) => {
  try {
    const { villaName } = req.params;
    const { startDate, endDate } = req.query;
    
    console.log(`[OFFERS] Checking offers for villa: ${villaName}, range: ${startDate} to ${endDate}`);
    
    if (!villaName || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Villa name, start date, and end date are required'
      });
    }

    const offers = await Offer.findActiveOffersForVillaAndDateRange(villaName, startDate, endDate);
    
    console.log(`[OFFERS] Found ${offers.length} offers for ${villaName} in date range`);
    
    res.status(200).json({
      success: true,
      count: offers.length,
      offers: offers.map(offer => ({
        id: offer._id,
        villaName: offer.villaName,
        offerAmount: offer.offerAmount,
        offerDateFrom: offer.offerDateFrom,
        offerDateTo: offer.offerDateTo,
        title: offer.title,
        description: offer.description
      }))
    });
  } catch (error) {
    console.error('[OFFERS] Error fetching villa offers for date range:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching offers',
      error: error.message
    });
  }
};

// User endpoint - Get all active offers
export const getAllActiveOffers = async (req, res) => {
  try {
    console.log('[OFFERS] Fetching all active offers');
    
    const currentDate = new Date();
    const offers = await Offer.find({
      isActive: true,
      offerDateTo: { $gte: currentDate }, // Only future or current offers
      offerAmount: { $gt: 0 }
    }).sort({ villaName: 1, offerDateFrom: 1 });

    console.log(`[OFFERS] Found ${offers.length} active offers`);
    
    res.status(200).json({
      success: true,
      count: offers.length,
      offers: offers.map(offer => ({
        id: offer._id,
        villaName: offer.villaName,
        offerAmount: offer.offerAmount,
        offerDateFrom: offer.offerDateFrom,
        offerDateTo: offer.offerDateTo,
        title: offer.title,
        description: offer.description
      }))
    });
  } catch (error) {
    console.error('[OFFERS] Error fetching all active offers:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching offers',
      error: error.message
    });
  }
};

// Utility function to calculate offer price for a booking
export const calculateOfferPricing = async (villaName, checkInDate, checkOutDate, originalPrice) => {
  try {
    console.log(`[OFFERS] Calculating offer pricing for ${villaName} from ${checkInDate} to ${checkOutDate}`);
    
    const offers = await Offer.findActiveOffersForVillaAndDateRange(villaName, checkInDate, checkOutDate);
    
    if (offers.length === 0) {
      return {
        hasOffer: false,
        originalPrice: originalPrice,
        finalPrice: originalPrice,
        savings: 0,
        offerDetails: null
      };
    }

    // For simplicity, use the best (lowest) offer if multiple offers overlap
    const bestOffer = offers.reduce((best, current) => 
      current.offerAmount < best.offerAmount ? current : best
    );

    const savings = Math.max(0, originalPrice - bestOffer.offerAmount);
    
    console.log(`[OFFERS] Applied offer: ₹${originalPrice} -> ₹${bestOffer.offerAmount} (Save ₹${savings})`);
    
    return {
      hasOffer: true,
      originalPrice: originalPrice,
      finalPrice: bestOffer.offerAmount,
      savings: savings,
      offerDetails: {
        id: bestOffer._id,
        title: bestOffer.title,
        description: bestOffer.description,
        offerDateFrom: bestOffer.offerDateFrom,
        offerDateTo: bestOffer.offerDateTo
      }
    };
  } catch (error) {
    console.error('[OFFERS] Error calculating offer pricing:', error);
    return {
      hasOffer: false,
      originalPrice: originalPrice,
      finalPrice: originalPrice,
      savings: 0,
      offerDetails: null,
      error: error.message
    };
  }
};
