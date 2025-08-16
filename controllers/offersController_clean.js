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
};
