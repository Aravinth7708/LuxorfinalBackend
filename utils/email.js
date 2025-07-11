import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Get directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create a transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.gmail,
      pass: process.env.pass,
    },
  });
};

// Generate booking confirmation PDF
const generateBookingPDF = async (booking, villa) => {
  return new Promise((resolve, reject) => {
    try {
      // Create a PDF document
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      // Set PDF file path
      const pdfFileName = `booking_${booking._id}.pdf`;
      const pdfPath = path.join(__dirname, "../temp", pdfFileName);
      
      // Ensure temp directory exists
      const tempDir = path.join(__dirname, "../temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Pipe PDF to file
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);

      // Format dates
      const checkInDate = new Date(booking.checkIn);
      const checkOutDate = new Date(booking.checkOut);
      const formattedCheckIn = checkInDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const formattedCheckOut = checkOutDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      // Calculate financial details
      const basePrice = villa.price * booking.totalDays;
      const serviceFee = Math.round(basePrice * 0.05);
      const taxAmount = Math.round((basePrice + serviceFee) * 0.18);
      const totalAmount = booking.totalAmount || basePrice + serviceFee + taxAmount;

      const bookingNumber = String(booking._id).substring(0, 6).toUpperCase();

      // PDF Header
      doc.font("Helvetica-Bold")
        .fontSize(24)
        .fillColor("#1e3a8a")
        .text("Booking Confirmation", { align: "center" });
      
      doc.moveDown(0.5);
      doc.font("Helvetica")
        .fontSize(14)
        .fillColor("#666666")
        .text("Thank you for choosing LuxorStay Villas", { align: "center" });

      // Booking ID Banner
      doc.moveDown(1);
      doc.rect(50, doc.y, 495, 40)
        .fillColor("#f2f7ff")
        .fill();
      
      doc.fillColor("#1e3a8a")
        .font("Helvetica-Bold")
        .fontSize(16)
        .text(`Booking #${bookingNumber}`, 50, doc.y - 30, { align: "center" });

      // Villa Details
      doc.moveDown(1.5);
      doc.fillColor("#333333");
      doc.font("Helvetica-Bold")
        .fontSize(18)
        .text(villa.name);

      // Location
      doc.font("Helvetica")
        .fontSize(12)
        .fillColor("#666666");
      if (villa.location) {
        doc.text(villa.location);
      }

      // Booking Details
      doc.moveDown(1);
      doc.font("Helvetica-Bold")
        .fontSize(14)
        .fillColor("#333333")
        .text("Booking Details");
      
      doc.moveDown(0.5);
      const detailsY = doc.y;
      doc.font("Helvetica-Bold")
        .fontSize(12)
        .text("Check-in:", 50, detailsY)
        .text("Check-out:", 50, detailsY + 25)
        .text("Guests:", 50, detailsY + 50)
        .text("Duration:", 50, detailsY + 75);
      
      doc.font("Helvetica")
        .fontSize(12)
        .text(formattedCheckIn, 150, detailsY)
        .text(formattedCheckOut, 150, detailsY + 25)
        .text(`${booking.guests} guest(s)${booking.infants > 0 ? `, ${booking.infants} infant(s)` : ""}`, 150, detailsY + 50)
        .text(`${booking.totalDays} night(s)`, 150, detailsY + 75);

      // Check-in/out times
      if (booking.checkInTime) {
        doc.font("Helvetica")
          .fontSize(10)
          .fillColor("#666666")
          .text(`After ${booking.checkInTime}`, 150, detailsY + 17);
      }
      
      if (booking.checkOutTime) {
        doc.font("Helvetica")
          .fontSize(10)
          .fillColor("#666666")
          .text(`Before ${booking.checkOutTime}`, 150, detailsY + 42);
      }

      // Payment Details
      doc.moveDown(4);
      doc.font("Helvetica-Bold")
        .fontSize(14)
        .fillColor("#333333")
        .text("Payment Details");
      
      doc.moveDown(0.5);
      const priceY = doc.y;
      
      // Price breakdown
      doc.font("Helvetica")
        .fontSize(12)
        .fillColor("#666666")
        .text(`Base Price × ${booking.totalDays} nights`, 50, priceY)
        .text("Service Fee (5%)", 50, priceY + 25)
        .text("Taxes (18%)", 50, priceY + 50);

      doc.font("Helvetica")
        .fontSize(12)
        .fillColor("#333333")
        .text(`₹${Math.round(basePrice).toLocaleString()}`, 400, priceY, { align: "right" })
        .text(`₹${Math.round(serviceFee).toLocaleString()}`, 400, priceY + 25, { align: "right" })
        .text(`₹${Math.round(taxAmount).toLocaleString()}`, 400, priceY + 50, { align: "right" });

      // Total
      doc.moveTo(50, priceY + 75).lineTo(545, priceY + 75).stroke();
      doc.font("Helvetica-Bold")
        .fontSize(14)
        .fillColor("#333333")
        .text("Total Amount", 50, priceY + 85)
        .fillColor("#D4AF37")
        .text(`₹${totalAmount.toLocaleString()}`, 400, priceY + 85, { align: "right" });

      // Payment Status
      doc.moveDown(2);
      doc.rect(50, doc.y, 495, 50)
        .fillColor("#f8f9fa")
        .fill();
      
      doc.fillColor("#333333")
        .font("Helvetica-Bold")
        .fontSize(12)
        .text("Payment Status:", 70, doc.y - 35)
        .font("Helvetica")
        .fillColor(booking.isPaid ? "#10B981" : "#F59E0B")
        .text(booking.isPaid ? "PAID" : "Payment Due at Hotel", 170, doc.y - 35);
      
      doc.fillColor("#333333")
        .font("Helvetica-Bold")
        .fontSize(12)
        .text("Payment Method:", 70, doc.y - 15)
        .font("Helvetica")
        .text(booking.paymentMethod || "Not specified", 170, doc.y - 15);

      // Address
      if (booking.address && (booking.address.street || booking.address.city)) {
        doc.moveDown(2);
        doc.font("Helvetica-Bold")
          .fontSize(14)
          .fillColor("#333333")
          .text("Booking Address");
        
        doc.moveDown(0.5);
        const address = [
          booking.address.street,
          booking.address.city,
          booking.address.state,
          booking.address.country,
          booking.address.zipCode,
        ].filter(Boolean).join(", ");
        
        doc.font("Helvetica")
          .fontSize(12)
          .text(address);
      }

      // Important Information
      doc.moveDown(2);
      doc.font("Helvetica-Bold")
        .fontSize(14)
        .fillColor("#333333")
        .text("Important Information");
      
      doc.moveDown(0.5);
      doc.font("Helvetica")
        .fontSize(11)
        .fillColor("#333333")
        .list([
          "Check-in time: 2:00 PM - 8:00 PM. Please inform us in advance for late check-ins.",
          "Check-out time: 11:00 AM",
          "A security deposit of ₹10,000 may be required at check-in, refundable upon departure.",
          "Please present this confirmation along with a valid ID at check-in.",
          `Pets are ${villa.name.toLowerCase().includes("pet") ? "allowed" : "not allowed"}.`,
          "For any assistance, contact us at +91 79040 40739 or support@luxorstay.com"
        ], { bulletRadius: 2, textIndent: 10 });

      // Footer
      doc.moveDown(2);
      const footerY = doc.page.height - 50;
      doc.moveTo(50, footerY).lineTo(545, footerY).stroke();
      doc.font("Helvetica")
        .fontSize(10)
        .fillColor("#666666")
        .text("Thank you for choosing Luxor Stay!", 50, footerY + 10, { align: "center" })
        .text(`Luxor Stay Pvt. Ltd. | www.luxorstay.com | +91 79040 40739`, 50, footerY + 25, { align: "center" });

      // Finalize the PDF
      doc.end();

      // Wait for stream to finish
      stream.on("finish", () => {
        resolve(pdfPath);
      });
      
      stream.on("error", (err) => {
        reject(err);
      });
      
    } catch (error) {
      reject(error);
    }
  });
};

// Send booking confirmation email with PDF attachment
export const sendBookingConfirmationEmail = async (email, booking, villa) => {
  try {
    // Generate PDF
    const pdfPath = await generateBookingPDF(booking, villa);
    const pdfFileName = path.basename(pdfPath);
    
    // Format dates for email
    const checkInDate = new Date(booking.checkIn);
    const formattedCheckIn = checkInDate.toLocaleDateString("en-US", {
      month: "short", 
      day: "numeric",
      year: "numeric"
    });
    
    const checkOutDate = new Date(booking.checkOut);
    const formattedCheckOut = checkOutDate.toLocaleDateString("en-US", {
      month: "short", 
      day: "numeric",
      year: "numeric"
    });
    
    const bookingNumber = String(booking._id).substring(0, 6).toUpperCase();
    
    // Create email transporter
    const transporter = createTransporter();
    
    // Set up email
    const mailOptions = {
      from: process.env.gmail,
      to: email,
      subject: `Booking Confirmation #${bookingNumber} - ${villa.name}`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Booking Confirmation</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 650px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
            .header { background-color: #1e3a8a; color: white; padding: 25px 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
            .booking-details { padding: 25px 30px; }
            .booking-id { background-color: #f2f7ff; padding: 12px; border-radius: 6px; text-align: center; margin-bottom: 20px; }
            .booking-id span { font-weight: 700; color: #1e3a8a; font-size: 18px; }
            .cta-button { display: inline-block; background-color: #D4AF37; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; margin-top: 20px; }
            .footer { background-color: #f2f7ff; padding: 20px 30px; text-align: center; font-size: 14px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Booking Confirmation</h1>
              <p>Thank you for choosing LuxorStay Villas</p>
            </div>
            <div class="booking-details">
              <div class="booking-id">
                <span>Booking #${bookingNumber}</span>
              </div>
              <h2>${villa.name}</h2>
              <p><strong>Check-in:</strong> ${formattedCheckIn}</p>
              <p><strong>Check-out:</strong> ${formattedCheckOut}</p>
              <p><strong>Guests:</strong> ${booking.guests} guests</p>
              <p><strong>Total Amount:</strong> ₹${booking.totalAmount?.toLocaleString() || "0"}</p>
              <p><strong>Status:</strong> Confirmed</p>
              <p>Your booking confirmation is attached as a PDF. Please save or print it for your records.</p>
              <p>We look forward to welcoming you soon!</p>
            </div>
            <div class="footer">
              <p>For questions, contact us at luxorholidayhomestays@gmail.com</p>
              <p>© ${new Date().getFullYear()} LuxorStay Villas. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      attachments: [
        {
          filename: `LuxorStay_Booking_${bookingNumber}.pdf`,
          path: pdfPath,
          contentType: "application/pdf"
        }
      ]
    };
    
    // Send email
    await transporter.sendMail(mailOptions);
    
    // Clean up - remove temporary PDF file
    fs.unlinkSync(pdfPath);
    
    return true;
    
  } catch (error) {
    console.error("[EMAIL] Error sending booking confirmation:", error);
    throw error;
  }
};

// Send cancellation email with PDF attachment
export const sendCancellationEmail = async (email, booking) => {
  try {
    const transporter = createTransporter();
    const bookingNumber = String(booking._id).substring(0, 6).toUpperCase();

    const mailOptions = {
      from: process.env.gmail,
      to: email,
      subject: `Booking Cancellation Confirmation #${bookingNumber}`,
      html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Booking Cancelled</title>
        <style>
          body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            line-height: 1.6; 
            color: #333;
            margin: 0; 
            padding: 0;
            background-color: #f5f5f5; 
          }
          .container { 
            max-width: 600px; 
            margin: 20px auto; 
            background-color: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
          }
          .header { 
            background-color: #ef4444; 
            color: white; 
            padding: 25px; 
            text-align: center; 
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
          }
          .content { 
            padding: 25px 30px; 
            background-color: white; 
          }
          .booking-id {
            background-color: #fef2f2;
            border: 1px solid #fee2e2;
            padding: 12px;
            border-radius: 6px;
            text-align: center;
            margin-bottom: 20px;
          }
          .booking-id span {
            font-weight: 700;
            color: #ef4444;
            font-size: 18px;
          }
          .detail-row {
            margin-bottom: 15px;
          }
          .detail-label {
            font-weight: 600;
            color: #6b7280;
            font-size: 14px;
          }
          .detail-value {
            font-size: 16px;
            color: #111827;
          }
          .footer { 
            padding: 20px; 
            text-align: center; 
            font-size: 14px; 
            color: #6b7280;
            background-color: #f9fafb;
            border-top: 1px solid #e5e7eb;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Booking Cancellation</h1>
            <p>Your booking has been cancelled</p>
          </div>
          <div class="content">
            <div class="booking-id">
              <span>Booking #${bookingNumber}</span>
            </div>
            
            <h2 style="margin-top: 0; color: #111827;">${booking.villaName}</h2>
            
            <div class="detail-row">
              <div class="detail-label">Cancelled on</div>
              <div class="detail-value">${booking.cancelledAt ? booking.cancelledAt.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }) : new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</div>
            </div>
            
            ${
              booking.refundAmount > 0
                ? `<div class="detail-row">
                    <div class="detail-label">Refund Amount</div>
                    <div class="detail-value">₹${booking.refundAmount.toLocaleString()} (${booking.refundPercentage || 100}%)</div>
                  </div>`
                : `<div class="detail-row">
                    <div class="detail-label">Refund</div>
                    <div class="detail-value">No refund applicable as per cancellation policy</div>
                  </div>`
            }
            
            <div style="margin-top: 30px; padding: 15px; background-color: #f9fafb; border-radius: 6px;">
              <p style="margin-top: 0; color: #4b5563;">
                If you have any questions regarding this cancellation, please contact our support team at 
                <a href="mailto:luxorholidayhomestays@gmail.com" style="color: #0f766e; text-decoration: none;">
                  luxorholidayhomestays@gmail.com
                </a>
              </p>
            </div>
          </div>
          <div class="footer">
            <p>Thank you for choosing Luxor Stay Villas!</p>
            <p style="margin-bottom: 0;">© ${new Date().getFullYear()} Luxor Stay Villas | All rights reserved</p>
          </div>
        </div>
      </body>
      </html>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("[EMAIL] Error sending cancellation email:", error);
    throw error;
  }
};

export default {
  sendBookingConfirmationEmail,
  sendCancellationEmail
};