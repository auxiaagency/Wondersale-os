import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { formatIndianCurrencyCompact } from './GlowCurveChart';
import {
  Layers,
  ArrowLeft,
  TrendingUp,
  ShoppingBag,
  PieChart as PieIcon,
  ChevronRight,
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
  '#38BDF8', // Sky Blue
  '#00E5A3', // Radiant Mint
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#818CF8', // Indigo / Violet
  '#10B981', // Emerald
  '#6366F1', // Royal Blue
  '#14B8A6', // Teal
  '#F43F5E', // Rose
  '#A855F7', // Purple
  '#EAB308', // Gold
  '#06B6D4', // Cyan
];

/**
 * Helper to compute an SVG donut arc path string.
 * Accurately supports single full-circle slices (100% share) without seam artifacts.
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

// Helper to extract value based on active metric mode
function getMetricVal(it, mode) {
  if (!it) return 0;
  if (mode === 'quantity') return Math.max(0, it.units_sold || 0);
  if (mode === 'profit') return Math.max(0, it.gross_profit || 0);
  return Math.max(0, it.revenue || 0);
}

export default function SectionPieChart({
  sections = [],
  storeId = null,
  selectedMonthName = 'September',
  selectedYear = 2026,
  onRangeChange = null,
  timelineRange: propTimelineRange = null,
  minDate = '2026-09-04',
  lockToSectionId = null,
  lockToSectionName = null,
}) {
  const [metricMode, setMetricMode] = useState('revenue'); // 'revenue' | 'profit' | 'quantity'
  const [selectedSectionId, setSelectedSectionId] = useState(() => lockToSectionId || null);
  const [itemSearch, setItemSearch] = useState('');
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => {
    if (lockToSectionId) {
      setSelectedSectionId(lockToSectionId);
    }
  }, [lockToSectionId]);

  // Range fetch state
  const [timelineRange, setTimelineRange] = useState(() => propTimelineRange || null);
  const [periodLabel, setPeriodLabel] = useState(
    () => propTimelineRange?.label || `${selectedMonthName} ${selectedYear} (1 Month)`
  );
  const [fetchedSections, setFetchedSections] = useState(null);
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

  // When parent re-fetches and passes new sections prop, clear local cache
  useEffect(() => {
    setFetchedSections(null);
  }, [sections]);

  // Clean, deduplicated sections list
  const effectiveSections = useMemo(() => {
    const list = fetchedSections !== null ? fetchedSections : (sections || []);
    const seen = new Set();
    const result = [];
    for (const sec of list) {
      if (!sec) continue;
      const key = `${sec.id != null ? sec.id : 'no-id'}::${sec.name || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(sec);
      }
    }
    return result;
  }, [fetchedSections, sections]);

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
        if (res && res.sections) {
          setFetchedSections(res.sections);
          setSelectedSectionId(lockToSectionId ? lockToSectionId : null);
          setItemSearch('');
          setHoveredId(null);
          setHoveredIndex(null);
        }
      } catch (err) {
        console.error('Failed to load section data for selected range:', err);
      } finally {
        setRangeLoading(false);
      }
    },
    [onRangeChange, storeId]
  );

  // Determine active section if drilled down to Level 2
  const selectedSection = useMemo(() => {
    if (selectedSectionId == null) return null;
    return effectiveSections.find((s) => String(s.id) === String(selectedSectionId)) || null;
  }, [effectiveSections, selectedSectionId]);

  // Determine items for the right-hand table ledger
  const ledgerItems = useMemo(() => {
    let list = [];
    if (selectedSection) {
      const raw = selectedSection.items || [];
      // Clean: strictly product items ONLY. Filter out any section items or metadata echoes
      const cleanItems = raw.filter((it) => {
        if (!it) return false;
        if (it.items_count !== undefined) return false;
        if (it.items && Array.isArray(it.items)) return false;
        if (it.isSection) return false;
        // Never allow any entity that matches a section id or name unless it is an actual product with barcode
        if (effectiveSections.some((s) => (String(s.id) === String(it.id) || s.name === it.name) && (it.items_count !== undefined || !it.barcode))) {
          return false;
        }
        return true;
      });

      if (!itemSearch.trim()) {
        list = cleanItems;
      } else {
        const q = itemSearch.toLowerCase();
        list = cleanItems.filter(
          (it) =>
            (it.name || '').toLowerCase().includes(q) ||
            (it.barcode || '').toLowerCase().includes(q) ||
            (it.sku || '').toLowerCase().includes(q)
        );
      }
    } else {
      const raw = effectiveSections || [];
      if (!itemSearch.trim()) {
        list = raw;
      } else {
        const q = itemSearch.toLowerCase();
        list = raw.filter(
          (sec) =>
            (sec.name || '').toLowerCase().includes(q) ||
            (sec.code || '').toLowerCase().includes(q)
        );
      }
    }

    const seen = new Set();
    const result = [];
    for (let idx = 0; idx < list.length; idx++) {
      const it = list[idx];
      const key = `${selectedSection ? 'item' : 'sec'}-${it.id != null ? it.id : 'no-id'}-${it.name || idx}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(it);
      }
    }
    return result;
  }, [effectiveSections, selectedSection, itemSearch]);

  // Determine items that define the pie slices: Top 10 + "Other Items" slice
  const pieDisplayItems = useMemo(() => {
    let sourceList = [];
    if (selectedSection) {
      const raw = selectedSection.items || [];
      sourceList = raw.filter((it) => {
        if (!it) return false;
        if (it.items_count !== undefined) return false;
        if (it.items && Array.isArray(it.items)) return false;
        if (it.isSection) return false;
        if (effectiveSections.some((s) => (String(s.id) === String(it.id) || s.name === it.name) && (it.items_count !== undefined || !it.barcode))) {
          return false;
        }
        return true;
      });
    } else {
      sourceList = effectiveSections || [];
    }

    if (sourceList.length === 0) return [];

    // Sort by active metric descending
    const sorted = [...sourceList].sort((a, b) => {
      const valA = getMetricVal(a, metricMode);
      const valB = getMetricVal(b, metricMode);
      return valB - valA;
    });

    if (sorted.length <= 10) {
      return sorted.map((it, idx) => ({
        ...it,
        color: selectedSection
          ? PALETTE[idx % PALETTE.length]
          : (it.color || PALETTE[idx % PALETTE.length]),
      }));
    }

    const top10 = sorted.slice(0, 10).map((it, idx) => ({
      ...it,
      color: selectedSection
        ? PALETTE[idx % PALETTE.length]
        : (it.color || PALETTE[idx % PALETTE.length]),
    }));
    const remainder = sorted.slice(10);
    const otherRev = remainder.reduce((acc, it) => acc + (it.revenue || 0), 0);
    const otherProfit = remainder.reduce((acc, it) => acc + (it.gross_profit || 0), 0);
    const otherUnits = remainder.reduce((acc, it) => acc + (it.units_sold || 0), 0);

    const otherSlice = {
      id: '__other_aggregated__',
      name: selectedSection
        ? `Other Items (${remainder.length})`
        : `Other Sections (${remainder.length})`,
      revenue: Math.round(otherRev * 100) / 100,
      gross_profit: Math.round(otherProfit * 100) / 100,
      units_sold: otherUnits,
      margin_pct: otherRev > 0 ? Math.round(((otherProfit / otherRev) * 100) * 10) / 10 : 0,
      isAggregatedOther: true,
      color: '#64748B',
    };

    return [...top10, otherSlice];
  }, [effectiveSections, selectedSection, metricMode]);

  // Total value for current metric
  const totalValue = useMemo(() => {
    return pieDisplayItems.reduce((acc, it) => {
      return acc + getMetricVal(it, metricMode);
    }, 0);
  }, [pieDisplayItems, metricMode]);

  // Slices geometry
  const slices = useMemo(() => {
    if (totalValue <= 0) return [];
    let cumulativeAngle = -Math.PI / 2;

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
    // When drilled down into a section with a single product, default center display directly to that product!
    if (selectedSection && slices.length === 1) {
      return slices[0];
    }
    return null;
  }, [hoveredIndex, hoveredId, slices, ledgerItems, metricMode, totalValue, selectedSection]);

  const cx = 135;
  const cy = 135;
  const rOuter = 115;
  const rInner = 72;

  const viewKeyScope = selectedSection ? `sec-${selectedSection.id}` : 'all';

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
            <Layers size={18} color="#38BDF8" />
            <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 700, color: 'var(--text-primary, #0F172A)' }}>
              Sales & Profit by Store Section & Items
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
              title="2-Layer Drilldown: Section -> Individual Items (Top 10 + Others)."
            >
              <ShieldCheck size={12} />
              <span>Section Item Drilldown</span>
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

          {/* Breadcrumb Navigation: All Sections -> Section Items */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '0.8rem', flexWrap: 'wrap' }}>
            {!lockToSectionId ? (
              <>
                <span
                  onClick={() => {
                    setSelectedSectionId(null);
                    setItemSearch('');
                    setHoveredId(null);
                    setHoveredIndex(null);
                  }}
                  style={{
                    color: selectedSection ? '#38BDF8' : 'var(--text-primary, #0F172A)',
                    fontWeight: selectedSection ? 500 : 700,
                    cursor: selectedSection ? 'pointer' : 'default',
                    textDecoration: selectedSection ? 'underline' : 'none',
                  }}
                >
                  All Sections ({effectiveSections.length})
                </span>

                {selectedSection && (
                  <>
                    <ChevronRight size={14} color="#64748B" />
                    <span style={{ color: '#00E5A3', fontWeight: 700 }}>
                      {selectedSection.name} {selectedSection.code ? `(${selectedSection.code})` : ''} ({ledgerItems.length} Products)
                    </span>
                  </>
                )}
              </>
            ) : (
              <span style={{ color: '#00E5A3', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#00E5A3' }} />
                <span>{selectedSection?.name || lockToSectionName || 'Assigned Section'} ({ledgerItems.length} Section Items)</span>
              </span>
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
          {selectedSection && !lockToSectionId && (
            <button
              onClick={() => {
                setSelectedSectionId(null);
                setItemSearch('');
                setHoveredId(null);
                setHoveredIndex(null);
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
              <ArrowLeft size={14} /> Back to All Sections
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
              <Package size={12} /> Units Sold
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Layout: Left Donut + Right Detailed Ledger Table */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 340px) 1fr',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Interactive SVG Donut Chart */}
        <div
          key={`chart-col-${viewKeyScope}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-surface-solid, rgba(255, 255, 255, 0.02))',
            borderRadius: '14px',
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.05))',
            padding: '18px 12px',
            position: 'relative',
          }}
        >
          {slices.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted, #64748B)', fontSize: '0.86rem' }}>
              <PieIcon size={38} style={{ opacity: 0.35, marginBottom: '10px' }} />
              <div>{selectedSection ? `No item sales recorded in ${selectedSection.name} for this period.` : 'No section activity recorded for this timeframe.'}</div>
            </div>
          ) : (
            <div style={{ position: 'relative', width: `${cx * 2}px`, height: `${cy * 2}px` }}>
              <svg width={cx * 2} height={cy * 2} style={{ overflow: 'visible' }}>
                <defs>
                  {slices.map((slice, i) => (
                    <filter key={`glow-${viewKeyScope}-${slice.id}-${i}`} id={`section-glow-${viewKeyScope}-${i}`} x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={slice.color} floodOpacity="0.65" />
                    </filter>
                  ))}
                </defs>

                {slices.length === 1 ? (
                  (() => {
                    const slice = slices[0];
                    const isHovered = hoveredIndex === 0 || hoveredId === slice.id;
                    const rMid = (rOuter + rInner) / 2;
                    const ringWidth = rOuter - rInner + (isHovered ? 6 : 0);

                    return (
                      <circle
                        key={`single-circle-${viewKeyScope}-${slice.id}`}
                        cx={cx}
                        cy={cy}
                        r={rMid}
                        fill="none"
                        stroke={slice.color}
                        strokeWidth={ringWidth}
                        strokeOpacity={isHovered ? 1 : 0.88}
                        filter={isHovered ? `url(#section-glow-${viewKeyScope}-0)` : undefined}
                        style={{
                          cursor: !selectedSection ? 'pointer' : 'default',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                        onMouseEnter={() => {
                          setHoveredIndex(0);
                          setHoveredId(slice.id);
                        }}
                        onMouseLeave={() => {
                          setHoveredIndex(null);
                          setHoveredId(null);
                        }}
                        onClick={() => {
                          if (!selectedSection) {
                            setSelectedSectionId(slice.id);
                            setItemSearch('');
                            setHoveredId(null);
                            setHoveredIndex(null);
                          }
                        }}
                      />
                    );
                  })()
                ) : (
                  slices.map((slice, i) => {
                    const isHovered = hoveredIndex === i || hoveredId === slice.id;
                    const isInteractive = !slice.isAggregatedOther;
                    const path = getDonutArcPath(
                      cx,
                      cy,
                      rInner - (isHovered ? 2 : 0),
                      rOuter + (isHovered ? 6 : 0),
                      slice.startAngle,
                      slice.endAngle
                    );

                    return (
                      <path
                        key={`slice-${viewKeyScope}-${slice.id}-${i}`}
                        d={path}
                        fill={slice.color}
                        fillOpacity={isHovered ? 1 : 0.85}
                        stroke="var(--chart-card-bg, #0F172A)"
                        strokeWidth="2.5"
                        filter={isHovered ? `url(#section-glow-${viewKeyScope}-${i})` : undefined}
                        style={{
                          cursor: !selectedSection && isInteractive ? 'pointer' : 'default',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                        onMouseEnter={() => {
                          setHoveredIndex(i);
                          setHoveredId(slice.id);
                        }}
                        onMouseLeave={() => {
                          setHoveredIndex(null);
                          setHoveredId(null);
                        }}
                        onClick={() => {
                          if (!selectedSection && isInteractive) {
                            setSelectedSectionId(slice.id);
                            setItemSearch('');
                            setHoveredId(null);
                            setHoveredIndex(null);
                          }
                        }}
                      />
                    );
                  })
                )}
              </svg>

              {/* Center Donut Hole Information */}
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: `${rInner * 2 - 12}px`,
                  height: `${rInner * 2 - 12}px`,
                  borderRadius: '50%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  pointerEvents: 'none',
                  padding: '6px',
                }}
              >
                {centerItem ? (
                  <>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: centerItem.color || 'var(--brand-primary, #38BDF8)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        maxWidth: '100px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {centerItem.name}
                    </span>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)', margin: '1px 0' }}>
                      {metricMode === 'quantity'
                        ? `${centerItem.val?.toLocaleString() || 0} pcs`
                        : formatIndianCurrencyCompact(centerItem.val || 0)}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary, #94A3B8)' }}>
                      {centerItem.pct}% {metricMode === 'quantity' ? 'units' : 'share'}
                    </span>
                    {centerItem.margin_pct !== undefined && (
                      <span
                        style={{
                          fontSize: '0.64rem',
                          fontWeight: 700,
                          color: '#00E5A3',
                          marginTop: '2px',
                        }}
                      >
                        {centerItem.margin_pct}% Margin
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '0.66rem', color: 'var(--text-secondary, #94A3B8)', textTransform: 'uppercase', letterSpacing: '0.5px', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedSection ? selectedSection.name : 'All Sections'}
                    </span>
                    <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)', margin: '2px 0' }}>
                      {metricMode === 'quantity'
                        ? `${totalValue.toLocaleString()} pcs`
                        : formatIndianCurrencyCompact(totalValue)}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748B)' }}>
                      {metricMode === 'revenue'
                        ? 'Total Revenue'
                        : metricMode === 'profit'
                        ? 'Total Gross Profit'
                        : 'Total Units Sold'}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Slices Legend Badges */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              justifyContent: 'center',
              marginTop: '16px',
              maxWidth: '310px',
            }}
          >
            {pieDisplayItems.map((it, idx) => {
              const isHovered = hoveredIndex === idx || hoveredId === it.id;
              const isAggregated = it.isAggregatedOther;

              return (
                <button
                  key={`badge-${viewKeyScope}-${it.id != null ? it.id : idx}-${idx}`}
                  onClick={() => {
                    if (!selectedSection && !isAggregated) {
                      setSelectedSectionId(it.id);
                      setItemSearch('');
                      setHoveredId(null);
                      setHoveredIndex(null);
                    }
                  }}
                  onMouseEnter={() => {
                    setHoveredIndex(idx);
                    setHoveredId(it.id);
                  }}
                  onMouseLeave={() => {
                    setHoveredIndex(null);
                    setHoveredId(null);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '3px 7px',
                    borderRadius: '6px',
                    background: isHovered ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${isHovered ? it.color : 'rgba(255, 255, 255, 0.06)'}`,
                    fontSize: '0.72rem',
                    color: isHovered ? '#FFFFFF' : 'var(--text-secondary, #94A3B8)',
                    cursor: !selectedSection && !isAggregated ? 'pointer' : 'default',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      backgroundColor: it.color,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Interactive Searchable Ledger Breakdown */}
        <div
          key={`ledger-col-${viewKeyScope}`}
          style={{
            background: 'var(--bg-surface-solid, rgba(255, 255, 255, 0.02))',
            borderRadius: '14px',
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.05))',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            minHeight: '340px',
          }}
        >
          {/* Header & Filter Search for Ledger */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary, #F8FAFC)' }}>
                {selectedSection
                  ? `Items in ${selectedSection.name} (${ledgerItems.length})`
                  : `Store Sections Breakdown (${ledgerItems.length})`}
              </span>
            </div>

            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #64748B)' }} />
              <input
                type="text"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder={selectedSection ? 'Filter items by name, barcode...' : 'Filter sections...'}
                style={{
                  width: '100%',
                  padding: '5px 8px 5px 28px',
                  borderRadius: '7px',
                  backgroundColor: 'var(--bg-input, #1E293B)',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                  fontSize: '0.74rem',
                  color: 'var(--text-primary, #F8FAFC)',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Detailed Ledger List */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              maxHeight: '360px',
              overflowY: 'auto',
              paddingRight: '4px',
            }}
          >
            {ledgerItems.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted, #64748B)', fontSize: '0.82rem' }}>
                {selectedSection
                  ? `No items found in ${selectedSection.name} matching "${itemSearch}".`
                  : `No sections matching "${itemSearch}".`}
              </div>
            ) : (
              ledgerItems.map((it, idx) => {
                const metricVal = getMetricVal(it, metricMode);
                const sharePct = totalValue > 0 ? ((metricVal / totalValue) * 100).toFixed(1) : '0.0';
                const isHovered = hoveredId === it.id;
                const assignedColor = selectedSection
                  ? PALETTE[idx % PALETTE.length]
                  : (it.color || PALETTE[idx % PALETTE.length]);

                return (
                  <div
                    key={`ledger-${viewKeyScope}-${it.id != null ? it.id : idx}-${it.name || idx}-${idx}`}
                    onClick={() => {
                      if (!selectedSection) {
                        setSelectedSectionId(it.id);
                        setItemSearch('');
                        setHoveredId(null);
                        setHoveredIndex(null);
                      }
                    }}
                    onMouseEnter={() => {
                      setHoveredId(it.id);
                    }}
                    onMouseLeave={() => {
                      setHoveredId(null);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      padding: '10px 12px',
                      borderRadius: '9px',
                      background: isHovered
                        ? 'rgba(56, 189, 248, 0.08)'
                        : 'var(--bg-surface, rgba(255, 255, 255, 0.02))',
                      border: `1px solid ${isHovered ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255, 255, 255, 0.04)'}`,
                      cursor: !selectedSection ? 'pointer' : 'default',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {/* Left details: Rank, Color dot, Name, Barcode/Code */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: 'var(--text-muted, #64748B)',
                          width: '18px',
                          textAlign: 'right',
                        }}
                      >
                        #{idx + 1}
                      </span>
                      <span
                        style={{
                          width: '9px',
                          height: '9px',
                          borderRadius: '50%',
                          backgroundColor: assignedColor,
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              color: 'var(--text-primary, #F8FAFC)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {it.name}
                          </span>
                          {!selectedSection && it.code && (
                            <span
                              style={{
                                padding: '1px 5px',
                                borderRadius: '4px',
                                fontSize: '0.66rem',
                                fontWeight: 700,
                                background: 'rgba(255, 255, 255, 0.08)',
                                color: 'var(--text-secondary, #CBD5E1)',
                              }}
                            >
                              {it.code}
                            </span>
                          )}
                        </div>

                        {/* Sub-line: Barcode / SKU / Items Count */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem', color: 'var(--text-secondary, #94A3B8)', marginTop: '2px' }}>
                          {selectedSection ? (
                            <>
                              {it.barcode && <span style={{ fontFamily: 'monospace' }}>🏷️ {it.barcode}</span>}
                              {it.sku && <span>SKU: {it.sku}</span>}
                            </>
                          ) : (
                            it.items_count !== undefined && (
                              <span>{it.items_count || (it.items?.length || 0)} products</span>
                            )
                          )}
                          {it.margin_pct !== undefined && (
                            <span style={{ color: '#00E5A3', fontWeight: 600 }}>
                              {it.margin_pct}% margin
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right details: Metric Value, Units & Action */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0, textAlign: 'right' }}>
                      <div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary, #F8FAFC)' }}>
                          {metricMode === 'quantity'
                            ? `${metricVal.toLocaleString()} pcs`
                            : formatIndianCurrencyCompact(metricVal)}
                        </div>
                        <div style={{ fontSize: '0.70rem', color: 'var(--text-secondary, #94A3B8)' }}>
                          {metricMode !== 'quantity' && `${it.units_sold || 0} sold · `}
                          {sharePct}% share
                        </div>
                      </div>

                      {!selectedSection && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(56, 189, 248, 0.12)',
                            color: '#38BDF8',
                            fontSize: '0.70rem',
                            fontWeight: 700,
                          }}
                        >
                          <span>Drilldown</span>
                          <ChevronRight size={13} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
