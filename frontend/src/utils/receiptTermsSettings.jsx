import React from 'react';

export const DEFAULT_TERMS_AND_CONDITIONS = `1. **Check before you leave.** Please verify items, quantity, price, expiry date and working condition at the counter. Once the product leaves the shop, we are not responsible for any shortage, damage or malfunction.
2. **No warranty.** Most of our products are imported/generic and carry no warranty unless stated in writing on this bill. We are not liable for malfunction or failure after sale.
3. **Returns/exchange.** Only for a genuine reason (wrong, defective or damaged item at the time of sale), reported within [2] days, with this bill, and with the item unused and in original packaging. No bill, no return.
4. **No return on:** food and perishables, opened or used items, personal-care items, items damaged by misuse, water or burning, and discounted or clearance items.
5. **Online/delivery orders.** We test items before dispatch. Please record an **unboxing video** (opening the parcel, uncut and continuous, with the bill visible) and test the product immediately on receipt. Claims without this video will not be accepted. Report issues within [24–48 hours].
6. **Refunds.** Approved refunds are made in the original payment mode, or as an exchange or store credit, at our discretion. Delivery or handling charges are non-refundable.
7. **Electronics.** Please check the plug, charging and battery before leaving. Any repair or warranty is handled by the manufacturer only, if one exists.
8. **Prices and payment.** Prices include applicable taxes. Prices may change without notice. Cheque or UPI payments are valid only after the amount is received.
9. **Bill is proof of purchase.** Keep it safe. Errors must be reported at the time of billing.
10. **Disputes** are subject to [Bhopal] jurisdiction only.`;

export const STORAGE_KEY_TERMS_TEXT = 'wondersale_receipt_terms_text';
export const STORAGE_KEY_TERMS_FONT_SIZE = 'wondersale_receipt_terms_font_size'; // e.g., '0.58rem', '0.64rem', '0.70rem'

export function getReceiptTermsText() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_TERMS_TEXT);
    if (saved !== null && saved !== undefined && saved.trim() !== '') {
      return saved;
    }
  } catch (e) {}
  return DEFAULT_TERMS_AND_CONDITIONS;
}

export function saveReceiptTermsText(text) {
  try {
    localStorage.setItem(STORAGE_KEY_TERMS_TEXT, text);
    window.dispatchEvent(new CustomEvent('wondersale_terms_settings_changed', { detail: { text } }));
  } catch (e) {}
}

export function getReceiptTermsFontSize() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_TERMS_FONT_SIZE);
    if (saved) return saved;
  } catch (e) {}
  return '0.58rem';
}

export function saveReceiptTermsFontSize(size) {
  try {
    localStorage.setItem(STORAGE_KEY_TERMS_FONT_SIZE, size);
    window.dispatchEvent(new CustomEvent('wondersale_terms_settings_changed', { detail: { fontSize: size } }));
  } catch (e) {}
}

/**
 * Parses markdown-style **bold** text into React elements.
 */
export function renderFormattedTerms(rawText) {
  if (!rawText) return null;
  const lines = rawText.split('\n');
  return lines.map((line, lineIdx) => {
    if (!line.trim()) {
      return <div key={lineIdx} style={{ height: '4px' }} />;
    }
    // Match **bold** tokens
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <div key={lineIdx} style={{ marginBottom: '2.5px', lineHeight: 1.35 }}>
        {parts.map((part, partIdx) => {
          if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
            return (
              <strong key={partIdx} style={{ fontWeight: 800, color: '#000000' }}>
                {part.slice(2, -2)}
              </strong>
            );
          }
          return <span key={partIdx}>{part}</span>;
        })}
      </div>
    );
  });
}

/**
 * Formats terms for WhatsApp markdown.
 * In WhatsApp, *text* is bold. We transform **text** to *text*.
 */
export function formatTermsForWhatsApp(rawText) {
  if (!rawText) return '';
  return rawText.replace(/\*\*([^*]+)\*\*/g, '*$1*');
}
