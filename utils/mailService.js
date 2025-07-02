import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create reusable transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail', // or your specific service
    auth: {
      user: process.env.EMAIL_USER || process.env.gmail,
      pass: process.env.EMAIL_PASSWORD || process.env.pass
    },
    // Optimize for serverless environments
    pool: true,
    maxConnections: 1,
    rateDelta: 1000,
    rateLimit: 5
  });
};

// Generate a random 6-digit OTP
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP to user's email for verification
export const sendOTPEmail = async (email, otp, isPasswordReset = false) => {
  try {
    const transporter = createTransporter();
    
    // Verify connection configuration
    await transporter.verify();
    
    const subject = isPasswordReset 
      ? "Password Reset - Your OTP Code" 
      : "Verify Your Email - Your OTP Code";
      
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body {
          font-family: 'Arial', sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background: #ffffff;
          border-radius: 8px;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: #16a34a;
          color: white;
          padding: 20px;
          text-align: center;
          border-radius: 8px 8px 0 0;
        }
        .content {
          padding: 20px;
        }
        .otp-container {
          margin: 30px 0;
          text-align: center;
        }
        .otp {
          font-size: 32px;
          font-weight: bold;
          color: #16a34a;
          letter-spacing: 5px;
          padding: 10px;
          background: #f0fdf4;
          border-radius: 4px;
          border: 1px dashed #16a34a;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          color: #666;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${isPasswordReset ? 'Reset Your Password' : 'Verify Your Email'}</h1>
        </div>
        <div class="content">
          <p>Dear User,</p>
          <p>${
            isPasswordReset 
            ? 'We received a request to reset your password. Please use the following OTP to complete the process:'
            : 'Thank you for registering with Luxor Holiday Home Stays. To complete your registration, please verify your email address using the following OTP:'
          }</p>
          
          <div class="otp-container">
            <div class="otp">${otp}</div>
          </div>
          
          <p>This OTP is valid for 10 minutes. Please do not share this code with anyone.</p>
          <p>${
            isPasswordReset
            ? 'If you did not request a password reset, please ignore this email.'
            : 'If you did not register for an account, please ignore this email.'
          }</p>
          
          <p>Thank you,<br>Luxor Holiday Home Stays Team</p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Luxor Holiday Home Stays. All rights reserved.
        </div>
      </div>
    </body>
    </html>
    `;
    
    const mailOptions = {
      from: process.env.EMAIL_USER || process.env.gmail,
      to: email,
      subject: subject,
      html: htmlContent
    };
    
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
};

export default { generateOTP, sendOTPEmail };
