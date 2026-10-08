import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { formatIndianCurrencyCompact } from './GlowCurveChart';
import {
  Truck,
  ArrowLeft,
  TrendingUp,
  ShoppingBag,
  PieChart as PieIcon,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
  Search,
  Package,
  Building2,
  Phone,
  Mail,
  UserCheck,
  Calendar,
} from 'lucide-react';
import TimelineRangeSelector from './TimelineRangeSelector';
import { fetchMonthlyFinancialAnalysis } from '../api';

const PALETTE = [
  '#38BDF8', // Cyan
  '#00E5A3', // Radiant Mint
  '#818CF8', // Indigo / Violet
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#10B981', // Emerald
  '#A855F7', // Purple
  '#6366F1', // Royal Blue
  '#14B8A6', // Teal
  '#F43F5E', // Rose
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
 * Generator for sample supplier performance demo showcase
 */
function generateRandomSuppliersData() {
  const template = [
    {
      id: 501,
      name: 'Apex Global Textiles & Denims',
      contact_person: 'Rajesh Sharma',
      phone: '+91 98201 44521',
      revenue: 165000,
      cogs: 82000,
      gross_profit: 83000,
      margin_pct: 50.3,
      units_sold: 142,
      items: [
        { id: 5001, name: 'Slim Fit Indigo Jeans 32', barcode: 'AP-DN-01', sku: 'APX-JNS-01', selling_price: 1699, cost_price: 850, revenue: 48000, cogs: 24000, gross_profit: 24000, margin_pct: 50.0, units_sold: 28 },
        { id: 5002, name: 'Classic Straight Denim 34', barcode: 'AP-DN-02', sku: 'APX-JNS-02', selling_price: 1599, cost_price: 780, revenue: 38000, cogs: 18500, gross_profit: 19500, margin_pct: 51.3, units_sold: 24 },
        { id: 5003, name: 'White Oxford Formal Shirt 40', barcode: 'AP-FS-01', sku: 'APX-SHT-01', selling_price: 1299, cost_price: 600, revenue: 32000, cogs: 14800, gross_profit: 17200, margin_pct: 53.8, units_sold: 25 },
        { id: 5004, name: 'Distressed Blue Stretch 30', barcode: 'AP-DN-03', sku: 'APX-JNS-03', selling_price: 1799, cost_price: 900, revenue: 26000, cogs: 13000, gross_profit: 13000, margin_pct: 50.0, units_sold: 15 },
        { id: 5005, name: 'Casual Linen Shirt Olive L', barcode: 'AP-FS-02', sku: 'APX-SHT-02', selling_price: 1399, cost_price: 690, revenue: 21000, cogs: 11700, gross_profit: 9300, margin_pct: 44.3, units_sold: 15 },
      ]
    },
    {
      id: 502,
      name: 'TechnoSound Gear Corp',
      contact_person: 'Ananya Deshmukh',
      phone: '+91 99302 11409',
      revenue: 124000,
      cogs: 68000,
      gross_profit: 56000,
      margin_pct: 45.2,
      units_sold: 96,
      items: [
        { id: 6001, name: 'Pro ANC Wireless Earbuds', barcode: 'EL-AU-01', sku: 'TS-EAR-01', selling_price: 2499, cost_price: 1350, revenue: 54000, cogs: 29200, gross_profit: 24800, margin_pct: 45.9, units_sold: 22 },
        { id: 6002, name: 'Over-Ear Studio Monitor', barcode: 'EL-AU-02', sku: 'TS-HPH-02', selling_price: 3999, cost_price: 2200, revenue: 42000, cogs: 23100, gross_profit: 18900, margin_pct: 45.0, units_sold: 11 },
        { id: 6003, name: 'Braided Type-C Fast Cable', barcode: 'EL-AU-03', sku: 'TS-CBL-03', selling_price: 499, cost_price: 180, revenue: 28000, cogs: 15700, gross_profit: 12300, margin_pct: 43.9, units_sold: 56 },
      ]
    },
    {
      id: 503,
      name: 'StrideFootwear Dynamics',
      contact_person: 'Vikram Mehta',
      phone: '+91 97690 88214',
      revenue: 94000,
      cogs: 49000,
      gross_profit: 45000,
      margin_pct: 47.9,
      units_sold: 62,
      items: [
        { id: 7001, name: 'Air Cushion Running Shoes 9', barcode: 'FW-RN-01', sku: 'SF-RUN-01', selling_price: 2999, cost_price: 1500, revenue: 48000, cogs: 24000, gross_profit: 24000, margin_pct: 50.0, units_sold: 16 },
        { id: 7002, name: 'Oxford Formal Leather 8', barcode: 'FW-FM-01', sku: 'SF-OXF-01', selling_price: 3499, cost_price: 1850, revenue: 31000, cogs: 16400, gross_profit: 14600, margin_pct: 47.1, units_sold: 9 },
        { id: 7003, name: 'Memory Foam Casual Slides 10', barcode: 'FW-SL-01', sku: 'SF-SLD-01', selling_price: 999, cost_price: 520, revenue: 15000, cogs: 8600, gross_profit: 6400, margin_pct: 42.7, units_sold: 15 },
      ]
    },
    {
      id: 504,
      name: 'Direct / In-House Production',
      contact_person: 'Store Central Inventory',
      phone: 'Direct Sourced',
      revenue: 62000,
      cogs: 24000,
      gross_profit: 38000,
      margin_pct: 61.3,
      units_sold: 84,
      items: [
        { id: 8001, name: 'Store Branded Tote Bag', barcode: 'IH-TT-01', sku: 'IH-TOT-01', selling_price: 299, cost_price: 80, revenue: 24000, cogs: 6400, gross_profit: 17600, margin_pct: 73.3, units_sold: 80 },
        { id: 8002, name: 'Custom Printed Graphic Tee L', barcode: 'IH-TS-01', sku: 'IH-TEE-01', selling_price: 899, cost_price: 380, revenue: 38000, cogs: 17600, gross_profit: 20400, margin_pct: 53.7, units_sold: 42 },
      ]
    },
  ];

  return template.map((sup) => ({
    ...sup,
    items_count: sup.items.length,
  }));
}

// Helper to extract value based on active metric mode
function getMetricVal(it, mode) {
  if (!it) return 0;
  if (mode === 'quantity') return Math.max(0, it.units_sold || 0);
  if (mode === 'profit') return Math.max(0, it.gross_profit || 0);
  return Math.max(0, it.revenue || 0);
}

export default function SupplierPieChart({
  suppliers = [],
  storeId = null,
  selectedMonthName = 'September',
  selectedYear = 2026,
  onRangeChange = null,
  timelineRange: propTimelineRange = null,
  minDate = '2026-09-04',
}) {
  const [metricMode, setMetricMode] = useState('revenue'); // 'revenue' | 'profit' | 'quantity'
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [itemSearch, setItemSearch] = useState('');
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  // Range fetch state
  const [timelineRange, setTimelineRange] = useState(() => propTimelineRange || null);
  const [periodLabel, setPeriodLabel] = useState(
    () => propTimelineRange?.label || `${selectedMonthName} ${selectedYear} (1 Month)`
  );
  const [fetchedSuppliers, setFetchedSuppliers] = useState(null);
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

  // When parent re-fetches and passes new suppliers prop, clear local fetchedSuppliers cache
  useEffect(() => {
    setFetchedSuppliers(null);
  }, [suppliers]);

  // Real store data by default; zero fake data unless user explicitly requests demo showcase
  const [useRandomData, setUseRandomData] = useState(false);
  const [randomData, setRandomData] = useState(() => generateRandomSuppliersData());

  // Use live store data by default; only use sample demo if explicitly enabled.
  // Deduplicate strictly by ID and Name to prevent duplicate or stuck cards.
  const effectiveSuppliers = useMemo(() => {
    let list = [];
    if (useRandomData) {
      list = randomData;
    } else if (fetchedSuppliers !== null) {
      list = fetchedSuppliers;
    } else {
      list = suppliers || [];
    }
    const seen = new Set();
    return list.filter((sup) => {
      const key = `${sup.id != null ? sup.id : 'no-id'}::${sup.name || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [useRandomData, randomData, fetchedSuppliers, suppliers]);

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

      // Skip redundant fetch on first mount if initial suppliers already provided
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
        if (res && res.suppliers) {
          setFetchedSuppliers(res.suppliers);
          setSelectedSupplierId(null);
          setItemSearch('');
        }
      } catch (err) {
        console.error('Failed to load supplier data for selected range:', err);
      } finally {
        setRangeLoading(false);
      }
    },
    [onRangeChange, storeId]
  );

  // Determine active supplier if drilled down to Level 2
  const selectedSupplier = useMemo(() => {
    if (selectedSupplierId == null) return null;
    return effectiveSuppliers.find((s) => s.id === selectedSupplierId) || null;
  }, [effectiveSuppliers, selectedSupplierId]);

  // Determine items for the right-hand table ledger
  const ledgerItems = useMemo(() => {
    let list = [];
    if (selectedSupplier) {
      const raw = selectedSupplier.items || [];
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
    } else {
      const raw = effectiveSuppliers || [];
      if (!itemSearch.trim()) {
        list = raw;
      } else {
        const q = itemSearch.toLowerCase();
        list = raw.filter(
          (sup) =>
            (sup.name || '').toLowerCase().includes(q) ||
            (sup.contact_person || '').toLowerCase().includes(q) ||
            (sup.phone || '').toLowerCase().includes(q)
        );
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
  }, [effectiveSuppliers, selectedSupplier, itemSearch]);

  // Determine items that define the pie slices
  // Rule: Top 10 items/suppliers by current metric, remainder bundled into "Other" slice
  const pieDisplayItems = useMemo(() => {
    let sourceList = [];
    if (selectedSupplier) {
      sourceList = selectedSupplier.items || [];
    } else {
      sourceList = effectiveSuppliers || [];
    }

    if (sourceList.length === 0) return [];

    // Sort by active metric descending
    const sorted = [...sourceList].sort((a, b) => {
      const valA = getMetricVal(a, metricMode);
      const valB = getMetricVal(b, metricMode);
      return valB - valA;
    });

    // If 10 or fewer, show all directly
    if (sorted.length <= 10) {
      return sorted.map((it, idx) => ({
        ...it,
        color: PALETTE[idx % PALETTE.length],
      }));
    }

    // If more than 10, take Top 10 + bundle remainder into "Other" slice
    const top10 = sorted.slice(0, 10).map((it, idx) => ({
      ...it,
      color: PALETTE[idx % PALETTE.length],
    }));
    const remainder = sorted.slice(10);
    const otherRev = remainder.reduce((acc, it) => acc + (it.revenue || 0), 0);
    const otherProfit = remainder.reduce((acc, it) => acc + (it.gross_profit || 0), 0);
    const otherUnits = remainder.reduce((acc, it) => acc + (it.units_sold || 0), 0);

    const otherSlice = {
      id: '__other_supplier_aggregated__',
      name: selectedSupplier
        ? `Other Items (${remainder.length})`
        : `Other Suppliers (${remainder.length})`,
      revenue: Math.round(otherRev * 100) / 100,
      gross_profit: Math.round(otherProfit * 100) / 100,
      units_sold: otherUnits,
      margin_pct: otherRev > 0 ? Math.round(((otherProfit / otherRev) * 100) * 10) / 10 : 0,
      isAggregatedOther: true,
      color: '#64748B', // Distinct slate color for aggregated slice
    };

    return [...top10, otherSlice];
  }, [effectiveSuppliers, selectedSupplier, metricMode]);

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
            <Truck size={18} color="#38BDF8" />
            <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 700, color: 'var(--text-primary, #0F172A)' }}>
              Sales & Profit by Supplier & Supplied Items
            </h3>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 700,
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                color: '#38BDF8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title="2-Layer Drilldown: Supplier -> Supplied Items (Top 10 + Others)."
            >
              <ShieldCheck size={12} />
              <span>Supplier Item Drilldown</span>
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
            <Calendar size={13} style={{ color: '#38BDF8' }} />
            <span>Time Period: <strong style={{ color: 'var(--text-primary, #F8FAFC)', fontWeight: 600 }}>{periodLabel}</strong></span>
          </p>

          {/* Breadcrumb Navigation: All Suppliers -> [Supplier Name] */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '0.8rem', flexWrap: 'wrap' }}>
            <span
              onClick={() => {
                setSelectedSupplierId(null);
                setItemSearch('');
              }}
              style={{
                color: selectedSupplier ? '#38BDF8' : 'var(--text-primary, #0F172A)',
                fontWeight: selectedSupplier ? 500 : 700,
                cursor: selectedSupplier ? 'pointer' : 'default',
                textDecoration: selectedSupplier ? 'underline' : 'none',
              }}
            >
              All Suppliers ({effectiveSuppliers.length})
            </span>

            {selectedSupplier && (
              <>
                <ChevronRight size={14} color="#64748B" />
                <span style={{ color: '#00E5A3', fontWeight: 700 }}>
                  {selectedSupplier.name} ({selectedSupplier.items?.length || 0} Supplied Items)
                </span>
                {selectedSupplier.contact_person && (
                  <span style={{ fontSize: '0.72rem', color: '#94A3B8', marginLeft: '4px' }}>
                    • Contact: {selectedSupplier.contact_person}
                  </span>
                )}
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
            <Calendar size={13} style={{ color: '#38BDF8' }} />
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
          {selectedSupplier && (
            <button
              onClick={() => {
                setSelectedSupplierId(null);
                setItemSearch('');
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                color: '#38BDF8',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                fontSize: '0.76rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={14} /> Back to Suppliers
            </button>
          )}

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

      {/* Main Grid: Pie Chart on Left + Structured Supplier/Items Ledger on Right */}
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
                  <filter key={`glow-sup-slice-${s.id}`} id={`glow-sup-slice-${s.id}`} x="-20%" y="-20%" width="140%" height="140%">
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
                    filter={isHovered ? `url(#glow-sup-slice-${s.id})` : 'none'}
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
                      if (!selectedSupplier && s.items && s.items.length > 0) {
                        setSelectedSupplierId(s.id);
                        setItemSearch('');
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
                    : selectedSupplier
                    ? `${selectedSupplier.items?.length || 0} Supplied Items`
                    : `${effectiveSuppliers.length} Suppliers`}
                </text>
              </g>
            </svg>
          </div>

          <span style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '10px', textAlign: 'center' }}>
            {selectedSupplier
              ? 'Showing Top 10 items + Others. Complete items list on the right.'
              : 'Click any supplier slice or row to inspect items supplied.'}
          </span>
        </div>

        {/* Right Column: Structured Supplier / Items Ledger */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
          {/* Instant search input */}
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
              placeholder={
                selectedSupplier
                  ? `Search items supplied by ${selectedSupplier.name}...`
                  : 'Search suppliers by name or contact...'
              }
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

          {ledgerItems.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary, #94A3B8)', fontSize: '0.82rem' }}>
              {selectedSupplier
                ? 'No items found matching search for this supplier.'
                : 'No suppliers found matching search.'}
            </div>
          ) : (
            ledgerItems.map((item, idx) => {
              const isHovered =
                (hoveredId != null && item.id === hoveredId) ||
                (hoveredIndex !== null && slices[hoveredIndex]?.id === item.id);
              const isClickable = !selectedSupplier && item.items && item.items.length > 0;

              const v = getMetricVal(item, metricMode);
              const pct = totalValue > 0 ? ((v / totalValue) * 100).toFixed(1) : '0.0';

              // Determine color (item might be in top 10 slices or beyond)
              const matchedSlice = slices.find((s) => s.id === item.id);
              const itemColor = matchedSlice ? matchedSlice.color : PALETTE[idx % PALETTE.length];

              return (
                <div
                  key={`sup-ledger-${item.id != null ? item.id : 'no-id'}-${item.name || ''}-${idx}`}
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
                    if (!selectedSupplier && item.items && item.items.length > 0) {
                      setSelectedSupplierId(item.id);
                      setItemSearch('');
                    }
                  }}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    backgroundColor: isHovered
                      ? 'var(--bg-surface-hover, rgba(255,255,255,0.06))'
                      : 'var(--bg-surface, rgba(255,255,255,0.02))',
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
                        {selectedSupplier && item.barcode && ` • ${item.barcode}`}
                        {selectedSupplier && item.sku && ` • SKU: ${item.sku}`}
                        {!selectedSupplier && ` • ${item.items_count || item.items?.length || 0} supplied items`}
                        {!selectedSupplier && item.phone && ` • ${item.phone}`}
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
                    <div style={{ color: isHovered ? '#38BDF8' : '#64748B', flexShrink: 0 }}>
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
