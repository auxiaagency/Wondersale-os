import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Upload,
  Check,
  Edit3,
  Eye,
  FileText,
  Copy,
  ExternalLink,
  ChevronRight,
  Image as ImageIcon,
  Layers,
  ArrowRight,
  Search,
  ArrowUpDown,
  SlidersHorizontal,
  RotateCcw
} from 'lucide-react';
import ItemImageModal from './ItemImageModal';
import {
  fetchAIDescriptionJobDetail,
  fetchActiveAIDescriptionJob,
  applyAIDescription,
  bulkApplyAIDescriptions,
  discardAIDescription,
  singleAIGenerateDescription,
  retryAIDescription,
  uploadItemImages
} from '../api';

export default function AIDescriptionReviewModal({
  jobId,
  isOpen,
  onClose,
  onItemUpdated
}) {
  const [job, setJob] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'in_progress', 'ready', 'skipped', 'failed', 'applied'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name_asc');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [imageFilter, setImageFilter] = useState('all'); // 'all' | 'has_image' | 'no_image'
  const [descriptionFilter, setDescriptionFilter] = useState('all'); // 'all' | 'has_draft' | 'has_desc' | 'no_desc'
  const [activeTabMode, setActiveTabMode] = useState({}); // { [itemId]: 'edit' | 'preview' }
  const [draftEdits, setDraftEdits] = useState({}); // { [itemId]: string }
  const [actionLoading, setActionLoading] = useState({}); // { [itemId]: boolean }
  const [bulkApplying, setBulkApplying] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [imageModalItem, setImageModalItem] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadJobData = useCallback(async () => {
    setErrorMessage(null);
    try {
      const targetJobId = jobId || 'active';
      const data = await fetchAIDescriptionJobDetail(targetJobId);
      if (data) {
        setJob(data.job || null);
        setItems(data.items || []);

        setDraftEdits(prev => {
          const next = { ...prev };
          (data.items || []).forEach(item => {
            const currentVal = next[item.id];
            // If the item has a newly generated draft from server, update it if not manually edited by user
            if (item.ai_description_draft) {
              if (currentVal === undefined || currentVal === '' || currentVal === item.description) {
                next[item.id] = item.ai_description_draft;
              }
            } else if (currentVal === undefined) {
              next[item.id] = item.description || '';
            }
          });
          return next;
        });
      }
    } catch (err) {
      console.error("Failed to load AI Studio data:", err);
      setErrorMessage(err.message || "Failed to connect to AI server. Please verify your connection or Gemini API keys.");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      loadJobData();

      // Poll every 2.5s while drawer is open so generated descriptions update in real time
      const interval = setInterval(() => {
        loadJobData();
      }, 2500);

      const handleDraftsUpdated = () => {
        loadJobData();
      };

      const handleJobStarted = () => {
        loadJobData();
      };

      window.addEventListener('ai-drafts-updated', handleDraftsUpdated);
      window.addEventListener('ai-job-started', handleJobStarted);

      return () => {
        clearInterval(interval);
        window.removeEventListener('ai-drafts-updated', handleDraftsUpdated);
        window.removeEventListener('ai-job-started', handleJobStarted);
      };
    }
  }, [isOpen, loadJobData]);

  const handleApplySingle = async (item) => {
    const customText = draftEdits[item.id] !== undefined ? draftEdits[item.id] : item.ai_description_draft;
    setActionLoading(prev => ({ ...prev, [item.id]: true }));
    try {
      const res = await applyAIDescription(item.id, customText);
      showToast(`Overwritten description for "${item.name}"`);
      setItems(prev => prev.map(it => it.id === item.id ? { ...it, ...res.item, description: res.item.description, ai_description_status: 'applied' } : it));
      window.dispatchEvent(new CustomEvent('ai-drafts-updated'));
      if (onItemUpdated) onItemUpdated(res.item);
    } catch (err) {
      showToast(err.message || 'Failed to apply description.');
    } finally {
      setActionLoading(prev => ({ ...prev, [item.id]: false }));
    }
  };

  const handleBulkApplyAll = async () => {
    const readyItems = items.filter(it => it.ai_description_status === 'ready' || (draftEdits[it.id] && it.ai_description_status !== 'applied'));
    if (readyItems.length === 0) {
      showToast("No ready drafts to apply.");
      return;
    }

    setBulkApplying(true);
    try {
      const readyIds = readyItems.map(it => it.id);
      const res = await bulkApplyAIDescriptions(readyIds);
      showToast(`Applied & overwritten descriptions for ${res.applied_count} products!`);
      window.dispatchEvent(new CustomEvent('ai-drafts-updated'));
      await loadJobData();
      if (onItemUpdated) onItemUpdated();
    } catch (err) {
      showToast(err.message || 'Failed to bulk apply descriptions.');
    } finally {
      setBulkApplying(false);
    }
  };

  const handleRegenerate = async (item) => {
    setActionLoading(prev => ({ ...prev, [item.id]: true }));
    try {
      const res = await singleAIGenerateDescription(item.id);
      showToast(`Regenerated draft for "${item.name}"`);
      setDraftEdits(prev => ({ ...prev, [item.id]: res.description }));
      setItems(prev => prev.map(it => it.id === item.id ? { ...it, ...res.item, ai_description_draft: res.description, ai_description_status: 'ready' } : it));
      window.dispatchEvent(new CustomEvent('ai-drafts-updated'));
      if (onItemUpdated) onItemUpdated(res.item);
    } catch (err) {
      showToast(err.message || 'Failed to generate description.');
    } finally {
      setActionLoading(prev => ({ ...prev, [item.id]: false }));
    }
  };

  const handleDiscardSingle = async (item) => {
    setActionLoading(prev => ({ ...prev, [item.id]: true }));
    try {
      const res = await discardAIDescription(item.id);
      showToast(`Draft discarded for "${item.name}"`);
      setItems(prev => prev.map(it => it.id === item.id ? { ...it, ...res.item, ai_description_draft: '', ai_description_status: 'none', ai_description_error: '' } : it));
      setDraftEdits(prev => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      window.dispatchEvent(new CustomEvent('ai-drafts-updated'));
      if (onItemUpdated) onItemUpdated(res.item);
    } catch (err) {
      showToast(err.message || 'Failed to discard description.');
    } finally {
      setActionLoading(prev => ({ ...prev, [item.id]: false }));
    }
  };

  const handleImageModalUpdated = async (updatedItem) => {
    if (!updatedItem) return;
    setItems(prev => prev.map(it => it.id === updatedItem.id ? { ...it, ...updatedItem } : it));
    if (onItemUpdated) onItemUpdated(updatedItem);

    const hasPhoto = Boolean(updatedItem.primary_image_url) || (updatedItem.images && updatedItem.images.length > 0);
    if (hasPhoto) {
      setActionLoading(prev => ({ ...prev, [updatedItem.id]: true }));
      try {
        showToast(`Generating AI description for "${updatedItem.name}"...`);
        const res = await singleAIGenerateDescription(updatedItem.id);
        showToast(`✨ AI description ready for "${updatedItem.name}"!`);
        setDraftEdits(prev => ({ ...prev, [updatedItem.id]: res.description }));
        setItems(prev => prev.map(it => it.id === updatedItem.id ? { ...it, ...res.item, ai_description_draft: res.description, ai_description_status: 'ready' } : it));
        if (res.job) {
          window.dispatchEvent(new CustomEvent('ai-job-started', { detail: res.job }));
        }
        window.dispatchEvent(new CustomEvent('ai-drafts-updated'));
        if (onItemUpdated) onItemUpdated(res.item);
      } catch (err) {
        showToast(err.message || 'Failed to generate description.');
        window.dispatchEvent(new CustomEvent('ai-drafts-updated'));
      } finally {
        setActionLoading(prev => ({ ...prev, [updatedItem.id]: false }));
      }
    }
  };

  if (!isOpen) return null;

  const inProgressCount = items.filter(it => it.ai_description_status === 'pending' || it.ai_description_status === 'generating').length;
  const readyCount = items.filter(it => it.ai_description_status === 'ready').length;
  const skippedCount = items.filter(it => it.ai_description_status === 'skipped_no_image').length;
  const failedCount = items.filter(it => it.ai_description_status === 'failed').length;
  const appliedCount = items.filter(it => it.ai_description_status === 'applied').length;
  const pendingCount = items.filter(it => it.ai_description_status !== 'applied').length;

  const handleResetFilters = () => {
    setSearchQuery('');
    setSortBy('name_asc');
    setCategoryFilter('all');
    setImageFilter('all');
    setDescriptionFilter('all');
  };

  const hasActiveFilters = searchQuery.trim() !== '' || categoryFilter !== 'all' || imageFilter !== 'all' || descriptionFilter !== 'all' || sortBy !== 'name_asc';

  // Extract unique categories from items
  const uniqueCategories = useMemo(() => {
    const cats = new Set();
    items.forEach(it => {
      if (it.category_name) cats.add(it.category_name);
      if (it.subcategories && Array.isArray(it.subcategories)) {
        it.subcategories.forEach(sub => {
          if (sub?.category?.name) cats.add(sub.category.name);
          else if (sub?.category_name) cats.add(sub.category_name);
          else if (typeof sub === 'string') cats.add(sub);
        });
      }
    });
    return Array.from(cats).filter(Boolean).sort();
  }, [items]);

  // Tab Filtering first
  const tabFilteredItems = useMemo(() => {
    return items.filter(it => {
      if (filter === 'all') return it.ai_description_status !== 'applied';
      if (filter === 'in_progress') return it.ai_description_status === 'pending' || it.ai_description_status === 'generating';
      if (filter === 'ready') return it.ai_description_status === 'ready';
      if (filter === 'skipped') return it.ai_description_status === 'skipped_no_image';
      if (filter === 'failed') return it.ai_description_status === 'failed';
      if (filter === 'applied') return it.ai_description_status === 'applied';
      return true;
    });
  }, [items, filter]);

  // Search, Category, Image, Description Filtering and Sorting
  const processedItems = useMemo(() => {
    let list = tabFilteredItems.filter(it => {
      // 1. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (it.name || '').toLowerCase();
        const barcode = (it.barcode || '').toLowerCase();
        const sku = (it.sku || '').toLowerCase();
        const cat = (it.category_name || (it.subcategories?.[0]?.category?.name) || (it.subcategories?.[0]?.category_name) || '').toLowerCase();
        const liveDesc = (it.description || '').toLowerCase();
        const draftDesc = (draftEdits[it.id] !== undefined ? draftEdits[it.id] : (it.ai_description_draft || '')).toLowerCase();
        const matches = name.includes(q) || barcode.includes(q) || sku.includes(q) || cat.includes(q) || liveDesc.includes(q) || draftDesc.includes(q);
        if (!matches) return false;
      }

      // 2. Category filter
      if (categoryFilter !== 'all') {
        const itemCat = it.category_name || (it.subcategories?.[0]?.category?.name) || (it.subcategories?.[0]?.category_name) || '';
        if (itemCat !== categoryFilter) return false;
      }

      // 3. Image filter
      const hasImg = (it.images && it.images.length > 0) || !!it.primary_image;
      if (imageFilter === 'has_image' && !hasImg) return false;
      if (imageFilter === 'no_image' && hasImg) return false;

      // 4. Description state filter
      const liveDesc = it.description && it.description.trim();
      const draftDesc = (draftEdits[it.id] !== undefined ? draftEdits[it.id] : it.ai_description_draft) && (draftEdits[it.id] || it.ai_description_draft).trim();
      if (descriptionFilter === 'has_draft' && !draftDesc) return false;
      if (descriptionFilter === 'has_desc' && !liveDesc) return false;
      if (descriptionFilter === 'no_desc' && liveDesc) return false;

      return true;
    });

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'name_desc') {
        return (b.name || '').localeCompare(a.name || '');
      }
      if (sortBy === 'price_asc') {
        return Number(a.selling_price || a.price || 0) - Number(b.selling_price || b.price || 0);
      }
      if (sortBy === 'price_desc') {
        return Number(b.selling_price || b.price || 0) - Number(a.selling_price || a.price || 0);
      }
      if (sortBy === 'stock_desc') {
        return Number(b.stock_quantity || b.stock || 0) - Number(a.stock_quantity || a.stock || 0);
      }
      if (sortBy === 'stock_asc') {
        return Number(a.stock_quantity || a.stock || 0) - Number(b.stock_quantity || b.stock || 0);
      }
      if (sortBy === 'status') {
        return (a.ai_description_status || '').localeCompare(b.ai_description_status || '');
      }
      if (sortBy === 'newest') {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
      return 0;
    });

    return list;
  }, [tabFilteredItems, searchQuery, categoryFilter, imageFilter, descriptionFilter, sortBy, draftEdits]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 8, 16, 0.85)',
        backdropFilter: 'blur(12px)',
        zIndex: 10000,
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'fadeIn 0.2s ease',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
      }}
    >
      {/* Slide-out Review Studio Drawer */}
      <div
        style={{
          width: '100%',
          maxWidth: '1000px',
          height: '100%',
          background: 'var(--bg-surface, #141829)',
          borderLeft: '1px solid var(--border-strong, rgba(255,255,255,0.12))',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.75)',
          color: 'var(--text-primary, #ffffff)',
          position: 'relative',
        }}
      >
        {/* Toast Notification */}
        {toastMessage && (
          <div
            style={{
              position: 'absolute',
              top: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 11000,
              background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)',
              color: '#ffffff',
              padding: '8px 18px',
              borderRadius: '9999px',
              boxShadow: '0 8px 24px rgba(99, 102, 241, 0.5)',
              fontSize: '0.84rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Sparkles size={15} />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Drawer Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
            background: 'var(--bg-main, #0B0E17)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 18px rgba(99, 102, 241, 0.35)',
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary, #fff)' }}>
                  AI Description Studio
                </h2>
                {job?.status === 'running' && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: 'rgba(99, 102, 241, 0.2)',
                      color: '#a5b4fc',
                      border: '1px solid rgba(99, 102, 241, 0.4)',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                    }}
                  >
                    Generating in Background
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted, #94a3b8)', margin: '2px 0 0 0' }}>
                Review, tweak, and overwrite descriptions for e-commerce website sync.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {readyCount > 0 && (
              <button
                type="button"
                onClick={handleBulkApplyAll}
                disabled={bulkApplying}
                className="btn btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  borderColor: '#10B981',
                  borderRadius: 'var(--radius-pill)',
                  padding: '8px 16px',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                }}
              >
                {bulkApplying ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                <span>Apply All Ready ({readyCount})</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary, #ffffff)',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filter Navigation Tabs */}
        <div
          style={{
            padding: '10px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface-hover, rgba(0,0,0,0.2))',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto',
            flexShrink: 0,
          }}
        >
          {[
            { id: 'all', label: 'All Products', count: pendingCount, color: '#6366F1' },
            { id: 'in_progress', label: 'In Progress', count: inProgressCount, color: '#A855F7' },
            { id: 'ready', label: 'Ready for Review', count: readyCount, color: '#10B981' },
            { id: 'skipped', label: 'No Photo Uploaded', count: skippedCount, color: '#F59E0B' },
            { id: 'failed', label: 'Failed', count: failedCount, color: '#EF4444' },
            { id: 'applied', label: 'Applied / Done', count: appliedCount, color: '#3B82F6' },
          ].map(tab => {
            const isActive = filter === tab.id;
            if (tab.id === 'in_progress' && tab.count === 0 && !isActive) return null;
            if (tab.id === 'failed' && tab.count === 0 && !isActive) return null;
            if (tab.id === 'applied' && tab.count === 0 && !isActive) return null;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-pill)',
                  border: isActive ? `1px solid ${tab.color}` : '1px solid var(--border-subtle)',
                  background: isActive ? `${tab.color}22` : 'transparent',
                  color: isActive ? tab.color : 'var(--text-secondary, #94a3b8)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    background: isActive ? tab.color : 'rgba(255,255,255,0.1)',
                    color: isActive ? '#ffffff' : 'inherit',
                    padding: '1px 6px',
                    borderRadius: '9999px',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search, Sort, and Filter Toolbar */}
        <div
          style={{
            padding: '10px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface-solid, var(--bg-surface))',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '180px' }}>
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by name, barcode, SKU, category, draft..."
                style={{
                  width: '100%',
                  padding: '6px 30px 6px 32px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--bg-input, var(--bg-surface-hover))',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.78rem',
                  outline: 'none',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Sort Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ArrowUpDown size={13} style={{ color: 'var(--text-muted)' }} />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--bg-surface-hover)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="name_asc">Sort: Name (A → Z)</option>
                <option value="name_desc">Sort: Name (Z → A)</option>
                <option value="price_asc">Sort: Price (Low → High)</option>
                <option value="price_desc">Sort: Price (High → Low)</option>
                <option value="stock_desc">Sort: Stock (High → Low)</option>
                <option value="stock_asc">Sort: Stock (Low → High)</option>
                <option value="status">Sort: Generation Status</option>
                <option value="newest">Sort: Newest Added</option>
              </select>
            </div>

            {/* Category Filter */}
            {uniqueCategories.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Layers size={13} style={{ color: 'var(--text-muted)' }} />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-pill)',
                    background: categoryFilter !== 'all' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-surface-hover)',
                    border: categoryFilter !== 'all' ? '1px solid #6366F1' : '1px solid var(--border-subtle)',
                    color: categoryFilter !== 'all' ? '#818cf8' : 'var(--text-primary)',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="all">All Categories ({uniqueCategories.length})</option>
                  {uniqueCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Image Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ImageIcon size={13} style={{ color: 'var(--text-muted)' }} />
              <select
                value={imageFilter}
                onChange={(e) => setImageFilter(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-pill)',
                  background: imageFilter !== 'all' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-surface-hover)',
                  border: imageFilter !== 'all' ? '1px solid #6366F1' : '1px solid var(--border-subtle)',
                  color: imageFilter !== 'all' ? '#818cf8' : 'var(--text-primary)',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="all">All Photos</option>
                <option value="has_image">Has Photo(s)</option>
                <option value="no_image">No Photo Uploaded</option>
              </select>
            </div>

            {/* Description State Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FileText size={13} style={{ color: 'var(--text-muted)' }} />
              <select
                value={descriptionFilter}
                onChange={(e) => setDescriptionFilter(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-pill)',
                  background: descriptionFilter !== 'all' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-surface-hover)',
                  border: descriptionFilter !== 'all' ? '1px solid #6366F1' : '1px solid var(--border-subtle)',
                  color: descriptionFilter !== 'all' ? '#818cf8' : 'var(--text-primary)',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="all">All Description States</option>
                <option value="has_draft">Has AI Draft Ready</option>
                <option value="has_desc">Has Live Description</option>
                <option value="no_desc">Missing Live Description</option>
              </select>
            </div>

            {/* Reset Filters Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: 'var(--color-danger, #ef4444)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  marginLeft: 'auto',
                }}
                title="Reset all search & filter options"
              >
                <RotateCcw size={11} />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Result Count and Active Filters Summary */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <span>
              Showing <strong style={{ color: 'var(--text-primary)' }}>{processedItems.length}</strong> of {tabFilteredItems.length} products in this tab
              {searchQuery && <span> matching &ldquo;{searchQuery}&rdquo;</span>}
            </span>
          </div>
        </div>

        {/* Main List Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Error Banner if API connection or batch job failed */}
          {errorMessage && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '14px',
                padding: '14px 18px',
                color: '#fca5a5',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                fontSize: '0.84rem',
              }}
            >
              <AlertTriangle size={20} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <strong style={{ display: 'block', color: '#f87171', marginBottom: '2px' }}>AI Engine Notice</strong>
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={loadJobData}
                style={{
                  background: '#EF4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  padding: '6px 12px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: '12px', color: 'var(--text-muted)' }}>
              <RefreshCw size={28} className="animate-spin" style={{ color: '#6366F1' }} />
              <span style={{ fontSize: '0.88rem' }}>Loading product catalog drafts...</span>
            </div>
          ) : processedItems.length === 0 ? (
            hasActiveFilters ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '12px', textAlign: 'center' }}>
                <Search size={32} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>No Matching Products Found</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    No products match your current search and filter settings.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  style={{
                    borderRadius: 'var(--radius-pill)',
                    padding: '6px 16px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    background: 'var(--bg-surface-hover)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <RotateCcw size={12} />
                  <span>Clear Search &amp; Filters</span>
                </button>
              </div>
            ) : filter === 'all' && pendingCount === 0 && appliedCount > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '14px', textAlign: 'center' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.35)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: 800, color: '#34d399' }}>All Product Descriptions Applied!</h3>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '420px' }}>
                    All {appliedCount} product descriptions in this batch have been applied and overwritten to the catalog.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFilter('applied')}
                  className="btn btn-primary"
                  style={{ borderRadius: 'var(--radius-pill)', padding: '8px 20px', fontSize: '0.82rem', fontWeight: 700, background: '#3B82F6', borderColor: '#3B82F6', cursor: 'pointer' }}
                >
                  View Applied Products ({appliedCount})
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: '8px', color: 'var(--text-muted)' }}>
                <FileText size={36} style={{ opacity: 0.4 }} />
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>No items in this tab.</span>
              </div>
            )
          ) : (
            processedItems.map(item => {
              const currentDraft = draftEdits[item.id] !== undefined ? draftEdits[item.id] : (item.ai_description_draft || '');
              const mode = activeTabMode[item.id] || 'edit';
              const isLoading = !!actionLoading[item.id];
              const isInProgress = item.ai_description_status === 'pending' || item.ai_description_status === 'generating';
              const isSkippedNoImage = item.ai_description_status === 'skipped_no_image';
              const isSkipped = isSkippedNoImage;
              const isReady = item.ai_description_status === 'ready';
              const isApplied = item.ai_description_status === 'applied';
              const isFailed = item.ai_description_status === 'failed';

              return (
                <div
                  key={item.id}
                  style={{
                    background: 'var(--bg-main, #0B0E17)',
                    border: isReady ? '1px solid rgba(99, 102, 241, 0.4)' : isInProgress ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid var(--border-subtle)',
                    borderRadius: '16px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
                  }}
                >
                  {/* Item Header Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap' }}>
                    
                    {/* Left: Thumbnail & Details */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                      <div
                        onClick={() => setImageModalItem(item)}
                        style={{
                          width: '80px',
                          height: '80px',
                          borderRadius: '12px',
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid var(--border-subtle)',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          cursor: 'pointer',
                          position: 'relative',
                        }}
                        title="Click to view, upload, or crop product photos"
                      >
                        {item.primary_image_url ? (
                          <img
                            src={item.primary_image_url}
                            alt={item.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            <ImageIcon size={22} style={{ opacity: 0.4, margin: '0 auto 2px' }} />
                            <span style={{ fontSize: '0.65rem', display: 'block' }}>Add Photo</span>
                          </div>
                        )}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                          <h4 style={{ fontSize: '0.96rem', fontWeight: 800, margin: 0, color: 'var(--text-primary, #fff)' }}>
                            {item.name}
                          </h4>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '0.74rem',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-xs)',
                              background: 'rgba(255,255,255,0.08)',
                              color: 'var(--text-secondary, #94a3b8)',
                            }}
                          >
                            UID: {item.uid}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.76rem', color: 'var(--text-muted, #94a3b8)', flexWrap: 'wrap' }}>
                          {item.primary_subcategory && (
                            <span style={{ color: '#818cf8', fontWeight: 600 }}>{item.primary_subcategory.name}</span>
                          )}
                          <span>•</span>
                          <span>Price: <strong style={{ color: 'var(--text-primary)' }}>₹{item.selling_price}</strong></span>
                          {item.mrp && (
                            <>
                              <span>•</span>
                              <span>MRP: <strong style={{ color: 'var(--text-primary)' }}>₹{item.mrp}</strong></span>
                            </>
                          )}
                        </div>

                        {/* Status Tag */}
                        <div style={{ marginTop: '8px' }}>
                          {isInProgress && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '9999px', background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.4)', color: '#c084fc', fontSize: '0.72rem', fontWeight: 700 }}>
                              <Sparkles size={12} className="animate-spin" />
                              {item.ai_description_status === 'generating' ? 'AI Analyzing Photo & Writing...' : 'In Progress (Queued)...'}
                            </span>
                          )}
                          {isReady && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '9999px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', fontSize: '0.72rem', fontWeight: 700 }}>
                              <Sparkles size={12} />
                              Ready to Overwrite Description
                            </span>
                          )}
                          {isApplied && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '9999px', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60a5fa', fontSize: '0.72rem', fontWeight: 700 }}>
                              <Check size={12} />
                              Applied &amp; Active on Product
                            </span>
                          )}
                          {isSkippedNoImage && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '9999px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fbbf24', fontSize: '0.72rem', fontWeight: 700 }}>
                              <AlertTriangle size={12} />
                              Skipped (Product image required for AI vision)
                            </span>
                          )}
                          {isFailed && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '9999px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '0.72rem', fontWeight: 700 }}>
                              <AlertTriangle size={12} />
                              {item.ai_description_error || 'Generation Failed'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Action Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {isSkippedNoImage && (
                        <button
                          type="button"
                          onClick={() => setImageModalItem(item)}
                          disabled={isLoading}
                          className="btn btn-sm"
                          style={{
                            background: '#F59E0B',
                            borderColor: '#F59E0B',
                            color: '#fff',
                            borderRadius: 'var(--radius-pill)',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            padding: '6px 14px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                          }}
                        >
                          <Upload size={13} />
                          <span>Upload Photo &amp; Generate</span>
                        </button>
                      )}

                      {(isReady || isFailed || isApplied) && (
                        <button
                          type="button"
                          onClick={() => handleRegenerate(item)}
                          disabled={isLoading || !item.primary_image_url}
                          className="btn btn-secondary btn-sm"
                          style={{
                            borderRadius: 'var(--radius-pill)',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            padding: '6px 12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                          }}
                          title="Regenerate from photo using Gemini AI"
                        >
                          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                          <span>Regenerate</span>
                        </button>
                      )}

                      {(isReady || (currentDraft && !isApplied) || isFailed || isSkipped) && (
                        <button
                          type="button"
                          onClick={() => handleDiscardSingle(item)}
                          disabled={isLoading}
                          className="btn btn-secondary btn-sm"
                          style={{
                            borderRadius: 'var(--radius-pill)',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            padding: '6px 12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            background: 'rgba(255, 255, 255, 0.04)',
                            borderColor: 'rgba(255, 255, 255, 0.12)',
                          }}
                          title="Don't apply and discard this draft"
                        >
                          <X size={13} />
                          <span>Don't Apply</span>
                        </button>
                      )}

                      {(isReady || (currentDraft && !isApplied)) && (
                        <button
                          type="button"
                          onClick={() => handleApplySingle(item)}
                          disabled={isLoading || !currentDraft.trim()}
                          className="btn btn-primary btn-sm"
                          style={{
                            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                            borderColor: '#10B981',
                            color: '#fff',
                            borderRadius: 'var(--radius-pill)',
                            fontSize: '0.76rem',
                            fontWeight: 800,
                            padding: '6px 16px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                          }}
                        >
                          <Check size={14} />
                          <span>Apply &amp; Overwrite</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* In Progress Banner inside card */}
                  {isInProgress && (
                    <div
                      style={{
                        background: 'rgba(168, 85, 247, 0.08)',
                        border: '1px dashed rgba(168, 85, 247, 0.35)',
                        borderRadius: '12px',
                        padding: '14px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        color: '#e9d5ff',
                      }}
                    >
                      <RefreshCw size={18} className="animate-spin" style={{ color: '#c084fc', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#f3e8ff' }}>
                          Generating Description in Background...
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#c084fc', marginTop: '2px' }}>
                          Gemini Vision is inspecting product image labels, packaging, and metadata. Draft will appear here automatically.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Description Box */}
                  {!isInProgress && (isReady || isApplied || isFailed || currentDraft) && (
                    <div
                      style={{
                        background: 'var(--bg-surface, #141829)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '12px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      {/* Editor Sub-header Tabs */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => setActiveTabMode(prev => ({ ...prev, [item.id]: 'edit' }))}
                            style={{
                              padding: '3px 10px',
                              borderRadius: '6px',
                              border: 'none',
                              background: mode === 'edit' ? '#6366F1' : 'transparent',
                              color: mode === 'edit' ? '#ffffff' : 'var(--text-muted)',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Edit3 size={12} />
                            <span>Edit Markdown</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTabMode(prev => ({ ...prev, [item.id]: 'preview' }))}
                            style={{
                              padding: '3px 10px',
                              borderRadius: '6px',
                              border: 'none',
                              background: mode === 'preview' ? '#6366F1' : 'transparent',
                              color: mode === 'preview' ? '#ffffff' : 'var(--text-muted)',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Eye size={12} />
                            <span>Formatted Preview</span>
                          </button>
                        </div>

                        <span
                          style={{
                            fontSize: '0.70rem',
                            fontWeight: 600,
                            color: currentDraft.length > 1450 ? 'var(--color-danger, #ef4444)' : 'var(--text-muted)',
                          }}
                        >
                          {currentDraft.length}/1500 characters
                        </span>
                      </div>

                      {mode === 'edit' ? (
                        <textarea
                          rows={6}
                          maxLength={1500}
                          value={currentDraft}
                          onChange={(e) => setDraftEdits(prev => ({ ...prev, [item.id]: e.target.value.slice(0, 1500) }))}
                          placeholder="Generated description markdown will appear here..."
                          className="form-input"
                          style={{
                            width: '100%',
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            fontSize: '0.80rem',
                            fontFamily: 'inherit',
                            lineHeight: '1.6',
                            color: 'var(--text-primary)',
                            resize: 'vertical',
                            padding: 0,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            fontSize: '0.80rem',
                            lineHeight: '1.6',
                            color: 'var(--text-secondary)',
                            whiteSpace: 'pre-wrap',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            padding: '4px 0',
                          }}
                        >
                          {currentDraft || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No description draft.</span>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-main, #0B0E17)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}
        >
          <div>
            Total: <strong style={{ color: 'var(--text-primary)' }}>{items.length}</strong> • In Progress: <strong style={{ color: '#A855F7' }}>{inProgressCount}</strong> • Ready: <strong style={{ color: '#10B981' }}>{readyCount}</strong> • Done: <strong style={{ color: '#3B82F6' }}>{appliedCount}</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ borderRadius: 'var(--radius-pill)', padding: '6px 16px' }}
          >
            Done
          </button>
        </div>
      </div>

      {/* Standard Product Photo Management & Universal 1:1 Crop Modal */}
      {imageModalItem && (
        <ItemImageModal
          item={imageModalItem}
          onClose={() => setImageModalItem(null)}
          onUpdateItem={handleImageModalUpdated}
        />
      )}
    </div>
  );
}
