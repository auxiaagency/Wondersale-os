import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  RotateCcw,
  Search,
  X,
  AlertCircle,
  CheckCircle2,
  Package,
  Calendar,
  User,
  CreditCard,
  Coins,
  ArrowRight,
  Printer,
  ChevronLeft,
  Info,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import { lookupSaleOrderForReturn, processSaleOrderReturn } from '../api';

export default function ProductReturnModal({
  isOpen,
  onClose,
  activeShift = null,
  currentUser = null,
  onReturnSuccess = null,
}) {
  const [step, setStep] = useState('search'); // 'search' | 'items' | 'success'
  const [invoiceInput, setInvoiceInput] = useState('');
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [lookupError, setLookupError] = useState('');

  const [billData, setBillData] = useState(null);
  const [returnQuantities, setReturnQuantities] = useState({});
  const [refundMethod, setRefundMethod] = useState('cash');
  const [returnNotes, setReturnNotes] = useState('Customer Return');
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState('');

  const [returnResult, setReturnResult] = useState(null);

  const searchInputRef = useRef(null);

  // Auto-focus search input on modal open
  useEffect(() => {
    if (isOpen) {
      setStep('search');
      setInvoiceInput('');
      setLookupError('');
      setBillData(null);
      setReturnQuantities({});
      setProcessError('');
      setReturnResult(null);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Total return units and total refund amount
  const { totalUnitsToReturn, totalRefundAmount } = useMemo(() => {
    if (!billData?.items) return { totalUnitsToReturn: 0, totalRefundAmount: 0 };
    let units = 0;
    let amount = 0;

    billData.items.forEach((line) => {
      const qty = returnQuantities[line.id] || 0;
      if (qty > 0) {
        units += qty;
        const unitPrice = parseFloat(line.effective_unit_price ?? line.unit_selling_price ?? 0);
        amount += qty * unitPrice;
      }
    });

    return {
      totalUnitsToReturn: units,
      totalRefundAmount: Math.round(amount * 100) / 100,
    };
  }, [billData, returnQuantities]);

  if (!isOpen) return null;

  // Handle Bill Lookup
  const handleLookup = async (e) => {
    e?.preventDefault();
    const query = invoiceInput.trim();
    if (!query) {
      setLookupError('Please enter a valid bill or invoice number.');
      return;
    }

    setLoadingLookup(true);
    setLookupError('');
    try {
      const data = await lookupSaleOrderForReturn(query);
      setBillData(data);

      // Initialize return quantities to 0
      const initialQtys = {};
      data.items?.forEach((it) => {
        initialQtys[it.id] = 0;
      });
      setReturnQuantities(initialQtys);

      // Smart preselection based on original payment method and customer VIP status
      const hasVipCard = Boolean(data.customer_has_vip_card || (data.customer && data.vip_card_uid));
      const wasCard = (data.payment_method || '').toLowerCase() === 'card';
      const wasUpi = (data.payment_method || '').toLowerCase() === 'upi';
      const wasVip = (data.payment_method || '').toLowerCase() === 'vip_card';

      if (wasCard) {
        setRefundMethod('card');
      } else if (wasUpi) {
        setRefundMethod('upi');
      } else if (wasVip && hasVipCard) {
        setRefundMethod('vip_card');
      } else {
        setRefundMethod('cash'); // Safe default: Cash from drawer
      }

      setStep('items');
    } catch (err) {
      setLookupError(err.message || 'Failed to find invoice.');
    } finally {
      setLoadingLookup(false);
    }
  };

  // Adjust return quantity for an item
  const updateReturnQty = (lineId, maxAvailable, delta) => {
    setReturnQuantities((prev) => {
      const current = prev[lineId] || 0;
      const next = Math.max(0, Math.min(maxAvailable, current + delta));
      return { ...prev, [lineId]: next };
    });
  };

  // Direct quantity input change
  const handleQtyInputChange = (lineId, maxAvailable, val) => {
    const parsed = parseInt(val, 10);
    const validQty = isNaN(parsed) ? 0 : Math.max(0, Math.min(maxAvailable, parsed));
    setReturnQuantities((prev) => ({ ...prev, [lineId]: validQty }));
  };

  // Return all units of a line item
  const handleReturnAllForLine = (lineId, maxAvailable) => {
    setReturnQuantities((prev) => ({ ...prev, [lineId]: maxAvailable }));
  };

  // Submit & Process the Return
  const handleConfirmReturn = async () => {
    if (processing) return;
    if (totalUnitsToReturn <= 0 || totalRefundAmount <= 0) {
      setProcessError('Please select at least one item and quantity to return.');
      return;
    }

    if (refundMethod === 'vip_card' && !billData.customer_has_vip_card) {
      setProcessError('Customer does not have a registered VIP Card to receive a credit refund.');
      return;
    }
    if (refundMethod === 'card' && billData.payment_method !== 'card') {
      setProcessError('Cannot refund to Card because the original bill was not paid by card.');
      return;
    }

    const itemsPayload = Object.entries(returnQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([id, qty]) => ({
        sale_order_item_id: parseInt(id, 10),
        quantity: qty,
      }));

    setProcessing(true);
    setProcessError('');
    try {
      const payload = {
        invoice_number: billData.invoice_number,
        items: itemsPayload,
        refund_payment_method: refundMethod,
        notes: returnNotes.trim() || 'Customer Return',
      };

      const result = await processSaleOrderReturn(payload);
      setReturnResult(result);
      setStep('success');
      onReturnSuccess?.(result);
    } catch (err) {
      setProcessError(err.message || 'Failed to process return.');
    } finally {
      setProcessing(false);
    }
  };

  // Print Return Voucher
  const handlePrintVoucher = () => {
    window.print();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !processing) onClose();
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: step === 'items' ? '820px' : '560px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 'var(--radius-xl, 16px)',
          background: 'var(--bg-surface-solid, var(--bg-surface, #1E293B))',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden',
          transition: 'max-width 0.2s ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface-hover, rgba(0, 0, 0, 0.04))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.1))',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#EF4444',
              }}
            >
              <RotateCcw size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {step === 'success'
                  ? 'Return Processed Successfully'
                  : step === 'items'
                  ? `Return Bill #${billData?.invoice_number}`
                  : 'Product Return & Bill Refund'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {step === 'items'
                  ? 'Select products to minus from the original bill for refund'
                  : 'Customer product return, stock ledger restoration & register refund'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* STEP 1: Search for Bill */}
          {step === 'search' && (
            <form onSubmit={handleLookup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  fontSize: '0.80rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <Info size={18} style={{ color: '#3B82F6', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  Enter the original bill/invoice number (e.g. <strong>INV-20260908-0001</strong>). You can also scan the barcode on the customer's receipt.
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Bill / Invoice Number:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={invoiceInput}
                    onChange={(e) => setInvoiceInput(e.target.value.toUpperCase())}
                    placeholder="INV-YYYYMMDD-XXXX (e.g. INV-20260908-0001)"
                    className="form-input"
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 42px',
                      fontSize: '1rem',
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      boxSizing: 'border-box',
                      borderRadius: '10px',
                    }}
                    disabled={loadingLookup}
                  />
                  <Search
                    size={18}
                    style={{
                      position: 'absolute',
                      left: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                    }}
                  />
                </div>
              </div>

              {lookupError && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#EF4444',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{lookupError}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary"
                  style={{ padding: '9px 18px', fontWeight: 700, borderRadius: '8px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loadingLookup || !invoiceInput.trim()}
                  className="btn btn-primary"
                  style={{
                    padding: '9px 22px',
                    fontWeight: 800,
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
                  }}
                >
                  {loadingLookup ? (
                    <span>Looking up...</span>
                  ) : (
                    <>
                      <span>Find Bill</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Items Selection & Refund Method */}
          {step === 'items' && billData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Back to search */}
              <button
                type="button"
                onClick={() => setStep('search')}
                style={{
                  alignSelf: 'flex-start',
                  background: 'transparent',
                  border: 'none',
                  color: '#3B82F6',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  padding: '2px 0',
                }}
              >
                <ChevronLeft size={16} />
                <span>Look up a different bill</span>
              </button>

              {/* Bill Details Summary Card */}
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  background: 'var(--bg-surface-hover, rgba(255, 255, 255, 0.04))',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '12px',
                  fontSize: '0.78rem',
                }}
              >
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    Original Bill Date
                  </div>
                  <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {new Date(billData.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                </div>

                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    Original Cashier
                  </div>
                  <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {billData.cashier_name || 'Cashier'}
                  </div>
                </div>

                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    Customer
                  </div>
                  <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {billData.customer_name || billData.customer_phone || 'Walk-in Customer'}
                  </div>
                </div>

                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    Paid Method
                  </div>
                  <div style={{ fontWeight: 800, color: '#3B82F6', marginTop: '2px', textTransform: 'uppercase' }}>
                    {billData.payment_method}
                  </div>
                </div>

                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    Original Bill Total
                  </div>
                  <div style={{ fontWeight: 900, color: '#10B981', marginTop: '2px', fontSize: '0.88rem' }}>
                    ₹{parseFloat(billData.total_amount).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Items Return Table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Select Products to Return:
                  </label>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Only items from this bill can be returned
                  </span>
                </div>

                <div
                  className="glass-panel"
                  style={{
                    overflow: 'hidden',
                    padding: 0,
                    borderRadius: '10px',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                    <thead>
                      <tr
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          background: 'rgba(0, 0, 0, 0.04)',
                          color: 'var(--text-muted)',
                          fontSize: '0.72rem',
                          textTransform: 'uppercase',
                        }}
                      >
                        <th style={{ padding: '10px 14px' }}>Product</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right' }}>Sold Unit Price</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Sold / Returned</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Qty to Return</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right' }}>Refund Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billData.items?.map((line) => {
                        const maxAvail = Math.max(0, line.quantity - (line.returned_quantity || 0));
                        const returnQty = returnQuantities[line.id] || 0;
                        const unitPrice = parseFloat(line.effective_unit_price ?? line.unit_selling_price ?? 0);
                        const origPrice = parseFloat(line.unit_selling_price || 0);
                        const isDiscounted = Boolean(line.has_discount || unitPrice < origPrice - 0.01);
                        const lineRefund = returnQty * unitPrice;
                        const isFullyReturned = maxAvail === 0;

                        return (
                          <tr
                            key={line.id}
                            style={{
                              borderBottom: '1px solid var(--border-subtle)',
                              background: returnQty > 0 ? 'rgba(239, 68, 68, 0.05)' : isFullyReturned ? 'rgba(0, 0, 0, 0.02)' : 'transparent',
                              opacity: isFullyReturned ? 0.6 : 1,
                            }}
                          >
                            <td style={{ padding: '10px 14px' }}>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{line.item_name}</div>
                              <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                UID: {line.item_uid}
                              </div>
                            </td>

                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: 'var(--text-primary)' }}>
                              <div>₹{unitPrice.toFixed(2)}</div>
                              {isDiscounted && (
                                <div style={{ fontSize: '0.68rem', color: '#10B981', fontWeight: 700 }}>
                                  (Discounted from ₹{origPrice.toFixed(2)})
                                </div>
                              )}
                            </td>

                            <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: '0.78rem' }}>
                              <span style={{ fontWeight: 700 }}>{line.quantity}</span> sold
                              {line.returned_quantity > 0 && (
                                <span style={{ color: '#EF4444', marginLeft: '4px' }}>
                                  ({line.returned_quantity} ret.)
                                </span>
                              )}
                            </td>

                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              {isFullyReturned ? (
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10B981' }}>
                                  Fully Returned
                                </span>
                              ) : (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                  <button
                                    type="button"
                                    onClick={() => updateReturnQty(line.id, maxAvail, -1)}
                                    disabled={returnQty <= 0}
                                    style={{
                                      width: '26px',
                                      height: '26px',
                                      borderRadius: '6px',
                                      border: '1px solid var(--border-subtle)',
                                      background: 'var(--bg-surface)',
                                      color: 'var(--text-primary)',
                                      cursor: returnQty <= 0 ? 'not-allowed' : 'pointer',
                                      opacity: returnQty <= 0 ? 0.4 : 1,
                                      fontWeight: 800,
                                      fontSize: '0.9rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    -
                                  </button>

                                  <input
                                    type="number"
                                    min="0"
                                    max={maxAvail}
                                    value={returnQty}
                                    onChange={(e) => handleQtyInputChange(line.id, maxAvail, e.target.value)}
                                    style={{
                                      width: '45px',
                                      textAlign: 'center',
                                      fontSize: '0.85rem',
                                      fontWeight: 800,
                                      padding: '3px 0',
                                      borderRadius: '6px',
                                      border: returnQty > 0 ? '1px solid #EF4444' : '1px solid var(--border-subtle)',
                                      background: 'var(--bg-surface)',
                                      color: returnQty > 0 ? '#EF4444' : 'var(--text-primary)',
                                    }}
                                  />

                                  <button
                                    type="button"
                                    onClick={() => updateReturnQty(line.id, maxAvail, 1)}
                                    disabled={returnQty >= maxAvail}
                                    style={{
                                      width: '26px',
                                      height: '26px',
                                      borderRadius: '6px',
                                      border: '1px solid var(--border-subtle)',
                                      background: 'var(--bg-surface)',
                                      color: 'var(--text-primary)',
                                      cursor: returnQty >= maxAvail ? 'not-allowed' : 'pointer',
                                      opacity: returnQty >= maxAvail ? 0.4 : 1,
                                      fontWeight: 800,
                                      fontSize: '0.9rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    +
                                  </button>

                                  {maxAvail > 1 && returnQty < maxAvail && (
                                    <button
                                      type="button"
                                      onClick={() => handleReturnAllForLine(line.id, maxAvail)}
                                      style={{
                                        border: 'none',
                                        background: 'transparent',
                                        color: '#3B82F6',
                                        fontSize: '0.70rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        marginLeft: '4px',
                                      }}
                                    >
                                      All
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>

                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 900, color: returnQty > 0 ? '#EF4444' : 'var(--text-muted)' }}>
                              {returnQty > 0 ? `-₹${lineRefund.toFixed(2)}` : '₹0.00'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Refund Options & Payment Method */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '14px',
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'var(--bg-surface-hover, rgba(0, 0, 0, 0.04))',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Refund Payment Method:
                  </label>
                  <select
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value)}
                    className="form-input"
                    style={{
                      padding: '8px 12px',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-input, var(--bg-surface, #FFFFFF))',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <option value="cash">Cash (From Drawer)</option>
                    <option value="upi">UPI / Online QR Refund</option>
                    {billData.payment_method === 'card' && (
                      <option value="card">Debit / Credit Card (Original Mode)</option>
                    )}
                    {billData.customer_has_vip_card && (
                      <option value="vip_card">VIP Card Credit ({billData.customer_vip_card_uid || 'Registered Card'})</option>
                    )}
                    <option value="other">Other / Store Credit</option>
                  </select>

                  {refundMethod === 'cash' && (
                    <div style={{ fontSize: '0.70rem', color: '#F59E0B', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <Coins size={12} />
                      <span>
                        {totalRefundAmount > 0
                          ? `₹${totalRefundAmount.toFixed(2)} will be deducted from active shift cash drawer.`
                          : 'Will be deducted from active shift cash drawer.'}
                      </span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Return Reason / Audit Note:
                  </label>
                  <input
                    type="text"
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    placeholder="e.g. Customer changed mind, wrong size, defective"
                    className="form-input"
                    style={{
                      padding: '8px 12px',
                      fontSize: '0.84rem',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-input, var(--bg-surface, #FFFFFF))',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  />
                </div>
              </div>

              {/* Total Refund Banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(220, 38, 38, 0.05))',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#EF4444', textTransform: 'uppercase' }}>
                    Total Refund to Customer
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {totalUnitsToReturn} unit(s) selected for return
                  </div>
                </div>

                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#EF4444' }}>
                  ₹{totalRefundAmount.toFixed(2)}
                </div>
              </div>

              {processError && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#EF4444',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{processError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={processing}
                  className="btn btn-secondary"
                  style={{ padding: '9px 18px', fontWeight: 700, borderRadius: '8px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReturn}
                  disabled={processing || totalUnitsToReturn <= 0}
                  className="btn btn-primary"
                  style={{
                    padding: '9px 24px',
                    fontWeight: 800,
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                    color: '#FFFFFF',
                    border: 'none',
                    boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)',
                    cursor: totalUnitsToReturn <= 0 ? 'not-allowed' : 'pointer',
                    opacity: totalUnitsToReturn <= 0 ? 0.5 : 1,
                  }}
                >
                  {processing ? (
                    <span>Processing Return...</span>
                  ) : (
                    <>
                      <RotateCcw size={16} />
                      <span>Confirm &amp; Process Return (₹{totalRefundAmount.toFixed(2)})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Success Screen */}
          {step === 'success' && returnResult && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px', padding: '10px 0' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.1))',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10B981',
                }}
              >
                <CheckCircle2 size={32} />
              </div>

              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Return Processed Successfully!
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.80rem', color: 'var(--text-muted)' }}>
                  Stock has been restored to inventory and refund recorded.
                </p>
              </div>

              {/* Voucher Box */}
              <div
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'var(--bg-surface-hover, rgba(0, 0, 0, 0.04))',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  textAlign: 'left',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700 }}>Return Voucher Ref #</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.94rem', color: '#3B82F6' }}>
                    {returnResult.return_order?.invoice_number}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700 }}>Original Bill #</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                    {returnResult.original_invoice_number}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700 }}>Refund Amount Paid</span>
                  <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#10B981' }}>
                    ₹{returnResult.refund_amount?.toFixed(2)}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700 }}>Refund Method</span>
                  <span style={{ fontWeight: 800, fontSize: '0.80rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    {returnResult.refund_payment_method}
                  </span>
                </div>
              </div>

              {/* Stock Ledger Notification */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.75rem',
                  color: '#10B981',
                  fontWeight: 700,
                  background: 'rgba(16, 185, 129, 0.1)',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <ShieldCheck size={16} />
                <span>Stock quantity restored to inventory audit ledger with new timestamp.</span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={handlePrintVoucher}
                  className="btn btn-secondary"
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    fontWeight: 700,
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <Printer size={16} />
                  <span>Print Receipt</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-primary"
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    fontWeight: 800,
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #10B981, #059669)',
                    color: '#FFFFFF',
                    border: 'none',
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
