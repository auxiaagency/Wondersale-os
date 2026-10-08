import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Check, X, Star } from 'lucide-react';

export default function SubcategoryPickerPopover({
  isOpen,
  anchorEl,
  anchorRect,
  categories = [],
  subcategories = [],
  selectedIds = [],
  primaryId = null,
  onChangePrimary,
  onToggle,
  onClear,
  onClose,
}) {
  const [search, setSearch] = useState('');
  const [currentRect, setCurrentRect] = useState(anchorRect);
  const popoverRef = useRef(null);

  // Sync anchor rect when anchorEl or anchorRect changes
  useEffect(() => {
    if (anchorEl) {
      setCurrentRect(anchorEl.getBoundingClientRect());
    } else if (anchorRect) {
      setCurrentRect(anchorRect);
    }
  }, [anchorEl, anchorRect, isOpen]);

  // Keep pinned to anchorEl on scroll / resize and close if scrolled out of viewport
  useEffect(() => {
    if (!isOpen) return;

    let rAF = null;
    const handleScrollOrResize = (e) => {
      // Ignore scroll events originating from within the popover itself (e.g. scrolling subcategories list)
      if (e && e.target && popoverRef.current && popoverRef.current.contains(e.target)) {
        return;
      }

      if (rAF) cancelAnimationFrame(rAF);
      rAF = requestAnimationFrame(() => {
        if (!anchorEl || !anchorEl.isConnected) {
          onClose?.();
          return;
        }
        const rect = anchorEl.getBoundingClientRect();
        // If element is scrolled out of viewport bounds, gracefully close popover
        if (
          rect.bottom < 30 ||
          rect.top > window.innerHeight - 30 ||
          rect.right < 20 ||
          rect.left > window.innerWidth - 20
        ) {
          onClose?.();
          return;
        }
        setCurrentRect(rect);
      });
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      if (rAF) cancelAnimationFrame(rAF);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, anchorEl, onClose]);

  // Close on outside click or escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleMouseDown(e) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        (!anchorEl || !anchorEl.contains(e.target))
      ) {
        onClose?.();
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose?.();
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, anchorEl]);

  // Reset search when opening
  useEffect(() => {
    if (isOpen) {
      setSearch('');
    }
  }, [isOpen]);

  // Determine active primary subcategory object
  const activePrimarySubcategory = useMemo(() => {
    const pId = primaryId || (selectedIds.length > 0 ? selectedIds[0] : null);
    if (!pId) return null;
    return subcategories.find((s) => String(s.id) === String(pId)) || null;
  }, [primaryId, selectedIds, subcategories]);

  // Filter and group subcategories by category
  const filteredCategoryGroups = useMemo(() => {
    const q = search.toLowerCase().trim();

    // 1. If categories array is populated
    if (categories && categories.length > 0) {
      return categories
        .map((cat) => {
          const subs = subcategories.filter(
            (s) => String(s.category) === String(cat.id) || String(s.category_id) === String(cat.id)
          );
          const matchingSubs = q
            ? subs.filter(
                (s) =>
                  (s.name && s.name.toLowerCase().includes(q)) ||
                  (cat.name && cat.name.toLowerCase().includes(q))
              )
            : subs;

          if (matchingSubs.length > 0) {
            return {
              id: cat.id,
              name: cat.name,
              subcategories: matchingSubs,
            };
          }
          return null;
        })
        .filter(Boolean);
    }

    // 2. Fallback: Group by s.category_name or category
    const groupMap = {};
    subcategories.forEach((s) => {
      const catName = s.category_name || 'All Categories';
      if (!groupMap[catName]) {
        groupMap[catName] = { id: catName, name: catName, subcategories: [] };
      }
      if (!q || s.name.toLowerCase().includes(q) || catName.toLowerCase().includes(q)) {
        groupMap[catName].subcategories.push(s);
      }
    });

    return Object.values(groupMap).filter((g) => g.subcategories.length > 0);
  }, [categories, subcategories, search]);

  const rectToUse = currentRect || anchorRect;
  if (!isOpen || !rectToUse) return null;

  // Calculate smart fixed viewport positioning
  const popoverWidth = 300;
  const popoverHeight = 360;
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

  return (
    <div
      ref={popoverRef}
      className="glass-panel custom-scrollbar"
      style={{
        position: 'fixed',
        top: `${Math.round(top)}px`,
        left: `${Math.round(left)}px`,
        width: `${popoverWidth}px`,
        maxHeight: `${popoverHeight}px`,
        zIndex: 9999,
        background: 'var(--bg-surface, #0f172a)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg, 12px)',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.65)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search Header */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface-hover)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter subcategories..."
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: '0.82rem',
            color: 'var(--text-primary)',
            width: '100%',
          }}
          autoFocus
        />
        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--brand-primary)',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              padding: '2px 4px',
            }}
          >
            Clear ({selectedIds.length})
          </button>
        )}
      </div>

      {/* Primary Financial Anchor Status Header */}
      {selectedIds.length > 0 && (
        <div
          style={{
            padding: '6px 10px',
            background: 'rgba(245, 158, 11, 0.1)',
            borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.74rem',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden' }}>
            <Star size={11} fill="#f59e0b" color="#f59e0b" style={{ flexShrink: 0 }} />
            <span style={{ color: 'var(--text-muted)' }}>Primary:</span>
            <strong
              style={{
                color: '#f59e0b',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              {activePrimarySubcategory ? activePrimarySubcategory.name : 'Not set'}
            </strong>
          </div>
          <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            100% P&amp;L Anchor
          </span>
        </div>
      )}

      {/* Grouped Subcategories List */}
      <div style={{ overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        {filteredCategoryGroups.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            No subcategories match your search.
          </div>
        ) : (
          filteredCategoryGroups.map((cat) => (
            <div key={cat.id} style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: 'var(--brand-primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  padding: '4px 6px',
                }}
              >
                {cat.name}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {cat.subcategories.map((sub) => {
                  const isSelected = selectedIds.some((id) => String(id) === String(sub.id));
                  const isPrimary =
                    isSelected &&
                    (String(primaryId) === String(sub.id) ||
                      (!primaryId && selectedIds.length > 0 && String(selectedIds[0]) === String(sub.id)));

                  return (
                    <div
                      key={sub.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggle?.(sub.id);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        borderRadius: 'var(--radius-sm)',
                        background: isPrimary
                          ? 'rgba(245, 158, 11, 0.12)'
                          : isSelected
                          ? 'rgba(218, 41, 28, 0.08)'
                          : 'transparent',
                        border: isPrimary ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid transparent',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        color: isPrimary ? '#f59e0b' : isSelected ? 'var(--brand-primary)' : 'var(--text-primary)',
                        fontWeight: isSelected ? 700 : 500,
                        transition: 'all 0.12s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                        {isSelected ? (
                          <Check size={14} style={{ color: isPrimary ? '#f59e0b' : 'var(--brand-primary)', flexShrink: 0 }} />
                        ) : (
                          <div
                            style={{
                              width: '14px',
                              height: '14px',
                              borderRadius: '3px',
                              border: '1px solid var(--border-strong)',
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {sub.name}
                        </span>
                      </div>

                      {/* Right side controls: Primary indicator OR Set as Primary button */}
                      {isPrimary ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            background: '#f59e0b',
                            color: '#000000',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            letterSpacing: '0.3px',
                            flexShrink: 0,
                          }}
                          title="Primary Financial Subcategory: 100% of sales & P&L attach here"
                        >
                          <Star size={9} fill="#000000" color="#000000" />
                          PRIMARY
                        </span>
                      ) : isSelected ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onChangePrimary?.(sub.id);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-secondary)',
                            padding: '1px 6px',
                            borderRadius: 'var(--radius-pill)',
                            fontSize: '0.66rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            flexShrink: 0,
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#f59e0b';
                            e.currentTarget.style.borderColor = '#f59e0b';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--text-secondary)';
                            e.currentTarget.style.borderColor = 'var(--border-subtle)';
                          }}
                          title="Set as Primary Financial Anchor"
                        >
                          <Star size={9} />
                          <span>Make Primary</span>
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
