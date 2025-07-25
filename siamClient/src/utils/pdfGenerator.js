import jsPDF from "jspdf";
import QRCode from "qrcode";
import Logo from "../images/logo.png";
import mainQR from "../images/PDFQR.png";

export const generateJobPDF = async (options) => {
  const {
    job,
    extraPaymentCategories = [],
    selectedExtraPayments = [], // Array of selected extra payment category IDs
    selectedExtraPaymentsCost = 0,
    jobType = 'job'
  } = options;

  console.log("=== PDF Generation Debug ===");
  console.log("jobType:", jobType);
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
  doc.text(`Name: ${ArrayPDF?.tailor?.firstname || ''} ${ArrayPDF?.tailor?.lastname || ''}`, 5, 45);
  doc.text(`Date: ${new Date(ArrayPDF?.date).toLocaleDateString()}`, 5, 51);
  doc.text(`Order No.: ${ArrayPDF?.order_id?.orderId || ArrayPDF?.group_order_id?.orderId || ''}`, 5, 57);

  // Category
  doc.setFont('helvetica', 'bold');
  doc.text('Category', 5, 67);
  doc.text('Price', 65, 67, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.text(`${toTitleCase(ArrayPDF?.process?.name)}`, 5, 75);
  doc.text(`${ArrayPDF?.cost || 0}`, 65, 75, { align: 'right' });

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
        doc.text(toTitleCase(item.nameOfCategory), 5, yPos);
        doc.text(String(item.cost), 65, yPos, { align: 'right' });
        yPos += 5;

        if (item['thai_category_name']) {
          doc.text(item['thai_category_name'], 5, yPos);
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
        doc.text(toTitleCase(item.name), 5, yPos);
        doc.text(String(item.cost), 65, yPos, { align: 'right' });
        yPos += 5;

        if (item['thai_name']) {
          doc.text(item['thai_name'], 5, yPos);
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
      doc.text(toTitleCase(key), 5, yPos);
      doc.text(String(value), 65, yPos, { align: 'right' });
      yPos += 5;
    });
  }

  // Total
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total:', 5, yPos + 5);
  doc.text(String(totalCost), 65, yPos + 5, { align: 'right' });

  // Open in popup window
  const pdfBlob = doc.output('blob');
  const blobUrl = URL.createObjectURL(pdfBlob);
  const popup = window.open("", "pdfPopup", "width=800,height=600");

  if (popup) {
    popup.document.write(`
      <html>
        <head><title>PDF Preview</title></head>
        <body style="margin:0">
          <embed width="100%" height="100%" src="${blobUrl}" type="application/pdf" />
        </body>
      </html>
    `);
  } else {
    alert("Popup blocked! Please allow popups for this site.");
  }
}; 