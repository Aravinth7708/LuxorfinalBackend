import Newsletter from '../../models/Newsletter.js';

// Get all newsletter subscribers
export const getAllSubscribers = async (req, res) => {
  try {
    console.log("[NEWSLETTER] Fetching all subscribers");
    
    const subscribers = await Newsletter.find().sort({ subscribedAt: -1 });
    
    res.json({
      success: true,
      count: subscribers.length,
      subscribers
    });
  } catch (error) {
    console.error("[NEWSLETTER] Error fetching subscribers:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch subscribers",
      message: error.message
    });
  }
};

// Get subscriber by ID
export const getSubscriberById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const subscriber = await Newsletter.findById(id);
    
    if (!subscriber) {
      return res.status(404).json({
        success: false,
        error: "Subscriber not found"
      });
    }
    
    res.json({
      success: true,
      subscriber
    });
  } catch (error) {
    console.error("[NEWSLETTER] Error fetching subscriber:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch subscriber",
      message: error.message
    });
  }
};

// Add a new subscriber
export const addSubscriber = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required"
      });
    }
    
    // Check if email already exists
    const existingSubscriber = await Newsletter.findOne({ email });
    
    if (existingSubscriber) {
      // If already exists but unsubscribed, resubscribe them
      if (!existingSubscriber.subscribed) {
        existingSubscriber.subscribed = true;
        existingSubscriber.subscribedAt = new Date();
        existingSubscriber.unsubscribedAt = undefined;
        await existingSubscriber.save();
        
        return res.json({
          success: true,
          message: "Email resubscribed successfully",
          subscriber: existingSubscriber
        });
      }
      
      return res.status(409).json({
        success: false,
        error: "Email is already subscribed"
      });
    }
    
    // Create new subscriber
    const newSubscriber = new Newsletter({
      email,
      subscribed: true,
      subscribedAt: new Date()
    });
    
    await newSubscriber.save();
    
    res.status(201).json({
      success: true,
      message: "Subscribed successfully",
      subscriber: newSubscriber
    });
  } catch (error) {
    console.error("[NEWSLETTER] Error adding subscriber:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add subscriber",
      message: error.message
    });
  }
};

// Update subscriber status
export const updateSubscriber = async (req, res) => {
  try {
    const { id } = req.params;
    const { subscribed } = req.body;
    
    const subscriber = await Newsletter.findById(id);
    
    if (!subscriber) {
      return res.status(404).json({
        success: false,
        error: "Subscriber not found"
      });
    }
    
    if (subscribed !== undefined) {
      subscriber.subscribed = subscribed;
      
      if (subscribed) {
        subscriber.subscribedAt = new Date();
        subscriber.unsubscribedAt = undefined;
      } else {
        subscriber.unsubscribedAt = new Date();
      }
    }
    
    await subscriber.save();
    
    res.json({
      success: true,
      message: "Subscriber updated successfully",
      subscriber
    });
  } catch (error) {
    console.error("[NEWSLETTER] Error updating subscriber:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update subscriber",
      message: error.message
    });
  }
};

// Delete subscriber
export const deleteSubscriber = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedSubscriber = await Newsletter.findByIdAndDelete(id);
    
    if (!deletedSubscriber) {
      return res.status(404).json({
        success: false,
        error: "Subscriber not found"
      });
    }
    
    res.json({
      success: true,
      message: "Subscriber deleted successfully",
      id
    });
  } catch (error) {
    console.error("[NEWSLETTER] Error deleting subscriber:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete subscriber",
      message: error.message
    });
  }
};

// Export subscribers to CSV
export const exportSubscribers = async (req, res) => {
  try {
    const subscribers = await Newsletter.find({ subscribed: true }).select('email subscribedAt -_id');
    
    // Create CSV content
    let csv = 'Email,Subscribed Date\n';
    subscribers.forEach(subscriber => {
      const subscribedDate = new Date(subscriber.subscribedAt).toISOString().split('T')[0];
      csv += `${subscriber.email},${subscribedDate}\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=newsletter_subscribers.csv');
    res.send(csv);
  } catch (error) {
    console.error("[NEWSLETTER] Error exporting subscribers:", error);
    res.status(500).json({
      success: false,
      error: "Failed to export subscribers",
      message: error.message
    });
  }
};