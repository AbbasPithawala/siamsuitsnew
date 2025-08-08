import jsPDF from "jspdf";
import QRCode from "qrcode";
import Logo from "../images/logo.png";
import mainQR from "../images/PDFQR.png";
import "../fonts/THSarabunNewRegular-normal";
import "../fonts/Itim Regular-normal";

export const generateJobPDF = async (options) => {
  const {
    job,
    extraPaymentCategories = [],
    selectedExtraPayments = [], // Array of selected extra payment category IDs
    selectedExtraPaymentsCost = 0,
    jobType = 'job',
    printType = 'new' // 'new' for first print, 'copy' for reprint
  } = options;

  console.log("=== PDF Generation Debug ===");
  console.log("jobType:", jobType);
  console.log("printType:", printType);
  console.log("job_id:", job?._id);
  console.log("typeof job_id:", typeof job?._id);

  if (!job) {
    console.error("No job provided for PDF generation");
    return;
  }

  // Create a copy to avoid mutating original job object
  const ArrayPDF = { ...job };

  // Process extra payments
  if (ArrayPDF['extraPayments']?.length > 0) {
    for (let x of ArrayPDF['extraPayments']) {
      const category = extraPaymentCategories.find(single => single['_id'] === x['extraPaymentCategory']);
      if (category) {
        x['nameOfCategory'] = category['name'];
        if (category['thai_name']) {
          x['thai_category_name'] = category['thai_name'];
        }
      }
    }
  }

  console.log("Processed job data:", ArrayPDF);

  // Calculate total cost
  let totalCost = ArrayPDF['cost'] || 0;
  
  // Add existing extra payments cost
  if (ArrayPDF['extraPayments']?.length > 0) {
    for (let x of ArrayPDF['extraPayments']) {
      if (x['approved'] && x['status'] !== false) {
        totalCost += x.cost;
      }
    }
  }

  // Add styling price
  if (ArrayPDF['stylingprice'] && Object.keys(ArrayPDF['stylingprice']).length > 0) {
    for (let value of Object.values(ArrayPDF['stylingprice'])) {
      totalCost += Number(value);
    }
  }

  // Add selected extra payments cost
  totalCost += selectedExtraPaymentsCost;

  // Create PDF
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 290],
  });

  function toTitleCase(text) {
    return text?.toLowerCase().split(' ').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ') || '';
  }

  // Helper function to detect Thai text
  function isThaiText(text) {
    if (!text) return false;
    // Thai Unicode range: U+0E00–U+0E7F
    const thaiRegex = /[\u0E00-\u0E7F]/;
    return thaiRegex.test(text);
  }

  // Helper function to render text with appropriate font
  function renderText(doc, text, x, y, options = {}) {
    if (isThaiText(text)) {
      // Set Thai font with enhanced styling
      doc.setFont('THSarabunNewRegular', 'normal');
      
      // Increase font size for Thai text to match visual weight
      const currentFontSize = doc.getFontSize();
      doc.setFontSize(currentFontSize + 3);
      
      // Add character spacing for Thai text
      const modifiedOptions = { 
        ...options, 
        charSpace: 0.2 // Reduced character spacing
      };
      
      // Render once without bold effect
      doc.text(text, x, y, modifiedOptions);
      
      // Reset font size
      doc.setFontSize(currentFontSize);
    } else {
      doc.setFont('helvetica', options.fontStyle || 'normal');
      doc.text(text, x, y, options);
    }
  }

  // Logo
  doc.addImage(Logo, 'PNG', 25, 2, 30, 10);

  // Generate dynamic QR code with job ID
  try {
    console.log("Generating QR code for:", job._id);
    const qrCodeDataUrl = await QRCode.toDataURL(String(job._id), {
      width: 150,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    });
    console.log("QR code generated successfully");
    
    // QR code with job ID
    doc.addImage(qrCodeDataUrl, 'PNG', 30, 17, 20, 20);
  } catch (qrError) {
    console.error('Error generating QR code:', qrError);
    // Fallback to static QR if generation fails
    doc.addImage(mainQR, 'PNG', 30, 17, 20, 20);
  }

  // Order Info
  doc.setFontSize(10);
  renderText(doc, `Name: ${ArrayPDF?.tailor?.firstname || ''} ${ArrayPDF?.tailor?.lastname || ''}`, 5, 45);
  renderText(doc, `Date: ${new Date(ArrayPDF?.date).toLocaleDateString()}`, 5, 51);
  renderText(doc, `Order No.: ${ArrayPDF?.order_id?.orderId || ArrayPDF?.group_order_id?.orderId || ''}`, 5, 57);

  // Category
  doc.setFont('helvetica', 'bold');
  doc.text('Category', 5, 67);
  doc.text('Price', 65, 67, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  renderText(doc, `${toTitleCase(ArrayPDF?.process?.name)}`, 5, 75);
  renderText(doc, `${ArrayPDF?.cost || 0}`, 65, 75, { align: 'right' });

  let yPos = 85;

  // Extra Payments (existing)
  if (ArrayPDF['extraPayments']?.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Extra Category', 5, yPos);
    doc.text('Price', 65, yPos, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    yPos += 7;

    ArrayPDF['extraPayments'].forEach((item) => {
      if (item['approved'] && item['status'] !== false) {
        renderText(doc, toTitleCase(item.nameOfCategory), 5, yPos);
        renderText(doc, String(item.cost), 65, yPos, { align: 'right' });
        yPos += 5;

        if (item['thai_category_name']) {
          renderText(doc, item['thai_category_name'], 5, yPos);
          yPos += 5;
        }
      }
    });
  }

  // Selected Extra Payment Categories (newly added)
  if (selectedExtraPayments.length > 0) {
    const selectedExtraPaymentDetails = extraPaymentCategories.filter(epc => 
      selectedExtraPayments.includes(epc['_id'])
    );

    if (selectedExtraPaymentDetails.length > 0) {
      if (ArrayPDF['extraPayments']?.length === 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('Extra Category', 5, yPos);
        doc.text('Price', 65, yPos, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        yPos += 7;
      }

      selectedExtraPaymentDetails.forEach((item) => {
        renderText(doc, toTitleCase(item.name), 5, yPos);
        renderText(doc, String(item.cost), 65, yPos, { align: 'right' });
        yPos += 5;

        if (item['thai_name']) {
          renderText(doc, item['thai_name'], 5, yPos);
          yPos += 5;
        }
      });
    }
  }

  // Styling Price
  if (ArrayPDF['stylingprice'] && Object.keys(ArrayPDF['stylingprice']).length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Stylings', 5, yPos);
    doc.text('Price', 65, yPos, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    yPos += 7;

    Object.entries(ArrayPDF['stylingprice']).forEach(([key, value]) => {
      renderText(doc, toTitleCase(key), 5, yPos);
      renderText(doc, String(value), 65, yPos, { align: 'right' });
      yPos += 5;
    });
  }

  // Total
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  renderText(doc, 'Total:', 5, yPos + 5, { fontStyle: 'bold' });
  renderText(doc, String(totalCost), 65, yPos + 5, { align: 'right', fontStyle: 'bold' });

  // Add watermark if it's a copy
  if (printType === 'copy') {
    // Save current state
    const currentFontSize = doc.getFontSize();
    const currentTextColor = doc.getTextColor();
    
    // Set watermark style
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(60);
    doc.setTextColor(180, 180, 180); // Light gray color
    
    // Add watermark text
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({opacity: 0.4})); // Set transparency
    
    // Position watermark in center horizontally and lower vertically
    const watermarkX = 50; // Center of page width (80mm / 2)
    const watermarkY = 80; // Position lower but not in vertical center
    
    // Set outline style for text
    doc.setDrawColor(180, 180, 180); // Same color for outline
    doc.setLineWidth(0.3); // Thin outline
    
    // Rotate and add watermark text with outline style
    doc.text('COPY', watermarkX, watermarkY, {
      angle: 45,
      align: 'center',
      baseline: 'middle',
      renderingMode: 'stroke' // This creates outline text instead of filled
    });
    
    doc.restoreGraphicsState();
    
    // Restore original state
    doc.setFontSize(currentFontSize);
    doc.setTextColor(currentTextColor);
  }

  // Open print dialog directly with hidden iframe
  const pdfBlob = doc.output('blob');
  const blobUrl = URL.createObjectURL(pdfBlob);
  
  // Create hidden iframe for direct printing
  const printFrame = document.createElement('iframe');
  printFrame.style.display = 'none';
  printFrame.src = blobUrl;
  document.body.appendChild(printFrame);
  
  printFrame.onload = function() {
    setTimeout(function() {
      try {
        printFrame.contentWindow.print();
        
        // Listen for afterprint event to clean up properly
        printFrame.contentWindow.addEventListener('afterprint', function() {
          setTimeout(() => {
            if (document.body.contains(printFrame)) {
              document.body.removeChild(printFrame);
            }
            URL.revokeObjectURL(blobUrl);
          }, 500);
        });
        
        // Fallback cleanup in case afterprint doesn't fire
        setTimeout(() => {
          if (document.body.contains(printFrame)) {
            document.body.removeChild(printFrame);
          }
          URL.revokeObjectURL(blobUrl);
        }, 30000); // 30 seconds fallback
        
      } catch (error) {
        console.error('Print error:', error);
        // Clean up on error
        if (document.body.contains(printFrame)) {
          document.body.removeChild(printFrame);
        }
        URL.revokeObjectURL(blobUrl);
      }
    }, 1000); // Increased delay to ensure PDF is fully loaded
  };
}; 