import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Package, Sparkles } from 'lucide-react';

export default function VariantSelectionModal({
  item,
  onSelectVariant,
  onClose,
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const variants = item?.design_variants || [];

  // Find first available variant index on open
  useEffect(() => {
    const firstAvailable = variants.findIndex((v) => (v.quantity || 0) > 0);
    if (firstAvailable >= 0) {
      setSelectedIndex(firstAvailable);
    }
  }, [item]);

  // Keyboard Navigation: Numbers 1-9, Arrows, Enter, Esc
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Hotkey 1 to 9
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= variants.length) {
        e.preventDefault();
        const targetVariant = variants[num - 1];
        if (targetVariant && (targetVariant.quantity || 0) > 0) {
          onSelectVariant(targetVariant);
        }
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % variants.length);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + variants.length) % variants.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const activeVariant = variants[selectedIndex];
        if (activeVariant && (activeVariant.quantity || 0) > 0) {
          onSelectVariant(activeVariant);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [variants, selectedIndex, onSelectVariant, onClose]);

  if (!item) return null;

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(11, 14, 23, 0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="modal-content glass-panel"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          background: 'var(--bg-surface-solid, #1e293b)',
          border: '1px solid rgba(244, 63, 94, 0.35)',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7)',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: '18px',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
            paddingBottom: '14px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(244, 63, 94, 0.15)',
                  color: 'var(--brand-primary, #f43f5e)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Package size={18} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary, #ffffff)' }}>
                Select Colour / Design
              </h3>
            </div>
            <p style={{ margin: '4px 0 0 40px', fontSize: '0.84rem', color: 'var(--text-muted, #94a3b8)' }}>
              {item.name} • <span className="mono font-bold">UID: {item.uid}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-icon"
            style={{ width: '32px', height: '32px', borderRadius: '50%' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Keyboard Instructions Banner */}
        <div
          style={{
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: '10px',
            padding: '8px 12px',
            marginBottom: '16px',
            fontSize: '0.78rem',
            color: '#a5b4fc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>
            ⚡ <strong>Cashier Fast Keys:</strong> Press <kbd style={{ background: '#312e81', padding: '1px 5px', borderRadius: '4px' }}>1</kbd>–<kbd style={{ background: '#312e81', padding: '1px 5px', borderRadius: '4px' }}>9</kbd> or <kbd style={{ background: '#312e81', padding: '1px 5px', borderRadius: '4px' }}>Arrows</kbd> + <kbd style={{ background: '#312e81', padding: '1px 5px', borderRadius: '4px' }}>Enter</kbd>
          </span>
          <span style={{ fontSize: '0.72rem', color: '#818cf8' }}>Esc to cancel</span>
        </div>

        {/* Variant Cards Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '12px',
            marginBottom: '20px',
          }}
        >
          {variants.map((v, idx) => {
            const isOutOfStock = (v.quantity || 0) <= 0;
            const isFocused = selectedIndex === idx;
            const imageUrl = v.image_url;

            return (
              <div
                key={v.id || idx}
                onClick={() => {
                  if (!isOutOfStock) {
                    onSelectVariant(v);
                  }
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '14px',
                  background: isFocused
                    ? 'rgba(244, 63, 94, 0.12)'
                    : 'var(--bg-surface-subtle, rgba(255, 255, 255, 0.03))',
                  border: isFocused
                    ? '2px solid var(--brand-primary, #f43f5e)'
                    : '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                  cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                  opacity: isOutOfStock ? 0.45 : 1,
                  transition: 'all 0.15s ease',
                  transform: isFocused ? 'scale(1.02)' : 'none',
                }}
              >
                {/* Number Key Badge */}
                <div
                  style={{
                    position: 'absolute',
                    top: '6px',
                    left: '6px',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: isFocused ? 'var(--brand-primary, #f43f5e)' : 'rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    fontSize: '0.68rem',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2,
                  }}
                >
                  {idx + 1}
                </div>

                {/* Photo Thumbnail */}
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    background: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={v.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <Package size={24} style={{ color: 'var(--text-muted, #64748b)' }} />
                  )}
                </div>

                {/* Variant Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: '0.96rem',
                      color: isFocused ? '#ffffff' : 'var(--text-primary, #e2e8f0)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {v.name}
                  </div>

                  <div style={{ marginTop: '4px' }}>
                    {isOutOfStock ? (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: '#ef4444',
                          background: 'rgba(239, 68, 68, 0.15)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        OUT OF STOCK (0)
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          color: v.quantity <= 3 ? '#f59e0b' : '#10b981',
                          background: v.quantity <= 3 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        {v.quantity} in stock
                      </span>
                    )}
                  </div>
                </div>

                {isFocused && !isOutOfStock && (
                  <div style={{ color: 'var(--brand-primary, #f43f5e)' }}>
                    <Check size={18} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const activeVariant = variants[selectedIndex];
              if (activeVariant && (activeVariant.quantity || 0) > 0) {
                onSelectVariant(activeVariant);
              }
            }}
            disabled={!variants[selectedIndex] || (variants[selectedIndex].quantity || 0) <= 0}
            className="btn btn-primary"
            style={{ fontWeight: 700 }}
          >
            Add to Bill
          </button>
        </div>
      </div>
    </div>
  );
}
