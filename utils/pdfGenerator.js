import pdfMake from "pdfmake/build/pdfmake"
import pdfFonts from "pdfmake/build/vfs_fonts"

pdfMake.vfs = pdfFonts.pdfMake.vfs

/**
 * Generates a booking PDF.
 * @param {Object} booking - The booking object.
 * @param {Object} villa - The villa object.
 * @returns {Promise<string>} - The path to the generated PDF.
 */
export const generateBookingPDF = async (booking, villa) => {
  try {
    // Format dates
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

    // Booking Reference
    const bookingReference = String(booking._id).substring(0, 8).toUpperCase()

    // Define document content
    const documentDefinition = {
      content: [
        { text: "Booking Confirmation", style: "header" },
        { text: `Booking Reference: #${bookingReference}`, style: "subheader" },
        { text: `Villa: ${villa.name}`, style: "paragraph" },
        { text: `Check-in: ${formattedCheckIn}`, style: "paragraph" },
        { text: `Check-out: ${formattedCheckOut}`, style: "paragraph" },
        {
          text: `Guests: ${booking.guests}${booking.infants > 0 ? ` adult(s), ${booking.infants} infant(s)` : " guest(s)"}`,
          style: "paragraph",
        },
        { text: `Total Amount: ₹${booking.totalAmount.toLocaleString()}`, style: "paragraph" },
        { text: "Thank you for your booking!", style: "footer" },
      ],
      styles: {
        header: {
          fontSize: 22,
          bold: true,
          margin: [0, 0, 0, 20],
        },
        subheader: {
          fontSize: 16,
          bold: true,
          margin: [0, 0, 0, 10],
        },
        paragraph: {
          fontSize: 12,
          margin: [0, 0, 0, 5],
        },
        footer: {
          fontSize: 10,
          italics: true,
          margin: [0, 50, 0, 0],
        },
      },
    }

    // Generate PDF
    const pdfDoc = pdfMake.createPdf(documentDefinition)

    // Convert PDF to data URL
    return new Promise((resolve, reject) => {
      pdfDoc.getBase64((data) => {
        // Save the PDF to a temporary file (using booking reference as filename)
        const fs = require("fs") // only import fs when needed
        const pdfPath = `temp_booking_${bookingReference}.pdf`
        const buffer = Buffer.from(data, "base64")
        fs.writeFile(pdfPath, buffer, (err) => {
          if (err) {
            console.error("Error saving PDF:", err)
            reject(err)
          } else {
            resolve(pdfPath)
          }
        })
      })
    })
  } catch (error) {
    console.error("Error generating PDF:", error)
    throw error
  }
}
