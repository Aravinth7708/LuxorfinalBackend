import nodemailer from "nodemailer"
import PDFDocument from "pdfkit"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { dirname } from "path"

// Get directory name
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Create a transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    service: "gmail",
    auth: {
      user: process.env.gmail,
      pass: process.env.pass,
    },
  })
}

// Generate booking confirmation PDF with professional design
const generateBookingPDF = async (booking, villa) => {
  return new Promise((resolve, reject) => {
    try {
      // Create a PDF document
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
      })

      // Set PDF file path
      const pdfFileName = `booking_${booking._id}.pdf`
      const pdfPath = path.join(__dirname, "../temp", pdfFileName)

      // Ensure temp directory exists
      const tempDir = path.join(__dirname, "../temp")
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }

      // Pipe PDF to file
      const stream = fs.createWriteStream(pdfPath)
      doc.pipe(stream)

      // Format dates
      const checkInDate = new Date(booking.checkIn)
      const checkOutDate = new Date(booking.checkOut)
      const formattedCheckIn = checkInDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
      const formattedCheckOut = checkOutDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })

      // Calculate financial details
      const basePrice = villa.price * booking.totalDays
      const serviceFee = Math.round(basePrice * 0.05)
      const taxAmount = Math.round((basePrice + serviceFee) * 0.18)
      const totalAmount = booking.totalAmount || basePrice + serviceFee + taxAmount
      const bookingNumber = String(booking._id).substring(0, 8).toUpperCase()

      // Document Header with Border
      doc.rect(40, 40, 515, 750).stroke()

      // Title Header
      doc.rect(40, 40, 515, 60).fillAndStroke("#f8f9fa", "#000000")
      doc
        .fillColor("#000000")
        .font("Helvetica-Bold")
        .fontSize(16)
        .text("VILLA BOOKING CONFIRMATION (VBC) Luxury Stay", 50, 60, {
          align: "center",
        })

      doc.font("Helvetica").fontSize(12).text("LuxorStay Villas - Premium Accommodation", 50, 80, {
        align: "center",
      })

      // Booking Reference Section
      let currentY = 120
      doc.rect(50, currentY, 495, 30).fillAndStroke("#e3f2fd", "#1976d2")
      doc
        .fillColor("#1976d2")
        .font("Helvetica-Bold")
        .fontSize(14)
        .text(`BOOKING REFERENCE: #${bookingNumber}`, 60, currentY + 10)

      // Main Booking Details Section
      currentY += 50
      doc.fillColor("#000000").font("Helvetica-Bold").fontSize(12).text("BOOKING DETAILS", 50, currentY)

      currentY += 25

      // Create structured table layout
      const leftColX = 60
      const rightColX = 300
      const rowHeight = 20

      // Villa Information
      doc.rect(50, currentY, 495, 25).fillAndStroke("#f5f5f5", "#cccccc")
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#000000")
        .text("VILLA INFORMATION", leftColX, currentY + 8)

      currentY += 35

      doc.font("Helvetica-Bold").fontSize(10).text("Villa Name:", leftColX, currentY)
      doc.font("Helvetica").text(villa.name, leftColX + 80, currentY)

      doc.font("Helvetica-Bold").text("Location:", rightColX, currentY)
      doc.font("Helvetica").text(villa.location || "Premium Location", rightColX + 60, currentY)

      currentY += rowHeight

      doc.font("Helvetica-Bold").text("Property Type:", leftColX, currentY)
      doc.font("Helvetica").text("Luxury Villa", leftColX + 80, currentY)

      doc.font("Helvetica-Bold").text("Category:", rightColX, currentY)
      doc.font("Helvetica").text("PREMIUM", rightColX + 60, currentY)

      // Check-in/Check-out Section
      currentY += 35
      doc.rect(50, currentY, 495, 25).fillAndStroke("#f5f5f5", "#cccccc")
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#000000")
        .text("STAY DURATION", leftColX, currentY + 8)

      currentY += 35

      doc.font("Helvetica-Bold").fontSize(10).text("Check-in Date:", leftColX, currentY)
      doc.font("Helvetica").text(formattedCheckIn, leftColX + 80, currentY)

      doc.font("Helvetica-Bold").text("Check-in Time:", rightColX, currentY)
      doc.font("Helvetica").text("After 2:00 PM", rightColX + 80, currentY)

      currentY += rowHeight

      doc.font("Helvetica-Bold").text("Check-out Date:", leftColX, currentY)
      doc.font("Helvetica").text(formattedCheckOut, leftColX + 80, currentY)

      doc.font("Helvetica-Bold").text("Check-out Time:", rightColX, currentY)
      doc.font("Helvetica").text("Before 11:00 AM", rightColX + 80, currentY)

      currentY += rowHeight

      doc.font("Helvetica-Bold").text("Duration:", leftColX, currentY)
      doc.font("Helvetica").text(`${booking.totalDays} Night(s)`, leftColX + 80, currentY)

      doc.font("Helvetica-Bold").text("Total Guests:", rightColX, currentY)
      doc.font("Helvetica").text(`${booking.guests} Guest(s)`, rightColX + 80, currentY)

      // Guest Details Section
      currentY += 35
      doc.rect(50, currentY, 495, 25).fillAndStroke("#f5f5f5", "#cccccc")
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#000000")
        .text("GUEST INFORMATION", leftColX, currentY + 8)

      currentY += 35

      // Guest Details Table Header
      doc.rect(50, currentY, 495, 20).fillAndStroke("#e8f4fd", "#1976d2")
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#000000")

      const colWidths = [40, 120, 80, 80, 85, 90]
      const colPositions = [60, 100, 220, 300, 380, 465]
      const headers = ["S.No", "Guest Type", "Adults", "Children", "Infants", "Special Requests"]

      headers.forEach((header, index) => {
        doc.text(header, colPositions[index], currentY + 6, {
          width: colWidths[index],
          align: "center",
        })
      })

      currentY += 25

      // Guest Details Row
      doc.rect(50, currentY, 495, 20).stroke()
      doc.font("Helvetica").fontSize(9)

      const guestData = [
        "1",
        "PRIMARY",
        booking.guests.toString(),
        booking.children ? booking.children.toString() : "0",
        booking.infants ? booking.infants.toString() : "0",
        booking.specialRequests || "None",
      ]

      guestData.forEach((data, index) => {
        doc.text(data, colPositions[index], currentY + 6, {
          width: colWidths[index],
          align: "center",
        })
      })

      // Payment Details Section
      currentY += 40
      doc.rect(50, currentY, 495, 25).fillAndStroke("#f5f5f5", "#cccccc")
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#000000")
        .text("PAYMENT DETAILS", leftColX, currentY + 8)

      currentY += 35

      // Payment breakdown table
      const paymentItems = [
        ["Base Price", `₹${Math.round(basePrice).toLocaleString()}`],
        ["Service Fee (5%)", `₹${Math.round(serviceFee).toLocaleString()}`],
        ["Taxes (18%)", `₹${Math.round(taxAmount).toLocaleString()}`],
        ["Total Amount", `₹${totalAmount.toLocaleString()}`],
      ]

      paymentItems.forEach((item, index) => {
        if (index === paymentItems.length - 1) {
          // Total row with different styling
          doc.rect(50, currentY, 495, 20).fillAndStroke("#fff3cd", "#856404")
          doc.font("Helvetica-Bold").fontSize(11)
        } else {
          doc.rect(50, currentY, 495, 20).stroke()
          doc.font("Helvetica").fontSize(10)
        }

        doc.text(item[0], leftColX, currentY + 6)
        doc.text(item[1], 450, currentY + 6, { align: "right" })
        currentY += 20
      })

      // Payment Status
      currentY += 10
      doc.rect(50, currentY, 495, 25).fillAndStroke("#d4edda", "#155724")
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#155724")
        .text(
          `PAYMENT STATUS: ${booking.isPaid ? "CONFIRMED & PAID" : "PENDING"} | METHOD: ${booking.paymentMethod || "Online Payment"}`,
          leftColX,
          currentY + 8,
        )

      // Transaction Details
      if (booking.transactionId) {
        currentY += 35
        doc.fillColor("#000000").font("Helvetica-Bold").fontSize(10).text("Transaction ID:", leftColX, currentY)
        doc.font("Helvetica").text(booking.transactionId, leftColX + 90, currentY)
      }

      // Important Instructions
      currentY += 40
      doc.rect(50, currentY, 495, 25).fillAndStroke("#fff3cd", "#856404")
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#856404")
        .text("IMPORTANT INSTRUCTIONS", leftColX, currentY + 8)

      currentY += 35

      const instructions = [
        "• Please carry a valid government-issued photo ID for check-in verification",
        "• A security deposit of ₹10,000 may be collected at check-in (refundable)",
        "• Check-in: 2:00 PM onwards | Check-out: 11:00 AM (Late check-out subject to availability)",
        "• Smoking and pets are strictly prohibited inside the villa premises",
        "• Any damage to property will be charged separately from the security deposit",
        "• For any assistance, contact: +91 79040 40739 or support@luxorstay.com",
      ]

      doc.font("Helvetica").fontSize(9).fillColor("#000000")

      instructions.forEach((instruction) => {
        doc.text(instruction, leftColX, currentY, { width: 450 })
        currentY += 15
      })

      // Terms and Conditions
      currentY += 20
      doc.rect(50, currentY, 495, 25).fillAndStroke("#f8f9fa", "#6c757d")
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#6c757d")
        .text("TERMS & CONDITIONS", leftColX, currentY + 8)

      currentY += 35

      const terms = [
        "• This booking is subject to availability and confirmation from LuxorStay Villas",
        "• Cancellation policy: Free cancellation up to 24 hours before check-in",
        "• No-show or same-day cancellation will result in full charge",
        "• Guest is responsible for any additional charges incurred during the stay",
        "• Management reserves the right to refuse service in case of misconduct",
      ]

      doc.font("Helvetica").fontSize(8).fillColor("#000000")

      terms.forEach((term) => {
        doc.text(term, leftColX, currentY, { width: 450 })
        currentY += 12
      })

      // Footer
      const footerY = 750
      doc.moveTo(50, footerY).lineTo(545, footerY).stroke()

      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#000000")
        .text("LuxorStay Villas Pvt. Ltd.", 50, footerY + 10)

      doc
        .font("Helvetica")
        .fontSize(8)
        .text("www.luxorstay.com | Email: support@luxorstay.com | Phone: +91 79040 40739", 50, footerY + 25)

      doc.text(`Generated on: ${new Date().toLocaleString("en-US")}`, 400, footerY + 10, {
        align: "right",
      })

      doc.text("Thank you for choosing LuxorStay Villas!", 400, footerY + 25, {
        align: "right",
      })

      // Finalize the PDF
      doc.end()

      // Wait for stream to finish
      stream.on("finish", () => {
        resolve(pdfPath)
      })

      stream.on("error", (err) => {
        reject(err)
      })
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Send booking confirmation email with PDF attachment
 * @param {Object} booking - The booking object
 * @param {Object} villa - The villa object
 * @returns {Promise<boolean>} - True if email sent successfully
 */
export const sendBookingConfirmationEmail = async (booking, villa) => {
  try {
    // Format dates for email
    const checkInDate = new Date(booking.checkIn)
    const checkOutDate = new Date(booking.checkOut)
    const formattedCheckIn = checkInDate.toLocaleDateString("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    const formattedCheckOut = checkOutDate.toLocaleDateString("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    })

    // Create booking reference number
    const bookingReference = String(booking._id).substring(0, 8).toUpperCase()

    // Generate PDF
    const pdfPath = await generateBookingPDF(booking, villa)

    // Set up email transporter
    const transporter = createTransporter()

    // Format payment info
    const paymentMethod = booking.paymentMethod || "Online Payment"

    // Create email content
    const mailOptions = {
      from: process.env.gmail,
      to: booking.email,
      subject: `✅ Booking Confirmed #${bookingReference} - ${villa.name}`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Booking Confirmation</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #1f2937;
              margin: 0;
              padding: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
            }
            
            .email-wrapper {
              padding: 40px 20px;
              min-height: 100vh;
            }
            
            .container {
              max-width: 650px;
              margin: 0 auto;
              background: #ffffff;
              border-radius: 20px;
              overflow: hidden;
              box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
              position: relative;
            }
            
            .container::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 6px;
              background: linear-gradient(90deg, #10b981, #059669, #047857);
            }
            
            .header {
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white;
              padding: 50px 40px;
              text-align: center;
              position: relative;
              overflow: hidden;
            }
            
            .header::before {
              content: '';
              position: absolute;
              top: -50%;
              left: -50%;
              width: 200%;
              height: 200%;
              background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
              animation: shimmer 3s ease-in-out infinite;
            }
            
            @keyframes shimmer {
              0%, 100% { transform: translateX(-100%) translateY(-100%) rotate(0deg); }
              50% { transform: translateX(0%) translateY(0%) rotate(180deg); }
            }
            
            .header-content {
              position: relative;
              z-index: 2;
            }
            
            .success-icon {
              width: 80px;
              height: 80px;
              background: rgba(255, 255, 255, 0.2);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 20px;
              backdrop-filter: blur(10px);
            }
            
            .success-icon::after {
              content: '✓';
              font-size: 40px;
              font-weight: bold;
              color: white;
            }
            
            .header h1 {
              font-size: 32px;
              font-weight: 700;
              margin-bottom: 10px;
              letter-spacing: -0.5px;
            }
            
            .header p {
              font-size: 18px;
              opacity: 0.9;
              font-weight: 400;
            }
            
            .booking-details {
              padding: 50px 40px;
            }
            
            .booking-id {
              background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
              padding: 25px;
              border-radius: 16px;
              text-align: center;
              margin-bottom: 40px;
              border: 2px solid #a7f3d0;
              position: relative;
              overflow: hidden;
            }
            
            .booking-id::before {
              content: '';
              position: absolute;
              top: 0;
              left: -100%;
              width: 100%;
              height: 100%;
              background: linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.1), transparent);
              animation: slide 2s ease-in-out infinite;
            }
            
            @keyframes slide {
              0% { left: -100%; }
              100% { left: 100%; }
            }
            
            .booking-id-label {
              font-size: 14px;
              color: #059669;
              font-weight: 500;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 8px;
            }
            
            .booking-id span {
              font-weight: 800;
              color: #047857;
              font-size: 24px;
              letter-spacing: 2px;
              position: relative;
              z-index: 2;
            }
            
            .villa-name {
              font-size: 28px;
              font-weight: 700;
              color: #111827;
              margin-bottom: 35px;
              text-align: center;
              position: relative;
            }
            
            .villa-name::after {
              content: '';
              position: absolute;
              bottom: -10px;
              left: 50%;
              transform: translateX(-50%);
              width: 60px;
              height: 3px;
              background: linear-gradient(90deg, #10b981, #059669);
              border-radius: 2px;
            }
            
            .details-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 30px;
              margin-bottom: 35px;
            }
            
            .info-card {
              background: #f8fafc;
              padding: 25px;
              border-radius: 12px;
              border-left: 4px solid #10b981;
              transition: transform 0.2s ease, box-shadow 0.2s ease;
            }
            
            .info-card:hover {
              transform: translateY(-2px);
              box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
            }
            
            .info-label {
              font-weight: 600;
              color: #6b7280;
              font-size: 13px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 8px;
            }
            
            .info-value {
              font-size: 18px;
              color: #111827;
              font-weight: 600;
            }
            
            .total-amount {
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white;
              padding: 30px;
              border-radius: 16px;
              text-align: center;
              margin: 35px 0;
              position: relative;
              overflow: hidden;
            }
            
            .total-amount::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: radial-gradient(circle at 30% 20%, rgba(255,255,255,0.2) 0%, transparent 50%);
            }
            
            .amount-label {
              font-size: 16px;
              opacity: 0.9;
              margin-bottom: 8px;
              position: relative;
              z-index: 2;
            }
            
            .amount-value {
              font-size: 36px;
              font-weight: 800;
              position: relative;
              z-index: 2;
            }
            
            .payment-status {
              background: #ecfdf5;
              color: #047857;
              padding: 12px 20px;
              border-radius: 25px;
              font-weight: 600;
              font-size: 14px;
              display: inline-block;
              margin-top: 15px;
              border: 2px solid #a7f3d0;
              position: relative;
              z-index: 2;
            }
            
            .important-info {
              background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
              padding: 30px;
              border-radius: 16px;
              margin: 35px 0;
              border-left: 5px solid #f59e0b;
            }
            
            .important-info h3 {
              color: #92400e;
              font-size: 18px;
              font-weight: 700;
              margin-bottom: 15px;
              display: flex;
              align-items: center;
            }
            
            .important-info h3::before {
              content: '⚠️';
              margin-right: 10px;
              font-size: 20px;
            }
            
            .important-info ul {
              list-style: none;
              padding: 0;
            }
            
            .important-info li {
              color: #78350f;
              margin-bottom: 10px;
              padding-left: 25px;
              position: relative;
              font-weight: 500;
            }
            
            .important-info li::before {
              content: '•';
              color: #f59e0b;
              font-weight: bold;
              position: absolute;
              left: 0;
              font-size: 20px;
            }
            
            .cta-section {
              text-align: center;
              margin: 40px 0;
            }
            
            .cta-text {
              font-size: 18px;
              color: #4b5563;
              margin-bottom: 25px;
              font-weight: 500;
            }
            
            .button {
              display: inline-block;
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white;
              text-decoration: none;
              padding: 16px 35px;
              border-radius: 50px;
              font-weight: 600;
              font-size: 16px;
              transition: all 0.3s ease;
              box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3);
              position: relative;
              overflow: hidden;
            }
            
            .button::before {
              content: '';
              position: absolute;
              top: 0;
              left: -100%;
              width: 100%;
              height: 100%;
              background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
              transition: left 0.5s ease;
            }
            
            .button:hover::before {
              left: 100%;
            }
            
            .button:hover {
              transform: translateY(-2px);
              box-shadow: 0 12px 35px rgba(16, 185, 129, 0.4);
            }
            
            .footer {
              background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
              padding: 40px;
              text-align: center;
              border-top: 1px solid #e5e7eb;
            }
            
            .footer-content {
              max-width: 400px;
              margin: 0 auto;
            }
            
            .footer h3 {
              color: #374151;
              font-size: 20px;
              font-weight: 700;
              margin-bottom: 15px;
            }
            
            .footer p {
              color: #6b7280;
              font-size: 14px;
              margin-bottom: 10px;
              line-height: 1.6;
            }
            
            .footer a {
              color: #10b981;
              text-decoration: none;
              font-weight: 600;
            }
            
            .footer a:hover {
              text-decoration: underline;
            }
            
            .social-links {
              margin-top: 25px;
              padding-top: 25px;
              border-top: 1px solid #d1d5db;
            }
            
            .copyright {
              font-size: 12px;
              color: #9ca3af;
              margin-top: 20px;
            }
            
            @media (max-width: 600px) {
              .email-wrapper {
                padding: 20px 10px;
              }
              
              .container {
                border-radius: 12px;
              }
              
              .header {
                padding: 40px 25px;
              }
              
              .header h1 {
                font-size: 26px;
              }
              
              .booking-details {
                padding: 30px 25px;
              }
              
              .details-grid {
                grid-template-columns: 1fr;
                gap: 20px;
              }
              
              .villa-name {
                font-size: 22px;
              }
              
              .amount-value {
                font-size: 28px;
              }
              
              .footer {
                padding: 30px 25px;
              }
            }
          </style>
        </head>
        <body>
          <div class="email-wrapper">
            <div class="container">
              <div class="header">
                <div class="header-content">
                  <div class="success-icon"></div>
                  <h1>Booking Confirmed!</h1>
                  <p>Your luxury villa reservation is all set</p>
                </div>
              </div>
              
              <div class="booking-details">
                <div class="booking-id">
                  <div class="booking-id-label">Booking Reference</div>
                  <span>#${bookingReference}</span>
                </div>
                
                <h2 class="villa-name">${villa.name}</h2>
                
                <div class="details-grid">
                  <div class="info-card">
                    <div class="info-label">Check-in Date</div>
                    <div class="info-value">${formattedCheckIn}</div>
                  </div>
                  
                  <div class="info-card">
                    <div class="info-label">Check-out Date</div>
                    <div class="info-value">${formattedCheckOut}</div>
                  </div>
                  
                  <div class="info-card">
                    <div class="info-label">Guests</div>
                    <div class="info-value">${booking.guests}${booking.infants > 0 ? ` adult(s), ${booking.infants} infant(s)` : " guest(s)"}</div>
                  </div>
                  
                  <div class="info-card">
                    <div class="info-label">Duration</div>
                    <div class="info-value">${Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24))} nights</div>
                  </div>
                </div>
                
                <div class="total-amount">
                  <div class="amount-label">Total Amount Paid</div>
                  <div class="amount-value">₹${booking.totalAmount.toLocaleString()}</div>
                  <div class="payment-status">✓ PAID via ${paymentMethod}</div>
                </div>
                
                <div class="important-info">
                  <h3>Important Information</h3>
                  <ul>
                    <li>Please check the attached PDF for complete booking details and terms</li>
                    <li>Present this confirmation at check-in with a valid government ID</li>
                    <li>A refundable security deposit may be collected upon arrival</li>
                    <li>Check-in time: 2:00 PM | Check-out time: 11:00 AM</li>
                    <li>Contact us 24 hours before arrival for any special requests</li>
                  </ul>
                </div>
                
                <div class="cta-section">
                  <p class="cta-text">We can't wait to welcome you to your luxury getaway!</p>
                  <a href="https://luxorstay.com/my-bookings" class="button">View My Booking</a>
                </div>
              </div>
              
              <div class="footer">
                <div class="footer-content">
                  <h3>Thank you for choosing Luxor Stay Villas!</h3>
                  <p>Questions or need assistance? We're here to help!</p>
                  <p>📧 <a href="mailto:luxorholidayhomestays@gmail.com">luxorholidayhomestays@gmail.com</a></p>
                  <p>📞 +91 XXX XXX XXXX</p>
                  
                  <div class="social-links">
                    <p>Follow us for travel inspiration and exclusive offers</p>
                  </div>
                  
                  <div class="copyright">
                    © ${new Date().getFullYear()} Luxor Stay Villas | All rights reserved
                  </div>
                </div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      attachments: [
        {
          filename: `LuxorStay_Booking_${bookingReference}.pdf`,
          path: pdfPath,
          contentType: "application/pdf",
        },
      ],
    }

    // Send email with attachment
    await transporter.sendMail(mailOptions)

    // Clean up temporary PDF file
    fs.unlink(pdfPath, (err) => {
      if (err) console.error("Error removing temporary PDF:", err)
    })

    return true
  } catch (error) {
    console.error("Error sending booking confirmation email:", error)
    throw error
  }
}

/**
 * Send cancellation email
 * @param {Object} booking - The cancelled booking
 * @returns {Promise<boolean>} - True if email sent successfully
 */
export const sendCancellationEmail = async (booking) => {
  try {
    const transporter = createTransporter()

    // Create booking reference
    const bookingReference = String(booking._id).substring(0, 8).toUpperCase()

    const mailOptions = {
      from: process.env.gmail,
      to: booking.email,
      subject: `❌ Booking Cancelled - #${bookingReference}`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Booking Cancelled</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #1f2937;
              margin: 0;
              padding: 0;
              background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
              min-height: 100vh;
            }
            
            .email-wrapper {
              padding: 40px 20px;
              min-height: 100vh;
            }
            
            .container {
              max-width: 650px;
              margin: 0 auto;
              background: #ffffff;
              border-radius: 20px;
              overflow: hidden;
              box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
              position: relative;
            }
            
            .container::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 6px;
              background: linear-gradient(90deg, #ef4444, #dc2626, #b91c1c);
            }
            
            .header {
              background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
              color: white;
              padding: 50px 40px;
              text-align: center;
              position: relative;
              overflow: hidden;
            }
            
            .header::before {
              content: '';
              position: absolute;
              top: -50%;
              left: -50%;
              width: 200%;
              height: 200%;
              background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
            }
            
            .header-content {
              position: relative;
              z-index: 2;
            }
            
            .cancel-icon {
              width: 80px;
              height: 80px;
              background: rgba(255, 255, 255, 0.2);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 20px;
              backdrop-filter: blur(10px);
            }
            
            .cancel-icon::after {
              content: '✕';
              font-size: 40px;
              font-weight: bold;
              color: white;
            }
            
            .header h1 {
              font-size: 32px;
              font-weight: 700;
              margin-bottom: 10px;
              letter-spacing: -0.5px;
            }
            
            .header p {
              font-size: 18px;
              opacity: 0.9;
              font-weight: 400;
            }
            
            .content {
              padding: 50px 40px;
            }
            
            .booking-id {
              background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
              padding: 25px;
              border-radius: 16px;
              text-align: center;
              margin-bottom: 40px;
              border: 2px solid #fca5a5;
              position: relative;
            }
            
            .booking-id-label {
              font-size: 14px;
              color: #dc2626;
              font-weight: 500;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 8px;
            }
            
            .booking-id span {
              font-weight: 800;
              color: #b91c1c;
              font-size: 24px;
              letter-spacing: 2px;
            }
            
            .villa-name {
              font-size: 28px;
              font-weight: 700;
              color: #111827;
              margin-bottom: 35px;
              text-align: center;
              position: relative;
            }
            
            .villa-name::after {
              content: '';
              position: absolute;
              bottom: -10px;
              left: 50%;
              transform: translateX(-50%);
              width: 60px;
              height: 3px;
              background: linear-gradient(90deg, #ef4444, #dc2626);
              border-radius: 2px;
            }
            
            .details-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 30px;
              margin-bottom: 35px;
            }
            
            .info-card {
              background: #f8fafc;
              padding: 25px;
              border-radius: 12px;
              border-left: 4px solid #ef4444;
            }
            
            .info-label {
              font-weight: 600;
              color: #6b7280;
              font-size: 13px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 8px;
            }
            
            .info-value {
              font-size: 18px;
              color: #111827;
              font-weight: 600;
            }
            
            .refund-section {
              background: ${booking.refundAmount ? "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)" : "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)"};
              padding: 30px;
              border-radius: 16px;
              margin: 35px 0;
              border-left: 5px solid ${booking.refundAmount ? "#10b981" : "#ef4444"};
              text-align: center;
            }
            
            .refund-title {
              font-size: 18px;
              font-weight: 700;
              color: ${booking.refundAmount ? "#047857" : "#b91c1c"};
              margin-bottom: 15px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            
            .refund-title::before {
              content: '${booking.refundAmount ? "💰" : "❌"}';
              margin-right: 10px;
              font-size: 20px;
            }
            
            .refund-amount {
              font-size: 32px;
              font-weight: 800;
              color: ${booking.refundAmount ? "#047857" : "#b91c1c"};
              margin-bottom: 10px;
            }
            
            .refund-note {
              font-size: 14px;
              color: ${booking.refundAmount ? "#065f46" : "#7f1d1d"};
              font-weight: 500;
            }
            
            .support-section {
              background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
              padding: 30px;
              border-radius: 16px;
              margin: 35px 0;
              text-align: center;
              border-left: 5px solid #3b82f6;
            }
            
            .support-title {
              font-size: 18px;
              font-weight: 700;
              color: #1e40af;
              margin-bottom: 15px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            
            .support-title::before {
              content: '💬';
              margin-right: 10px;
              font-size: 20px;
            }
            
            .support-text {
              color: #1e3a8a;
              font-weight: 500;
              line-height: 1.6;
            }
            
            .support-email {
              color: #2563eb;
              text-decoration: none;
              font-weight: 600;
              padding: 8px 16px;
              background: rgba(59, 130, 246, 0.1);
              border-radius: 20px;
              display: inline-block;
              margin-top: 10px;
              transition: all 0.3s ease;
            }
            
            .support-email:hover {
              background: rgba(59, 130, 246, 0.2);
              transform: translateY(-1px);
            }
            
            .footer {
              background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
              padding: 40px;
              text-align: center;
              border-top: 1px solid #e5e7eb;
            }
            
            .footer-content {
              max-width: 400px;
              margin: 0 auto;
            }
            
            .footer h3 {
              color: #374151;
              font-size: 20px;
              font-weight: 700;
              margin-bottom: 15px;
            }
            
            .footer p {
              color: #6b7280;
              font-size: 14px;
              margin-bottom: 10px;
              line-height: 1.6;
            }
            
            .copyright {
              font-size: 12px;
              color: #9ca3af;
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #d1d5db;
            }
            
            @media (max-width: 600px) {
              .email-wrapper {
                padding: 20px 10px;
              }
              
              .container {
                border-radius: 12px;
              }
              
              .header {
                padding: 40px 25px;
              }
              
              .header h1 {
                font-size: 26px;
              }
              
              .content {
                padding: 30px 25px;
              }
              
              .details-grid {
                grid-template-columns: 1fr;
                gap: 20px;
              }
              
              .villa-name {
                font-size: 22px;
              }
              
              .refund-amount {
                font-size: 24px;
              }
              
              .footer {
                padding: 30px 25px;
              }
            }
          </style>
        </head>
        <body>
          <div class="email-wrapper">
            <div class="container">
              <div class="header">
                <div class="header-content">
                  <div class="cancel-icon"></div>
                  <h1>Booking Cancelled</h1>
                  <p>Your reservation has been cancelled</p>
                </div>
              </div>
              
              <div class="content">
                <div class="booking-id">
                  <div class="booking-id-label">Cancelled Booking</div>
                  <span>#${bookingReference}</span>
                </div>
                
                <h2 class="villa-name">${booking.villaName}</h2>
                
                <div class="details-grid">
                  <div class="info-card">
                    <div class="info-label">Cancelled On</div>
                    <div class="info-value">${new Date().toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}</div>
                  </div>
                  
                  <div class="info-card">
                    <div class="info-label">Cancellation Time</div>
                    <div class="info-value">${new Date().toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}</div>
                  </div>
                </div>
                
                <div class="refund-section">
                  ${
                    booking.refundAmount
                      ? `
                    <div class="refund-title">Refund Information</div>
                    <div class="refund-amount">₹${booking.refundAmount.toLocaleString()}</div>
                    <div class="refund-note">
                      ${booking.refundPercentage || 100}% refund will be processed within 5-7 business days
                    </div>
                  `
                      : `
                    <div class="refund-title">No Refund Available</div>
                    <div class="refund-note">
                      No refund applicable as per our cancellation policy
                    </div>
                  `
                  }
                </div>
                
                <div class="support-section">
                  <div class="support-title">Need Help?</div>
                  <div class="support-text">
                    If you have any questions regarding this cancellation or need assistance with future bookings, our support team is here to help.
                  </div>
                  <a href="mailto:luxorholidayhomestays@gmail.com" class="support-email">
                    Contact Support
                  </a>
                </div>
              </div>
              
              <div class="footer">
                <div class="footer-content">
                  <h3>We're sorry to see you go</h3>
                  <p>We hope to welcome you back to Luxor Stay Villas in the future!</p>
                  <p>Thank you for considering us for your luxury getaway.</p>
                  
                  <div class="copyright">
                    © ${new Date().getFullYear()} Luxor Stay Villas | All rights reserved
                  </div>
                </div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    }

    await transporter.sendMail(mailOptions)
    return true
  } catch (error) {
    console.error("Error sending cancellation email:", error)
    throw error
  }
}

export default {
  sendBookingConfirmationEmail,
  sendCancellationEmail,
}
