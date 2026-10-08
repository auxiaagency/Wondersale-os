import React, { useState, useMemo, useRef } from 'react';
import {
  Calendar,
  Clock,
  RotateCcw,
  ShoppingBag,
  TrendingUp,
  Receipt,
  DollarSign,
  Sparkles,
  Zap,
} from 'lucide-react';
import { filterTimelineSeries } from './TimelineRangeSelector';
import { formatIndianCurrencyCompact, getCatmullRomBezierPath } from './GlowCurveChart';

const PERIOD_CONFIG = {
  day: { label: 'Day (Hourly)', sublabel: 'Hourly Transaction Curve', icon: Clock },
  week: { label: 'Week', sublabel: '7-Day View', icon: Calendar },
  month: { label: 'Month', sublabel: 'Daily Sales Frequency', icon: Calendar },
  year: { label: 'Year', sublabel: '12 Months', icon: Calendar },
};

export default function SalesVolumeCurveChart({
  id = 'sales-volume-chart',
  title = 'Sales Volume & Transaction Frequency',
  yearlyData = [],
  monthlyData = [],
  weeksData = [],
  hourlyByDay = {},
  initialPeriod = 'month',
  activeMonthKey = 9,
  selectedYear = 2026,
  selectedMonthName = 'September',
  onYearChange = null,
  onMonthChange = null,
  onWeekChange = null,
  onDayChange = null,
  timelineRange = null,
  minDate = '2026-09-04',
  height = 300,
}) {
  const containerRef = useRef(null);
  const [period, setPeriod] = useState(initialPeriod || 'month');
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(0);
  const [selectedDayNum, setSelectedDayNum] = useState(() => {
    const today = new Date();
    return today.getDate();
  });
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [showReturnsLine, setShowReturnsLine] = useState(true);

  // Sync with timelineRange unit when changed by master timeline
  React.useEffect(() => {
    if (timelineRange?.unit) {
      if (['day', 'week', 'month', 'year'].includes(timelineRange.unit)) {
        setPeriod(timelineRange.unit);
      }
    }
  }, [timelineRange?.unit]);

  // Determine active raw dataset
  const rawDataset = useMemo(() => {
    if (period === 'year') return yearlyData || [];
    if (period === 'month') return monthlyData || [];
    if (period === 'week') return weeksData || [];
    if (period === 'day') {
      const daySlots = hourlyByDay?.[selectedDayNum] || [];
      return daySlots;
    }
    return monthlyData || [];
  }, [period, yearlyData, monthlyData, weeksData, hourlyByDay, selectedDayNum]);

  // Filter dataset by timeline range
  const activeDataset = useMemo(() => {
    if (!rawDataset || rawDataset.length === 0) return [];
    if (!timelineRange || timelineRange.isAllTime) return rawDataset;
    try {
      const filtered = filterTimelineSeries(rawDataset, timelineRange, period);
      return filtered.length > 0 ? filtered : rawDataset;
    } catch (e) {
      return rawDataset;
    }
  }, [rawDataset, timelineRange, period]);

  // Aggregate statistics for the current active dataset
  const stats = useMemo(() => {
    if (!activeDataset || activeDataset.length === 0) {
      return { totalOrders: 0, totalReturns: 0, netOrders: 0, totalRevenue: 0, avgSale: 0, peakSale: 0, peakLabel: '' };
    }
    let totalOrders = 0;
    let totalReturns = 0;
    let totalRevenue = 0;
    let peakSale = 0;
    let peakLabel = '';

    activeDataset.forEach((pt) => {
      const orders = Number(pt.orders_count ?? pt.units ?? pt.transactions ?? 0);
      const returns = Number(pt.returns_count ?? 0);
      const rev = Number(pt.net_revenue ?? pt.net_revenue_after_gst ?? pt.revenue ?? 0);
      totalOrders += orders;
      totalReturns += returns;
      totalRevenue += rev;
      if (orders > peakSale) {
        peakSale = orders;
        peakLabel = pt.label || pt.short_label || pt.date || '';
      }
    });

    const netOrders = Math.max(0, totalOrders - totalReturns);
    const avgSale = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    return { totalOrders, totalReturns, netOrders, totalRevenue, avgSale, peakSale, peakLabel };
  }, [activeDataset]);

  // SVG dimensions
  const svgWidth = 840;
  const svgHeight = height || 300;
  const padTop = 38;
  const padBottom = 42;
  const padLeft = 44;
  const padRight = 32;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  const pointsCount = activeDataset.length;

  // Max value calculation for Y axis
  const maxY = useMemo(() => {
    let max = 5;
    activeDataset.forEach((d) => {
      const orders = Number(d.orders_count || 0);
      const returns = Number(d.returns_count || 0);
      if (orders > max) max = orders;
      if (returns > max) max = returns;
    });
    // Add 20% headroom
    return Math.ceil(max * 1.25);
  }, [activeDataset]);

  const getY = (val) => {
    if (maxY <= 0) return padTop + plotHeight;
    const ratio = Math.max(0, Math.min(1, Number(val || 0) / maxY));
    return padTop + plotHeight - ratio * plotHeight;
  };

  const getX = (idx) => {
    if (pointsCount <= 1) return padLeft + plotWidth / 2;
    return padLeft + (idx / (pointsCount - 1)) * plotWidth;
  };

  // Build points for Sales Orders Curve and Returns Curve
  const salesPoints = useMemo(() => {
    return activeDataset.map((d, i) => ({
      x: getX(i),
      y: getY(d.orders_count || 0),
      val: d.orders_count || 0,
      data: d,
    }));
  }, [activeDataset, maxY]);

  const returnsPoints = useMemo(() => {
    return activeDataset.map((d, i) => ({
      x: getX(i),
      y: getY(d.returns_count || 0),
      val: d.returns_count || 0,
      data: d,
    }));
  }, [activeDataset, maxY]);

  const salesPath = useMemo(() => getCatmullRomBezierPath(salesPoints, 0.28), [salesPoints]);
  const returnsPath = useMemo(() => getCatmullRomBezierPath(returnsPoints, 0.28), [returnsPoints]);

  // Closed area paths for gradient glow underneath
  const salesAreaPath = useMemo(() => {
    if (!salesPoints.length || !salesPath) return '';
    const bottomY = padTop + plotHeight;
    const first = salesPoints[0];
    const last = salesPoints[salesPoints.length - 1];
    return `${salesPath} L ${last.x.toFixed(2)} ${bottomY} L ${first.x.toFixed(2)} ${bottomY} Z`;
  }, [salesPoints, salesPath, plotHeight, padTop]);

  // Determine active hovered item
  const activeIndex = hoveredIndex !== null && hoveredIndex < pointsCount ? hoveredIndex : null;
  const activeItem = activeIndex !== null ? activeDataset[activeIndex] : null;
  const activeSalePt = activeIndex !== null ? salesPoints[activeIndex] : null;

  // Change period drilldown helper
  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    setHoveredIndex(null);
  };

  return (
    <div
      ref={containerRef}
      style={{
        borderRadius: '16px',
        backgroundColor: 'var(--bg-surface, var(--card-bg, #1E293B))',
        border: '1px solid var(--border-subtle, var(--border-color, rgba(255,255,255,0.08)))',
        boxShadow: '0 4px 20px -2px rgba(0,0,0,0.12)',
        padding: '22px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        position: 'relative',
      }}
    >
      {/* ── Top Header & Toolbar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38BDF8',
            }}
          >
            <ShoppingBag size={18} />
          </div>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '1.05rem',
                fontWeight: 800,
                color: 'var(--text-primary, #F8FAFC)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {title}
              {period === 'day' && (
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-pill, 12px)',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#10B981',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}
                >
                  Hourly Today
                </span>
              )}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: 'var(--text-secondary, #94A3B8)' }}>
              {period === 'day'
                ? `Day ${selectedDayNum} ${selectedMonthName} — Hourly completed retail sales & returns count`
                : period === 'week'
                ? `Weekly breakdown of sales transactions & ticket sizes`
                : period === 'month'
                ? `Daily orders count across ${selectedMonthName} ${selectedYear} with returns tracking`
                : `Annual monthly sales volume & return activity for ${selectedYear}`}
            </p>
          </div>
        </div>

        {/* Period Selector Tabs & Returns Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '3px',
              borderRadius: '10px',
              backgroundColor: 'rgba(0,0,0,0.06)',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
              gap: '2px',
            }}
          >
            {Object.keys(PERIOD_CONFIG).map((pKey) => {
              const cfg = PERIOD_CONFIG[pKey];
              const isActive = period === pKey;
              return (
                <button
                  key={pKey}
                  type="button"
                  onClick={() => handlePeriodChange(pKey)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: '7px',
                    fontSize: '0.74rem',
                    fontWeight: isActive ? 700 : 500,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: isActive ? '#38BDF8' : 'transparent',
                    color: isActive ? '#0B0F19' : 'var(--text-secondary, #94A3B8)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>

          {/* Quick "Today" action button when in day mode */}
          {period === 'day' && (
            <button
              type="button"
              onClick={() => {
                const todayNum = new Date().getDate();
                setSelectedDayNum(todayNum);
                if (onDayChange) onDayChange(todayNum);
              }}
              style={{
                padding: '5px 11px',
                borderRadius: '8px',
                fontSize: '0.72rem',
                fontWeight: 700,
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                color: '#38BDF8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Zap size={12} /> Today (Day {new Date().getDate()})
            </button>
          )}

          {/* Toggle Returns Curve */}
          <button
            type="button"
            onClick={() => setShowReturnsLine((prev) => !prev)}
            style={{
              padding: '5px 10px',
              borderRadius: '8px',
              fontSize: '0.72rem',
              fontWeight: 600,
              backgroundColor: showReturnsLine ? 'rgba(244, 63, 94, 0.12)' : 'rgba(255, 255, 255, 0.04)',
              color: showReturnsLine ? '#F43F5E' : 'var(--text-secondary, #94A3B8)',
              border: `1px solid ${showReturnsLine ? 'rgba(244, 63, 94, 0.35)' : 'var(--border-subtle, rgba(255,255,255,0.08))'}`,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <RotateCcw size={12} /> {showReturnsLine ? 'Returns Curve ON' : 'Show Returns'}
          </button>
        </div>
      </div>

      {/* ── Summary KPI Strip for this interval ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '10px',
        }}
      >
        {/* Metric 1: Total Sales Orders */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            backgroundColor: 'rgba(56, 189, 248, 0.06)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
          }}
        >
          <div style={{ fontSize: '0.7rem', color: '#38BDF8', fontWeight: 600, textTransform: 'uppercase' }}>
            Completed Sales Orders
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)', marginTop: '2px' }}>
            {stats.totalOrders} <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94A3B8)', fontWeight: 500 }}>orders</span>
          </div>
        </div>

        {/* Metric 2: Returns & Refund Ratio */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            backgroundColor: stats.totalReturns > 0 ? 'rgba(244, 63, 94, 0.06)' : 'rgba(255, 255, 255, 0.02)',
            border: `1px solid ${stats.totalReturns > 0 ? 'rgba(244, 63, 94, 0.25)' : 'var(--border-subtle, rgba(255,255,255,0.06))'}`,
          }}
        >
          <div style={{ fontSize: '0.7rem', color: stats.totalReturns > 0 ? '#F43F5E' : 'var(--text-secondary, #94A3B8)', fontWeight: 600, textTransform: 'uppercase' }}>
            Returns & Refunds
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: stats.totalReturns > 0 ? '#F43F5E' : 'var(--text-secondary, #94A3B8)', marginTop: '2px' }}>
            {stats.totalReturns} <span style={{ fontSize: '0.72rem', fontWeight: 500 }}>({stats.totalOrders > 0 ? ((stats.totalReturns / stats.totalOrders) * 100).toFixed(1) : 0}%)</span>
          </div>
        </div>

        {/* Metric 3: Net Retained Transactions */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            backgroundColor: 'rgba(16, 185, 129, 0.06)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
          }}
        >
          <div style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 600, textTransform: 'uppercase' }}>
            Net Active Transactions
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10B981', marginTop: '2px' }}>
            {stats.netOrders} <span style={{ fontSize: '0.72rem', fontWeight: 500 }}>net sales</span>
          </div>
        </div>

        {/* Metric 4: Average Ticket Size (₹ per sale) */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
          }}
        >
          <div style={{ fontSize: '0.7rem', color: '#F59E0B', fontWeight: 600, textTransform: 'uppercase' }}>
            Average ₹ Per Sale (AOV)
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#F59E0B', marginTop: '2px' }}>
            ₹{stats.avgSale.toLocaleString('en-IN')} <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94A3B8)', fontWeight: 600 }}>/ order</span>
          </div>
        </div>

        {/* Metric 5: Peak Sales Interval */}
        {stats.peakSale > 0 && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: 'rgba(99, 102, 241, 0.06)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
            }}
          >
            <div style={{ fontSize: '0.7rem', color: '#818CF8', fontWeight: 600, textTransform: 'uppercase' }}>
              Peak Interval
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#818CF8', marginTop: '2px' }}>
              {stats.peakSale} sales <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94A3B8)', fontWeight: 500 }}>({stats.peakLabel})</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Interactive SVG Curve Chart ── */}
      <div style={{ position: 'relative', width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ width: '100%', minWidth: '640px', height: `${svgHeight}px`, display: 'block', overflow: 'visible' }}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <defs>
            {/* Sales Volume Glow Gradient */}
            <linearGradient id={`${id}-sales-grad`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.32" />
              <stop offset="70%" stopColor="#38BDF8" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.0" />
            </linearGradient>

            {/* Returns Volume Glow Gradient */}
            <linearGradient id={`${id}-returns-grad`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F43F5E" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#F43F5E" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid Lines (Horizontal) */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = padTop + plotHeight * (1 - ratio);
            const val = Math.round(maxY * ratio);
            return (
              <g key={`grid-${idx}`}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={padLeft + plotWidth}
                  y2={y}
                  stroke="var(--border-subtle, rgba(255,255,255,0.06))"
                  strokeWidth="1"
                  strokeDasharray={idx === 0 ? 'none' : '3 3'}
                />
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize="10"
                  fontWeight="600"
                  fill="var(--text-muted, #64748B)"
                  fontFamily="var(--font-mono, monospace)"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Y-axis label */}
          <text
            x={padLeft}
            y={padTop - 12}
            textAnchor="start"
            fontSize="10"
            fontWeight="700"
            fill="var(--text-muted, #64748B)"
            letterSpacing="0.04em"
          >
            SALES COUNT
          </text>

          {/* Area Fill Under Sales Curve */}
          {salesAreaPath && <path d={salesAreaPath} fill={`url(#${id}-sales-grad)`} />}

          {/* Returns Curve (if enabled) */}
          {showReturnsLine && returnsPath && (
            <path
              d={returnsPath}
              fill="none"
              stroke="#F43F5E"
              strokeWidth="2"
              strokeDasharray="4 4"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.85"
            />
          )}

          {/* Main Sales Orders Curve */}
          {salesPath && (
            <path
              d={salesPath}
              fill="none"
              stroke="#38BDF8"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="drop-shadow(0 2px 6px rgba(56, 189, 248, 0.45))"
            />
          )}

          {/* Vertical Hover Guides & Interactive Column Triggers */}
          {activeDataset.map((pt, i) => {
            const x = getX(i);
            const colWidth = pointsCount > 1 ? plotWidth / (pointsCount - 1) : plotWidth;
            const isHovered = i === activeIndex;

            return (
              <g key={`col-${i}`}>
                {/* Transparent hit target for hover/click */}
                <rect
                  x={x - colWidth / 2}
                  y={padTop}
                  width={colWidth}
                  height={plotHeight}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onClick={() => {
                    if (period === 'year' && pt.month && onMonthChange) {
                      onMonthChange(pt.month);
                      handlePeriodChange('month');
                    } else if ((period === 'month' || period === 'week') && pt.day) {
                      setSelectedDayNum(pt.day);
                      if (onDayChange) onDayChange(pt.day);
                      handlePeriodChange('day');
                    }
                  }}
                />

                {/* Vertical cursor guide */}
                {isHovered && (
                  <line
                    x1={x}
                    y1={padTop}
                    x2={x}
                    y2={padTop + plotHeight}
                    stroke="#38BDF8"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    opacity="0.8"
                    style={{ pointerEvents: 'none' }}
                  />
                )}
              </g>
            );
          })}

          {/* Circular Data Points on Curve */}
          {salesPoints.map((pt, i) => {
            const isSelected = i === activeIndex;
            return (
              <g key={`pt-${i}`} style={{ pointerEvents: 'none' }}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isSelected ? 6 : pointsCount > 25 ? 3 : 4}
                  fill="var(--bg-surface, var(--card-bg, #1E293B))"
                  stroke="#38BDF8"
                  strokeWidth={isSelected ? 3.5 : 2}
                />
                {isSelected && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={12}
                    fill="#38BDF8"
                    fillOpacity="0.22"
                    stroke="#38BDF8"
                    strokeWidth="1.5"
                    strokeOpacity="0.6"
                  />
                )}
              </g>
            );
          })}

          {/* Returns Data Points */}
          {showReturnsLine &&
            returnsPoints.map((pt, i) => {
              if (pt.val <= 0 && i !== activeIndex) return null;
              const isSelected = i === activeIndex;
              return (
                <circle
                  key={`ret-pt-${i}`}
                  cx={pt.x}
                  cy={pt.y}
                  r={isSelected ? 4.5 : 2.5}
                  fill="var(--bg-surface, var(--card-bg, #1E293B))"
                  stroke="#F43F5E"
                  strokeWidth="2"
                  style={{ pointerEvents: 'none' }}
                />
              );
            })}

          {/* X-Axis Labels */}
          {activeDataset.map((d, i) => {
            const x = getX(i);
            const isSelected = i === activeIndex;
            // Skip alternating labels if pointsCount is dense
            if (pointsCount > 20 && i % 2 !== 0 && i !== pointsCount - 1 && !isSelected) {
              return null;
            }
            return (
              <text
                key={`xlabel-${i}`}
                x={x}
                y={padTop + plotHeight + 20}
                fill={isSelected ? '#38BDF8' : 'var(--text-muted, #64748B)'}
                fontSize={isSelected ? '11.5' : '10.5'}
                fontWeight={isSelected ? '800' : '500'}
                textAnchor="middle"
                fontFamily="system-ui, -apple-system, sans-serif"
                style={{ pointerEvents: 'none' }}
              >
                {d.label || d.short_label || d.hour || d.day || i + 1}
              </text>
            );
          })}
        </svg>

        {/* ── DETAILED HOVER CARD (KEY USER REQUIREMENT: SHOW AVERAGE RUPEES PER SALE) ── */}
        {activeItem && activeSalePt && (
          <div
            style={{
              position: 'absolute',
              top: '10px',
              left: `${Math.min(Math.max(18, (activeSalePt.x / svgWidth) * 100), 82)}%`,
              transform: 'translate(-50%, 0)',
              backgroundColor: 'var(--bg-surface, var(--card-bg, #1E293B))',
              border: '1.5px solid #38BDF8',
              boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.35), 0 0 16px rgba(56, 189, 248, 0.2)',
              borderRadius: '12px',
              padding: '12px 16px',
              pointerEvents: 'none',
              zIndex: 30,
              minWidth: '260px',
              maxWidth: '340px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              backdropFilter: 'blur(12px)',
            }}
          >
            {/* Header: Date or Slot Label */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                paddingBottom: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-primary, #F8FAFC)' }}>
                <Calendar size={13} color="#38BDF8" />
                <span>{activeItem.label || activeItem.date || `Interval #${activeIndex + 1}`}</span>
              </div>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: '#38BDF8',
                  backgroundColor: 'rgba(56, 189, 248, 0.12)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                {period.toUpperCase()}
              </span>
            </div>

            {/* Sales Volume Count */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#38BDF8' }} />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94A3B8)', fontWeight: 600 }}>Sales Orders:</span>
              </div>
              <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary, #F8FAFC)', fontFamily: 'var(--font-mono, monospace)' }}>
                {activeItem.orders_count || 0} Orders
              </strong>
            </div>

            {/* Returns & Net Sales */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F43F5E' }} />
                <span style={{ color: 'var(--text-secondary, #94A3B8)', fontWeight: 600 }}>Returns / Refunds:</span>
              </div>
              <span style={{ color: Number(activeItem.returns_count || 0) > 0 ? '#F43F5E' : 'var(--text-muted, #64748B)', fontWeight: 700 }}>
                {activeItem.returns_count || 0} {Number(activeItem.returns_count || 0) > 0 && activeItem.returns_amount ? `(-₹${Number(activeItem.returns_amount).toLocaleString('en-IN')})` : ''}
              </span>
            </div>

            {/* Total Net Revenue That Day */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Receipt size={12} color="#10B981" />
                <span style={{ color: 'var(--text-secondary, #94A3B8)', fontWeight: 600 }}>Net Day Revenue:</span>
              </div>
              <span style={{ color: '#10B981', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)' }}>
                ₹{Number(activeItem.net_revenue ?? activeItem.revenue ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>

            {/* ── HIGHLIGHT: AVERAGE RUPEES PER SALE THAT DAY ── */}
            <div
              style={{
                marginTop: '4px',
                padding: '8px 10px',
                borderRadius: '8px',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.7rem', color: '#F59E0B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Average ₹ Per Sale:
                </span>
                <span style={{ fontSize: '0.98rem', fontWeight: 900, color: '#F59E0B', fontFamily: 'var(--font-mono, monospace)' }}>
                  ₹{(activeItem.avg_sale_rupees || activeItem.average_order_value || (activeItem.orders_count ? Math.round(Number(activeItem.net_revenue ?? activeItem.revenue ?? 0) / activeItem.orders_count) : 0)).toLocaleString('en-IN')}
                </span>
              </div>
              <div style={{ fontSize: '0.64rem', color: 'var(--text-muted, #94A3B8)' }}>
                Average ticket size calculated for this interval
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Legend & Interactive Note ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          paddingTop: '6px',
          borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
          fontSize: '0.74rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#38BDF8' }} />
            <span style={{ color: 'var(--text-primary, #F8FAFC)', fontWeight: 600 }}>Sales Orders Placed</span>
          </div>
          {showReturnsLine && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#F43F5E' }} />
              <span style={{ color: 'var(--text-primary, #F8FAFC)', fontWeight: 600 }}>Returns / Refunds Processed</span>
            </div>
          )}
        </div>

        <div style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.72rem' }}>
          💡 Click any point to zoom into its detailed hourly/daily breakdown. Hover to inspect average rupees per sale.
        </div>
      </div>
    </div>
  );
}
