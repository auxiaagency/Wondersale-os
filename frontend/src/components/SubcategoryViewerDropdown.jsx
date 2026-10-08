import React, { useState, useEffect, useRef } from 'react';

/**
 * Compact Subcategories Badge List with automatic dropdown overflow.
 * If subcategories count <= 2, displays regular pill badges.
 * If subcategories count > 2, displays the primary badge + a "+N more ▾" dropdown button,
 * preventing table rows from stretching vertically.
 */
export function SubcategoriesBadgeList({
  subcategories = [],
  primarySubcategoryId = null,
  primarySubcategory = null,
  fontSize = '0.68rem',
  onOpenDropdown,
  isOpen = false,
}) {
  if (!subcategories || subcategories.length === 0) {
    return (
      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
        —
      </span>
    );
  }

  // Identify the primary subcategory
  const primId = primarySubcategory?.id || primarySubcategoryId || subcategories[0]?.id;
  const primSub = subcategories.find((sc) => String(sc.id) === String(primId)) || subcategories[0];
  const otherSubs = subcategories.filter((sc) => String(sc.id) !== String(primSub?.id));

  // If 2 or fewer subcategories, render standard pill badges
  if (subcategories.length <= 2) {
    const listToRender = [primSub, ...otherSubs].filter(Boolean);
    return (
      <div className="inv-subcat-badge-wrap" style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
        {listToRender.map((sc) => {
          const isPrimary = String(sc.id) === String(primSub?.id);
          return (
            <span
              key={sc.id}
              className={`badge inv-subcat-badge ${isPrimary ? 'inv-subcat-primary' : ''}`}
              style={{
                fontSize,
                padding: '1px 6px',
                borderRadius: 'var(--radius-pill)',
                background: isPrimary ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-surface-hover)',
                border: isPrimary ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid var(--border-subtle)',
                color: isPrimary ? '#f59e0b' : 'var(--text-secondary)',
                fontWeight: isPrimary ? 700 : 500,
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
              title={
                isPrimary
                  ? 'Primary Financial Subcategory: 100% of sales and P&L attribution attach here'
                  : 'Secondary tag: Used for search & merchandising filters'
              }
            >
              {isPrimary && <span style={{ fontSize: '0.65rem' }}>★</span>}
              <span>{sc.name}</span>
            </span>
          );
        })}
      </div>
    );
  }

  // If more than 2 subcategories: display Primary badge + sleek Dropdown trigger button
  return (
    <div
      className="inv-subcat-badge-wrap"
      style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', alignItems: 'center' }}
    >
      {/* Primary Badge */}
      {primSub && (
        <span
          className="badge inv-subcat-badge inv-subcat-primary"
          style={{
            fontSize,
            padding: '1px 6px',
            borderRadius: 'var(--radius-pill)',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.5)',
            color: '#f59e0b',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
          }}
          title="Primary Financial Subcategory: 100% of sales and P&L attribution attach here"
        >
          <span style={{ fontSize: '0.65rem' }}>★</span>
          <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {primSub.name}
          </span>
        </span>
      )}

      {/* Dropdown trigger button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenDropdown?.(e.currentTarget, primSub, subcategories);
        }}
        className="badge inv-subcat-dropdown-trigger"
        style={{
          fontSize,
          padding: '1px 6px',
          borderRadius: 'var(--radius-pill)',
          background: isOpen ? 'rgba(99, 102, 241, 0.25)' : 'var(--bg-surface-hover)',
          border: isOpen ? '1px solid var(--accent-primary, #6366f1)' : '1px solid var(--border-subtle)',
          color: isOpen ? '#818cf8' : 'var(--text-secondary)',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
          whiteSpace: 'nowrap',
          transition: 'all 0.15s ease',
          outline: 'none',
        }}
        title={`Click to view all ${subcategories.length} subcategories`}
      >
        <span>+{otherSubs.length} more</span>
        <span
          style={{
            fontSize: '0.6rem',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease',
            lineHeight: 1,
          }}
        >
          ▾
        </span>
      </button>
    </div>
  );
}

/**
 * Floating Dropdown Popover showing all subcategories for an item.
 * Attached directly under the "+N more ▾" trigger button with collision detection.
 */
export default function SubcategoryViewerDropdown({
  isOpen,
  anchorEl,
  anchorRect,
  itemName = '',
  primarySubcat = null,
  subcategories = [],
  onClose,
}) {
  const [filterQuery, setFilterQuery] = useState('');
  const [currentRect, setCurrentRect] = useState(anchorRect);
  const popoverRef = useRef(null);

  // Sync anchor rect
  useEffect(() => {
    if (anchorEl) {
      setCurrentRect(anchorEl.getBoundingClientRect());
    } else if (anchorRect) {
      setCurrentRect(anchorRect);
    }
  }, [anchorEl, anchorRect, isOpen]);

  // Dynamic positioning on window resize/scroll and close on outside click / escape
  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = (e) => {
      // Don't close or update if scrolling inside the popover list
      if (e && e.target && popoverRef.current && popoverRef.current.contains(e.target)) {
        return;
      }
      if (!anchorEl || !anchorEl.isConnected) {
        onClose?.();
        return;
      }
      const rect = anchorEl.getBoundingClientRect();
      if (
        rect.bottom < 20 ||
        rect.top > window.innerHeight - 20 ||
        rect.right < 10 ||
        rect.left > window.innerWidth - 10
      ) {
        onClose?.();
        return;
      }
      setCurrentRect(rect);
    };

    const handleMouseDown = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        (!anchorEl || !anchorEl.contains(e.target))
      ) {
        onClose?.();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, anchorEl, onClose]);

  // Reset filter when opening
  useEffect(() => {
    if (isOpen) {
      setFilterQuery('');
    }
  }, [isOpen]);

  const rectToUse = currentRect || anchorRect;
  if (!isOpen || !rectToUse) return null;

  // Viewport calculation
  const popoverWidth = 260;
  const popoverHeight = 310;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let top = rectToUse.bottom + 4;
  if (top + popoverHeight > viewportHeight - 10) {
    top = Math.max(10, rectToUse.top - popoverHeight - 4);
  }

  let left = rectToUse.left;
  if (left + popoverWidth > viewportWidth - 10) {
    left = Math.max(10, viewportWidth - popoverWidth - 10);
  }

  const q = filterQuery.toLowerCase().trim();
  const otherSubcats = (subcategories || []).filter(
    (sc) => !primarySubcat || String(sc.id) !== String(primarySubcat.id)
  );
  const filteredOthers = q
    ? otherSubcats.filter((sc) => sc.name && sc.name.toLowerCase().includes(q))
    : otherSubcats;

  const showPrimaryInSearch =
    primarySubcat && (!q || (primarySubcat.name && primarySubcat.name.toLowerCase().includes(q)));

  return (
    <div
      ref={popoverRef}
      className="glass-panel"
      style={{
        position: 'fixed',
        top: `${Math.round(top)}px`,
        left: `${Math.round(left)}px`,
        width: `${popoverWidth}px`,
        maxHeight: `${popoverHeight}px`,
        zIndex: 9999,
        background: 'var(--bg-surface, #0f172a)',
        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
        borderRadius: 'var(--radius-lg, 12px)',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.65)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        style={{
          padding: '9px 12px',
          borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-surface-elevated, rgba(255, 255, 255, 0.03))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-primary)' }}>
            Subcategories
          </span>
          <span
            style={{
              fontSize: '0.66rem',
              padding: '1px 6px',
              borderRadius: 'var(--radius-pill)',
              background: 'rgba(99, 102, 241, 0.18)',
              color: '#818cf8',
              fontWeight: 700,
            }}
          >
            {subcategories.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '2px 4px',
            fontSize: '0.85rem',
            lineHeight: 1,
            borderRadius: '4px',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
          title="Close"
        >
          ✕
        </button>
      </div>

      {/* Item Name Sub-header if available */}
      {itemName && (
        <div
          style={{
            padding: '4px 12px 6px',
            fontSize: '0.68rem',
            color: 'var(--text-secondary)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          For: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{itemName}</span>
        </div>
      )}

      {/* Search Input (if > 4 subcategories) */}
      {subcategories.length > 4 && (
        <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))' }}>
          <input
            type="text"
            placeholder="Search subcategories..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '4px 8px',
              fontSize: '0.74rem',
              borderRadius: 'var(--radius-sm, 6px)',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
              background: 'var(--bg-input, rgba(0, 0, 0, 0.25))',
              color: 'var(--text-primary)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {/* Scrollable Subcategories List */}
      <div
        className="custom-scrollbar"
        style={{
          padding: '8px 10px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
          maxHeight: '190px',
        }}
      >
        {/* Primary Subcategory Section */}
        {showPrimaryInSearch && primarySubcat && (
          <div
            style={{
              padding: '6px 9px',
              borderRadius: 'var(--radius-md, 8px)',
              background: 'rgba(245, 158, 11, 0.14)',
              border: '1px solid rgba(245, 158, 11, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
              <span style={{ color: '#f59e0b', fontSize: '0.75rem', flexShrink: 0 }}>★</span>
              <span
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: '#f59e0b',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {primarySubcat.name}
              </span>
            </div>
            <span
              style={{
                fontSize: '0.60rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: '#f59e0b',
                fontWeight: 700,
                opacity: 0.9,
                flexShrink: 0,
              }}
            >
              Primary
            </span>
          </div>
        )}

        {/* Secondary Subcategories Section */}
        {filteredOthers.length > 0 ? (
          filteredOthers.map((sc) => (
            <div
              key={sc.id}
              style={{
                padding: '5px 8px',
                borderRadius: 'var(--radius-sm, 6px)',
                background: 'var(--bg-surface-hover, rgba(255, 255, 255, 0.04))',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
                fontSize: '0.73rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>•</span>
              <span
                style={{
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {sc.name}
              </span>
            </div>
          ))
        ) : !showPrimaryInSearch ? (
          <div
            style={{
              padding: '12px 8px',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}
          >
            No subcategories match "{filterQuery}"
          </div>
        ) : null}
      </div>

      {/* Footer hint */}
      <div
        style={{
          padding: '6px 10px',
          borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
          background: 'var(--bg-surface-elevated, rgba(255, 255, 255, 0.02))',
          fontSize: '0.64rem',
          color: 'var(--text-muted)',
          textAlign: 'center',
        }}
      >
        Click ✎ on the item row to edit tags
      </div>
    </div>
  );
}
