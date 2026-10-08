import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { formatIndianCurrencyCompact } from './GlowCurveChart';
import {
  Layers,
  ArrowLeft,
  TrendingUp,
  ShoppingBag,
  PieChart as PieIcon,
  ChevronRight,
  Dices,
  RefreshCw,
  ShieldCheck,
  Search,
  Tag,
  Package,
  Calendar,
} from 'lucide-react';
import TimelineRangeSelector from './TimelineRangeSelector';
import { fetchMonthlyFinancialAnalysis } from '../api';

const PALETTE = [
  '#00E5A3', // Radiant Mint
  '#38BDF8', // Cyan
  '#818CF8', // Indigo / Violet
  '#EC4899', // Pink
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#6366F1', // Royal Blue
  '#14B8A6', // Teal
  '#F43F5E', // Rose
  '#A855F7', // Purple
  '#EAB308', // Gold
  '#06B6D4', // Sky
];

/**
 * Helper to compute an SVG donut arc path string
 */
function getDonutArcPath(cx, cy, rInner, rOuter, startAngle, endAngle) {
  const angleDelta = endAngle - startAngle;
  const isFullCircle = angleDelta >= 2 * Math.PI - 0.001;
  const safeEndAngle = isFullCircle ? startAngle + 2 * Math.PI - 0.0001 : endAngle;

  const x1 = cx + rOuter * Math.cos(startAngle);
  const y1 = cy + rOuter * Math.sin(startAngle);
  const x2 = cx + rOuter * Math.cos(safeEndAngle);
  const y2 = cy + rOuter * Math.sin(safeEndAngle);

  const x3 = cx + rInner * Math.cos(safeEndAngle);
  const y3 = cy + rInner * Math.sin(safeEndAngle);
  const x4 = cx + rInner * Math.cos(startAngle);
  const y4 = cy + rInner * Math.sin(startAngle);

  const largeArc = angleDelta > Math.PI ? 1 : 0;

  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;
}

/**
 * Generator for rich multi-category demo sample with subcategories and items
 */
function generateRandomCategoriesData() {
  const template = [
    {
      id: 101,
      name: 'Apparel & Denim',
      baseRev: 185000,
      marginPct: 52.4,
      subcategories: [
        {
          id: 1011,
          name: 'Casuals & Denims',
          ratio: 0.45,
          margin: 51.5,
          items: [
            { id: 1001, name: 'Slim Fit Indigo Jeans 32', barcode: 'AP-DN-01', revenue: 32000, cogs: 15500, gross_profit: 16500, margin_pct: 51.6, units_sold: 28 },
            { id: 1002, name: 'Classic Straight Denim 34', barcode: 'AP-DN-02', revenue: 24500, cogs: 12000, gross_profit: 12500, margin_pct: 51.0, units_sold: 21 },
            { id: 1003, name: 'Distressed Blue Jeans 30', barcode: 'AP-DN-03', revenue: 16000, cogs: 7800, gross_profit: 8200, margin_pct: 51.2, units_sold: 14 },
            { id: 1004, name: 'Dark Wash Comfort Fit 36', barcode: 'AP-DN-04', revenue: 10500, cogs: 5100, gross_profit: 5400, margin_pct: 51.4, units_sold: 9 },
          ]
        },
        {
          id: 1012,
          name: 'Formal Shirts & Suits',
          ratio: 0.28,
          margin: 56.2,
          items: [
            { id: 1005, name: 'White Oxford Classic Shirt 40', barcode: 'AP-FS-01', revenue: 28000, cogs: 12200, gross_profit: 15800, margin_pct: 56.4, units_sold: 20 },
            { id: 1006, name: 'Charcoal Wool Blend Blazer 42', barcode: 'AP-FS-02', revenue: 23800, cogs: 10400, gross_profit: 13400, margin_pct: 56.3, units_sold: 7 },
          ]
        },
        { id: 1013, name: "Men's Ethnic Wear", ratio: 0.16, margin: 48.0, items: [] },
        { id: 1014, name: "Women's Activewear", ratio: 0.11, margin: 53.8, items: [] },
      ],
    },
    {
      id: 102,
      name: 'Electronics & Gadgets',
      baseRev: 142000,
      marginPct: 38.6,
      subcategories: [
        {
          id: 1021,
          name: 'Audio & Wireless Headphones',
          ratio: 0.42,
          margin: 44.0,
          items: [
            { id: 2001, name: 'Pro ANC Wireless Earbuds', barcode: 'EL-AU-01', revenue: 35000, cogs: 19600, gross_profit: 15400, margin_pct: 44.0, units_sold: 15 },
            { id: 2002, name: 'Over-Ear Studio Headphones', barcode: 'EL-AU-02', revenue: 24600, cogs: 13800, gross_profit: 10800, margin_pct: 43.9, units_sold: 8 },
          ]
        },
        { id: 1022, name: 'Smartphones & Tablets', ratio: 0.35, margin: 28.5, items: [] },
        { id: 1023, name: 'Cables, Adapters & Power', ratio: 0.23, margin: 55.0, items: [] },
      ],
    },
    {
      id: 103,
      name: 'Footwear & Sneakers',
      baseRev: 98000,
      marginPct: 49.2,
      subcategories: [
        { id: 1031, name: 'Running & Training Shoes', ratio: 0.48, margin: 50.2, items: [] },
        { id: 1032, name: 'Formal Leather Shoes', ratio: 0.32, margin: 52.0, items: [] },
        { id: 1033, name: 'Casual Slides & Slippers', ratio: 0.20, margin: 42.5, items: [] },
      ],
    },
  ];

  return template.map((cat) => {
    const rev = cat.baseRev;
    const profit = Math.round(rev * (cat.marginPct / 100));
    return {
      id: cat.id,
      name: cat.name,
      revenue: rev,
      cogs: rev - profit,
      gross_profit: profit,
      margin_pct: cat.marginPct,
      units_sold: 65,
      subcategories: cat.subcategories.map((sub) => {
        const sRev = Math.round(rev * sub.ratio);
        const sProfit = Math.round(sRev * (sub.margin / 100));
        return {
          id: sub.id,
          name: sub.name,
          revenue: sRev,
          cogs: sRev - sProfit,
          gross_profit: sProfit,
          margin_pct: sub.margin,
          units_sold: 25,
          items_count: sub.items.length,
          items: sub.items,
        };
      }),
    };
  });
}

// Helper to extract value based on active metric mode
function getMetricVal(it, mode) {
  if (!it) return 0;
  if (mode === 'quantity') return Math.max(0, it.units_sold || 0);
  if (mode === 'profit') return Math.max(0, it.gross_profit || 0);
  return Math.max(0, it.revenue || 0);
}

export default function CategoryPieChart({
  categories = [],
  storeId = null,
  selectedMonthName = 'September',
  selectedYear = 2026,
  onRangeChange = null,
  timelineRange: propTimelineRange = null,
  minDate = '2026-09-04',
}) {
  const [metricMode, setMetricMode] = useState('revenue'); // 'revenue' | 'profit' | 'quantity'
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState(null);
  const [itemSearch, setItemSearch] = useState('');
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  // Range fetch state
  const [timelineRange, setTimelineRange] = useState(() => propTimelineRange || null);
  const [periodLabel, setPeriodLabel] = useState(
    () => propTimelineRange?.label || `${selectedMonthName} ${selectedYear} (1 Month)`
  );
  const [fetchedCategories, setFetchedCategories] = useState(null);
  const [rangeLoading, setRangeLoading] = useState(false);
  const isInitialMount = useRef(true);

  // Sync default label if props change
  useEffect(() => {
    if (propTimelineRange) {
      setTimelineRange(propTimelineRange);
      if (propTimelineRange.label) {
        setPeriodLabel(propTimelineRange.label);
      } else if (propTimelineRange.startDate && propTimelineRange.endDate) {
        setPeriodLabel(`${propTimelineRange.startDate} – ${propTimelineRange.endDate}`);
      }
    } else if (isInitialMount.current && selectedMonthName && selectedYear) {
      setPeriodLabel(`${selectedMonthName} ${selectedYear} (1 Month)`);
    }
  }, [propTimelineRange, selectedMonthName, selectedYear]);

  // When parent re-fetches and passes new categories prop, clear local fetchedCategories cache
  useEffect(() => {
    setFetchedCategories(null);
  }, [categories]);

  // Real store data by default; zero fake data unless user explicitly requests demo showcase
  const [useRandomData, setUseRandomData] = useState(false);
  const [randomData, setRandomData] = useState(() => generateRandomCategoriesData());

  const handleRandomize = useCallback(() => {
    setUseRandomData(true);
    setRandomData(generateRandomCategoriesData());
    setHoveredIndex(null);
    setHoveredId(null);
  }, []);

  // Use live store data by default; only use sample demo if explicitly enabled.
  // Deduplicate strictly by ID and Name to prevent duplicate or stuck cards.
  const effectiveCategories = useMemo(() => {
    let list = [];
    if (useRandomData) {
      list = randomData;
    } else if (fetchedCategories !== null) {
      list = fetchedCategories;
    } else {
      list = categories || [];
    }
    const seen = new Set();
    return list.filter((cat) => {
      const key = `${cat.id != null ? cat.id : 'no-id'}::${cat.name || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [useRandomData, randomData, fetchedCategories, categories]);

  // Handle timeline range selector change
  const handleRangeChange = useCallback(
    async (newRange) => {
      if (newRange?.label) {
        setPeriodLabel(newRange.label);
      } else if (newRange?.startDate && newRange?.endDate) {
        setPeriodLabel(`${newRange.startDate} – ${newRange.endDate}`);
      }

      if (onRangeChange) {
        onRangeChange(newRange);
      }

      // Skip redundant fetch on first mount if initial categories already provided
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }

      if (!newRange || !newRange.startDate || !newRange.endDate) return;

      try {
        setRangeLoading(true);
        const res = await fetchMonthlyFinancialAnalysis({
          store: storeId || undefined,
          start_date: newRange.startDate,
          end_date: newRange.endDate,
        });
        if (res && res.categories) {
          setFetchedCategories(res.categories);
          setSelectedCategoryId(null);
          setSelectedSubcategoryId(null);
          setItemSearch('');
        }
      } catch (err) {
        console.error('Failed to load category data for selected range:', err);
      } finally {
        setRangeLoading(false);
      }
    },
    [onRangeChange, storeId]
  );

  // Determine active category if drilled down to Level 2 or 3
  const selectedCategory = useMemo(() => {
    if (selectedCategoryId == null) return null;
    return effectiveCategories.find((c) => c.id === selectedCategoryId) || null;
  }, [effectiveCategories, selectedCategoryId]);

  // Determine active subcategory if drilled down to Level 3
  const selectedSubcategory = useMemo(() => {
    if (!selectedCategory || selectedSubcategoryId == null) return null;
    return (selectedCategory.subcategories || []).find((s) => s.id === selectedSubcategoryId) || null;
  }, [selectedCategory, selectedSubcategoryId]);

  // Determine items for the right-hand table ledger
  const ledgerItems = useMemo(() => {
    let list = [];
    if (selectedSubcategory) {
      const raw = selectedSubcategory.items || [];
      if (!itemSearch.trim()) {
        list = raw;
      } else {
        const q = itemSearch.toLowerCase();
        list = raw.filter(
          (it) =>
            (it.name || '').toLowerCase().includes(q) ||
            (it.barcode || '').toLowerCase().includes(q) ||
            (it.sku || '').toLowerCase().includes(q)
        );
      }
    } else if (selectedCategory) {
      const raw = (selectedCategory.subcategories || []).map((sub) => ({
        ...sub,
        isSubcategory: true,
        parentCategoryName: selectedCategory.name,
      }));
      if (!itemSearch.trim()) {
        list = raw;
      } else {
        const q = itemSearch.toLowerCase();
        list = raw.filter((sub) => (sub.name || '').toLowerCase().includes(q));
      }
    } else {
      const raw = effectiveCategories.map((cat) => ({
        ...cat,
        isSubcategory: false,
      }));
      if (!itemSearch.trim()) {
        list = raw;
      } else {
        const q = itemSearch.toLowerCase();
        list = raw.filter((cat) => (cat.name || '').toLowerCase().includes(q));
      }
    }

    // Strict deduplication by ID and Name to guarantee zero phantom fixed/duplicate cards
    const seen = new Set();
    return list.filter((it, idx) => {
      const key = `${it.id != null ? it.id : 'no-id'}::${it.name || idx}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [effectiveCategories, selectedCategory, selectedSubcategory, itemSearch]);

  // Determine items that define the pie slices
  // Rule: Top 10 items/subcategories by current metric, remainder bundled into "Other Items" slice
  const pieDisplayItems = useMemo(() => {
    let sourceList = [];
    if (selectedSubcategory) {
      sourceList = selectedSubcategory.items || [];
    } else if (selectedCategory) {
      sourceList = selectedCategory.subcategories || [];
    } else {
      sourceList = effectiveCategories || [];
    }

    if (sourceList.length === 0) return [];

    // Sort by active metric descending
    const sorted = [...sourceList].sort((a, b) => {
      const valA = getMetricVal(a, metricMode);
      const valB = getMetricVal(b, metricMode);
      return valB - valA;
    });

    // If 10 or fewer items, show all directly
    if (sorted.length <= 10) {
      return sorted.map((it, idx) => ({
        ...it,
        color: PALETTE[idx % PALETTE.length],
      }));
    }

    // If more than 10, take Top 10 + bundle remainder into "Other Items" slice
    const top10 = sorted.slice(0, 10).map((it, idx) => ({
      ...it,
      color: PALETTE[idx % PALETTE.length],
    }));
    const remainder = sorted.slice(10);
    const otherRev = remainder.reduce((acc, it) => acc + (it.revenue || 0), 0);
    const otherProfit = remainder.reduce((acc, it) => acc + (it.gross_profit || 0), 0);
    const otherUnits = remainder.reduce((acc, it) => acc + (it.units_sold || 0), 0);

    const otherSlice = {
      id: '__other_aggregated__',
      name: selectedSubcategory
        ? `Other Items (${remainder.length})`
        : selectedCategory
        ? `Other Subcategories (${remainder.length})`
        : `Other Categories (${remainder.length})`,
      revenue: Math.round(otherRev * 100) / 100,
      gross_profit: Math.round(otherProfit * 100) / 100,
      units_sold: otherUnits,
      margin_pct: otherRev > 0 ? Math.round(((otherProfit / otherRev) * 100) * 10) / 10 : 0,
      isAggregatedOther: true,
      color: '#64748B', // Distinct slate color for aggregated slice
    };

    return [...top10, otherSlice];
  }, [effectiveCategories, selectedCategory, selectedSubcategory, metricMode]);

  // Total value for current metric
  const totalValue = useMemo(() => {
    return pieDisplayItems.reduce((acc, it) => {
      return acc + getMetricVal(it, metricMode);
    }, 0);
  }, [pieDisplayItems, metricMode]);

  // Slices geometry
  const slices = useMemo(() => {
    if (totalValue <= 0) return [];
    let cumulativeAngle = -Math.PI / 2; // start from 12 o'clock

    return pieDisplayItems.map((it, idx) => {
      const v = getMetricVal(it, metricMode);
      const pct = (v / totalValue) * 100;
      const angle = (v / totalValue) * 2 * Math.PI;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angle;
      cumulativeAngle = endAngle;

      return {
        ...it,
        index: idx,
        val: v,
        pct: pct.toFixed(1),
        startAngle,
        endAngle,
      };
    });
  }, [pieDisplayItems, totalValue, metricMode]);

  const centerItem = useMemo(() => {
    if (hoveredIndex !== null && slices[hoveredIndex]) return slices[hoveredIndex];
    if (hoveredId != null) {
      const inSlice = slices.find((s) => s.id === hoveredId);
      if (inSlice) return inSlice;
      const inLedger = ledgerItems.find((it) => it.id === hoveredId);
      if (inLedger) {
        const v = getMetricVal(inLedger, metricMode);
        const pct = totalValue > 0 ? ((v / totalValue) * 100).toFixed(1) : '0.0';
        return {
          ...inLedger,
          val: v,
          pct,
          color: '#38BDF8',
        };
      }
    }
    return null;
  }, [hoveredIndex, hoveredId, slices, ledgerItems, metricMode, totalValue]);

  const cx = 135;
  const cy = 135;
  const rOuter = 115;
  const rInner = 72;

  return (
    <div
      style={{
        borderRadius: '16px',
        backgroundColor: 'var(--chart-card-bg, #0F172A)',
        border: '1px solid var(--chart-card-border, rgba(255, 255, 255, 0.08))',
        padding: '22px 24px',
        boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.35)',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        color: 'var(--text-primary, #F8FAFC)',
      }}
    >
      {/* Top Header Row with Title, Badges, and TimelineRangeSelector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
          paddingBottom: '14px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <PieIcon size={18} color="#A78BFA" />
            <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 700, color: 'var(--text-primary, #0F172A)' }}>
              Sales & Profit by Category, SubCategory & Items
            </h3>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 700,
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                color: '#10B981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title="3-Layer Drilldown: Category -> Subcategory -> Individual Items (Top 10 + Others)."
            >
              <ShieldCheck size={12} />
              <span>3-Layer Item Drilldown</span>
            </span>

            {rangeLoading && (
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  color: '#F59E0B',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Updating timeline...</span>
              </span>
            )}

            {useRandomData && (
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  backgroundColor: 'rgba(236, 72, 153, 0.15)',
                  color: '#F472B6',
                  border: '1px solid rgba(236, 72, 153, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>Sample Demo Active</span>
              </span>
            )}
          </div>

          {/* Active Timeline Range Indicator */}
          <p
            style={{
              margin: '3px 0 0 0',
              fontSize: '0.78rem',
              color: 'var(--text-secondary, #64748B)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Calendar size={13} style={{ color: '#A78BFA' }} />
            <span>Time Period: <strong style={{ color: 'var(--text-primary, #F8FAFC)', fontWeight: 600 }}>{periodLabel}</strong></span>
          </p>

          {/* Breadcrumb Navigation: Category -> Subcategory -> Items */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '0.8rem', flexWrap: 'wrap' }}>
            <span
              onClick={() => {
                setSelectedCategoryId(null);
                setSelectedSubcategoryId(null);
                setItemSearch('');
              }}
              style={{
                color: selectedCategory ? '#38BDF8' : 'var(--text-primary, #0F172A)',
                fontWeight: selectedCategory ? 500 : 700,
                cursor: selectedCategory ? 'pointer' : 'default',
                textDecoration: selectedCategory ? 'underline' : 'none',
              }}
            >
              All Categories ({effectiveCategories.length})
            </span>

            {selectedCategory && (
              <>
                <ChevronRight size={14} color="#64748B" />
                <span
                  onClick={() => {
                    setSelectedSubcategoryId(null);
                    setItemSearch('');
                  }}
                  style={{
                    color: selectedSubcategory ? '#38BDF8' : '#00E5A3',
                    fontWeight: selectedSubcategory ? 500 : 700,
                    cursor: selectedSubcategory ? 'pointer' : 'default',
                    textDecoration: selectedSubcategory ? 'underline' : 'none',
                  }}
                >
                  {selectedCategory.name} ({selectedCategory.subcategories?.length || 0} Subcategories)
                </span>
              </>
            )}

            {selectedSubcategory && (
              <>
                <ChevronRight size={14} color="#64748B" />
                <span style={{ color: '#F59E0B', fontWeight: 700 }}>
                  {selectedSubcategory.name} ({selectedSubcategory.items?.length || 0} Items)
                </span>
              </>
            )}
          </div>
        </div>

        {/* Timeline Range Selector & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '8px',
              background: 'var(--bg-surface-solid, rgba(255, 255, 255, 0.04))',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              fontSize: '0.72rem',
              color: 'var(--text-secondary, #94A3B8)',
              fontWeight: 600,
            }}
          >
            <Calendar size={13} style={{ color: '#A78BFA' }} />
            <span>{periodLabel}</span>
          </div>

          <TimelineRangeSelector
            value={timelineRange || undefined}
            defaultUnit="month"
            defaultCount={1}
            minDate={minDate}
            allowAllTime={true}
            compact={true}
            chartType="pie_chart"
            showXAxis={false}
            onChange={handleRangeChange}
          />


          {/* Back Navigation Button */}
          {selectedSubcategory ? (
            <button
              onClick={() => {
                setSelectedSubcategoryId(null);
                setItemSearch('');
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: '#F59E0B',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                fontSize: '0.76rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={14} /> Back to Subcategories
            </button>
          ) : selectedCategory ? (
            <button
              onClick={() => {
                setSelectedCategoryId(null);
                setItemSearch('');
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: '#E2E8F0',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                fontSize: '0.76rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={14} /> Back to Categories
            </button>
          ) : null}

          {/* Metric Toggle: Sales Revenue vs Gross Profit vs Quantity Sold */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-input, #1E293B)',
              borderRadius: '9px',
              padding: '2px',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
            }}
          >
            <button
              onClick={() => setMetricMode('revenue')}
              style={{
                padding: '5px 12px',
                borderRadius: '7px',
                fontSize: '0.74rem',
                fontWeight: metricMode === 'revenue' ? 800 : 500,
                backgroundColor: metricMode === 'revenue' ? '#38BDF8' : 'transparent',
                color: metricMode === 'revenue' ? '#0F172A' : '#94A3B8',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
              }}
            >
              <ShoppingBag size={12} /> Sales Revenue
            </button>

            <button
              onClick={() => setMetricMode('profit')}
              style={{
                padding: '5px 12px',
                borderRadius: '7px',
                fontSize: '0.74rem',
                fontWeight: metricMode === 'profit' ? 800 : 500,
                backgroundColor: metricMode === 'profit' ? '#00E5A3' : 'transparent',
                color: metricMode === 'profit' ? '#0F172A' : '#94A3B8',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
              }}
            >
              <TrendingUp size={12} /> Gross Profit
            </button>

            <button
              onClick={() => setMetricMode('quantity')}
              style={{
                padding: '5px 12px',
                borderRadius: '7px',
                fontSize: '0.74rem',
                fontWeight: metricMode === 'quantity' ? 800 : 500,
                backgroundColor: metricMode === 'quantity' ? '#F59E0B' : 'transparent',
                color: metricMode === 'quantity' ? '#0F172A' : '#94A3B8',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
              }}
            >
              <Package size={12} /> Quantity Sold
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Pie Chart on Left + Structured Category/Subcategory/Items Ledger on Right */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
          gap: '24px',
          alignItems: 'center',
        }}
      >
        {/* Left Column: Interactive SVG Donut / Pie Chart */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            padding: '10px',
          }}
        >
          <div style={{ position: 'relative', width: '270px', height: '270px' }}>
            <svg viewBox="0 0 270 270" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                {slices.map((s) => (
                  <filter key={`glow-slice-${s.id}`} id={`glow-slice-${s.id}`} x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                ))}
              </defs>

              {/* Slices */}
              {slices.map((s, idx) => {
                const isHovered = hoveredIndex === idx || (hoveredId != null && s.id === hoveredId);
                const dPath = getDonutArcPath(cx, cy, rInner, isHovered ? rOuter + 6 : rOuter, s.startAngle, s.endAngle);

                return (
                  <path
                    key={`slice-${s.id || idx}`}
                    d={dPath}
                    fill={s.color}
                    stroke="var(--chart-card-bg, #0F172A)"
                    strokeWidth="2.5"
                    opacity={(hoveredIndex !== null || hoveredId !== null) && !isHovered ? 0.6 : 1}
                    style={{
                      cursor: 'pointer',
                      transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
                    }}
                    filter={isHovered ? `url(#glow-slice-${s.id})` : 'none'}
                    onMouseEnter={() => {
                      setHoveredIndex(idx);
                      setHoveredId(s.id);
                    }}
                    onMouseLeave={() => {
                      setHoveredIndex(null);
                      setHoveredId(null);
                    }}
                    onClick={() => {
                      if (s.isAggregatedOther) return;
                      if (!selectedCategory && s.subcategories && s.subcategories.length > 0) {
                        setSelectedCategoryId(s.id);
                      } else if (selectedCategory && !selectedSubcategory) {
                        setSelectedSubcategoryId(s.id);
                      }
                    }}
                  />
                );
              })}

              {/* Central Donut Hole */}
              <circle cx={cx} cy={cy} r={rInner - 2} fill="var(--chart-card-bg, #0F172A)" />

              {/* Center KPI Display */}
              <g transform={`translate(${cx}, ${cy})`} style={{ pointerEvents: 'none' }}>
                <text
                  x="0"
                  y="-12"
                  fill="var(--chart-text-muted, var(--text-secondary, #64748B))"
                  fontSize="10"
                  fontWeight="600"
                  textAnchor="middle"
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {centerItem
                    ? centerItem.name
                    : metricMode === 'profit'
                    ? 'Total Profit'
                    : metricMode === 'quantity'
                    ? 'Total Units Sold'
                    : 'Total Revenue'}
                </text>
                <text
                  x="0"
                  y="10"
                  fill={centerItem ? centerItem.color : 'var(--chart-text, var(--text-primary, #0F172A))'}
                  fontSize="15"
                  fontWeight="800"
                  textAnchor="middle"
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {metricMode === 'quantity'
                    ? `${Number(centerItem ? centerItem.val : totalValue).toLocaleString('en-IN')} units`
                    : formatIndianCurrencyCompact(centerItem ? centerItem.val : totalValue)}
                </text>
                <text
                  x="0"
                  y="26"
                  fill="#64748B"
                  fontSize="10"
                  fontWeight="700"
                  textAnchor="middle"
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {centerItem
                    ? `${centerItem.pct}% • ${centerItem.units_sold || 0} units`
                    : selectedSubcategory
                    ? `${selectedSubcategory.items?.length || 0} Total Items`
                    : selectedCategory
                    ? `${selectedCategory.subcategories?.length || 0} Subcategories`
                    : `${effectiveCategories.length} Categories`}
                </text>
              </g>
            </svg>
          </div>

          <span style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '10px', textAlign: 'center' }}>
            {selectedSubcategory
              ? 'Showing Top 10 items + Others. Full items list on the right.'
              : selectedCategory
              ? 'Click a subcategory to inspect individual items.'
              : 'Click any slice or row to drill down into subcategories.'}
          </span>
        </div>

        {/* Right Column: Structured Category / Subcategory / Items Ledger */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
          {/* Search box when inside Item-Level view */}
          {selectedSubcategory && (
            <div style={{ position: 'relative', marginBottom: '4px' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-secondary, #94A3B8)',
                }}
              />
              <input
                type="text"
                placeholder={`Search items in ${selectedSubcategory.name}...`}
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 12px 7px 32px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-input, #1E293B)',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
                  color: 'var(--text-primary, #F8FAFC)',
                  fontSize: '0.78rem',
                  outline: 'none',
                }}
              />
            </div>
          )}

          {ledgerItems.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary, #94A3B8)', fontSize: '0.82rem' }}>
              {selectedSubcategory
                ? 'No items found matching search in this subcategory.'
                : 'No data recorded for this selection.'}
            </div>
          ) : (
            ledgerItems.map((item, idx) => {
              const isHovered =
                (hoveredId != null && item.id === hoveredId) ||
                (hoveredIndex !== null && slices[hoveredIndex]?.id === item.id);
              const hasSub = item.subcategories && item.subcategories.length > 0;
              const isClickable = (!selectedCategory && hasSub) || (selectedCategory && !selectedSubcategory);

              const v = getMetricVal(item, metricMode);
              const pct = totalValue > 0 ? ((v / totalValue) * 100).toFixed(1) : '0.0';

              // Determine color (item might be in top 10 slices or beyond)
              const matchedSlice = slices.find((s) => s.id === item.id);
              const itemColor = matchedSlice ? matchedSlice.color : PALETTE[idx % PALETTE.length];

              return (
                <div
                  key={`cat-ledger-${item.id != null ? item.id : 'no-id'}-${item.name || ''}-${idx}`}
                  onMouseEnter={() => {
                    setHoveredId(item.id);
                    const sIdx = slices.findIndex((s) => s.id === item.id);
                    setHoveredIndex(sIdx !== -1 ? sIdx : null);
                  }}
                  onMouseLeave={() => {
                    setHoveredId(null);
                    setHoveredIndex(null);
                  }}
                  onClick={() => {
                    if (!selectedCategory && hasSub) {
                      setSelectedCategoryId(item.id);
                    } else if (selectedCategory && !selectedSubcategory) {
                      setSelectedSubcategoryId(item.id);
                    }
                  }}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    backgroundColor: isHovered ? 'var(--bg-surface-hover, rgba(255,255,255,0.06))' : 'var(--bg-surface, rgba(255,255,255,0.02))',
                    border: isHovered ? `1px solid ${itemColor}` : '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    cursor: isClickable ? 'pointer' : 'default',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Left: Swatch and Title */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '160px', flex: 1 }}>
                    <span
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: itemColor,
                        boxShadow: isHovered ? `0 0 8px ${itemColor}` : 'none',
                        display: 'inline-block',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ overflow: 'hidden' }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: '0.84rem',
                          color: 'var(--text-primary, #F8FAFC)',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                        }}
                      >
                        {item.name}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
                        {item.units_sold} sold
                        {selectedSubcategory && item.barcode && ` • ${item.barcode}`}
                        {!selectedCategory && hasSub && ` • ${item.subcategories.length} subcategories`}
                        {selectedCategory && !selectedSubcategory && ` • ${item.items_count || item.items?.length || 0} items`}
                      </div>
                    </div>
                  </div>

                  {/* Center: Share Progress Pill */}
                  <div style={{ width: '70px', display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: itemColor, textAlign: 'right' }}>
                      {pct}%
                    </div>
                    <div style={{ height: '3.5px', borderRadius: '2px', backgroundColor: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.min(Number(pct), 100)}%`,
                          height: '100%',
                          backgroundColor: itemColor,
                          borderRadius: '2px',
                        }}
                      />
                    </div>
                  </div>

                  {/* Right: Revenue, Profit or Quantity metrics */}
                  <div style={{ textAlign: 'right', minWidth: '110px', flexShrink: 0 }}>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        color:
                          metricMode === 'profit'
                            ? '#00E5A3'
                            : metricMode === 'quantity'
                            ? '#F59E0B'
                            : '#38BDF8',
                      }}
                    >
                      {metricMode === 'quantity'
                        ? `${Number(v).toLocaleString('en-IN')} units`
                        : `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                      {metricMode === 'quantity' ? (
                        <>
                          Sales:{' '}
                          <strong style={{ color: '#38BDF8' }}>
                            ₹{Number(item.revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </strong>
                        </>
                      ) : (
                        <>
                          Margin: <strong style={{ color: '#34D399' }}>{item.margin_pct}%</strong>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Drill Down Chevron */}
                  {isClickable && (
                    <div style={{ color: isHovered ? '#00E5A3' : '#64748B', flexShrink: 0 }}>
                      <ChevronRight size={15} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
