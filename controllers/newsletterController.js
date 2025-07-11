import Booking from '../models/Booking.js';
import Villa from '../models/Villa.js';
import nodemailer from 'nodemailer';
import Newsletter from '../models/Newsletter.js';
import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get all subscribers (admin only)
export const getAllSubscribers = async (req, res) => {
  try {
    const subscribers = await Newsletter.find().sort({ subscribedAt: -1 });
    res.status(200).json({
      success: true,
      subscribers
    });
  } catch (error) {
    console.error('Error fetching subscribers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscribers'
    });
  }
};

// Add a new subscriber (can be used by both public and admin)
export const addSubscriber = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Check if email already exists
    const existingSubscriber = await Newsletter.findOne({ email });
    if (existingSubscriber) {
      // If subscriber exists but is unsubscribed, reactivate them
      if (!existingSubscriber.subscribed) {
        existingSubscriber.subscribed = true;
        await existingSubscriber.save();
        return res.status(200).json({
          success: true,
          message: 'Subscription reactivated successfully'
        });
      }
      
      return res.status(400).json({
        success: false,
        error: 'Email is already subscribed'
      });
    }

    const newSubscriber = new Newsletter({ email });
    await newSubscriber.save();

    res.status(201).json({
      success: true,
      message: 'Subscription successful',
      subscriber: newSubscriber
    });
  } catch (error) {
    console.error('Error adding subscriber:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add subscriber'
    });
  }
};

// Update subscriber status (admin only)
export const updateSubscriber = async (req, res) => {
  try {
    const { id } = req.params;
    const { subscribed } = req.body;

    if (subscribed === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Subscribed status is required'
      });
    }

    const subscriber = await Newsletter.findById(id);
    if (!subscriber) {
      return res.status(404).json({
        success: false,
        error: 'Subscriber not found'
      });
    }

    subscriber.subscribed = subscribed;
    await subscriber.save();

    res.status(200).json({
      success: true,
      message: `Subscriber ${subscribed ? 'activated' : 'deactivated'} successfully`,
      subscriber
    });
  } catch (error) {
    console.error('Error updating subscriber:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update subscriber'
    });
  }
};

// Delete subscriber (admin only)
export const deleteSubscriber = async (req, res) => {
  try {
    const { id } = req.params;
    
    const subscriber = await Newsletter.findById(id);
    if (!subscriber) {
      return res.status(404).json({
        success: false,
        error: 'Subscriber not found'
      });
    }

    await Newsletter.findByIdAndDelete(id);
    
    res.status(200).json({
      success: true,
      message: 'Subscriber deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting subscriber:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete subscriber'
    });
  }
};

// Export subscribers as CSV (admin only)
export const exportSubscribersCSV = async (req, res) => {
  try {
    // Get all active subscribers
    const subscribers = await Newsletter.find({ subscribed: true }).sort({ subscribedAt: -1 });

    // Create temp directory if it doesn't exist
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const csvFilePath = path.join(tempDir, `newsletter_subscribers_${Date.now()}.csv`);
    
    const csvWriter = createObjectCsvWriter({
      path: csvFilePath,
      header: [
        { id: 'email', title: 'EMAIL' },
        { id: 'subscribedAt', title: 'SUBSCRIBED DATE' }
      ]
    });

    const records = subscribers.map(subscriber => ({
      email: subscriber.email,
      subscribedAt: new Date(subscriber.subscribedAt).toLocaleDateString()
    }));

    await csvWriter.writeRecords(records);

    // Send file to client
    res.download(csvFilePath, 'newsletter_subscribers.csv', (err) => {
      if (err) {
        console.error('Error sending CSV file:', err);
      }
      
      // Delete the temporary file after sending
      fs.unlinkSync(csvFilePath);
    });
  } catch (error) {
    console.error('Error exporting subscribers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export subscribers'
    });
  }
};

// Public subscription endpoint
export const subscribe = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Check if email already exists
    const existingSubscriber = await Newsletter.findOne({ email });
    if (existingSubscriber) {
      // If already subscribed, return success but inform that they were already subscribed
      if (existingSubscriber.subscribed) {
        return res.status(200).json({
          success: true,
          message: 'You are already subscribed to our newsletter',
          alreadySubscribed: true
        });
      } else {
        // If unsubscribed before, reactivate
        existingSubscriber.subscribed = true;
        await existingSubscriber.save();
        return res.status(200).json({
          success: true,
          message: 'You have been resubscribed to our newsletter'
        });
      }
    }

    // Create new subscriber
    const newSubscriber = new Newsletter({ email });
    await newSubscriber.save();

    res.status(201).json({
      success: true,
      message: 'Thank you for subscribing to our newsletter!'
    });
  } catch (error) {
    console.error('Error processing subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process subscription'
    });
  }
};

// Public unsubscribe endpoint
export const unsubscribe = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const subscriber = await Newsletter.findOne({ email });
    if (!subscriber) {
      return res.status(404).json({
        success: false,
        error: 'Email not found in our subscribers list'
      });
    }

    subscriber.subscribed = false;
    await subscriber.save();

    res.status(200).json({
      success: true,
      message: 'You have been unsubscribed from our newsletter'
    });
  } catch (error) {
    console.error('Error processing unsubscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process unsubscription'
    });
  }
};

// Admin: send a newsletter email to subscribers (basic example)
export const sendNewsletter = async (req, res) => {
  try {
    const { subject, html } = req.body;
    if (!subject || !html) return res.status(400).json({ error: 'Subject and html required' });
    const subscribers = await Newsletter.find({ expiresAt: { $gt: new Date() } });
    const emails = subscribers.map(s => s.email);
    if (!emails.length) return res.status(400).json({ error: 'No active subscribers' });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.gmail, pass: process.env.pass }
    });

    await transporter.sendMail({
      from: process.env.gmail,
      to: emails,
      subject,
      html
    });

    return res.json({ success: true, message: 'Newsletter sent', recipients: emails.length });
  } catch (err) {
    console.error('Error in sendNewsletter:', err);
    return res.status(500).json({ error: err.message });
  }
};
