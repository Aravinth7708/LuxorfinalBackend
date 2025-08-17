import BlockedDate from '../models/BlockedDate.js';
import Villa from '../models/Villa.js';
import Booking from '../models/Booking.js';

// Get all blocked dates (Admin only)
export const getAllBlockedDates = async (req, res) => {
  try {
    console.log('[BLOCKED DATES] Fetching all blocked dates');

    const blockedDates = await BlockedDate.find({ isActive: true })
      .populate('villaId', 'name location')
      .populate('createdBy', 'name email')
      .sort({ startDate: 1 });

    console.log(`[BLOCKED DATES] Found ${blockedDates.length} blocked dates`);

    res.status(200).json({
      success: true,
      blockedDates: blockedDates
    });
  } catch (error) {
    console.error('[BLOCKED DATES] Error fetching blocked dates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blocked dates'
    });
  }
};

// Get blocked dates for a specific villa
export const getVillaBlockedDates = async (req, res) => {
  try {
    const { villaId } = req.params;
    console.log(`[BLOCKED DATES] Fetching blocked dates for villa: ${villaId}`);

    // Validate villa exists
    const villa = await Villa.findById(villaId);
    if (!villa) {
      return res.status(404).json({
        success: false,
        message: 'Villa not found'
      });
    }

    const blockedDates = await BlockedDate.find({
      villaId: villaId,
      isActive: true,
      endDate: { $gte: new Date() } // Only future and current blocked dates
    }).sort({ startDate: 1 });

    console.log(`[BLOCKED DATES] Found ${blockedDates.length} blocked dates for villa ${villa.name}`);

    res.status(200).json({
      success: true,
      blockedDates: blockedDates,
      villaName: villa.name
    });
  } catch (error) {
    console.error('[BLOCKED DATES] Error fetching villa blocked dates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch villa blocked dates'
    });
  }
};

// Create new blocked date (Admin only)
export const createBlockedDate = async (req, res) => {
  try {
    const { villaId, villaName, startDate, endDate, reason, description } = req.body;
    const userId = req.user.userId;

    console.log('[BLOCKED DATES] Creating new blocked date:', {
      villaId,
      villaName,
      startDate,
      endDate,
      reason
    });

    // Validation
    if (!villaId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Villa ID, start date, and end date are required'
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    if (start < now) {
      return res.status(400).json({
        success: false,
        message: 'Cannot block dates in the past'
      });
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    // Validate villa exists
    const villa = await Villa.findById(villaId);
    if (!villa) {
      return res.status(404).json({
        success: false,
        message: 'Villa not found'
      });
    }

    // Check for overlapping blocked dates
    const overlappingBlocked = await BlockedDate.findOne({
      villaId: villaId,
      isActive: true,
      $or: [
        {
          startDate: { $lte: end },
          endDate: { $gte: start }
        }
      ]
    });

    if (overlappingBlocked) {
      return res.status(409).json({
        success: false,
        message: 'This date range overlaps with an existing blocked period'
      });
    }

    // Check for existing bookings in this date range
    const existingBookings = await Booking.find({
      villaId: villaId,
      status: { $nin: ['cancelled'] },
      $or: [
        {
          checkIn: { $lte: end },
          checkOut: { $gte: start }
        }
      ]
    });

    if (existingBookings.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot block these dates as there are ${existingBookings.length} existing booking(s) in this period`,
        conflictingBookings: existingBookings.map(booking => ({
          id: booking._id,
          guestName: booking.guestName,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut
        }))
      });
    }

    // Create blocked date
    const blockedDate = new BlockedDate({
      villaId,
      villaName: villaName || villa.name,
      startDate: start,
      endDate: end,
      reason: reason || 'Maintenance',
      description: description || '',
      createdBy: userId
    });

    await blockedDate.save();

    console.log(`[BLOCKED DATES] Successfully created blocked date: ${blockedDate._id}`);

    res.status(201).json({
      success: true,
      message: 'Blocked date created successfully',
      blockedDate: blockedDate
    });
  } catch (error) {
    console.error('[BLOCKED DATES] Error creating blocked date:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create blocked date'
    });
  }
};

// Update blocked date (Admin only)
export const updateBlockedDate = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, reason, description } = req.body;

    console.log(`[BLOCKED DATES] Updating blocked date: ${id}`);

    const blockedDate = await BlockedDate.findById(id);
    if (!blockedDate) {
      return res.status(404).json({
        success: false,
        message: 'Blocked date not found'
      });
    }

    // Validate dates if provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start > end) {
        return res.status(400).json({
          success: false,
          message: 'End date must be after start date'
        });
      }

      // Check for overlapping blocked dates (excluding current one)
      const overlappingBlocked = await BlockedDate.findOne({
        _id: { $ne: id },
        villaId: blockedDate.villaId,
        isActive: true,
        $or: [
          {
            startDate: { $lte: end },
            endDate: { $gte: start }
          }
        ]
      });

      if (overlappingBlocked) {
        return res.status(409).json({
          success: false,
          message: 'This date range overlaps with another existing blocked period'
        });
      }
    }

    // Update fields
    if (startDate) blockedDate.startDate = new Date(startDate);
    if (endDate) blockedDate.endDate = new Date(endDate);
    if (reason) blockedDate.reason = reason;
    if (description !== undefined) blockedDate.description = description;

    await blockedDate.save();

    console.log(`[BLOCKED DATES] Successfully updated blocked date: ${id}`);

    res.status(200).json({
      success: true,
      message: 'Blocked date updated successfully',
      blockedDate: blockedDate
    });
  } catch (error) {
    console.error('[BLOCKED DATES] Error updating blocked date:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update blocked date'
    });
  }
};

// Delete/Remove blocked date (Admin only)
export const deleteBlockedDate = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`[BLOCKED DATES] Deleting blocked date: ${id}`);

    const blockedDate = await BlockedDate.findById(id);
    if (!blockedDate) {
      return res.status(404).json({
        success: false,
        message: 'Blocked date not found'
      });
    }

    // Mark as inactive instead of deleting (soft delete)
    blockedDate.isActive = false;
    await blockedDate.save();

    console.log(`[BLOCKED DATES] Successfully deleted blocked date: ${id}`);

    res.status(200).json({
      success: true,
      message: 'Blocked date removed successfully'
    });
  } catch (error) {
    console.error('[BLOCKED DATES] Error deleting blocked date:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete blocked date'
    });
  }
};

// Check if a villa is available for booking (used by booking system)
export const checkVillaAvailability = async (req, res) => {
  try {
    const { villaId, checkIn, checkOut } = req.query;

    console.log(`[BLOCKED DATES] Checking villa availability:`, {
      villaId,
      checkIn,
      checkOut
    });

    if (!villaId || !checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        message: 'Villa ID, check-in, and check-out dates are required'
      });
    }

    // Check if villa is blocked
    const isBlocked = await BlockedDate.isVillaBlocked(villaId, checkIn, checkOut);

    if (isBlocked) {
      const blockingDates = await BlockedDate.find({
        villaId: villaId,
        isActive: true,
        $or: [
          {
            startDate: { $lte: new Date(checkOut) },
            endDate: { $gte: new Date(checkIn) }
          }
        ]
      });

      return res.status(200).json({
        success: true,
        available: false,
        message: 'Villa is not available for the selected dates',
        blockedPeriods: blockingDates.map(blocked => ({
          startDate: blocked.startDate,
          endDate: blocked.endDate,
          reason: blocked.reason,
          description: blocked.description
        }))
      });
    }

    res.status(200).json({
      success: true,
      available: true,
      message: 'Villa is available for the selected dates'
    });
  } catch (error) {
    console.error('[BLOCKED DATES] Error checking villa availability:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check villa availability'
    });
  }
};

// Get blocked dates summary/statistics (Admin only)
export const getBlockedDatesSummary = async (req, res) => {
  try {
    console.log('[BLOCKED DATES] Fetching summary statistics');

    const now = new Date();

    // Get counts
    const totalBlocked = await BlockedDate.countDocuments({ isActive: true });
    const activeBlocked = await BlockedDate.countDocuments({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    });
    const futureBlocked = await BlockedDate.countDocuments({
      isActive: true,
      startDate: { $gt: now }
    });

    // Get blocked dates by reason
    const reasonStats = await BlockedDate.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$reason', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get blocked dates by villa
    const villaStats = await BlockedDate.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$villaId', villaName: { $first: '$villaName' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.status(200).json({
      success: true,
      summary: {
        totalBlocked,
        activeBlocked,
        futureBlocked,
        reasonStats,
        villaStats
      }
    });
  } catch (error) {
    console.error('[BLOCKED DATES] Error fetching summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blocked dates summary'
    });
  }
};
