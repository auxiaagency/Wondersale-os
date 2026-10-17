import React, { useState } from 'react';
import { X, ArrowUpDown, AlertCircle, Check } from 'lucide-react';
import { adjustStock } from '../api';

export default function StockAdjustmentModal({ item, onClose, onSuccess }) {
  const hasVariants = Boolean(item?.has_variants && (item?.design_variants || []).length > 0);
  const variants = item?.design_variants || [];

  // If item has variants, initialize map of { variantId: changeAmount }
  const [variantChanges, setVariantChanges] = useState(() => {
    const initial = {};
    variants.forEach((v) => {
      initial[v.id] = '';
    });
    return initial;
  });

  const [change, setChange] = useState('');
  const [reason, setReason] = useState('manual_adjustment');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!item) return null;

  // Calculate total change for variant-enabled items
  const computedVariantChange = hasVariants
    ? Object.values(variantChanges).reduce((acc, val) => {
        const parsed = parseInt(val, 10);
        return acc + (isNaN(parsed) ? 0 : parsed);
      }, 0)
    : 0;

  const effectiveChange = hasVariants ? computedVariantChange : (parseInt(change, 10) || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (hasVariants) {
      const activeVariantAdjustments = [];
      let hasInvalidVariant = false;

      for (const v of variants) {
        const vChangeRaw = variantChanges[v.id];
        const vChange = parseInt(vChangeRaw, 10);
        if (!isNaN(vChange) && vChange !== 0) {
          const currentVQty = parseInt(v.quantity, 10) || 0;
          if (currentVQty + vChange < 0) {
            setError(`Cannot deduct ${Math.abs(vChange)} from variant "${v.name}": Only ${currentVQty} in stock.`);
            return;
          }
          activeVariantAdjustments.push({
            variant_id: v.id,
            change: vChange,
          });
        }
      }

      if (activeVariantAdjustments.length === 0) {
        setError('Please enter at least one non-zero variant adjustment.');
        return;
      }

      const totalItemChange = activeVariantAdjustments.reduce((sum, va) => sum + va.change, 0);
      const currentQty = parseInt(item.quantity, 10) || 0;
      if (currentQty + totalItemChange < 0) {
        setError(`Overall item stock cannot drop below 0.`);
        return;
      }

      setLoading(true);
      setError('');

      try {
        await adjustStock(item.id, {
          change: totalItemChange,
          reason,
          note: note.trim(),
          variant_adjustments: activeVariantAdjustments,
        });
        onSuccess?.();
        onClose();
      } catch (err) {
        setError(err.message || 'Failed to adjust stock');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Standard non-variant product
    const numChange = parseInt(change, 10);
    if (isNaN(numChange) || numChange === 0) {
      setError('Please specify a valid non-zero adjustment number (e.g. 5 or -2).');
      return;
    }

    const currentQty = parseInt(item.quantity, 10) || 0;
    if (currentQty + numChange < 0) {
      setError(`Cannot deduct ${Math.abs(numChange)} units: Current stock is ${currentQty}. Minimum permissible stock is 0.`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await adjustStock(item.id, {
        change: numChange,
        reason,
        note: note.trim(),
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to adjust stock');
    } finally {
      setLoading(false);
    }
  };

  const newProjectedQty = (parseInt(item.quantity, 10) || 0) + effectiveChange;
  const isNegativeProjected = effectiveChange !== 0 && newProjectedQty < 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--brand-ruby-glow)',
                color: 'var(--brand-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ArrowUpDown size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem' }}>Adjust Stock</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Stock Ledger Transaction</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-icon" style={{ width: '32px', height: '32px' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {/* Target Item Card */}
          <div
            style={{
              padding: '12px 16px',
              background: 'var(--bg-surface-hover)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              marginBottom: '20px',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{item.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
              <span className="mono" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                UID: {item.uid}
              </span>
              <span style={{ fontSize: '0.86rem', fontWeight: 700 }}>Current: {item.quantity} units</span>
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: '10px 14px',
                marginBottom: '16px',
                background: 'var(--color-danger-bg)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.84rem',
                color: 'var(--color-danger)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {hasVariants ? (
            /* Variant-Level Stock Adjustments */
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>
                  Adjust Individual Variants <span style={{ color: 'var(--brand-primary)' }}>*</span>
                </label>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Total delta:{' '}
                  <strong style={{ color: effectiveChange >= 0 ? '#10B981' : '#EF4444' }}>
                    {effectiveChange > 0 ? `+${effectiveChange}` : effectiveChange}
                  </strong>
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                Enter quantity changes for each variant (e.g. +5 to add, -2 to deduct). Unchanged variants can be left blank or 0.
              </p>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  paddingRight: '4px',
                }}
              >
                {variants.map((v) => {
                  const currentVQty = parseInt(v.quantity, 10) || 0;
                  const deltaRaw = variantChanges[v.id] ?? '';
                  const deltaParsed = parseInt(deltaRaw, 10);
                  const validDelta = !isNaN(deltaParsed) ? deltaParsed : 0;
                  const newVQty = currentVQty + validDelta;
                  const isVNeg = newVQty < 0;

                  return (
                    <div
                      key={v.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        padding: '10px 12px',
                        background: 'rgba(0, 0, 0, 0.25)',
                        border: isVNeg ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {v.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          In stock: <strong>{currentVQty}</strong> →{' '}
                          <strong style={{ color: isVNeg ? '#EF4444' : '#10B981' }}>{newVQty}</strong>
                        </div>
                      </div>

                      <div style={{ width: '110px', flexShrink: 0 }}>
                        <input
                          type="number"
                          placeholder="± Change"
                          value={variantChanges[v.id] ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setVariantChanges((prev) => ({
                              ...prev,
                              [v.id]: val,
                            }));
                          }}
                          className="form-input mono"
                          style={{
                            padding: '6px 10px',
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            textAlign: 'right',
                            borderColor: isVNeg ? '#EF4444' : undefined,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total Balance Snapshot */}
              <div style={{ fontSize: '0.8rem', marginTop: '10px', color: 'var(--text-secondary)' }}>
                Resulting total balance:{' '}
                <strong style={{ color: newProjectedQty < 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                  {newProjectedQty} units
                </strong>
                {isNegativeProjected && (
                  <span style={{ color: 'var(--color-danger)', display: 'block', marginTop: '2px', fontSize: '0.75rem' }}>
                    ⚠️ Overall stock cannot drop below 0.
                  </span>
                )}
              </div>
            </div>
          ) : (
            /* Standard Non-Variant Change Quantity Input */
            <div style={{ marginBottom: '16px' }}>
              <label className="form-label">
                Adjustment Quantity <span style={{ color: 'var(--brand-primary)' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  value={change}
                  onChange={(e) => setChange(e.target.value)}
                  placeholder="e.g. +10 (stock in) or -2 (stock out)"
                  className="form-input mono"
                  required
                  autoFocus
                  style={{ fontSize: '1.05rem', fontWeight: 700 }}
                />
              </div>
              {change && (
                <div style={{ fontSize: '0.8rem', marginTop: '6px', color: 'var(--text-secondary)' }}>
                  Resulting balance:{' '}
                  <strong style={{ color: newProjectedQty < 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                    {newProjectedQty} units
                  </strong>
                  {isNegativeProjected && (
                    <span style={{ color: 'var(--color-danger)', display: 'block', marginTop: '2px', fontSize: '0.75rem' }}>
                      ⚠️ Stock cannot drop below 0.
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Reason Selector */}
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label">Movement Reason</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="form-select">
              <option value="manual_adjustment">Manual Adjustment</option>
              <option value="restock">Restock (Received Shipment)</option>
              <option value="damage">Damaged / Discarded Item</option>
              <option value="return">Customer / Supplier Return</option>
              <option value="audit_correction">Inventory Audit Correction</option>
            </select>
          </div>

          {/* Optional Note */}
          <div style={{ marginBottom: '24px' }}>
            <label className="form-label">Audit Note (Optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. PO #1024 or Broken box on shelf B"
              className="form-input"
              maxLength={250}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                loading ||
                (hasVariants ? effectiveChange === 0 : !change) ||
                isNegativeProjected
              }
              className="btn btn-primary"
            >
              {loading ? 'Recording...' : 'Record Movement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
