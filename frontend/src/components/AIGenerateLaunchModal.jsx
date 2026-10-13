import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  X,
  AlertTriangle,
  Image as ImageIcon,
  Check,
  Search,
  Info
} from 'lucide-react';

export default function AIGenerateLaunchModal({
  isOpen,
  onClose,
  items = [],
  onConfirm,
  loading = false
}) {
  const [selectedForName, setSelectedForName] = useState(() => {
    const initialSet = new Set();
    items.forEach(it => {
      if (it.needs_better_name) {
        initialSet.add(it.id);
      }
    });
    return initialSet;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'name_enabled' | 'with_photo' | 'no_photo'

  // Reset or initialize state when modal items change
  React.useEffect(() => {
    if (isOpen) {
      const initialSet = new Set();
      items.forEach(it => {
        if (it.needs_better_name) {
          initialSet.add(it.id);
        }
      });
      setSelectedForName(initialSet);
      setSearchQuery('');
      setFilterMode('all');
    }
  }, [isOpen, items]);

  const toggleItemForName = (id) => {
    setSelectedForName(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllName = () => {
    const all = new Set(items.map(it => it.id));
    setSelectedForName(all);
  };

  const handleSelectNoneName = () => {
    setSelectedForName(new Set());
  };

  const handleSelectFlaggedOnly = () => {
    const flagged = new Set(items.filter(it => it.needs_better_name).map(it => it.id));
    setSelectedForName(flagged);
  };

  const filteredItems = useMemo(() => {
    return items.filter(it => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (it.name || '').toLowerCase().includes(q);
        const matchesUid = (it.uid || '').toLowerCase().includes(q);
        const matchesCat = (it.primary_subcategory?.name || it.category_name || '').toLowerCase().includes(q);
        if (!matchesName && !matchesUid && !matchesCat) return false;
      }
      const hasPhoto = Boolean(it.primary_image_url || (it.images && it.images.length > 0));
      if (filterMode === 'with_photo') return hasPhoto;
      if (filterMode === 'no_photo') return !hasPhoto;
      if (filterMode === 'name_enabled') return selectedForName.has(it.id);
      return true;
    });
  }, [items, searchQuery, filterMode, selectedForName]);

  const totalCount = items.length;
  const nameCount = items.filter(it => selectedForName.has(it.id)).length;
  const descOnlyCount = totalCount - nameCount;
  const missingPhotoCount = items.filter(it => !it.primary_image_url && (!it.images || it.images.length === 0)).length;

  if (!isOpen) return null;

  const handleSubmit = () => {
    const targetIds = items.map(it => it.id);
    const generateNameIds = items.filter(it => selectedForName.has(it.id)).map(it => it.id);
    onConfirm({
      item_ids: targetIds,
      generate_name_ids: generateNameIds
    });
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
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        padding: '20px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '880px',
          maxHeight: '90vh',
          background: 'var(--bg-surface-solid)',
          borderRadius: 'var(--radius-lg, 18px)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md, 12px)',
                background: 'var(--brand-ruby-glow, rgba(197, 34, 36, 0.12))',
                border: '1px solid rgba(197, 34, 36, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--brand-primary)',
                flexShrink: 0
              }}
            >
              <Sparkles size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                Launch AI Catalog Studio
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                Select which products need an AI Name upgrade before description generation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '8px',
              borderRadius: 'var(--radius-sm, 8px)',
              cursor: loading ? 'not-allowed' : 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'var(--transition-smooth)'
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

        {/* Informative Banner */}
        <div
          style={{
            padding: '11px 24px',
            background: 'var(--bg-surface-hover)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)'
          }}
        >
          <Info size={16} style={{ flexShrink: 0, color: 'var(--brand-primary)' }} />
          <span style={{ lineHeight: 1.45 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Workflow:</strong> Products with <strong style={{ color: 'var(--brand-primary)' }}>New Name</strong> enabled will first have Gemini Vision generate a polished, SEO-friendly e-commerce product title from their photo, followed by a rich product description.
          </span>
        </div>

        {/* Stats & Quick Actions Toolbar */}
        <div
          style={{
            padding: '14px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            background: 'var(--bg-surface)'
          }}
        >
          {/* Badge counters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--bg-surface-hover)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              Total: <strong>{totalCount}</strong>
            </span>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--brand-ruby-glow, rgba(197, 34, 36, 0.12))',
                color: 'var(--brand-primary)',
                border: '1px solid rgba(197, 34, 36, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Sparkles size={12} /> Name + Desc: <strong>{nameCount}</strong>
            </span>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--bg-surface-hover)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              Desc Only: <strong>{descOnlyCount}</strong>
            </span>
            {missingPhotoCount > 0 && (
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--color-danger-bg, rgba(239, 68, 68, 0.1))',
                  color: 'var(--color-danger, #EF4444)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <AlertTriangle size={12} /> {missingPhotoCount} No Photo
              </span>
            )}
          </div>

          {/* Quick buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleSelectAllName}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius-sm, 8px)',
                fontSize: '0.78rem',
                fontWeight: 700,
                border: '1px solid rgba(197, 34, 36, 0.3)',
                background: 'var(--brand-ruby-glow, rgba(197, 34, 36, 0.08))',
                color: 'var(--brand-primary)',
                cursor: 'pointer',
                transition: 'var(--transition-smooth)'
              }}
            >
              Select All for New Name
            </button>
            <button
              type="button"
              onClick={handleSelectNoneName}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius-sm, 8px)',
                fontSize: '0.78rem',
                fontWeight: 600,
                border: '1px solid var(--border-strong)',
                background: 'var(--bg-surface)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'var(--transition-smooth)'
              }}
            >
              All Description Only
            </button>
            <button
              type="button"
              onClick={handleSelectFlaggedOnly}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius-sm, 8px)',
                fontSize: '0.78rem',
                fontWeight: 600,
                border: '1px solid var(--border-strong)',
                background: 'var(--bg-surface-hover)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'var(--transition-smooth)'
              }}
            >
              Only Flagged
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div
          style={{
            padding: '10px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'var(--bg-page)'
          }}
        >
          <div
            style={{
              position: 'relative',
              flex: 1,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '12px',
                color: 'var(--text-muted)'
              }}
            />
            <input
              type="text"
              placeholder="Search products by name, UID or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 12px 7px 34px',
                borderRadius: 'var(--radius-sm, 8px)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-input, var(--bg-surface))',
                fontSize: '0.84rem',
                color: 'var(--text-primary)',
                outline: 'none',
                transition: 'var(--transition-smooth)'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--brand-primary)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'name_enabled', label: 'New Name' },
              { id: 'with_photo', label: 'Has Photo' },
              { id: 'no_photo', label: 'Missing Photo' }
            ].map(f => {
              const isActive = filterMode === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilterMode(f.id)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 'var(--radius-sm, 8px)',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    border: isActive
                      ? '1px solid var(--brand-primary)'
                      : '1px solid var(--border-subtle)',
                    background: isActive
                      ? 'var(--brand-ruby-glow, rgba(197, 34, 36, 0.1))'
                      : 'var(--bg-surface)',
                    color: isActive
                      ? 'var(--brand-primary)'
                      : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Products List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '14px 24px',
            maxHeight: '430px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            background: 'var(--bg-page)'
          }}
        >
          {filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>No products match your filter criteria.</p>
            </div>
          ) : (
            filteredItems.map(item => {
              const hasPhoto = Boolean(item.primary_image_url || (item.images && item.images.length > 0));
              const isChecked = selectedForName.has(item.id);
              const photoUrl = item.primary_image_url || (item.images && item.images[0]?.image) || null;

              return (
                <div
                  key={item.id}
                  onClick={() => toggleItemForName(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md, 12px)',
                    border: isChecked
                      ? '1px solid var(--brand-primary)'
                      : '1px solid var(--border-subtle)',
                    background: isChecked
                      ? 'var(--brand-ruby-glow, rgba(197, 34, 36, 0.06))'
                      : 'var(--bg-surface)',
                    cursor: 'pointer',
                    transition: 'var(--transition-smooth)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isChecked) {
                      e.currentTarget.style.borderColor = 'var(--border-strong)';
                      e.currentTarget.style.background = 'var(--bg-surface-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isChecked) {
                      e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      e.currentTarget.style.background = 'var(--bg-surface)';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                    {/* Thumbnail */}
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: 'var(--radius-sm, 8px)',
                        background: 'var(--bg-surface-hover)',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        border: '1px solid var(--border-subtle)'
                      }}
                    >
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={item.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <ImageIcon size={18} color="var(--text-muted)" />
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                          {item.name || 'Unnamed Product'}
                        </span>
                        {item.needs_better_name && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: 'var(--radius-xs, 4px)',
                              background: 'var(--color-warning-bg, rgba(245, 158, 11, 0.12))',
                              color: 'var(--color-warning, #D97706)',
                              border: '1px solid rgba(245, 158, 11, 0.25)'
                            }}
                          >
                            Flagged for Upgrade
                          </span>
                        )}
                        {!hasPhoto && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              padding: '2px 7px',
                              borderRadius: 'var(--radius-xs, 4px)',
                              background: 'var(--color-danger-bg, rgba(239, 68, 68, 0.12))',
                              color: 'var(--color-danger, #EF4444)',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            <AlertTriangle size={10} /> No Photo
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        UID: <strong>{item.uid || '-'}</strong>
                        {item.primary_subcategory?.name && (
                          <span> • {item.primary_subcategory.name}</span>
                        )}
                        {item.selling_price && (
                          <span> • ₹{item.selling_price}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Toggle / Checkbox */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      flexShrink: 0
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleItemForName(item.id);
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        padding: '4px 11px',
                        borderRadius: 'var(--radius-pill)',
                        background: isChecked
                          ? 'var(--brand-primary)'
                          : 'var(--bg-surface-hover)',
                        color: isChecked
                          ? '#ffffff'
                          : 'var(--text-secondary)',
                        border: isChecked
                          ? '1px solid var(--brand-primary)'
                          : '1px solid var(--border-subtle)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        transition: 'var(--transition-smooth)'
                      }}
                    >
                      {isChecked ? (
                        <>
                          <Sparkles size={12} /> New Name + Description
                        </>
                      ) : (
                        <>
                          Description Only
                        </>
                      )}
                    </span>

                    {/* Visual Checkbox */}
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '6px',
                        border: isChecked
                          ? '2px solid var(--brand-primary)'
                          : '2px solid var(--border-strong)',
                        background: isChecked
                          ? 'var(--brand-primary)'
                          : 'var(--bg-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        transition: 'var(--transition-smooth)'
                      }}
                    >
                      {isChecked && <Check size={13} strokeWidth={3} />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface)'
          }}
        >
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>{totalCount}</strong> products queued for AI generation.
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '9px 18px',
                borderRadius: 'var(--radius-sm, 8px)',
                fontSize: '0.86rem',
                fontWeight: 600,
                border: '1px solid var(--border-strong)',
                background: 'var(--bg-surface)',
                color: 'var(--text-secondary)',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'var(--transition-smooth)'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = 'var(--bg-surface-hover)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = 'var(--bg-surface)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || totalCount === 0}
              style={{
                padding: '9px 22px',
                borderRadius: 'var(--radius-sm, 8px)',
                fontSize: '0.86rem',
                fontWeight: 700,
                border: 'none',
                background: 'var(--brand-primary)',
                color: '#ffffff',
                cursor: (loading || totalCount === 0) ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px var(--brand-ruby-glow, rgba(197, 34, 36, 0.35))',
                opacity: (loading || totalCount === 0) ? 0.6 : 1,
                transition: 'var(--transition-smooth)'
              }}
              onMouseEnter={(e) => {
                if (!loading && totalCount > 0) {
                  e.currentTarget.style.background = 'var(--brand-primary-hover, #A81B1D)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && totalCount > 0) {
                  e.currentTarget.style.background = 'var(--brand-primary)';
                }
              }}
            >
              <Sparkles size={16} />
              {loading ? 'Starting Batch...' : `Start AI Generation (${totalCount})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
