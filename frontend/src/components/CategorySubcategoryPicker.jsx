import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  X,
  Plus,
  FolderPlus,
  Check,
  Folder,
  FolderOpen,
  Tag,
  Loader2,
  Star,
  Info,
} from 'lucide-react';
import { createCategory, createSubcategory } from '../api';

/**
 * High-performance, organized Category & Subcategory Picker.
 * Features:
 * - Explicit Primary Financial Subcategory Anchor with 1-to-1 P&L attribution
 * - Live real-time search across categories & subcategories
 * - Direct inline "+ Subcategory" creation right within each category card
 * - Inline "+ Category" creator
 * - Selected chips bar with instant primary switching & remove
 * - Optimistic local state for 0ms lag
 */
export default function CategorySubcategoryPicker({
  categories = [],
  subcategories = [],
  selectedSubcatIds = [],
  primarySubcatId = null,
  onChangeSelected,
  onChangePrimary,
  onMetaUpdated,
  maxHeight = '280px',
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [activeInlineSubcatCatId, setActiveInlineSubcatCatId] = useState(null);
  const [inlineSubcatName, setInlineSubcatName] = useState('');
  const [creating, setCreating] = useState(false);

  // Local optimistic lists for instantaneous UI feedback without network lag
  const [localCategories, setLocalCategories] = useState(categories);
  const [localSubcategories, setLocalSubcategories] = useState(subcategories);

  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  useEffect(() => {
    setLocalSubcategories(subcategories);
  }, [subcategories]);

  // Ensure primarySubcatId is kept in sync with selectedSubcatIds
  useEffect(() => {
    if (selectedSubcatIds && selectedSubcatIds.length > 0) {
      if (!primarySubcatId || !selectedSubcatIds.includes(primarySubcatId)) {
        onChangePrimary?.(selectedSubcatIds[0]);
      }
    } else if (primarySubcatId) {
      onChangePrimary?.(null);
    }
  }, [selectedSubcatIds, primarySubcatId, onChangePrimary]);

  // Toggle selection
  const handleToggle = (id) => {
    if (selectedSubcatIds.includes(id)) {
      const next = selectedSubcatIds.filter((item) => item !== id);
      onChangeSelected(next);
      if (primarySubcatId === id) {
        onChangePrimary?.(next.length > 0 ? next[0] : null);
      }
    } else {
      const next = [...selectedSubcatIds, id];
      onChangeSelected(next);
      if (!primarySubcatId) {
        onChangePrimary?.(id);
      }
    }
  };

  const handleClearAll = () => {
    onChangeSelected([]);
    onChangePrimary?.(null);
  };

  // Inline Category creation
  const handleCreateCategory = async (e) => {
    e?.preventDefault();
    const catName = newCatName.trim();
    if (!catName || creating) return;

    setCreating(true);
    try {
      const created = await createCategory({ name: catName });
      setLocalCategories((prev) => [...prev, created]);
      setNewCatName('');
      setShowAddCat(false);
      // Automatically open inline subcategory addition for the new category
      setActiveInlineSubcatCatId(created.id);
      onMetaUpdated?.();
    } catch (err) {
      alert(`Category creation failed: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  // Direct Inline Subcategory creation on a specific category card
  const handleCreateInlineSubcategory = async (catId) => {
    const subName = inlineSubcatName.trim();
    if (!subName || creating) return;

    setCreating(true);
    try {
      const created = await createSubcategory({
        category: parseInt(catId, 10),
        name: subName,
      });

      // Optimistically add to subcategories and select it immediately
      setLocalSubcategories((prev) => [...prev, created]);
      onChangeSelected([...selectedSubcatIds, created.id]);
      setInlineSubcatName('');
      setActiveInlineSubcatCatId(null);
      onMetaUpdated?.();
    } catch (err) {
      alert(`Subcategory creation failed: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  // Filter categories and subcategories based on search query
  const filteredCategories = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) {
      return localCategories.map((cat) => ({
        ...cat,
        matchingSubs: localSubcategories.filter((s) => String(s.category) === String(cat.id)),
      }));
    }

    return localCategories
      .map((cat) => {
        const catMatches = cat.name.toLowerCase().includes(q);
        const subs = localSubcategories.filter((s) => String(s.category) === String(cat.id));
        const matchingSubs = catMatches
          ? subs
          : subs.filter((s) => s.name.toLowerCase().includes(q));

        if (catMatches || matchingSubs.length > 0) {
          return {
            ...cat,
            matchingSubs,
          };
        }
        return null;
      })
      .filter(Boolean);
  }, [localCategories, localSubcategories, searchQuery]);

  // Selected subcategories objects for chips preview with category names and primary flag
  const selectedSubcategoryObjects = useMemo(() => {
    const list = selectedSubcatIds.map((id) => {
      const sub = localSubcategories.find((s) => s.id === id);
      if (!sub) return null;
      const parentCat = localCategories.find((c) => String(c.id) === String(sub.category));
      return {
        ...sub,
        categoryName: parentCat ? parentCat.name : '',
        isPrimary: sub.id === primarySubcatId,
      };
    }).filter(Boolean);

    // Primary first, then alphabetically
    return list.sort((a, b) => {
      if (a.isPrimary) return -1;
      if (b.isPrimary) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [localSubcategories, localCategories, selectedSubcatIds, primarySubcatId]);

  return (
    <div
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
        background: 'var(--bg-surface)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* Top Header: Search bar + Quick Category button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
        {/* Search input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-input, rgba(255,255,255,0.05))',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-pill)',
            padding: '6px 14px',
            flex: '1 1 240px',
            minWidth: '200px',
          }}
        >
          <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search categories or subcategories..."
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.84rem',
              width: '100%',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Quick Add Parent Category Button */}
        <button
          type="button"
          onClick={() => setShowAddCat((p) => !p)}
          className={`btn btn-sm ${showAddCat ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.78rem', padding: '6px 14px', borderRadius: 'var(--radius-pill)' }}
        >
          <FolderPlus size={13} />
          <span>+ Quick Category</span>
        </button>
      </div>

      {/* Inline Quick Add Category Form */}
      {showAddCat && (
        <form
          onSubmit={handleCreateCategory}
          style={{
            padding: '12px 16px',
            background: 'var(--bg-surface-hover)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--brand-primary)', fontSize: '0.82rem', fontWeight: 700 }}>
            <FolderPlus size={15} />
            <span>New Category:</span>
          </div>
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="e.g. Footwear, Winter Wear..."
            className="form-input"
            style={{ flex: '1 1 180px', fontSize: '0.82rem', height: '34px' }}
            autoFocus
          />
          <button
            type="submit"
            disabled={!newCatName.trim() || creating}
            className="btn btn-primary btn-sm"
            style={{ fontSize: '0.8rem', height: '34px' }}
          >
            {creating ? 'Saving...' : 'Add Category'}
          </button>
          <button
            type="button"
            onClick={() => setShowAddCat(false)}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.8rem', height: '34px' }}
          >
            Cancel
          </button>
        </form>
      )}

      {/* Selected Items Quick Row with Primary Financial Subcategory Anchor */}
      {selectedSubcategoryObjects.length > 0 && (
        <div
          style={{
            padding: '12px 14px',
            background: 'var(--bg-surface-hover, rgba(255, 255, 255, 0.03))',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {/* Header with Explanatory Financial Anchor Note */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                Assigned Subcategories ({selectedSubcategoryObjects.length})
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(245, 158, 11, 0.12)',
                  color: '#f59e0b',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                }}
                title="Single Financial Anchor: 100% of P&L revenue and pie chart contributions attach to this primary subcategory to prevent double-counting."
              >
                <Star size={11} fill="#f59e0b" />
                <span>Single Financial Anchor</span>
              </span>
            </div>
            <button
              type="button"
              onClick={handleClearAll}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.74rem',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: '2px 4px',
              }}
            >
              Clear All
            </button>
          </div>

          {/* Chips list */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {selectedSubcategoryObjects.map((sc) => {
              if (sc.isPrimary) {
                return (
                  <span
                    key={sc.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-pill)',
                      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(218, 41, 28, 0.22))',
                      border: '1px solid rgba(245, 158, 11, 0.7)',
                      color: 'var(--text-primary)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      boxShadow: '0 0 10px rgba(245, 158, 11, 0.25)',
                    }}
                  >
                    <Star size={12} fill="#f59e0b" color="#f59e0b" />
                    <span>
                      {sc.categoryName ? `${sc.categoryName} > ` : ''}
                      {sc.name}
                    </span>
                    <span
                      style={{
                        background: '#f59e0b',
                        color: '#000000',
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        letterSpacing: '0.3px',
                        textTransform: 'uppercase',
                      }}
                    >
                      Primary Financial
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggle(sc.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 0,
                        marginLeft: '3px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Remove (Next subcategory will become primary)"
                    >
                      <X size={12} />
                    </button>
                  </span>
                );
              }

              // Secondary Tag Chip
              return (
                <span
                  key={sc.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 9px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.76rem',
                    fontWeight: 500,
                  }}
                >
                  <span>
                    {sc.categoryName ? `${sc.categoryName} > ` : ''}
                    {sc.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => onChangePrimary?.(sc.id)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-pill)',
                      color: 'var(--text-primary)',
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      padding: '1px 6px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      transition: 'all 0.15s ease',
                    }}
                    title="Make this the Primary Financial Subcategory for P&L reports and pie charts"
                  >
                    <Star size={10} style={{ color: '#f59e0b' }} />
                    <span>Set Primary</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggle(sc.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Remove tag"
                  >
                    <X size={12} />
                  </button>
                </span>
              );
            })}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              borderTop: '1px dashed var(--border-subtle)',
              paddingTop: '6px',
            }}
          >
            <Info size={12} style={{ color: '#f59e0b', flexShrink: 0 }} />
            <span>
              <strong>Primary Financial Anchor</strong> receives 100% of sales & P&L accounting (zero double-counting). Additional subcategories are stored as secondary merchandising tags for search & filters.
            </span>
          </div>
        </div>
      )}

      {/* Organized Categories & Subcategories List */}
      <div
        style={{
          maxHeight,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          paddingRight: '4px',
        }}
      >
        {localCategories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
            <Folder size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
            <div>No categories found in the system.</div>
            <button
              type="button"
              onClick={() => setShowAddCat(true)}
              className="btn btn-secondary btn-sm"
              style={{ marginTop: '10px', fontSize: '0.78rem' }}
            >
              <Plus size={13} />
              <span>Add First Category</span>
            </button>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
            <Search size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
            <div>No categories or subcategories match "<strong>{searchQuery}</strong>"</div>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="btn btn-secondary btn-sm"
              style={{ marginTop: '10px', fontSize: '0.78rem' }}
            >
              Reset Search
            </button>
          </div>
        ) : (
          filteredCategories.map((cat) => {
            const hasSubs = cat.matchingSubs.length > 0;
            const selectedCountInCat = cat.matchingSubs.filter((s) => selectedSubcatIds.includes(s.id)).length;
            const isAddingSubcatHere = String(activeInlineSubcatCatId) === String(cat.id);

            return (
              <div
                key={cat.id}
                style={{
                  background: 'var(--bg-surface-hover)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '12px 14px',
                }}
              >
                {/* Category Title Row with Direct "+ Add Subcategory" Button */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: hasSubs || isAddingSubcatHere ? '10px' : '0',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <FolderOpen size={16} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: '0.86rem',
                        color: 'var(--text-primary)',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {cat.name}
                    </span>
                    {selectedCountInCat > 0 && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          background: 'var(--brand-primary)',
                          color: '#ffffff',
                          borderRadius: 'var(--radius-pill)',
                          padding: '1px 6px',
                        }}
                      >
                        {selectedCountInCat} selected
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {cat.matchingSubs.length} {cat.matchingSubs.length === 1 ? 'sub' : 'subs'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (isAddingSubcatHere) {
                          setActiveInlineSubcatCatId(null);
                          setInlineSubcatName('');
                        } else {
                          setActiveInlineSubcatCatId(cat.id);
                          setInlineSubcatName('');
                        }
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{
                        fontSize: '0.74rem',
                        padding: '3px 9px',
                        borderRadius: 'var(--radius-pill)',
                        height: '26px',
                      }}
                    >
                      <Plus size={12} />
                      <span>{isAddingSubcatHere ? 'Close' : 'Add Sub'}</span>
                    </button>
                  </div>
                </div>

                {/* Inline Subcategory Creator inside this specific category */}
                {isAddingSubcatHere && (
                  <div
                    style={{
                      padding: '8px 10px',
                      marginBottom: '10px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center',
                    }}
                  >
                    <Tag size={13} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
                    <input
                      type="text"
                      value={inlineSubcatName}
                      onChange={(e) => setInlineSubcatName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCreateInlineSubcategory(cat.id);
                        }
                      }}
                      placeholder={`New subcategory under ${cat.name}...`}
                      className="form-input"
                      style={{ flex: 1, fontSize: '0.8rem', height: '30px', padding: '4px 8px' }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleCreateInlineSubcategory(cat.id)}
                      disabled={!inlineSubcatName.trim() || creating}
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: '0.76rem', height: '30px', padding: '0 10px' }}
                    >
                      {creating ? <Loader2 size={12} className="animate-spin" /> : 'Add'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveInlineSubcatCatId(null);
                        setInlineSubcatName('');
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.76rem', height: '30px', padding: '0 8px' }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                {/* Subcategories Pills */}
                {hasSubs ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {cat.matchingSubs.map((sc) => {
                      const isSelected = selectedSubcatIds.includes(sc.id);
                      const isPrimary = isSelected && sc.id === primarySubcatId;
                      return (
                        <button
                          key={sc.id}
                          type="button"
                          onClick={() => handleToggle(sc.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '5px 12px',
                            borderRadius: 'var(--radius-pill)',
                            border: isPrimary
                              ? '1px solid #f59e0b'
                              : isSelected
                              ? '1px solid var(--brand-primary)'
                              : '1px solid var(--border-subtle)',
                            background: isPrimary
                              ? 'linear-gradient(135deg, rgba(245,158,11,0.22), rgba(218,41,28,0.22))'
                              : isSelected
                              ? 'var(--brand-primary)'
                              : 'var(--bg-surface)',
                            color: isPrimary
                              ? '#fef08a'
                              : isSelected
                              ? '#ffffff'
                              : 'var(--text-secondary)',
                            fontWeight: isSelected ? 700 : 500,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            boxShadow: isPrimary
                              ? '0 0 8px rgba(245, 158, 11, 0.35)'
                              : isSelected
                              ? '0 2px 6px rgba(218,41,28,0.25)'
                              : 'none',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {isPrimary ? (
                            <Star size={13} fill="#f59e0b" color="#f59e0b" />
                          ) : isSelected ? (
                            <Check size={13} />
                          ) : (
                            <Plus size={13} style={{ opacity: 0.6 }} />
                          )}
                          <span>{sc.name}</span>
                          {isPrimary && (
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, background: '#f59e0b', color: '#000', padding: '1px 4px', borderRadius: '3px' }}>
                              PRIMARY
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  !isAddingSubcatHere && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.78rem',
                        color: 'var(--text-muted)',
                        padding: '2px 0',
                      }}
                    >
                      <span>No subcategories yet under {cat.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveInlineSubcatCatId(cat.id);
                          setInlineSubcatName('');
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--brand-primary)',
                          fontWeight: 600,
                          fontSize: '0.76rem',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        + Add subcategory
                      </button>
                    </div>
                  )
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
