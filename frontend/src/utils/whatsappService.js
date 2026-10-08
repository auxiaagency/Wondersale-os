/**
 * WhatsApp Invoice Messaging & Meta Cloud API Service
 *
 * Designed to provide:
 * 1. Clean, concise, professional message (Bill/Receipt attached alongside).
 * 2. Safe Architecture: Zero frontend credential exposure. When Meta API is used,
 *    the frontend makes a request to Django backend, which pulls keys safely
 *    from server-side environment variables (.env).
 */

import { sendSaleOrderWhatsApp } from '../api';

/**
 * Builds a clean, compact WhatsApp message suitable when the bill/receipt is attached.
 */
export function buildWhatsAppInvoiceMessage(order, activeStore = null, customer = null) {
  if (!order) return '';

  const storeName = order.store_name || order.store_details?.name || activeStore?.name || 'Wondersale';
  const invoiceNumber = order.invoice_number || 'N/A';

  const orderDate = order.created_at ? new Date(order.created_at) : new Date();
  const dateStr = orderDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const rawPhone = customer?.phone || order.customer_phone || '';
  const cleanPhone = rawPhone.replace(/\D/g, '');
  const custName =
    customer?.name ||
    order.customer_name ||
    (order.customer_display_name && !order.customer_display_name.startsWith('Customer (') ? order.customer_display_name : '') ||
    cleanPhone ||
    'Dear Customer';

  const isReturn = Boolean(
    order.is_return ||
    (order.invoice_number && String(order.invoice_number).startsWith('RET-')) ||
    order.return_reference ||
    order.status === 'refunded'
  );

  const grandTotalVal = parseFloat(order.total_amount || 0).toFixed(2);
  const totalUnits =
    order.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) ||
    order.items?.length ||
    1;

  if (isReturn) {
    return (
      `🔄 *${storeName.toUpperCase()} - RETURN VOUCHER*\n\n` +
      `Hello *${custName}*,\n` +
      `Your return voucher *#${invoiceNumber}* for *₹${grandTotalVal}* has been issued.\n` +
      `Please find your detailed credit receipt attached below.\n\n` +
      `✨ *Thank you for visiting ${storeName}!*`
    );
  }

  const paymentModeStr =
    order.payment_method === 'split'
      ? 'Split (Cash+UPI)'
      : order.payment_method === 'vip_card'
      ? 'VIP Card'
      : String(order.payment_method || 'Cash').toUpperCase();

  // Concise, professional companion message for attached bill/receipt
  return (
    `🛍️ *${storeName.toUpperCase()} - TAX INVOICE*\n\n` +
    `Hello *${custName}*,\n` +
    `Thank you for shopping with us! Here is your bill summary:\n\n` +
    `📄 *Invoice No:* #${invoiceNumber}\n` +
    `📅 *Date:* ${dateStr} ${timeStr}\n` +
    `📦 *Items:* ${totalUnits} ${totalUnits === 1 ? 'unit' : 'units'}\n` +
    `💳 *Payment Mode:* ${paymentModeStr}\n` +
    `💰 *Grand Total:* ₹${grandTotalVal}\n\n` +
    `📎 *Your detailed tax invoice receipt is attached with this message.*\n\n` +
    `✨ *Thank you for shopping with ${storeName}! Visit us again soon.*`
  );
}

/**
 * Dispatches the WhatsApp message directly via Meta WhatsApp Cloud API.
 * Never redirects the browser to WhatsApp Web or external browser windows.
 */
export async function sendWhatsAppReceipt(order, activeStore = null, customer = null, onFeedback = null, pdfBlob = null, forceResend = false) {
  if (!order) return false;

  const rawPhone = customer?.phone || order.customer_phone || (order.customer && order.customer.phone) || '';
  let cleanPhone = String(rawPhone).replace(/\D/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = `91${cleanPhone}`;
  }

  if (!order.id) {
    const errorMsg = 'Cannot send bill via WhatsApp: Missing order ID.';
    if (onFeedback && typeof onFeedback === 'function') {
      onFeedback({
        success: false,
        method: 'cloud_api',
        message: errorMsg
      });
    }
    return false;
  }

  if (!cleanPhone) {
    const errorMsg = 'Cannot send WhatsApp bill: Customer phone number is missing or invalid.';
    if (onFeedback && typeof onFeedback === 'function') {
      onFeedback({
        success: false,
        method: 'cloud_api',
        message: errorMsg
      });
    }
    return false;
  }

  const isReturn = Boolean(
    order.is_return ||
    (order.invoice_number && String(order.invoice_number).startsWith('RET-')) ||
    order.return_reference ||
    order.status === 'refunded'
  );
  const itemLabel = isReturn ? 'Return voucher' : 'Bill';

  try {
    const res = await sendSaleOrderWhatsApp(order.id, cleanPhone, pdfBlob || null, forceResend);
    if (res && res.success) {
      if (onFeedback && typeof onFeedback === 'function') {
        onFeedback({
          success: true,
          method: 'cloud_api',
          message: `${itemLabel} #${order.invoice_number} sent directly to WhatsApp (${cleanPhone.slice(-10)})!`
        });
      }
      return true;
    } else {
      const errMsg = (res && res.error) || `Failed to send ${itemLabel.toLowerCase()} via WhatsApp Cloud API.`;
      if (onFeedback && typeof onFeedback === 'function') {
        onFeedback({
          success: false,
          method: 'cloud_api',
          message: errMsg
        });
      }
      return false;
    }
  } catch (err) {
    console.error('Meta WhatsApp Cloud API error:', err);
    const errMsg = err.message || `Error occurred while sending ${itemLabel.toLowerCase()} to WhatsApp.`;
    if (onFeedback && typeof onFeedback === 'function') {
      onFeedback({
        success: false,
        method: 'cloud_api',
        message: errMsg
      });
    }
    return false;
  }
}


