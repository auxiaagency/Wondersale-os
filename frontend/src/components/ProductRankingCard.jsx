import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Medal,
  Award,
  Crown,
  TrendingUp,
  DollarSign,
  Package,
  Percent,
  Zap,
  Boxes,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  CheckCircle2,
  ChevronDown,
  Layers,
  Tag,
  Truck,
  Store as StoreIcon,
  ArrowUpDown,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Sparkles,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

const METRIC_CONFIG = {
  revenue: {
    id: 'revenue',
    label: 'Total Sales',
    shortLabel: 'Sales',
    icon: DollarSign,
    color: '#10B981',
    bgColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    format: (val, curr) => `${curr} ${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    description: 'Total revenue generated from completed customer sales orders',
  },
  profit: {
    id: 'profit',
    label: 'Total Profit',
    shortLabel: 'Profit',
    icon: TrendingUp,
    color: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.12)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    format: (val, curr) => {
      const n = Number(val || 0);
      const prefix = n >= 0 ? '+' : '-';
      return `${prefix}${curr} ${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },
    description: 'Gross profit earned (Selling Price - Cost Price) on sold units',
  },
  units_sold: {
    id: 'units_sold',
    label: 'Quantity Sold',
    shortLabel: 'Units Sold',
    icon: Package,
    color: '#8B5CF6',
    bgColor: 'rgba(139, 92, 246, 0.12)',
    borderColor: 'rgba(139, 92, 246, 0.3)',
    format: (val) => `${Number(val || 0).toLocaleString('en-IN')} units`,
    description: 'Total number of items sold across completed sale orders',
  },
  margin_pct: {
    id: 'margin_pct',
    label: 'Profit Margin %',
    shortLabel: 'Margin %',
    icon: Percent,
    color: '#EC4899',
    bgColor: 'rgba(236, 72, 153, 0.12)',
    borderColor: 'rgba(236, 72, 153, 0.3)',
    format: (val) => `${Number(val || 0).toFixed(1)}%`,
    description: 'Gross profit percentage on retail sales or catalog markup',
  },
  velocity: {
    id: 'velocity',
    label: 'Sales Velocity',
    shortLabel: 'Velocity',
    icon: Zap,
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    format: (val) => `${Number(val || 0).toFixed(2)} units/day`,
    description: 'Average units sold per day since product was cataloged',
  },
  stock: {
    id: 'stock',
    label: 'Current Stock',
    shortLabel: 'Stock',
    icon: Boxes,
    color: '#06B6D4',
    bgColor: 'rgba(6, 182, 212, 0.12)',
    borderColor: 'rgba(6, 182, 212, 0.3)',
    format: (val) => `${Number(val || 0).toLocaleString('en-IN')} in stock`,
    description: 'Current real-time inventory quantity available on hand',
  },
};

export default function ProductRankingCard({
  item,
  analytics,
  loading = false,
  currencySymbol = 'Rs.',
  onSelectPeerItem,
}) {
  const [scopeType, setScopeType] = useState('all'); // 'all' | 'category' | 'subcategory' | 'supplier'
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState('revenue');
  const [sortAscending, setSortAscending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const scopes = analytics?.rankings?.scopes || null;

  // Extract available subcategories and categories
  const subcategoryList = useMemo(() => {
    if (scopes?.subcategories && scopes.subcategories.length > 0) {
      return scopes.subcategories;
    }
    return [];
  }, [scopes]);

  const categoryList = useMemo(() => {
    if (scopes?.categories && scopes.categories.length > 0) {
      return scopes.categories;
    }
    return [];
  }, [scopes]);

  const supplierScope = scopes?.supplier || null;

  // Auto-select primary subcategory or first subcategory if not yet chosen
  const activeSubcategoryId = useMemo(() => {
    if (selectedSubcategoryId) {
      const exists = subcategoryList.some((sc) => String(sc.subcategory_id) === String(selectedSubcategoryId));
      if (exists) return selectedSubcategoryId;
    }
    const primary = subcategoryList.find((sc) => sc.is_primary);
    return primary ? primary.subcategory_id : (subcategoryList[0]?.subcategory_id || null);
  }, [selectedSubcategoryId, subcategoryList]);

  // Auto-select primary category or first category
  const activeCategoryId = useMemo(() => {
    if (selectedCategoryId) {
      const exists = categoryList.some((c) => String(c.category_id) === String(selectedCategoryId));
      if (exists) return selectedCategoryId;
    }
    const primary = categoryList.find((c) => c.is_primary);
    return primary ? primary.category_id : (categoryList[0]?.category_id || null);
  }, [selectedCategoryId, categoryList]);

  // Active Scope Data object
  const activeScopeData = useMemo(() => {
    if (!scopes) return null;
    if (scopeType === 'all') {
      return scopes.all || null;
    }
    if (scopeType === 'category') {
      if (categoryList.length === 0) return null;
      return categoryList.find((c) => String(c.category_id) === String(activeCategoryId)) || categoryList[0] || null;
    }
    if (scopeType === 'subcategory') {
      if (subcategoryList.length === 0) return null;
      return subcategoryList.find((sc) => String(sc.subcategory_id) === String(activeSubcategoryId)) || subcategoryList[0] || null;
    }
    if (scopeType === 'supplier') {
      return supplierScope || null;
    }
    return scopes.all || null;
  }, [scopes, scopeType, activeCategoryId, activeSubcategoryId, categoryList, subcategoryList, supplierScope]);

  // Metric key mapping
  const metricDataKey = useMemo(() => {
    switch (selectedMetric) {
      case 'revenue': return 'by_revenue';
      case 'profit': return 'by_profit';
      case 'units_sold': return 'by_units';
      case 'margin_pct': return 'by_margin';
      case 'velocity': return 'by_velocity';
      case 'stock': return 'by_stock';
      default: return 'by_revenue';
    }
  }, [selectedMetric]);

  // Current metric ranking details for this scope
  const currentMetricDetails = useMemo(() => {
    if (!activeScopeData) return null;
    return activeScopeData[metricDataKey] || null;
  }, [activeScopeData, metricDataKey]);

  // Filtered and sorted leaderboard items
  const sortedLeaderboardItems = useMemo(() => {
    if (!activeScopeData?.all_items_ranked) {
      return currentMetricDetails?.leaderboard || [];
    }

    let items = [...activeScopeData.all_items_ranked];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter((it) => (
        (it.name && it.name.toLowerCase().includes(q)) ||
        (it.uid && it.uid.toLowerCase().includes(q))
      ));
    }

    // Sort by selected metric
    items.sort((a, b) => {
      const valA = Number(a[selectedMetric] || 0);
      const valB = Number(b[selectedMetric] || 0);
      return sortAscending ? valA - valB : valB - valA;
    });

    // Re-compute display ranks
    return items.map((it, idx) => ({
      ...it,
      displayRank: idx + 1,
    }));
  }, [activeScopeData, selectedMetric, sortAscending, searchQuery, currentMetricDetails]);

  const activeMetricCfg = METRIC_CONFIG[selectedMetric] || METRIC_CONFIG.revenue;
  const MetricIcon = activeMetricCfg.icon;

  // Podium Items (Top 3 in active scope)
  const podiumItems = useMemo(() => {
    if (!activeScopeData?.all_items_ranked || activeScopeData.all_items_ranked.length < 2) {
      return [];
    }
    const sorted = [...activeScopeData.all_items_ranked].sort((a, b) => {
      const valA = Number(a[selectedMetric] || 0);
      const valB = Number(b[selectedMetric] || 0);
      return valB - valA;
    });
    return sorted.slice(0, 3);
  }, [activeScopeData, selectedMetric]);

  // Current item rank info
  const currentRank = currentMetricDetails?.rank || null;
  const totalItems = activeScopeData?.total_items || 0;
  const percentile = currentMetricDetails?.percentile || 0;
  const currValue = currentMetricDetails?.current_value ?? 0;
  const avgValue = currentMetricDetails?.avg_value ?? 0;
  const leaderValue = currentMetricDetails?.leader_value ?? 0;
  const leaderName = currentMetricDetails?.leader_name || '';
  const diffVsAvg = currentMetricDetails?.diff_vs_avg_pct ?? 0;

  // Determine Rank Tier / Medal Badge
  const rankTier = useMemo(() => {
    if (!currentRank || totalItems === 0) return { label: 'Unranked', color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.1)' };
    if (currentRank === 1) return { label: 'Category Leader #1', color: '#FEC501', bg: 'rgba(254, 197, 1, 0.16)', border: '#FEC501', isFirst: true };
    if (currentRank === 2) return { label: 'Runner Up #2', color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.16)', border: '#CBD5E1', isSecond: true };
    if (currentRank === 3) return { label: 'Podium Rank #3', color: '#D97706', bg: 'rgba(217, 119, 6, 0.16)', border: '#D97706', isThird: true };
    if (percentile >= 80) return { label: `Top ${Math.max(1, Math.round(100 - percentile))}% Performer`, color: '#10B981', bg: 'rgba(16, 185, 129, 0.14)', border: 'rgba(16, 185, 129, 0.35)' };
    if (percentile >= 50) return { label: 'Upper Quartile', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.14)', border: 'rgba(59, 130, 246, 0.35)' };
    return { label: 'Standard Catalog', color: 'var(--text-secondary)', bg: 'var(--bg-surface-hover)', border: 'var(--border-subtle)' };
  }, [currentRank, totalItems, percentile]);

  // Loading skeleton state
  if (loading || !analytics) {
    return (
      <div
        className="glass-panel"
        style={{
          width: '100%',
          marginTop: '32px',
          borderRadius: '20px',
          padding: '32px',
          background: 'var(--bg-surface-solid)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--bg-surface-hover)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ width: '220px', height: '20px', borderRadius: '6px', background: 'var(--bg-surface-hover)' }} />
            <div style={{ width: '340px', height: '14px', borderRadius: '4px', background: 'var(--bg-surface-hover)' }} />
          </div>
        </div>
        <div style={{ width: '100%', height: '140px', borderRadius: '14px', background: 'var(--bg-surface-hover)' }} />
      </div>
    );
  }

  return (
    <section
      aria-label="Product Performance and Rankings"
      className="glass-panel product-ranking-card"
      style={{
        width: '100%',
        marginTop: '32px',
        borderRadius: '20px',
        padding: '32px 36px',
        background: 'var(--bg-surface-solid)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: '26px',
      }}
    >
      {/* 1. HEADER & ACTIVE SCOPE BADGE */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          paddingBottom: '20px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(254, 197, 1, 0.2) 0%, rgba(197, 34, 36, 0.2) 100%)',
              border: '1px solid rgba(254, 197, 1, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FEC501',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(254, 197, 1, 0.15)',
            }}
          >
            <Trophy size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                Product Performance &amp; Ranking
              </h2>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: '100px',
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Sparkles size={11} style={{ color: '#FEC501' }} /> Live Analytics
              </span>
            </div>
            <p
              style={{
                fontSize: '0.82rem',
                color: 'var(--text-muted)',
                margin: '3px 0 0 0',
              }}
            >
              Benchmark this item across catalog scopes and compare sales, profits, velocity, and stock against peers.
            </p>
          </div>
        </div>

        {/* Current Active Group Indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-main)',
            border: '1px solid var(--border-subtle)',
            padding: '7px 14px',
            borderRadius: 'var(--radius-pill)',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Comparing in:</span>
          <strong style={{ color: 'var(--text-primary)' }}>
            {activeScopeData?.scope_label || 'All Products'}
          </strong>
          <span
            style={{
              padding: '2px 7px',
              borderRadius: '100px',
              background: 'var(--brand-ruby-glow)',
              color: 'var(--brand-primary)',
              fontWeight: 700,
              fontSize: '0.72rem',
            }}
          >
            {totalItems} items
          </span>
        </div>
      </div>

      {/* 2. CONTROLS: SCOPE SELECTOR & METRIC SELECTOR */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Scope Type Tabs */}
        <div>
          <div style={{ fontSize: '0.70rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            1. Select Scope of Ranking
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            {/* All Products */}
            <button
              type="button"
              onClick={() => setScopeType('all')}
              className="btn btn-sm"
              style={{
                borderRadius: '10px',
                padding: '8px 15px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                background: scopeType === 'all' ? 'var(--brand-primary)' : 'var(--bg-main)',
                color: scopeType === 'all' ? '#FFFFFF' : 'var(--text-secondary)',
                border: scopeType === 'all' ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                boxShadow: scopeType === 'all' ? '0 3px 10px rgba(197, 34, 36, 0.25)' : 'none',
              }}
            >
              <StoreIcon size={14} />
              <span>All Products ({scopes?.all?.total_items || 0})</span>
            </button>

            {/* Category Scope */}
            {categoryList.length > 0 && (
              <button
                type="button"
                onClick={() => setScopeType('category')}
                className="btn btn-sm"
                style={{
                  borderRadius: '10px',
                  padding: '8px 15px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  background: scopeType === 'category' ? 'var(--brand-primary)' : 'var(--bg-main)',
                  color: scopeType === 'category' ? '#FFFFFF' : 'var(--text-secondary)',
                  border: scopeType === 'category' ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                  boxShadow: scopeType === 'category' ? '0 3px 10px rgba(197, 34, 36, 0.25)' : 'none',
                }}
              >
                <Tag size={14} />
                <span>Category ({categoryList.length > 1 ? `${categoryList.length} Categories` : categoryList[0]?.scope_label})</span>
              </button>
            )}

            {/* Subcategory Scope */}
            {subcategoryList.length > 0 && (
              <button
                type="button"
                onClick={() => setScopeType('subcategory')}
                className="btn btn-sm"
                style={{
                  borderRadius: '10px',
                  padding: '8px 15px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  background: scopeType === 'subcategory' ? 'var(--brand-primary)' : 'var(--bg-main)',
                  color: scopeType === 'subcategory' ? '#FFFFFF' : 'var(--text-secondary)',
                  border: scopeType === 'subcategory' ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                  boxShadow: scopeType === 'subcategory' ? '0 3px 10px rgba(197, 34, 36, 0.25)' : 'none',
                }}
              >
                <Layers size={14} />
                <span>
                  Subcategory ({subcategoryList.length > 1 ? `${subcategoryList.length} Options` : subcategoryList[0]?.scope_label})
                </span>
              </button>
            )}

            {/* Supplier Scope */}
            <button
              type="button"
              onClick={() => {
                if (supplierScope) setScopeType('supplier');
              }}
              disabled={!supplierScope}
              className="btn btn-sm"
              title={supplierScope ? `Filter to items supplied by ${supplierScope.supplier_name}` : 'No supplier assigned to this product'}
              style={{
                borderRadius: '10px',
                padding: '8px 15px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: supplierScope ? 'pointer' : 'not-allowed',
                opacity: supplierScope ? 1 : 0.45,
                transition: 'all 0.18s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                background: scopeType === 'supplier' ? 'var(--brand-primary)' : 'var(--bg-main)',
                color: scopeType === 'supplier' ? '#FFFFFF' : 'var(--text-secondary)',
                border: scopeType === 'supplier' ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                boxShadow: scopeType === 'supplier' ? '0 3px 10px rgba(197, 34, 36, 0.25)' : 'none',
              }}
            >
              <Truck size={14} />
              <span>
                {supplierScope ? `Supplier: ${supplierScope.supplier_name} (${supplierScope.total_items})` : 'Supplier (Unassigned)'}
              </span>
            </button>
          </div>
        </div>

        {/* Subcategory Picker (if Subcategory scope is active and product has multiple subcategories) */}
        {scopeType === 'subcategory' && subcategoryList.length > 1 && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'var(--bg-main)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              <Layers size={13} style={{ color: 'var(--brand-primary)' }} />
              <span>Select Subcategory to Compare:</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {subcategoryList.map((sc) => {
                const isSelected = String(sc.subcategory_id) === String(activeSubcategoryId);
                return (
                  <button
                    key={sc.subcategory_id}
                    type="button"
                    onClick={() => setSelectedSubcategoryId(sc.subcategory_id)}
                    style={{
                      borderRadius: '8px',
                      padding: '5px 12px',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: isSelected ? 'var(--brand-primary)' : 'var(--bg-surface)',
                      color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                      border: isSelected ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                      boxShadow: isSelected ? '0 2px 8px rgba(197, 34, 36, 0.2)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {sc.subcategory_name} ({sc.total_items} items)
                    {sc.is_primary && <span style={{ marginLeft: '4px', opacity: 0.8 }}>(Primary)</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Category Picker (if Category scope is active and product has multiple parent categories) */}
        {scopeType === 'category' && categoryList.length > 1 && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'var(--bg-main)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              <Tag size={13} style={{ color: 'var(--brand-primary)' }} />
              <span>Select Category to Compare:</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {categoryList.map((cat) => {
                const isSelected = String(cat.category_id) === String(activeCategoryId);
                return (
                  <button
                    key={cat.category_id}
                    type="button"
                    onClick={() => setSelectedCategoryId(cat.category_id)}
                    style={{
                      borderRadius: '8px',
                      padding: '5px 12px',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: isSelected ? 'var(--brand-primary)' : 'var(--bg-surface)',
                      color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                      border: isSelected ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                      boxShadow: isSelected ? '0 2px 8px rgba(197, 34, 36, 0.2)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {cat.category_name} ({cat.total_items} items)
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Metric Selector Pills */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ fontSize: '0.70rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              2. Rank by Commercial Metric
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setSortAscending((prev) => !prev)}
                className="btn btn-sm"
                title={`Currently sorted ${sortAscending ? 'Lowest to Highest' : 'Highest to Lowest'}. Click to toggle.`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  padding: '6px 13px',
                  borderRadius: '10px',
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  boxShadow: 'var(--shadow-sm)',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--brand-primary)';
                  e.currentTarget.style.background = 'var(--bg-surface-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.background = 'var(--bg-main)';
                }}
              >
                {sortAscending ? (
                  <ArrowUpNarrowWide size={14} style={{ color: 'var(--brand-primary)' }} />
                ) : (
                  <ArrowDownWideNarrow size={14} style={{ color: 'var(--brand-primary)' }} />
                )}
                <span style={{ color: 'var(--text-muted)' }}>Order:</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  {sortAscending ? 'Lowest First' : 'Highest First'}
                </span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {Object.values(METRIC_CONFIG).map((m) => {
              const isSelected = selectedMetric === m.id;
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMetric(m.id)}
                  className="btn btn-sm"
                  style={{
                    borderRadius: '10px',
                    padding: '7px 14px',
                    fontSize: '0.80rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.18s ease',
                    background: isSelected ? m.bgColor : 'var(--bg-main)',
                    color: isSelected ? m.color : 'var(--text-secondary)',
                    border: isSelected ? `1.5px solid ${m.color}` : '1px solid var(--border-subtle)',
                    boxShadow: isSelected ? `0 2px 10px ${m.bgColor}` : 'none',
                  }}
                >
                  <Icon size={14} style={{ color: isSelected ? m.color : 'var(--text-muted)' }} />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* 3. HERO CURRENT PRODUCT RANKING SHOWCASE */}
      <div
        className="product-ranking-hero"
        style={{
          borderRadius: '16px',
          padding: '24px 28px',
          background: 'var(--bg-main)',
          border: '1px solid var(--border-subtle)',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 320px) minmax(0, 1fr)',
          gap: '28px',
          alignItems: 'center',
        }}
      >
        {/* Left: Trophy & Rank Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div
            style={{
              width: '74px',
              height: '74px',
              borderRadius: '20px',
              background: rankTier.bg,
              border: `2px solid ${rankTier.border || 'var(--border-subtle)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: rankTier.color,
              flexShrink: 0,
              boxShadow: rankTier.isFirst ? '0 8px 24px rgba(254, 197, 1, 0.3)' : 'var(--shadow-sm)',
              position: 'relative',
            }}
          >
            {rankTier.isFirst ? (
              <Crown size={38} />
            ) : rankTier.isSecond ? (
              <Medal size={38} />
            ) : rankTier.isThird ? (
              <Award size={38} />
            ) : (
              <Trophy size={34} />
            )}
            <div
              style={{
                position: 'absolute',
                bottom: '-8px',
                background: rankTier.color,
                color: rankTier.isFirst ? '#0F172A' : '#FFFFFF',
                fontSize: '0.66rem',
                fontWeight: 800,
                padding: '1px 8px',
                borderRadius: '100px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              }}
            >
              #{currentRank || '—'}
            </div>
          </div>

          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '2px 8px',
                borderRadius: '6px',
                background: rankTier.bg,
                color: rankTier.color,
                fontSize: '0.72rem',
                fontWeight: 700,
                marginBottom: '4px',
                border: `1px solid ${rankTier.border || 'transparent'}`,
              }}
            >
              {rankTier.label}
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
              Rank #{currentRank || '—'} <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-muted)' }}>of {totalItems}</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              in <strong style={{ color: 'var(--text-primary)' }}>{activeScopeData?.scope_label || 'Current Scope'}</strong>
            </div>
          </div>
        </div>

        {/* Right: Metric Stats & Comparisons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '0.70rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
                {activeMetricCfg.label} (Current Product)
              </div>
              <div style={{ fontSize: '2.1rem', fontWeight: 900, color: activeMetricCfg.color, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {activeMetricCfg.format(currValue, currencySymbol)}
              </div>
            </div>

            {/* Benchmark vs Average */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '4px',
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '100px',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  background: diffVsAvg >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: diffVsAvg >= 0 ? '#10B981' : '#EF4444',
                  border: diffVsAvg >= 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                {diffVsAvg >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                <span>{diffVsAvg >= 0 ? `+${diffVsAvg}%` : `${diffVsAvg}%`} vs Group Avg</span>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Group Avg: <strong>{activeMetricCfg.format(avgValue, currencySymbol)}</strong>
              </span>
            </div>
          </div>

          {/* Percentile Bar */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
              <span>Catalog Percentile Standing</span>
              <strong style={{ color: 'var(--text-primary)' }}>
                {percentile.toFixed(1)}th Percentile {percentile >= 75 ? '(Top Tier)' : ''}
              </strong>
            </div>
            <div
              style={{
                width: '100%',
                height: '8px',
                borderRadius: '100px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, Math.max(2, percentile))}%`,
                  height: '100%',
                  borderRadius: '100px',
                  background: rankTier.isFirst
                    ? 'linear-gradient(90deg, #FEC501 0%, #F59E0B 100%)'
                    : 'linear-gradient(90deg, var(--brand-primary) 0%, #3B82F6 100%)',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>

          {/* Leader comparison */}
          {leaderName && currentRank !== 1 && (
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Crown size={12} style={{ color: '#FEC501', flexShrink: 0 }} />
              <span>
                Group Leader: <strong style={{ color: 'var(--text-primary)' }}>{leaderName}</strong> with{' '}
                <strong style={{ color: activeMetricCfg.color }}>{activeMetricCfg.format(leaderValue, currencySymbol)}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 4. TOP 3 PODIUM (if at least 2 items in scope) */}
      {podiumItems.length >= 2 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Award size={15} style={{ color: '#FEC501' }} />
            <h3 style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Group Leaderboard Podium ({activeMetricCfg.shortLabel})
            </h3>
          </div>

          <div
            className="product-ranking-podium-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: podiumItems.length === 2 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
              gap: '12px',
              alignItems: 'end',
            }}
          >
            {/* Podium Rank 2 (Silver) */}
            {podiumItems[1] && (
              <div
                style={{
                  padding: '16px',
                  borderRadius: '14px',
                  background: podiumItems[1].is_current ? 'var(--brand-ruby-glow)' : 'var(--bg-main)',
                  border: podiumItems[1].is_current ? '2px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  position: 'relative',
                  transition: 'all 0.18s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 9px', borderRadius: '100px', background: 'rgba(148, 163, 184, 0.2)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Medal size={13} style={{ color: '#94A3B8' }} />
                    <span>#2 Runner Up</span>
                  </span>
                  {podiumItems[1].is_current && (
                    <span style={{ fontSize: '0.66rem', fontWeight: 800, padding: '2px 7px', borderRadius: '100px', background: 'var(--brand-primary)', color: '#fff' }}>
                      THIS ITEM
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {podiumItems[1].name}
                </div>
                <div style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  UID: {podiumItems[1].uid}
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: activeMetricCfg.color, marginTop: '2px' }}>
                  {activeMetricCfg.format(podiumItems[1][selectedMetric], currencySymbol)}
                </div>
              </div>
            )}

            {/* Podium Rank 1 (Gold - Center) */}
            {podiumItems[0] && (
              <div
                style={{
                  padding: '18px',
                  borderRadius: '14px',
                  background: podiumItems[0].is_current
                    ? 'linear-gradient(180deg, rgba(254, 197, 1, 0.22) 0%, var(--bg-main) 100%)'
                    : 'linear-gradient(180deg, rgba(254, 197, 1, 0.12) 0%, var(--bg-main) 100%)',
                  border: podiumItems[0].is_current ? '2px solid #FEC501' : '1.5px solid rgba(254, 197, 1, 0.45)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  position: 'relative',
                  transform: 'translateY(-4px)',
                  boxShadow: '0 6px 18px rgba(254, 197, 1, 0.15)',
                  transition: 'all 0.18s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 9px', borderRadius: '100px', background: 'rgba(254, 197, 1, 0.25)', color: '#D97706', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Crown size={13} style={{ color: '#D97706' }} />
                    <span>#1 Champion</span>
                  </span>
                  {podiumItems[0].is_current && (
                    <span style={{ fontSize: '0.66rem', fontWeight: 800, padding: '2px 7px', borderRadius: '100px', background: 'var(--brand-primary)', color: '#fff' }}>
                      THIS ITEM
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.90rem', fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {podiumItems[0].name}
                </div>
                <div style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  UID: {podiumItems[0].uid}
                </div>
                <div style={{ fontSize: '1.20rem', fontWeight: 900, color: activeMetricCfg.color, marginTop: '2px' }}>
                  {activeMetricCfg.format(podiumItems[0][selectedMetric], currencySymbol)}
                </div>
              </div>
            )}

            {/* Podium Rank 3 (Bronze) */}
            {podiumItems[2] && (
              <div
                style={{
                  padding: '16px',
                  borderRadius: '14px',
                  background: podiumItems[2].is_current ? 'var(--brand-ruby-glow)' : 'var(--bg-main)',
                  border: podiumItems[2].is_current ? '2px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  position: 'relative',
                  transition: 'all 0.18s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 9px', borderRadius: '100px', background: 'rgba(217, 119, 6, 0.18)', color: '#D97706', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Award size={13} style={{ color: '#D97706' }} />
                    <span>#3 3rd Place</span>
                  </span>
                  {podiumItems[2].is_current && (
                    <span style={{ fontSize: '0.66rem', fontWeight: 800, padding: '2px 7px', borderRadius: '100px', background: 'var(--brand-primary)', color: '#fff' }}>
                      THIS ITEM
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {podiumItems[2].name}
                </div>
                <div style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  UID: {podiumItems[2].uid}
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: activeMetricCfg.color, marginTop: '2px' }}>
                  {activeMetricCfg.format(podiumItems[2][selectedMetric], currencySymbol)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. INTERACTIVE LEADERBOARD TABLE */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Full Group Standings ({sortedLeaderboardItems.length} Products)
            </h3>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Sorted by {activeMetricCfg.label} ({sortAscending ? 'Ascending' : 'Descending'})
            </span>
          </div>

          {/* Table Search */}
          <div style={{ position: 'relative', width: '240px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search product or UID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{
                paddingLeft: '32px',
                height: '34px',
                fontSize: '0.78rem',
                borderRadius: '8px',
                width: '100%',
              }}
            />
          </div>
        </div>

        {/* Table Container */}
        <div
          style={{
            border: '1px solid var(--border-subtle)',
            borderRadius: '14px',
            overflow: 'hidden',
            background: 'var(--bg-surface-solid)',
          }}
        >
          <div style={{ overflowX: 'auto', maxHeight: '420px', scrollbarWidth: 'thin' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead>
                <tr
                  style={{
                    background: 'var(--bg-main)',
                    borderBottom: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                    fontSize: '0.70rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  <th style={{ padding: '12px 16px', width: '70px' }}>Rank</th>
                  <th style={{ padding: '12px 16px' }}>Product</th>
                  <th style={{ padding: '12px 16px', width: '120px' }}>Stock</th>
                  <th style={{ padding: '12px 16px', width: '190px', textAlign: 'right' }}>
                    {activeMetricCfg.label}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedLeaderboardItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No items found in this scope matching &ldquo;{searchQuery}&rdquo;.
                    </td>
                  </tr>
                ) : (
                  sortedLeaderboardItems.map((peer, idx) => {
                    const isCurrent = Boolean(peer.is_current || (item && String(peer.id) === String(item.id)));
                    const peerRank = peer.displayRank || idx + 1;
                    const val = peer[selectedMetric] ?? 0;
                    const maxVal = Math.max(1, Number(sortedLeaderboardItems[0]?.[selectedMetric] || 1));
                    const barPct = Math.min(100, Math.max(4, Math.round((Number(val) / maxVal) * 100)));

                    return (
                      <tr
                        key={peer.id || idx}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          background: isCurrent
                            ? 'var(--brand-ruby-glow)'
                            : idx % 2 === 1
                            ? 'var(--bg-main)'
                            : 'var(--bg-surface-solid)',
                          transition: 'background 0.15s ease',
                          fontWeight: isCurrent ? 700 : 500,
                        }}
                      >
                        {/* Rank */}
                        <td style={{ padding: '12px 16px' }}>
                          {peerRank === 1 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 800, color: '#FEC501' }}>
                              <Crown size={13} /> 1
                            </span>
                          ) : peerRank === 2 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 800, color: '#94A3B8' }}>
                              <Medal size={13} /> 2
                            </span>
                          ) : peerRank === 3 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 800, color: '#D97706' }}>
                              <Award size={13} /> 3
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>#{peerRank}</span>
                          )}
                        </td>

                        {/* Product info */}
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{ color: 'var(--text-primary)', fontWeight: isCurrent ? 800 : 600 }}>
                                  {peer.name}
                                </span>
                                {isCurrent && (
                                  <span
                                    style={{
                                      fontSize: '0.65rem',
                                      fontWeight: 800,
                                      padding: '1px 6px',
                                      borderRadius: '100px',
                                      background: 'var(--brand-primary)',
                                      color: '#FFFFFF',
                                    }}
                                  >
                                    CURRENT
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                UID: {peer.uid || '—'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Stock */}
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              color:
                                peer.stock <= 0
                                  ? '#EF4444'
                                  : peer.stock <= 5
                                  ? '#F59E0B'
                                  : '#10B981',
                            }}
                          >
                            {peer.stock <= 0 ? 'Out of stock' : `${peer.stock} units`}
                          </span>
                        </td>

                        {/* Metric Value & Relative Bar */}
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: isCurrent ? 'var(--brand-primary)' : 'var(--text-primary)' }}>
                            {activeMetricCfg.format(val, currencySymbol)}
                          </div>
                          <div
                            style={{
                              width: '100px',
                              height: '4px',
                              borderRadius: '100px',
                              background: 'var(--bg-main)',
                              overflow: 'hidden',
                              marginLeft: 'auto',
                              marginTop: '4px',
                            }}
                          >
                            <div
                              style={{
                                width: `${barPct}%`,
                                height: '100%',
                                borderRadius: '100px',
                                background: isCurrent ? 'var(--brand-primary)' : activeMetricCfg.color,
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
