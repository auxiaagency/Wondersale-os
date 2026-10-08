/**
 * saveReceiptAsPdf.js
 * Captures the #printable-pos-receipt element into a tightly-sized PDF matching
 * the exact receipt dimensions from the top logo down through all Terms & Conditions
 * with zero emptiness, zero cutoff, and downloads directly to user's device.
 *
 * @param {string} invoiceNumber – used as the file name
 */
export async function generateReceiptPdfDoc(invoiceNumber = 'bill', targetElement = null) {
  const element = targetElement || document.getElementById('printable-pos-receipt');
  if (!element) return null;

  // Dynamically import heavy libraries
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  // Create an off-screen clone container attached to document.body
  // This completely eliminates modal scroll containers, overflow clipping,
  // viewport bounds, and window scroll offsets.
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '380px';
  container.style.margin = '0';
  container.style.padding = '0';
  container.style.background = '#ffffff';
  container.style.zIndex = '-9999';
  container.style.overflow = 'visible';

  // Deep clone the printable receipt
  const clonedElement = element.cloneNode(true);
  clonedElement.id = 'printable-pos-receipt-pdf-clone';
  clonedElement.style.width = '100%';
  clonedElement.style.maxWidth = '360px';
  clonedElement.style.height = 'auto';
  clonedElement.style.maxHeight = 'none';
  clonedElement.style.overflow = 'visible';
  clonedElement.style.overflowY = 'visible';
  clonedElement.style.flex = 'none';
  clonedElement.style.boxSizing = 'border-box';
  clonedElement.style.backgroundColor = '#ffffff';
  clonedElement.style.color = '#000000';

  // Ensure all children in the clone have overflow visible and no height clipping
  const allClonedChildren = clonedElement.querySelectorAll('*');
  allClonedChildren.forEach((child) => {
    if (child.style) {
      if (child.style.maxHeight && child.style.maxHeight !== 'none') {
        child.style.maxHeight = 'none';
      }
      if (child.style.overflow && child.style.overflow !== 'visible') {
        child.style.overflow = 'visible';
      }
      if (child.style.overflowY && child.style.overflowY !== 'visible') {
        child.style.overflowY = 'visible';
      }
    }
  });

  container.appendChild(clonedElement);
  document.body.appendChild(container);

  try {
    // Wait for fonts & DOM reflow (max 600ms guard)
    if (document.fonts && document.fonts.ready) {
      await Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 600)),
      ]);
    } else {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Render clone to canvas with exact full natural dimensions & 4-second timeout guard
    const renderCanvasPromise = html2canvas(clonedElement, {
      scale: 3,                   // 3x high DPI for crisp print quality
      useCORS: true,              // support logo images
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 1200,
      windowHeight: Math.max(clonedElement.scrollHeight + 500, 2000),
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
      width: clonedElement.offsetWidth || 360,
      height: clonedElement.scrollHeight || clonedElement.offsetHeight,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Receipt canvas rendering timed out after 4 seconds')), 4000)
    );

    const canvas = await Promise.race([renderCanvasPromise, timeoutPromise]);

    const imgData = canvas.toDataURL('image/png');

    // Calculate exact physical dimensions for receipt PDF (78mm standard POS width)
    const pxToMm = (px) => (px * 25.4) / 96;
    const targetWidthMm = 78; // standard 80mm POS paper width minus margins
    const targetHeightMm = targetWidthMm * (canvas.height / canvas.width);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [targetWidthMm, targetHeightMm], // Custom single continuous page
      compress: true,
    });

    pdf.addImage(imgData, 'PNG', 0, 0, targetWidthMm, targetHeightMm, undefined, 'FAST');

    return pdf;
  } catch (err) {
    console.warn('generateReceiptPdfDoc encountered error/timeout:', err);
    return null;
  } finally {
    // Clean up temporary DOM clone
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

/**
 * Generates the receipt PDF as a Blob object for uploading to Meta WhatsApp Cloud API.
 */
export async function generateReceiptPdfBlob(invoiceNumber = 'bill', targetElement = null) {
  try {
    const pdf = await generateReceiptPdfDoc(invoiceNumber, targetElement);
    if (!pdf) return null;
    const blob = pdf.output('blob');
    return blob;
  } catch (err) {
    console.warn('generateReceiptPdfBlob failed:', err);
    return null;
  }
}

/**
 * Downloads the receipt PDF directly to user's device.
 */
export async function saveReceiptAsPdf(invoiceNumber = 'bill', targetElement = null) {
  try {
    const pdf = await generateReceiptPdfDoc(invoiceNumber, targetElement);
    if (!pdf) return;
    const safeInv = String(invoiceNumber).replace(/[^\w\-]/g, '_');
    pdf.save(`Wondersale_Invoice_${safeInv}.pdf`);
  } catch (err) {
    console.error('Failed to generate receipt PDF:', err);
  }
}


