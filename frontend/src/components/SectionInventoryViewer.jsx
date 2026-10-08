import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Package,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Image as ImageIcon,
  Ruler,
  Scale,
  Box,
  Truck,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
  Folder,
  Layers,
  FileText,
  X,
  Eye,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import { fetchItems } from '../api';
import SubcategoryViewerDropdown, { SubcategoriesBadgeList } from './SubcategoryViewerDropdown';

// Derived volume and volumetric metrics helper
export const calculateVolumeMetrics = (length, width, height) => {
  const l = parseFloat(length);
  const w = parseFloat(width);
  const h = parseFloat(height);
  if (isNaN(l) || isNaN(w) || isNaN(h) || l <= 0 || w <= 0 || h <= 0) {
    return {
      hasDimensions: false,
      dimensionsStr: null,
      volumeCm3: null,
      volumeLiters: null,
      volumetricWeightKg: null,
    };
  }
  const vol = l * w * h;
  const volWt = vol / 5000;
  return {
    hasDimensions: true,
    dimensionsStr: `${l} × ${w} × ${h} cm`,
    volumeCm3: vol >= 1000 ? vol.toLocaleString(undefined, { maximumFractionDigits: 1 }) : vol.toFixed(1),
    volumeLiters: (vol / 1000).toFixed(2),
    volumetricWeightKg: volWt.toFixed(3),
  };
};

export default function SectionInventoryViewer({
  sectionId,
  sectionName,
  sectionColor = '#3B82F6',
  storeId,
  currentUser,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState('all'); // 'all' | 'in_stock' | 'low' | 'out'
  const [selectedSubcat, setSelectedSubcat] = useState('');
  const [pageSize, setPageSize] = useState(10); // 10, 15, or 25
  const [currentPage, setCurrentPage] = useState(1);
  const [lightboxImage, setLightboxImage] = useState(null); // { src, name, uid }
  const [hoveredItemId, setHoveredItemId] = useState(null);
  const [activeSubcatViewer, setActiveSubcatViewer] = useState(null); // { itemId, itemName, anchorEl, anchorRect, primarySubcat, allSubcategories }

  // Toggle subcategories viewer dropdown popover
  const handleToggleSubcatViewer = (itemId, itemName, anchorEl, primSub, allSubs) => {
    if (activeSubcatViewer?.itemId === itemId) {
      setActiveSubcatViewer(null);
    } else {
      setActiveSubcatViewer({
        itemId,
        itemName,
        anchorEl,
        anchorRect: anchorEl.getBoundingClientRect(),
        primarySubcat: primSub,
        allSubcategories: allSubs,
      });
    }
  };

  // Load section items
  const loadSectionItems = async () => {
    if (!sectionId) return;
    setLoading(true);
    setError('');
    try {
      const params = {
        section: sectionId,
      };
      if (storeId) {
        params.store = storeId;
      }
      const data = await fetchItems(params);
      const list = Array.isArray(data) ? data : (data?.results || []);
      setItems(list);
    } catch (err) {
      console.error('Failed to load section items:', err);
      setError('Unable to load section inventory items. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSectionItems();
    setCurrentPage(1);
  }, [sectionId, storeId]);

  // Handle ESC for lightbox image
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && lightboxImage) {
        setLightboxImage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxImage]);

  // Extract unique subcategories in this section for filtering
  const availableSubcategories = useMemo(() => {
    const map = new Map();
    items.forEach((it) => {
      (it.subcategories || []).forEach((sc) => {
        if (sc && sc.id && !map.has(sc.id)) {
          map.set(sc.id, sc.name);
        }
      });
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  // Stock counts
  const stats = useMemo(() => {
    let inStock = 0;
    let low = 0;
    let out = 0;
    items.forEach((it) => {
      const q = Number(it.quantity || 0);
      if (q <= 0) out++;
      else if (q <= 5) low++;
      else inStock++;
    });
    return { total: items.length, inStock, low, out };
  }, [items]);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Stock status filter
      const qty = Number(item.quantity || 0);
      if (stockFilter === 'out' && qty > 0) return false;
      if (stockFilter === 'low' && (qty <= 0 || qty > 5)) return false;
      if (stockFilter === 'in_stock' && qty <= 0) return false;

      // Subcategory filter
      if (selectedSubcat) {
        const hasSc = (item.subcategories || []).some((sc) => String(sc.id) === String(selectedSubcat));
        if (!hasSc) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (item.name || '').toLowerCase().includes(q);
        const matchUid = (item.uid || '').toLowerCase().includes(q);
        const matchLegacy = (item.legacy_uid || '').toLowerCase().includes(q);
        const matchSubcats = (item.subcategories || []).some((sc) => (sc.name || '').toLowerCase().includes(q));
        const matchSupplier = (item.supplier_name || '').toLowerCase().includes(q);
        if (!matchName && !matchUid && !matchLegacy && !matchSubcats && !matchSupplier) {
          return false;
        }
      }

      return true;
    });
  }, [items, stockFilter, selectedSubcat, searchQuery]);

  // Pagination calculation
  const totalItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, safePage, pageSize]);

  // Stock status badge renderer
  const renderStockBadge = (qty) => {
    const q = Number(qty || 0);
    if (q <= 0) {
      return (
        <span
          className="badge badge-danger"
          style={{
            fontSize: '0.72rem',
            padding: '3px 8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: 700,
            borderRadius: 'var(--radius-pill)',
          }}
        >
          <XCircle size={11} /> 0 Out of Stock
        </span>
      );
    }
    if (q <= 5) {
      return (
        <span
          className="badge badge-warning"
          style={{
            fontSize: '0.72rem',
            padding: '3px 8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: 700,
            borderRadius: 'var(--radius-pill)',
          }}
        >
          <AlertTriangle size={11} /> {q} Low Stock
        </span>
      );
    }
    return (
      <span
        className="badge badge-success"
        style={{
          fontSize: '0.72rem',
          padding: '3px 8px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontWeight: 700,
          borderRadius: 'var(--radius-pill)',
        }}
      >
        <CheckCircle2 size={11} /> {q} In Stock
      </span>
    );
  };

  return (
    <div
      className="glass-panel"
      style={{
        borderRadius: '18px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
        marginTop: '28px',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          background: 'var(--bg-surface)',
        }}
      >
        {/* Left: Section Identity & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              backgroundColor: `${sectionColor}18`,
              color: sectionColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${sectionColor}33`,
              flexShrink: 0,
            }}
          >
            <Package size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: sectionColor,
                }}
              >
                {sectionName || 'Assigned Section'}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                }}
              >
                <ShieldCheck size={12} style={{ color: '#10B981' }} />
                Read-Only Verification Mode
              </span>
            </div>
            <h3
              style={{
                margin: '2px 0 0 0',
                fontSize: '1.24rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
              }}
            >
              {sectionName ? `${sectionName} Inventory & Stock` : 'Section Inventory Items'}
            </h3>
          </div>
        </div>

        {/* Right: Quick Stock Badges & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--bg-surface-hover)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'var(--text-secondary)',
            }}
          >
            <span>Total:</span>
            <strong style={{ color: 'var(--text-primary)' }}>{stats.total}</strong>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: 'var(--radius-pill)',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: '#10B981',
            }}
          >
            <span>In Stock:</span>
            <strong>{stats.inStock}</strong>
          </div>

          {stats.low > 0 && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: 'var(--radius-pill)',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#F59E0B',
              }}
            >
              <span>Low:</span>
              <strong>{stats.low}</strong>
            </div>
          )}

          {stats.out > 0 && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: 'var(--radius-pill)',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#EF4444',
              }}
            >
              <span>Out:</span>
              <strong>{stats.out}</strong>
            </div>
          )}

          <button
            type="button"
            onClick={loadSectionItems}
            disabled={loading}
            className="btn btn-secondary"
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
            }}
            title="Refresh Section Inventory"
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      <div
        style={{
          padding: '10px 24px',
          background: 'var(--bg-surface-hover)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          fontSize: '0.78rem',
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Eye size={14} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
          <span>
            <b>Staff Verification View:</b> This live table shows all items registered in your section. Cost price and profit margin are hidden for staff privacy. Editing and barcode printing are restricted to inventory administrators.
          </span>
        </div>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Click product photo to inspect enlarged image
        </span>
      </div>

      {/* Filter and Search Toolbar */}
      <div
        style={{
          padding: '14px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          background: 'var(--bg-surface)',
        }}
      >
        {/* Left: Search input */}
        <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Search by name, UID, subcategory..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="form-input"
            style={{
              paddingLeft: '34px',
              height: '34px',
              fontSize: '0.82rem',
              borderRadius: 'var(--radius-sm)',
              width: '100%',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setCurrentPage(1);
              }}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Clear Search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Center / Right: Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Subcategory Filter (if available) */}
          {availableSubcategories.length > 0 && (
            <select
              value={selectedSubcat}
              onChange={(e) => {
                setSelectedSubcat(e.target.value);
                setCurrentPage(1);
              }}
              className="form-select"
              style={{
                height: '34px',
                padding: '0 10px',
                fontSize: '0.78rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                minWidth: '150px',
              }}
            >
              <option value="">All Subcategories</option>
              {availableSubcategories.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.name}
                </option>
              ))}
            </select>
          )}

          {/* Stock Status Filter Buttons */}
          <div
            style={{
              display: 'inline-flex',
              padding: '2px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-surface-hover)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {[
              { id: 'all', label: 'All' },
              { id: 'in_stock', label: 'In Stock' },
              { id: 'low', label: 'Low' },
              { id: 'out', label: 'Out' },
            ].map(({ id, label }) => {
              const isActive = stockFilter === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setStockFilter(id);
                    setCurrentPage(1);
                  }}
                  style={{
                    border: 'none',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    background: isActive ? 'var(--brand-primary, #C52224)' : 'transparent',
                    color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Small Per Page Selector: 10, 15, 25 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Page Size:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="form-select"
              style={{
                height: '32px',
                padding: '0 8px',
                fontSize: '0.78rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                width: '68px',
                fontWeight: 600,
              }}
            >
              <option value="10">10</option>
              <option value="15">15</option>
              <option value="25">25</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div style={{ overflowX: 'auto', width: '100%' }}>
        <table
          className="inv-table"
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: '0.82rem',
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface-hover)',
                fontSize: '0.70rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--text-muted)',
              }}
            >
              <th style={{ padding: '10px 8px', width: '60px', textAlign: 'center' }}>Photo</th>
              <th style={{ padding: '10px 10px', minWidth: '180px' }}>Product Details</th>
              <th style={{ padding: '10px 8px', minWidth: '120px' }}>Subcategories</th>
              <th style={{ padding: '10px 8px', width: '110px' }}>UID / SKU</th>
              <th style={{ padding: '10px 8px', width: '90px' }}>Section</th>
              <th style={{ padding: '10px 8px', width: '120px' }}>Stock</th>
              <th style={{ padding: '10px 8px', width: '85px' }}>Selling</th>
              <th style={{ padding: '10px 8px', width: '85px' }}>MRP</th>
              <th style={{ padding: '10px 8px', width: '70px' }}>Weight</th>
              <th style={{ padding: '10px 8px', width: '95px' }}>Expiry</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', fontWeight: 600 }}>
                    <RefreshCw size={18} className="spin" style={{ color: 'var(--brand-primary)' }} />
                    <span>Loading section inventory...</span>
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={10} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-danger, #EF4444)' }}>
                  <AlertTriangle size={28} style={{ marginBottom: '8px' }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>{error}</p>
                </td>
              </tr>
            ) : paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: '48px 20px', textAlign: 'center' }}>
                  <Package size={40} style={{ color: 'var(--text-muted)', opacity: 0.45, marginBottom: '10px' }} />
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    No products found in this section
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {searchQuery || stockFilter !== 'all' || selectedSubcat
                      ? 'No items matched your current filters. Try resetting search or stock filters.'
                      : 'There are currently no items registered in this retail section.'}
                  </p>
                </td>
              </tr>
            ) : (
              paginatedItems.map((item) => {
                const isHovered = hoveredItemId === item.id;
                const volMetrics = calculateVolumeMetrics(item.length, item.width, item.height);
                const isMasterVariant = item._isVariantGroupParent || (item.variants && item.variants.length > 0);
                const variantCount = item._groupItems?.length || (item.variants?.length ? item.variants.length + 1 : 0);

                return (
                  <React.Fragment key={item.id}>
                    {/* LINE 1: Primary Product Information (READ-ONLY, NON-CLICKABLE) */}
                    <tr
                      onMouseEnter={() => setHoveredItemId(item.id)}
                      onMouseLeave={() => setHoveredItemId(null)}
                      style={{
                        borderBottom: 'none',
                        background: isHovered ? 'var(--bg-surface-hover)' : 'transparent',
                        transition: 'background 0.15s ease',
                        fontSize: '0.82rem',
                        cursor: 'default', // Explicitly not clickable
                      }}
                    >
                      {/* 1. Thumbnail Image (Spans both rows) */}
                      <td
                        rowSpan={2}
                        style={{
                          padding: '8px 6px',
                          textAlign: 'center',
                          verticalAlign: 'top',
                          width: '56px',
                          minWidth: '56px',
                          borderBottom: '4px solid var(--border-subtle)',
                          background: isHovered ? 'var(--bg-surface-hover)' : 'transparent',
                        }}
                      >
                        <div
                          onClick={() => {
                            if (item.primary_image_url) {
                              setLightboxImage({
                                src: item.primary_image_url,
                                name: item.name,
                                uid: item.uid,
                              });
                            }
                          }}
                          style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: 'var(--radius-sm)',
                            overflow: 'hidden',
                            background: 'var(--bg-surface-hover)',
                            border: '1px solid var(--border-subtle)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: item.primary_image_url ? 'zoom-in' : 'default',
                            transition: 'all 0.18s ease',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                          }}
                          onMouseEnter={(e) => {
                            if (item.primary_image_url) {
                              e.currentTarget.style.transform = 'scale(1.08)';
                              e.currentTarget.style.borderColor = 'var(--brand-primary)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.borderColor = 'var(--border-subtle)';
                          }}
                          title={item.primary_image_url ? `Inspect image for "${item.name}"` : item.name}
                        >
                          {item.primary_image_url ? (
                            <img
                              src={item.primary_image_url}
                              alt={item.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <ImageIcon size={18} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                          )}
                        </div>
                      </td>

                      {/* 2. Product Details (NOT clickable) */}
                      <td style={{ padding: '8px 10px 4px', maxWidth: '240px' }}>
                        <div>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: '0.84rem',
                              color: 'var(--text-primary)',
                              lineHeight: 1.25,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={item.name}
                          >
                            {item.name}
                          </div>

                          {item.legacy_uid && item.legacy_uid !== item.uid && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Legacy: <span className="mono">{item.legacy_uid}</span>
                            </div>
                          )}

                          {variantCount > 1 && (
                            <div style={{ marginTop: '3px' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  padding: '1px 7px',
                                  borderRadius: 'var(--radius-pill)',
                                  fontSize: '0.66rem',
                                  fontWeight: 700,
                                  background: 'rgba(59, 130, 246, 0.1)',
                                  color: '#3B82F6',
                                  border: '1px solid rgba(59, 130, 246, 0.25)',
                                }}
                              >
                                <Folder size={10} />
                                <span>{variantCount} Variants</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 3. Subcategories (Compact Badge List with Dropdown if > 2) */}
                      <td style={{ padding: '8px 8px 4px', maxWidth: '170px' }}>
                        <SubcategoriesBadgeList
                          subcategories={item.subcategories}
                          primarySubcategory={item.primary_subcategory}
                          primarySubcategoryId={item.primary_subcategory_id}
                          isOpen={activeSubcatViewer?.itemId === item.id}
                          onOpenDropdown={(anchorEl, primSub, allSubs) => {
                            handleToggleSubcatViewer(item.id, item.name, anchorEl, primSub, allSubs);
                          }}
                        />
                      </td>

                      {/* 4. UID / SKU (No barcode print button) */}
                      <td style={{ padding: '8px 8px 4px', whiteSpace: 'nowrap' }}>
                        <span
                          className="mono"
                          style={{
                            fontWeight: 700,
                            fontSize: '0.78rem',
                            padding: '2px 6px',
                            background: 'var(--bg-surface-hover)',
                            borderRadius: 'var(--radius-xs)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            display: 'inline-block',
                          }}
                        >
                          {item.uid}
                        </span>
                      </td>

                      {/* 5. Section Pill */}
                      <td style={{ padding: '8px 8px 4px', whiteSpace: 'nowrap' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-pill)',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: `${item.section_color || sectionColor}18`,
                            color: item.section_color || sectionColor,
                            border: `1px solid ${item.section_color || sectionColor}33`,
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: item.section_color || sectionColor,
                            }}
                          />
                          <span>{item.section_name || sectionName || 'Section'}</span>
                        </div>
                      </td>

                      {/* 6. Stock Level */}
                      <td style={{ padding: '8px 8px 4px', whiteSpace: 'nowrap' }}>
                        {renderStockBadge(item.quantity)}
                      </td>

                      {/* 7. Selling Price (₹) */}
                      <td style={{ padding: '8px 8px 4px', whiteSpace: 'nowrap' }}>
                        <span
                          className="mono"
                          style={{
                            fontWeight: 800,
                            fontSize: '0.86rem',
                            color: 'var(--text-primary)',
                          }}
                        >
                          ₹{parseFloat(item.selling_price || 0).toFixed(2)}
                        </span>
                      </td>

                      {/* 8. MRP (₹) */}
                      <td style={{ padding: '8px 8px 4px', whiteSpace: 'nowrap' }}>
                        <span
                          className="mono"
                          style={{
                            fontSize: '0.80rem',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          ₹{parseFloat(item.effective_mrp || item.selling_price || 0).toFixed(2)}
                        </span>
                      </td>

                      {/* 9. Weight */}
                      <td style={{ padding: '8px 8px 4px', whiteSpace: 'nowrap' }}>
                        {item.weight ? (
                          <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                            {item.weight}g
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>—</span>
                        )}
                      </td>

                      {/* 10. Expiry */}
                      <td style={{ padding: '8px 8px 4px', whiteSpace: 'nowrap' }}>
                        {item.expiry_date ? (
                          <span className="mono" style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                            {item.expiry_date}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>—</span>
                        )}
                      </td>
                    </tr>

                    {/* LINE 2: Dimensions, Volume, Volumetric Weight, Supplier, & Description Sub-Row */}
                    <tr
                      onMouseEnter={() => setHoveredItemId(item.id)}
                      onMouseLeave={() => setHoveredItemId(null)}
                      style={{
                        borderBottom: '4px solid var(--border-subtle)',
                        background: isHovered
                          ? 'var(--bg-surface-hover)'
                          : 'var(--bg-surface-subtle, rgba(0, 0, 0, 0.015))',
                        fontSize: '0.78rem',
                        transition: 'background 0.15s ease',
                        cursor: 'default', // Explicitly not clickable
                      }}
                    >
                      <td
                        colSpan={9}
                        style={{
                          padding: '2px 10px 10px 10px',
                          verticalAlign: 'middle',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            flexWrap: 'wrap',
                            width: '100%',
                          }}
                        >
                          {/* Dimensions Badge */}
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontSize: '0.74rem',
                              padding: '3px 10px',
                              borderRadius: 'var(--radius-pill)',
                              background: volMetrics.hasDimensions ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-surface-hover)',
                              border: volMetrics.hasDimensions ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid var(--border-subtle)',
                              color: volMetrics.hasDimensions ? '#3B82F6' : 'var(--text-muted)',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}
                            title="Product dimensions (Length × Width × Height in cm)"
                          >
                            <Ruler size={12} />
                            <span>{volMetrics.dimensionsStr || 'Dimensions: —'}</span>
                          </div>

                          {/* Calculated Physical Volume Badge */}
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontSize: '0.74rem',
                              padding: '3px 10px',
                              borderRadius: 'var(--radius-pill)',
                              background: volMetrics.hasDimensions ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-surface-hover)',
                              border: volMetrics.hasDimensions ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-subtle)',
                              color: volMetrics.hasDimensions ? '#10B981' : 'var(--text-muted)',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}
                            title="Calculated physical volume"
                          >
                            <Box size={12} />
                            <span>
                              {volMetrics.volumeCm3
                                ? `Volume: ${volMetrics.volumeCm3} cm³ (${volMetrics.volumeLiters} L)`
                                : 'Volume: —'}
                            </span>
                          </div>

                          {/* Calculated Volumetric Weight Badge */}
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontSize: '0.74rem',
                              padding: '3px 10px',
                              borderRadius: 'var(--radius-pill)',
                              background: volMetrics.hasDimensions ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-surface-hover)',
                              border: volMetrics.hasDimensions ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border-subtle)',
                              color: volMetrics.hasDimensions ? '#D97706' : 'var(--text-muted)',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}
                            title="Volumetric shipping weight ((L × W × H) / 5000 kg)"
                          >
                            <Scale size={12} />
                            <span>
                              {volMetrics.volumetricWeightKg
                                ? `Volumetric: ${volMetrics.volumetricWeightKg} kg`
                                : 'Volumetric: —'}
                            </span>
                          </div>

                          {/* Supplier Badge */}
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontSize: '0.74rem',
                              padding: '3px 10px',
                              borderRadius: 'var(--radius-pill)',
                              background: item.supplier_name ? 'rgba(139, 92, 246, 0.1)' : 'var(--bg-surface-hover)',
                              border: item.supplier_name ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid var(--border-subtle)',
                              color: item.supplier_name ? '#8B5CF6' : 'var(--text-muted)',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <Truck size={12} />
                            <span>{item.supplier_name ? `Supplier: ${item.supplier_name}` : 'Supplier: —'}</span>
                          </div>

                          {/* Description Snippet (if available) */}
                          {item.description && (
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '0.72rem',
                                color: 'var(--text-muted)',
                                maxWidth: '380px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={item.description}
                            >
                              <FileText size={12} style={{ flexShrink: 0 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.description}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Small Pagination Controls (10 - 15 items default) */}
      <div
        style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.80rem',
          color: 'var(--text-muted)',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Left: Summary text */}
        <div>
          <span>
            Showing{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {totalItems > 0 ? (safePage - 1) * pageSize + 1 : 0}
            </strong>
            {' – '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {Math.min(safePage * pageSize, totalItems)}
            </strong>{' '}
            of <strong style={{ color: 'var(--text-primary)' }}>{totalItems}</strong> items in this section
          </span>
        </div>

        {/* Right: Page Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setCurrentPage(1)}
            disabled={safePage <= 1}
            className="btn btn-secondary btn-sm"
            style={{
              height: '28px',
              width: '28px',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-sm)',
            }}
            title="First Page"
          >
            <ChevronsLeft size={14} />
          </button>

          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="btn btn-secondary btn-sm"
            style={{
              height: '28px',
              width: '28px',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-sm)',
            }}
            title="Previous Page"
          >
            <ChevronLeft size={14} />
          </button>

          <span style={{ margin: '0 8px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Page <strong style={{ color: 'var(--text-primary)' }}>{safePage}</strong> of{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{totalPages}</strong>
          </span>

          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="btn btn-secondary btn-sm"
            style={{
              height: '28px',
              width: '28px',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-sm)',
            }}
            title="Next Page"
          >
            <ChevronRight size={14} />
          </button>

          <button
            type="button"
            onClick={() => setCurrentPage(totalPages)}
            disabled={safePage >= totalPages}
            className="btn btn-secondary btn-sm"
            style={{
              height: '28px',
              width: '28px',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-sm)',
            }}
            title="Last Page"
          >
            <ChevronsRight size={14} />
          </button>
        </div>
      </div>

      {/* Lightbox Modal for Photo Inspection */}
      {lightboxImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(5, 8, 16, 0.88)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '24px',
            animation: 'fadeIn 0.18s ease-out',
          }}
          onClick={() => setLightboxImage(null)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '92vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              style={{
                position: 'absolute',
                top: '-46px',
                right: '0',
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#ffffff',
                borderRadius: '50%',
                width: '38px',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
              }}
              title="Close (Esc)"
            >
              <X size={18} />
            </button>

            <img
              src={lightboxImage.src}
              alt={lightboxImage.name || 'Product Image'}
              style={{
                maxWidth: '85vw',
                maxHeight: '75vh',
                objectFit: 'contain',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                boxShadow: '0 20px 48px rgba(0, 0, 0, 0.65)',
              }}
            />

            {(lightboxImage.name || lightboxImage.uid) && (
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(8px)',
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: '#FFFFFF',
                  fontSize: '0.85rem',
                }}
              >
                {lightboxImage.name && <span style={{ fontWeight: 700 }}>{lightboxImage.name}</span>}
                {lightboxImage.uid && (
                  <span className="mono" style={{ opacity: 0.75, fontSize: '0.78rem' }}>
                    UID: {lightboxImage.uid}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Floating Read-Only Subcategories Viewer Dropdown */}
      <SubcategoryViewerDropdown
        isOpen={Boolean(activeSubcatViewer)}
        anchorEl={activeSubcatViewer?.anchorEl}
        anchorRect={activeSubcatViewer?.anchorRect}
        itemName={activeSubcatViewer?.itemName}
        primarySubcat={activeSubcatViewer?.primarySubcat}
        subcategories={activeSubcatViewer?.allSubcategories || []}
        onClose={() => setActiveSubcatViewer(null)}
      />
    </div>
  );
}
