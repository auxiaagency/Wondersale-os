import React, { useState } from 'react';
import {
  Printer,
  X,
  Copy,
  Check,
  FileText,
  FileDown,
  RotateCcw,
} from 'lucide-react';
import WhatsAppIcon from './WhatsAppIcon';
import { sendWhatsAppReceipt } from '../utils/whatsappService';
import { saveReceiptAsPdf, generateReceiptPdfBlob } from '../utils/saveReceiptAsPdf';
import {
  getReceiptTermsText,
  getReceiptTermsFontSize,
  renderFormattedTerms,
} from '../utils/receiptTermsSettings';

export default function ReceiptModal({
  order,
  stores = [],
  onClose,
  showNotification,
}) {
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [waCooldownActive, setWaCooldownActive] = useState(false);
  const [copiedInvoice, setCopiedInvoice] = useState(false);

  if (!order) return null;

  // Resolve store details
  const matchedStore = stores.find((s) => String(s.id) === String(order.store_id || order.store)) || {};
  const storeObj = {
    id: order.store_id || matchedStore.id,
    name: order.store_name || order.store_details?.name || matchedStore.name || 'Wondersale',
    address: order.store_details?.address || order.store_address || matchedStore.address || '',
    phone: order.store_details?.phone || order.store_phone || matchedStore.phone || '',
    gst_number: order.store_details?.gst_number || order.store_gst_number || matchedStore.gst_number || '',
  };

  const targetCustomer = {
    phone: order.customer_phone || (order.customer && order.customer.phone) || '',
    name: order.customer_name || (order.customer && order.customer.name) || 'Dear Customer',
  };

  const handleSendWhatsApp = async (force = false) => {
    setIsSendingWhatsApp(true);
    let pdfBlob = null;
    const receiptEl = document.getElementById('printable-pos-receipt');
    if (receiptEl) {
      try {
        pdfBlob = await generateReceiptPdfBlob(order.invoice_number || 'bill', receiptEl);
      } catch (e) {
        console.warn('Could not capture receipt blob from DOM, fallback to backend PDF:', e);
      }
    }

    try {
      await sendWhatsAppReceipt(
        order,
        storeObj,
        targetCustomer,
        (feedback) => {
          const isExchangeOrder = Boolean(
            order.is_exchange ||
            (order.invoice_number && String(order.invoice_number).startsWith('EXC-'))
          );
          const isReturnOrder = !isExchangeOrder && Boolean(
            order.is_return ||
            (order.invoice_number && String(order.invoice_number).startsWith('RET-')) ||
            order.return_reference ||
            order.status === 'refunded'
          );
          const typeLabel = isExchangeOrder ? 'Exchange bill' : isReturnOrder ? 'Return voucher' : 'Bill';
          if (feedback.success) {
            setWaCooldownActive(false);
            showNotification?.('success', feedback.message || `${typeLabel} #${order.invoice_number} sent directly to WhatsApp!`);
          } else {
            const msg = feedback.message || `Failed to send ${typeLabel.toLowerCase()} via WhatsApp.`;
            if (msg.toLowerCase().includes('wait') || msg.toLowerCase().includes('cooldown') || msg.toLowerCase().includes('recently')) {
              setWaCooldownActive(true);
            }
            showNotification?.('error', msg);
          }
        },
        pdfBlob,
        force
      );
    } catch (err) {
      showNotification?.('error', err?.message || 'Error sending WhatsApp receipt');
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const handleSaveAsPdf = async () => {
    const receiptEl = document.getElementById('printable-pos-receipt');
    try {
      await saveReceiptAsPdf(order, receiptEl);
      showNotification?.('success', `Receipt #${order.invoice_number || ''} saved as PDF!`);
    } catch (err) {
      showNotification?.('error', 'Failed to generate PDF: ' + (err.message || 'Unknown error'));
    }
  };

  const handleCopyInvoiceNumber = () => {
    if (!order.invoice_number) return;
    navigator.clipboard?.writeText(order.invoice_number);
    setCopiedInvoice(true);
    setTimeout(() => setCopiedInvoice(false), 2000);
  };

  const d = new Date(order.created_at || Date.now());
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const dateStr = `${day}-${month}-${year}`;
  const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const totalUnits = order.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || order.total_units || 1;
  const totalMrp = order.items?.reduce((sum, it) => {
    const mrpVal = parseFloat(it.mrp || it.item_mrp || it.unit_mrp || it.unit_selling_price || 0);
    return sum + mrpVal * (it.quantity || 1);
  }, 0) || parseFloat(order.subtotal || order.total_amount || 0);
  const totalSavings = Math.max(0, totalMrp - parseFloat(order.total_amount || order.grand_total || 0));
  const payMethod = (order.payment_method || 'cash').toLowerCase();
  const totalAmtFormatted = parseFloat(order.total_amount || order.grand_total || 0).toFixed(2);

  const storeContactParts = [];
  if (storeObj.address) storeContactParts.push(storeObj.address);
  if (storeObj.phone) storeContactParts.push(`M-${storeObj.phone}`);
  const storeContactLine = storeContactParts.join('. ');

  const customerReceiptName = order.customer_name || (order.customer_display_name && !order.customer_display_name.startsWith('Customer (') ? order.customer_display_name : '') || 'Walk-in Customer';
  const customerGstNumber = order.customer_gst_number || '';
  const isReceiptExchange = Boolean(
    order.is_exchange ||
    order.invoice_number?.startsWith('EXC-')
  );
  const isReceiptReturn = !isReceiptExchange && Boolean(
    order.is_return ||
    order.invoice_number?.startsWith('RET-') ||
    order.return_reference ||
    order.status === 'refunded'
  );

  return (
    <div
      className="receipt-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="receipt-modal-card"
        style={{
          width: '100%',
          maxWidth: '380px',
          maxHeight: '92vh',
          borderRadius: 'var(--radius-xl, 20px)',
          border: '1px solid #D1D5DB',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: '#FFFFFF',
          color: '#000000',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Printable Thermal Receipt Container matching exact 80mm Bixolon SRP-330 format (7.8cm - 8.0cm) */}
        <div
          id="printable-pos-receipt"
          style={{
            width: '100%',
            maxWidth: '340px',
            margin: '0 auto',
            padding: '12px 16px',
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 700,
            background: '#FFFFFF',
            color: '#000000',
            fontSize: '0.72rem',
            lineHeight: 1.35,
            boxSizing: 'border-box',
            overflowY: 'auto',
          }}
        >
          {/* Store Logo on Top & Tagline */}
          <div style={{ textAlign: 'center', marginBottom: '4px' }}>
            <img
              src="/assets/logo.svg"
              alt="Wondersale Logo"
              style={{ height: '62px', width: 'auto', objectFit: 'contain', margin: '0 auto 4px auto', display: 'block' }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <h2 style={{ fontSize: '1.45rem', fontWeight: 900, margin: 0, letterSpacing: '2px', color: '#DC2626', textTransform: 'uppercase' }}>
              WONDER SALE
            </h2>
            <div style={{ fontSize: '0.64rem', fontWeight: 800, letterSpacing: '2px', color: isReceiptReturn ? '#EF4444' : isReceiptExchange ? '#2563EB' : '#4B5563', textTransform: 'uppercase', marginTop: '2px' }}>
              {isReceiptReturn ? 'RETURN & REFUND VOUCHER' : isReceiptExchange ? 'EXCHANGE TAX INVOICE' : 'FOR BETTER NATION'}
            </div>
          </div>

          {/* Store Address & Contact */}
          {storeContactLine ? (
            <div style={{ textAlign: 'center', fontSize: '0.70rem', color: '#000000', paddingBottom: '6px', borderBottom: '1px dashed #000000', lineHeight: 1.35 }}>
              <div>{storeContactLine}</div>
            </div>
          ) : (
            <div style={{ borderBottom: '1px dashed #000000', marginBottom: '6px' }}></div>
          )}

          {/* Invoice Meta Grid */}
          <div style={{ padding: '6px 0', borderBottom: '1px dashed #000000', fontSize: '0.70rem', color: '#000000' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div><strong>{isReceiptReturn ? 'VOUCHER NO.' : isReceiptExchange ? 'EXCHANGE BILL NO.' : 'INVOICE NO.'} {order.invoice_number}</strong></div>
                {(isReceiptReturn || isReceiptExchange) && order.return_reference && (
                  <div><strong>Original Bill:</strong> #{order.return_reference}</div>
                )}
                <div>Name :- {customerReceiptName}</div>
                <div>Mobile No: {order.customer_phone || ''}</div>
                {customerGstNumber ? (
                  <div>Customer GSTIN : {customerGstNumber}</div>
                ) : null}
                <div>GST NO : {storeObj.gst_number || 'N/A'}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'right' }}>
                <div>Date:{dateStr}</div>
                <div>Time:{timeStr}</div>
                <div style={{ textTransform: 'capitalize' }}>
                  {isReceiptReturn
                    ? 'Refund Mode'
                    : 'Payment mode'}- {
                      payMethod === 'split'
                        ? 'Split (Cash + UPI)'
                        : payMethod === 'vip_card' || payMethod === 'card'
                        ? 'Card'
                        : payMethod === 'partial'
                        ? `Partial / Due (${(order.initial_payment_method || 'Cash').toUpperCase()})`
                        : (order.payment_method || 'Cash')
                    }
                </div>
              </div>
            </div>
          </div>

          {/* Line Items Table (Qty | MRP | Rate | Dis | Total) */}
          <div style={{ padding: '4px 0', borderBottom: '1px dashed #000000' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.70rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px dashed #000000', color: '#000000', fontWeight: 800 }}>
                  <th style={{ width: '12%', textAlign: 'left', padding: '2px 0' }}>Qty</th>
                  <th style={{ width: '22%', textAlign: 'right', padding: '2px 0' }}>MRP</th>
                  <th style={{ width: '22%', textAlign: 'right', padding: '2px 0' }}>Rate</th>
                  <th style={{ width: '18%', textAlign: 'right', padding: '2px 0' }}>Dis</th>
                  <th style={{ width: '26%', textAlign: 'right', padding: '2px 0' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map((item, i) => {
                  const mrpVal = parseFloat(item.mrp || item.item_mrp || item.unit_mrp || item.unit_selling_price || 0);
                  const rateVal = parseFloat(item.unit_selling_price || 0);
                  const discountVal = Math.max(0, (mrpVal - rateVal) * (item.quantity || 1));
                  const lineTotal = parseFloat(item.total_price || (rateVal * (item.quantity || 1)));
                  return (
                    <React.Fragment key={i}>
                      <tr>
                        <td colSpan={5} style={{ paddingTop: '5px', fontWeight: 800, color: '#000000', textTransform: 'uppercase', lineHeight: 1.25 }}>
                          {item.item_name}
                        </td>
                      </tr>
                      <tr style={{ borderBottom: i < order.items.length - 1 ? '1px dotted #E5E7EB' : 'none' }}>
                        <td style={{ textAlign: 'left', padding: '2px 0 5px 0' }}>{item.quantity}</td>
                        <td style={{ textAlign: 'right', padding: '2px 0 5px 0' }}>{mrpVal.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: '2px 0 5px 0' }}>{rateVal.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: '2px 0 5px 0' }}>{discountVal.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: '2px 0 5px 0', fontWeight: 800 }}>{lineTotal.toFixed(2)}</td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Payment Breakdown & Totals */}
          <div style={{ padding: '8px 0', borderBottom: '1px dashed #000000', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '0.70rem', lineHeight: 1.45 }}>
            {/* Left: Payment Mode Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', color: '#000000' }}>
              <div>Cash : {payMethod === 'cash' ? totalAmtFormatted : payMethod === 'split' ? parseFloat(order.split_cash_amount || 0).toFixed(2) : (payMethod === 'partial' && (order.initial_payment_method === 'cash' || !order.initial_payment_method)) ? parseFloat(order.amount_paid || 0).toFixed(2) : '0.00'}</div>
              <div>Card : {payMethod === 'vip_card' || payMethod === 'card' ? totalAmtFormatted : (payMethod === 'partial' && order.initial_payment_method === 'card') ? parseFloat(order.amount_paid || 0).toFixed(2) : '0'}</div>
              <div>UPI - {payMethod === 'upi' || payMethod === 'qr' ? totalAmtFormatted : payMethod === 'split' ? parseFloat(order.split_upi_amount || 0).toFixed(2) : (payMethod === 'partial' && order.initial_payment_method === 'upi') ? parseFloat(order.amount_paid || 0).toFixed(2) : '0'}</div>
              {(payMethod === 'partial' || parseFloat(order.balance_due || 0) > 0) && (
                <div style={{ marginTop: '3px', paddingTop: '3px', borderTop: '1px dotted #000000', fontWeight: 900, color: '#DC2626' }}>
                  DUE / KHATA: ₹{parseFloat(order.balance_due || 0).toFixed(2)}
                </div>
              )}
            </div>

            {/* Right: Totals Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', textAlign: 'right', color: '#000000' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px' }}>
                <span>Total Qty :</span>
                <strong>{totalUnits}</strong>
              </div>
              {totalSavings > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', color: '#DC2626', fontWeight: 800 }}>
                  <span>Total Saving :</span>
                  <span>{totalSavings.toFixed(totalSavings % 1 === 0 ? 0 : 2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px' }}>
                <span>Total Amount :</span>
                <span>{parseFloat(order.subtotal || order.total_amount || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', fontWeight: 900, fontSize: '0.82rem', borderTop: '1px dashed #000000', paddingTop: '3px', marginTop: '2px' }}>
                <span>Payable Amount :</span>
                <span>{totalAmtFormatted}</span>
              </div>
            </div>
          </div>

          {/* Footer Details */}
          <div style={{ paddingTop: '8px', fontSize: '0.70rem', display: 'flex', flexDirection: 'column', gap: '2px', color: '#000000' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Cashier Name - {order.cashier_name || 'Cashier'}</span>
            </div>
            {storeObj.gst_number ? (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>GSTIN No - {storeObj.gst_number}</span>
              </div>
            ) : null}
            <div style={{ textAlign: 'center', marginTop: '10px', fontWeight: 800, fontSize: '0.74rem', letterSpacing: '0.5px' }}>
              THANK YOU AND VISIT AGAIN
            </div>
          </div>

          {/* Terms & Conditions Section */}
          {(() => {
            const termsContent = getReceiptTermsText();
            const termsFontSize = getReceiptTermsFontSize();
            if (!termsContent) return null;
            return (
              <div
                style={{
                  marginTop: '10px',
                  paddingTop: '8px',
                  borderTop: '1px dashed #000000',
                  color: '#000000',
                }}
              >
                <div
                  style={{
                    textAlign: 'center',
                    fontWeight: 900,
                    fontSize: '0.76rem',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                  }}
                >
                  TERMS &amp; CONDITIONS
                </div>
                <div
                  style={{
                    fontSize: termsFontSize,
                    textAlign: 'left',
                    lineHeight: 1.35,
                    color: '#111827',
                  }}
                >
                  {renderFormattedTerms(termsContent)}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Action Controls */}
        <div
          className="no-print"
          style={{
            padding: '14px 18px',
            background: 'var(--card-bg, #FFFFFF)',
            borderTop: '1px solid var(--border-color, #E2E8F0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {order.notes && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(2, 132, 199, 0.08)',
                border: '1px solid rgba(2, 132, 199, 0.25)',
                color: 'var(--text-primary, #0F172A)',
                fontSize: '0.74rem',
              }}
            >
              <FileText size={16} color="#0284C7" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 800, color: '#0284C7', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Internal Sale Remark</span>
                  <span style={{ fontSize: '0.64rem', color: 'var(--text-muted, #64748B)', fontWeight: 500 }}>(Not on printed bill)</span>
                </div>
                <div style={{ color: 'var(--text-primary, #0F172A)', marginTop: '2px', wordBreak: 'break-word', lineHeight: 1.35, fontWeight: 500 }}>
                  {order.notes}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              onClick={() => handleSendWhatsApp(false)}
              disabled={isSendingWhatsApp}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: '#25D366',
                border: '1px solid #1EBE5D',
                color: '#FFFFFF',
                fontWeight: 800,
                padding: '9px 12px',
                borderRadius: '8px',
                cursor: isSendingWhatsApp ? 'not-allowed' : 'pointer',
                fontSize: '0.82rem',
                opacity: isSendingWhatsApp ? 0.75 : 1,
              }}
            >
              <WhatsAppIcon size={16} color="#FFFFFF" />
              <span>{isSendingWhatsApp ? 'Sending...' : 'WhatsApp'}</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: '#3B82F6',
                border: '1px solid #2563EB',
                color: '#FFFFFF',
                fontWeight: 700,
                padding: '9px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.82rem',
              }}
            >
              <Printer size={15} />
              <span>Print 80mm</span>
            </button>
          </div>

          {waCooldownActive && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', padding: '8px 12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.74rem', color: '#FBBF24', flex: 1, lineHeight: 1.3 }}>
                ⏳ <strong>Cooldown active:</strong> Need to bypass?
              </div>
              <button
                type="button"
                onClick={() => handleSendWhatsApp(true)}
                disabled={isSendingWhatsApp}
                style={{
                  padding: '5px 10px',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  background: '#F59E0B',
                  color: '#000000',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isSendingWhatsApp ? 'not-allowed' : 'pointer',
                }}
              >
                Force Send
              </button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <button
              type="button"
              onClick={handleSaveAsPdf}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.35)',
                color: '#60A5FA',
                fontSize: '0.8rem',
                fontWeight: 700,
                padding: '8px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <FileDown size={14} />
              <span>Save PDF</span>
            </button>

            <button
              type="button"
              onClick={handleCopyInvoiceNumber}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(107, 114, 128, 0.15)',
                border: '1px solid rgba(107, 114, 128, 0.3)',
                color: 'var(--text-secondary, #94A3B8)',
                fontSize: '0.8rem',
                fontWeight: 600,
                padding: '8px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              {copiedInvoice ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
              <span>{copiedInvoice ? 'Copied!' : 'Copy Inv #'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#EF4444',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '0.8rem',
                fontWeight: 700,
                padding: '8px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                marginLeft: 'auto',
              }}
            >
              <X size={14} />
              <span>Close</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
