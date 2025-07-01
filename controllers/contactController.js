// const nodemailer = require('nodemailer');
import nodemailer from "nodemailer"

// Handle contact form submissions
export const submitContactForm = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    
    // Validate required fields
    if (!name || !email || !message) {
      return res.status(400).json({ 
        success: false,
        error: 'Please provide name, email and message' 
      });
    }

    // Configure mail transport with better error handling for serverless
    let transporter;
    try {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER || process.env.gmail,
          pass: process.env.EMAIL_PASSWORD || process.env.pass
        },
        // Improve connection handling for serverless
        pool: true,
        maxConnections: 1,
        maxMessages: 5,
        rateDelta: 1000,
        rateLimit: 5
      });
      
      // Verify connection configuration
      await transporter.verify();
      console.log('[CONTACT] Email transporter verified successfully');
    } catch (emailSetupError) {
      console.error('[CONTACT] Email transporter setup error:', emailSetupError);
      // Still continue - don't fail the whole process if email doesn't work
      return res.status(200).json({ 
        success: true,
        message: 'Your message has been received. Email notification could not be sent.',
        emailSent: false
      });
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>New Contact Form Submission</title>
      <style>
        body {
          background-color: #f4f4f4;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 20px;
          color: #333;
        }
        .card {
          background-color: #ffffff;
          max-width: 650px;
          margin: auto;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .header {
          background-color: #047857;
          padding: 20px;
          color: #fff;
          text-align: center;
        }
        .content {
          padding: 30px;
        }
        .field {
          margin-bottom: 20px;
        }
        .label {
          font-weight: 600;
          margin-bottom: 6px;
          color: #047857;
        }
        .message-box {
          background: #f0fdf4;
          border-left: 4px solid #10b981;
          padding: 12px;
          white-space: pre-line;
          border-radius: 5px;
        }
        .footer {
          text-align: center;
          font-size: 12px;
          color: #aaa;
          padding: 20px;
          border-top: 1px solid #eee;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h2>📬 New Contact Submission</h2>
        </div>
        <div class="content">
          <div class="field">
            <div class="label">Name</div>
            <div>${name}</div>
          </div>
          <div class="field">
            <div class="label">Email</div>
            <div>${email}</div>
          </div>
          ${phone ? `
          <div class="field">
            <div class="label">Phone</div>
            <div>${phone}</div>
          </div>` : ''}
          <div class="field">
            <div class="label">Subject</div>
            <div>${subject || 'No subject provided'}</div>
          </div>
          <div class="field">
            <div class="label">Message</div>
            <div class="message-box">${message.replace(/\n/g, '<br>')}</div>
          </div>
        </div>
        <div class="footer">
          Sent via LuxorStay's Contact Form
        </div>
      </div>
    </body>
    </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER || process.env.gmail,
      to: process.env.CONTACT_EMAIL || process.env.gmail,
      subject: `New Contact Form: ${subject || 'LuxorStay Inquiry'}`,
      html: htmlContent,
      replyTo: email
    };

    const userConfirmation = {
      from: process.env.EMAIL_USER || process.env.gmail,
      to: email,
      subject: 'Thank you for contacting LuxorStay',
      html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Thank You - LuxorStay</title>
        <style>
          body {
            background-color: #f4f4f4;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 20px;
            color: #333;
          }
          .card {
            background-color: #ffffff;
            max-width: 650px;
            margin: auto;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header {
            background-color: #16a34a;
            padding: 20px;
            color: #fff;
            text-align: center;
          }
          .content {
            padding: 30px;
          }
          .message-box {
            background-color: #f0fdf4;
            padding: 15px;
            border-left: 4px solid #16a34a;
            border-radius: 5px;
            margin: 20px 0;
            white-space: pre-line;
          }
          .footer {
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #888;
            border-top: 1px solid #eee;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h2>✅ Message Received</h2>
          </div>
          <div class="content">
            <p>Dear ${name},</p>
            <p>Thank you for reaching out to <strong>LuxorStay</strong>. We’ve received your message and will respond within 24–48 hours.</p>
            <div class="message-box">
              ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ''}
              <p><strong>Your Message:</strong><br>${message.replace(/\n/g, '<br>')}</p>
            </div>
            <p>If your message is urgent, please call us directly.</p>
            <p>Warm regards,<br><strong>The LuxorStay Team</strong></p>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} LuxorStay. All rights reserved.
          </div>
        </div>
      </body>
      </html>
      `
    };

    // Try sending emails with better error handling
    try {
      console.log('[CONTACT] Sending notification email to admin');
      await transporter.sendMail(mailOptions);
      
      console.log('[CONTACT] Sending auto-reply to user');
      await transporter.sendMail(userConfirmation);
      
      console.log('[CONTACT] Emails sent successfully');
    } catch (emailSendError) {
      console.error('[CONTACT] Error sending email:', emailSendError);
      // Return success even if email fails, so the API doesn't crash
      return res.status(200).json({ 
        success: true,
        message: 'Your message has been received. Email notification could not be sent.',
        emailSent: false
      });
    }

    // Return properly structured success response
    return res.status(200).json({
      success: true,
      message: 'Your message has been sent successfully!',
      emailSent: true
    });
  } catch (err) {
    console.error('Contact form error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to send message. Please try again later.',
      details: process.env.NODE_ENV === 'production' ? null : err.message 
    });
  }
};
