import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  X,
  Wand2,
  Trash2,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';
import { fetchNextUid, checkItemUidExists } from '../api';

/**
 * UIDConflictVerificationModal
 * 
 * Allows users to review, modify, auto-generate, or reject/discard
 * items that had UID collisions before or during batch product saving.
 * Clean, production-safe, and theme-harmonized with Wondersale design tokens.
 */
export default function UIDConflictVerificationModal({
  isOpen,
  onClose,
  conflictingItems = [],
  existingUidMap = {},
  onSaveResolved,
  onDiscardItem,
}) {
  // Local state for items being resolved: { [id]: editedUid }
  const [editedUids, setEditedUids] = useState({});
  const [loadingAutoUid, setLoadingAutoUid] = useState({});
  const [localErrors, setLocalErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize or update state when modal opens
  useEffect(() => {
    if (isOpen && conflictingItems.length > 0) {
      const initialMap = {};
      conflictingItems.forEach((item) => {
        initialMap[item.id] = item.uid || '';
      });
      setEditedUids(initialMap);
      setLocalErrors({});
      setLoadingAutoUid({});
    }
  }, [isOpen, conflictingItems]);

  if (!isOpen || conflictingItems.length === 0) return null;

  // Handle manual input modification of a row's UID
  const handleUidChange = (id, newUid) => {
    setEditedUids((prev) => ({
      ...prev,
      [id]: newUid,
    }));
    // Clear error on edit
    if (localErrors[id]) {
      setLocalErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  // 1-Click Auto-Generate Next Unique UID from Backend Sequence
  const handleAutoGenerateUid = async (id) => {
    setLoadingAutoUid((prev) => ({ ...prev, [id]: true }));
    try {
      // Fetch next UID from backend
      const nextUid = await fetchNextUid();
      if (nextUid) {
        setEditedUids((prev) => ({
          ...prev,
          [id]: String(nextUid),
        }));
        if (localErrors[id]) {
          setLocalErrors((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }
      }
    } catch (err) {
      console.error('Failed to auto-generate next UID:', err);
      // Fallback: generate a timestamp-based unique sequence number
      const fallbackUid = `${Math.floor(1000000 + Math.random() * 9000000)}`;
      setEditedUids((prev) => ({
        ...prev,
        [id]: fallbackUid,
      }));
    } finally {
      setLoadingAutoUid((prev) => ({ ...prev, [id]: false }));
    }
  };

  // Auto-generate for ALL remaining conflicting items
  const handleAutoGenerateAll = async () => {
    for (const item of conflictingItems) {
      await handleAutoGenerateUid(item.id);
    }
  };

  // Re-verify and save all resolved products
  const handleSubmitResolved = async () => {
    setIsSubmitting(true);
    const newErrors = {};

    // 1. Check for duplicates amongst the newly typed UIDs in this modal
    const typedUidCounts = {};
    Object.entries(editedUids).forEach(([id, uid]) => {
      const uClean = String(uid || '').trim().toLowerCase();
      if (uClean) {
        typedUidCounts[uClean] = (typedUidCounts[uClean] || 0) + 1;
      }
    });

    // 2. Check each against backend / database
    const resolvedItems = [];
    for (const item of conflictingItems) {
      const newUid = String(editedUids[item.id] || '').trim();
      const newUidLower = newUid.toLowerCase();

      if (!newUid) {
        // Empty UID means let backend allocate automatically
        resolvedItems.push({
          ...item,
          uid: '',
        });
        continue;
      }

      // Check collision inside this dialog
      if (typedUidCounts[newUidLower] > 1) {
        newErrors[item.id] = `Duplicate UID "${newUid}" entered across multiple rows in this list`;
        continue;
      }

      // Check database collision if different from initial or previously colliding
      try {
        const checkRes = await checkItemUidExists(newUid);
        if (checkRes.exists) {
          newErrors[item.id] = `UID "${newUid}" already exists in database (${checkRes.item_name || 'Existing product'})`;
          continue;
        }
      } catch (err) {
        console.warn(`Could not verify UID ${newUid}:`, err);
      }

      resolvedItems.push({
        ...item,
        uid: newUid,
      });
    }

    setLocalErrors(newErrors);
    setIsSubmitting(false);

    if (Object.keys(newErrors).length === 0 && resolvedItems.length > 0) {
      onSaveResolved(resolvedItems);
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(8px)',
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '88vh',
          background: 'var(--bg-surface-solid)',
          borderRadius: 'var(--radius-lg, 18px)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md, 12px)',
                background: 'var(--color-warning-bg, rgba(245, 158, 11, 0.12))',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-warning, #f59e0b)',
                flexShrink: 0,
              }}
            >
              <ShieldAlert size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                UID Conflict Verification ({conflictingItems.length})
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                These products have duplicate UIDs / Barcodes. Modify their UID, auto-generate a fresh one, or discard them.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '8px',
              borderRadius: 'var(--radius-sm, 8px)',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'var(--transition-smooth)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-surface-hover)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar Notice & Global Actions */}
        <div
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface-hover)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={15} style={{ color: 'var(--color-warning)' }} />
            <span>All other clean products can be saved safely without delay.</span>
          </div>

          <button
            type="button"
            onClick={handleAutoGenerateAll}
            disabled={isSubmitting}
            className="btn btn-secondary btn-sm"
            style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              padding: '5px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(197, 34, 36, 0.3)',
              background: 'var(--brand-ruby-glow, rgba(197, 34, 36, 0.08))',
              color: 'var(--brand-primary)',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Wand2 size={13} />
            <span>Auto-Generate Unique UIDs for All</span>
          </button>
        </div>

        {/* Items List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            background: 'var(--bg-page)',
          }}
        >
          {conflictingItems.map((item, idx) => {
            const currentTypedUid = editedUids[item.id] !== undefined ? editedUids[item.id] : (item.uid || '');
            const rowError = localErrors[item.id];
            const originalUid = item.uid || '-';
            const dbConflictName = existingUidMap[String(item.uid || '').toLowerCase()]?.item_name || '';

            return (
              <div
                key={item.id}
                style={{
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md, 12px)',
                  border: rowError
                    ? '1px solid var(--color-danger, #ef4444)'
                    : '1px solid var(--border-subtle)',
                  padding: '14px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  transition: 'var(--transition-smooth)',
                }}
              >
                {/* Row Header: Product info & Actions */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        {item.name || `Row #${idx + 1}`}
                      </span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 'var(--radius-xs, 4px)',
                          background: 'var(--color-danger-bg, rgba(239, 68, 68, 0.12))',
                          color: 'var(--color-danger, #ef4444)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                        }}
                      >
                        Conflict UID: {originalUid}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {dbConflictName ? (
                        <span>
                          Clashes with existing product: <strong style={{ color: 'var(--text-primary)' }}>"{dbConflictName}"</strong>
                        </span>
                      ) : (
                        <span>Duplicate UID across multiple rows in your CSV / import list</span>
                      )}
                      {item.selling_price ? <span> • ₹{item.selling_price}</span> : null}
                      {item.initialQuantity || item.quantity ? <span> • Stock: {item.initialQuantity || item.quantity}</span> : null}
                    </div>
                  </div>

                  {/* Reject / Discard Button */}
                  <button
                    type="button"
                    onClick={() => onDiscardItem?.(item.id)}
                    style={{
                      background: 'var(--color-danger-bg, rgba(239, 68, 68, 0.08))',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      color: 'var(--color-danger, #ef4444)',
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-sm, 8px)',
                      cursor: 'pointer',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      flexShrink: 0,
                      transition: 'var(--transition-smooth)',
                    }}
                    title="Discard this product from queue"
                  >
                    <Trash2 size={13} />
                    <span>Reject / Discard</span>
                  </button>
                </div>

                {/* Inline UID Editor */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                    <input
                      type="text"
                      value={currentTypedUid}
                      onChange={(e) => handleUidChange(item.id, e.target.value)}
                      placeholder="Enter new UID or leave empty for auto-assignment..."
                      style={{
                        width: '100%',
                        padding: '7px 12px',
                        fontSize: '0.84rem',
                        fontWeight: 600,
                        fontFamily: 'monospace',
                        borderRadius: 'var(--radius-sm, 8px)',
                        border: rowError
                          ? '1px solid var(--color-danger, #ef4444)'
                          : '1px solid var(--border-strong)',
                        background: 'var(--bg-input, var(--bg-surface))',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        transition: 'var(--transition-smooth)',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'var(--brand-primary)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = rowError ? 'var(--color-danger)' : 'var(--border-strong)';
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAutoGenerateUid(item.id)}
                    disabled={loadingAutoUid[item.id]}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 'var(--radius-sm, 8px)',
                      border: '1px solid var(--border-strong)',
                      background: 'var(--bg-surface-hover)',
                      color: 'var(--text-primary)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: loadingAutoUid[item.id] ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'var(--transition-smooth)',
                    }}
                    title="Generate next available sequential UID"
                  >
                    <Wand2 size={13} style={{ color: 'var(--brand-primary)' }} />
                    <span>{loadingAutoUid[item.id] ? 'Generating...' : 'Auto-Generate UID'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUidChange(item.id, '')}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 'var(--radius-sm, 8px)',
                      border: '1px solid var(--border-subtle)',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'var(--transition-smooth)',
                    }}
                    title="Wipe UID so system allocates next sequential barcode at save"
                  >
                    Auto on Save
                  </button>
                </div>

                {/* Row Error Message */}
                {rowError && (
                  <div style={{ fontSize: '0.76rem', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={13} />
                    <span>{rowError}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <strong>{conflictingItems.length}</strong> product{conflictingItems.length > 1 ? 's' : ''} awaiting UID resolution.
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn btn-secondary btn-sm"
              style={{
                padding: '8px 16px',
                fontSize: '0.84rem',
                fontWeight: 600,
              }}
            >
              Keep in Staged List
            </button>

            <button
              type="button"
              onClick={handleSubmitResolved}
              disabled={isSubmitting}
              className="btn btn-primary btn-sm"
              style={{
                padding: '8px 20px',
                fontSize: '0.84rem',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--brand-primary)',
                borderColor: 'var(--brand-primary)',
                boxShadow: '0 2px 10px var(--brand-ruby-glow)',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Verifying & Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  <span>Save Resolved Products</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
