import Booking from '../models/Booking.js';
import Villa from '../models/Villa.js';
import nodemailer from 'nodemailer';
import Newsletter from '../models/Newsletter.js';


export const subscribe = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setFullYear(now.getFullYear() + 1);

    let subscription = await Newsletter.findOne({ email });
    let isNew = false;
    if (subscription) {
      // Update expiry if already subscribed
      subscription.expiresAt = expiresAt;
      await subscription.save();
    } else {
      subscription = await Newsletter.create({ email, expiresAt });
      isNew = true;
    }

    // Send confirmation email to the user
    try {
      await sendNewsletterEmail(email, isNew);
    } catch (mailErr) {
      // Log but do not fail the API if email sending fails
      console.error("[NEWSLETTER] Error sending confirmation email:", mailErr);
    }

    return res.json({
      message: isNew
        ? 'Subscribed successfully for 1 year'
        : 'Subscription renewed for 1 year',
      subscription
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Helper to send newsletter confirmation email
async function sendNewsletterEmail(email, isNew) {
  // Use environment variables for credentials
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.gmail,
      pass: process.env.pass
    }
  });

  const mailOptions = {
    from: process.env.gmail,
    to: email,
    subject: isNew
      ? 'Welcome to the Luxor Newsletter!'
      : 'Your Luxor Newsletter Subscription is Renewed',
    html: `
      <h2>Thank you for subscribing to Luxor!</h2>
      <p>
        ${isNew
          ? 'You have been successfully subscribed to our newsletter. You will now receive exclusive offers, travel inspiration, and updates from Luxor.'
          : 'Your newsletter subscription has been renewed for another year. Stay tuned for more updates and offers from Luxor.'}
      </p>
      <p>If you did not request this subscription, please ignore this email.</p>
      <p>Best regards,<br/>Luxor Team</p>
    `
  };

  await transporter.sendMail(mailOptions);
}

// Unsubscribe handler (soft delete / mark expired)
export const unsubscribe = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const subscription = await Newsletter.findOne({ email });
    if (!subscription) return res.status(404).json({ error: 'Subscription not found' });
    subscription.expiresAt = new Date();
    await subscription.save();
    return res.json({ success: true, message: 'Unsubscribed successfully' });
  } catch (err) {
    console.error('Error in unsubscribe:', err);
    return res.status(500).json({ error: err.message });
  }
};

// Admin: get all subscribers
export const getAllSubscribers = async (req, res) => {
  try {
    const subscribers = await Newsletter.find().select('-__v');
    return res.json({ success: true, subscribers });
  } catch (err) {
    console.error('Error in getAllSubscribers:', err);
    return res.status(500).json({ error: err.message });
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
