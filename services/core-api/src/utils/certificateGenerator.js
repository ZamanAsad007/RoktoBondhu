const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

/**
 * Generate a unique donation certificate number
 * Format: RB-YYYYMMDD-XXXXX
 */
function generateCertificateNumber(donatedAt = new Date()) {
  const dateStr = donatedAt.toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `RB-${dateStr}-${randomSuffix}`;
}

/**
 * Generate Certificate PDF stream
 * @param {Object} data
 * @param {string} data.donorName
 * @param {string} data.bloodGroup
 * @param {string} data.certificateNo
 * @param {string|Date} data.donatedAt
 * @param {string} [data.hospitalName]
 * @param {string} [data.city]
 * @param {stream.Writable} outputStream
 */
async function generateCertificatePdf(data, outputStream) {
  const doc = new PDFDocument({
    layout: 'landscape',
    size: 'A4',
    margin: 40,
  });

  doc.pipe(outputStream);

  const donatedDate = new Date(data.donatedAt || Date.now()).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Certificate Outer & Inner Border
  doc.rect(20, 20, 802, 555).lineWidth(4).stroke('#B91C1C'); // Crimson
  doc.rect(26, 26, 790, 543).lineWidth(1).stroke('#991B1B');

  // Decorative top bar
  doc.rect(20, 20, 802, 12).fill('#B91C1C');

  // Header Title
  doc.fillColor('#991B1B')
     .fontSize(28)
     .font('Helvetica-Bold')
     .text('ROKTOBONDHU (রক্তবন্ধু)', 40, 60, { align: 'center' });

  doc.fillColor('#4B5563')
     .fontSize(14)
     .font('Helvetica')
     .text('CERTIFICATE OF APPRECIATION FOR VOLUNTARY BLOOD DONATION', 40, 95, { align: 'center' });

  // Divider
  doc.moveTo(150, 120).lineTo(692, 120).lineWidth(1.5).stroke('#DC2626');

  // Presentation text
  doc.fillColor('#374151')
     .fontSize(13)
     .font('Helvetica')
     .text('This certificate is proudly awarded to', 40, 145, { align: 'center' });

  // Donor Name
  doc.fillColor('#111827')
     .fontSize(26)
     .font('Helvetica-Bold')
     .text(data.donorName || 'Honorable Donor', 40, 175, { align: 'center' });

  // Blood Group Pill
  doc.fillColor('#DC2626')
     .fontSize(16)
     .font('Helvetica-Bold')
     .text(`Blood Group: ${data.bloodGroup || 'Volunteer'}`, 40, 215, { align: 'center' });

  // Appreciation Message
  const hospitalText = data.hospitalName ? ` at ${data.hospitalName}` : '';
  const cityText = data.city ? ` (${data.city})` : '';
  doc.fillColor('#4B5563')
     .fontSize(12)
     .font('Helvetica')
     .text(
       `For demonstrating profound humanity, courage, and community spirit by selflessly donating blood${hospitalText}${cityText} on ${donatedDate}. Your voluntary contribution directly saved a human life.`,
       120,
       245,
       { align: 'center', width: 602, lineGap: 4 }
     );

  // Generate QR Code Buffer
  const qrUrl = `https://roktobondhu.org/verify/${data.certificateNo}`;
  const qrBuffer = await QRCode.toBuffer(qrUrl, {
    width: 90,
    margin: 1,
    color: {
      dark: '#1F2937',
      light: '#FFFFFF',
    },
  });

  // Position QR Code bottom left
  doc.image(qrBuffer, 120, 370, { width: 85, height: 85 });
  doc.fillColor('#6B7280')
     .fontSize(8)
     .font('Helvetica')
     .text(`Verify Authenticity`, 115, 460, { width: 95, align: 'center' });

  // Signatures and Metadata bottom
  doc.fillColor('#1F2937')
     .fontSize(11)
     .font('Helvetica-Bold')
     .text(`Certificate No: ${data.certificateNo}`, 40, 395, { align: 'center' });

  doc.fillColor('#4B5563')
     .fontSize(10)
     .font('Helvetica')
     .text(`Date of Issue: ${donatedDate}`, 40, 415, { align: 'center' });

  doc.fillColor('#9CA3AF')
     .fontSize(9)
     .font('Helvetica-Oblique')
     .text('"Every drop counts. A single donation can save up to three lives."', 40, 490, { align: 'center' });

  // Bottom bar
  doc.rect(20, 563, 802, 12).fill('#B91C1C');

  doc.end();
}

module.exports = {
  generateCertificateNumber,
  generateCertificatePdf,
};
