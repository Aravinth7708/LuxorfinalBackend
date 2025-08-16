import Offer from '../../models/Offer.js';
import Villa from '../../models/Villa.js';

// Get all offers
export const getAllOffers = async (req, res) => {
  try {
    const offers = await Offer.find()
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      offers,
      count: offers.length
    });
  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch offers'
    });
  }
};

// Create new offer
export const createOffer = async (req, res) => {
  try {
    const {
      villaName,
      offerAmount,
      offerDateFrom,
      offerDateTo,
      title,
      description,
      isActive = true
    } = req.body;

    // Validate required fields
    if (!villaName || !offerAmount || !offerDateFrom || !offerDateTo) {
      return res.status(400).json({
        success: false,
        message: 'Villa name, offer amount, and date range are required'
      });
    }

    // Validate date range
    if (new Date(offerDateFrom) >= new Date(offerDateTo)) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be before end date'
      });
    }

    // Check for overlapping offers for the same villa
    const overlappingOffer = await Offer.findOne({
      villaName: villaName,
      isActive: true,
      $or: [
        {
          offerDateFrom: { $lte: new Date(offerDateTo) },
          offerDateTo: { $gte: new Date(offerDateFrom) }
        }
      ]
    });

    if (overlappingOffer) {
      return res.status(400).json({
        success: false,
        message: 'An active offer already exists for this villa in the selected date range'
      });
    }

    // Create new offer
    const newOffer = new Offer({
      villaName,
      offerAmount: Number(offerAmount),
      offerDateFrom: new Date(offerDateFrom),
      offerDateTo: new Date(offerDateTo),
      title: title || 'Special Offer',
      description: description || 'Limited time offer',
      isActive,
      createdBy: req.user?.email || 'Admin'
    });

    const savedOffer = await newOffer.save();

    res.status(201).json({
      success: true,
      message: 'Offer created successfully',
      offer: savedOffer
    });
  } catch (error) {
    console.error('Error creating offer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create offer'
    });
  }
};

// Update offer
export const updateOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Validate date range if dates are being updated
    if (updateData.offerDateFrom && updateData.offerDateTo) {
      if (new Date(updateData.offerDateFrom) >= new Date(updateData.offerDateTo)) {
        return res.status(400).json({
          success: false,
          message: 'Start date must be before end date'
        });
      }
    }

    // Check for overlapping offers if dates or villa are being updated
    if (updateData.villaName || updateData.offerDateFrom || updateData.offerDateTo) {
      const currentOffer = await Offer.findById(id);
      if (!currentOffer) {
        return res.status(404).json({
          success: false,
          message: 'Offer not found'
        });
      }

      const villaName = updateData.villaName || currentOffer.villaName;
      const offerDateFrom = updateData.offerDateFrom || currentOffer.offerDateFrom;
      const offerDateTo = updateData.offerDateTo || currentOffer.offerDateTo;

      const overlappingOffer = await Offer.findOne({
        _id: { $ne: id },
        villaName: villaName,
        isActive: true,
        $or: [
          {
            offerDateFrom: { $lte: new Date(offerDateTo) },
            offerDateTo: { $gte: new Date(offerDateFrom) }
          }
        ]
      });

      if (overlappingOffer) {
        return res.status(400).json({
          success: false,
          message: 'An active offer already exists for this villa in the selected date range'
        });
      }
    }

    const updatedOffer = await Offer.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedOffer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Offer updated successfully',
      offer: updatedOffer
    });
  } catch (error) {
    console.error('Error updating offer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update offer'
    });
  }
};

// Delete offer
export const deleteOffer = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedOffer = await Offer.findByIdAndDelete(id);

    if (!deletedOffer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Offer deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting offer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete offer'
    });
  }
};

// Get offer by ID
export const getOfferById = async (req, res) => {
  try {
    const { id } = req.params;

    const offer = await Offer.findById(id);

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found'
      });
    }

    res.status(200).json({
      success: true,
      offer
    });
  } catch (error) {
    console.error('Error fetching offer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch offer'
    });
  }
};

// Toggle offer status
export const toggleOfferStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const updatedOffer = await Offer.findByIdAndUpdate(
      id,
      { isActive },
      { new: true, runValidators: true }
    );

    if (!updatedOffer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found'
      });
    }

    res.status(200).json({
      success: true,
      message: `Offer ${isActive ? 'activated' : 'deactivated'} successfully`,
      offer: updatedOffer
    });
  } catch (error) {
    console.error('Error updating offer status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update offer status'
    });
  }
};
