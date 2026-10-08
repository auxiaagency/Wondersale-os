import React, { useState } from 'react';
import { X, ArrowUpDown, AlertCircle, Check } from 'lucide-react';
import { adjustStock } from '../api';

export default function StockAdjustmentModal({ item, onClose, onSuccess }) {
  const [change, setChange] = useState('');
  const [reason, setReason] = useState('manual_adjustment');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!item) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const numChange = parseInt(change, 10);
    if (isNaN(numChange) || numChange === 0) {
      setError('Please specify a valid non-zero adjustment number (e.g. 5 or -2).');
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

  const newProjectedQty = item.quantity + (parseInt(change, 10) || 0);

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

          {/* Change Quantity Input */}
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
              </div>
            )}
          </div>

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
            <button type="submit" disabled={loading || !change} className="btn btn-primary">
              {loading ? 'Recording...' : 'Record Movement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
