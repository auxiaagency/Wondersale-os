import React, { useState, useMemo } from 'react';
import {
  Package,
  Calendar,
  Zap,
  Clock,
  Sparkles,
  BarChart3,
  LineChart,
  TrendingUp,
  Award,
  Crown,
  Flame,
  Boxes,
  ArrowUpRight,
  Info,
} from 'lucide-react';
import TimelineRangeSelector, { filterTimelineSeries } from './TimelineRangeSelector';
import { getCatmullRomBezierPath, formatIndianCurrencyCompact } from './GlowCurveChart';
import { calculatePointChange, getPointDisplayLabel } from '../utils/chartChangeHelper';

export default function ProductQuantitySalesChart({
  item,
  timeline,
  performance,
  currencySymbol = 'Rs.',
  height = 300,
  minDate = '2026-09-04',
}) {
  const [chartMode, setChartMode] = useState('area'); // 'area' | 'bar'
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Raw daily records from backend timeline
  const dailyRecords = useMemo(() => {
    if (timeline?.levels?.day && timeline.levels.day.length > 0) {
      return timeline.levels.day;
    }
    const today = new Date().toISOString().split('T')[0];
    return [
      {
        key: today,
        date: today,
        label: 'Today',
        units_sold: 0,
        revenue: 0,
        margin: 0,
        stock_level: parseInt(item?.quantity, 10) || 0,
      },
    ];
  }, [timeline, item]);

  // Adaptive initial range config
  const [rangeConfig, setRangeConfig] = useState(() => ({
    unit: 'month',
    count: 1,
    granularity: 'week',
    xAxisGrouping: 'week',
    startDate: '',
    endDate: '',
    label: '1 Month',
    isAllTime: false,
  }));

  // Sliced & filtered points
  const plotPoints = useMemo(() => {
    return filterTimelineSeries(dailyRecords, { ...rangeConfig, minDate });
  }, [dailyRecords, rangeConfig, minDate]);

  // Overall peaks from backend performance or computed from timeline
  const peakMetrics = useMemo(() => {
    // 1. All-time peaks from performance prop if available
    const perfBestDay = performance?.best_day;
    const perfBestWeek = performance?.best_week;
    const perfBestMonth = performance?.best_month;
    const dailyVelocity = performance?.daily_velocity ?? 0;
    const weeklyVelocity = performance?.weekly_velocity ?? 0;
    const daysLeft = performance?.days_inventory_left;

    // 2. Compute in-range peak point
    let inRangePeak = { units_sold: 0, plotLabel: '—', revenue: 0 };
    plotPoints.forEach((p) => {
      const u = Number(p.units_sold || p.units) || 0;
      if (u > inRangePeak.units_sold) {
        inRangePeak = {
          units_sold: u,
          plotLabel: p.full_date || p.subLabel || p.plotLabel || p.label || '—',
          revenue: Number(p.revenue) || 0,
        };
      }
    });

    // 3. Fallback day calculation across all daily records if perfBestDay not present
    let computedBestDay = perfBestDay;
    if (!computedBestDay && dailyRecords.length > 0) {
      let maxU = 0;
      dailyRecords.forEach((r) => {
        const u = Number(r.units_sold) || 0;
        if (u > maxU) {
          maxU = u;
          computedBestDay = {
            date: r.date,
            label: r.label || r.date,
            units: u,
            revenue: Number(r.revenue) || 0,
          };
        }
      });
    }

    return {
      bestDay: computedBestDay,
      bestWeek: perfBestWeek,
      bestMonth: perfBestMonth,
      dailyVelocity,
      weeklyVelocity,
      daysLeft,
      inRangePeak,
    };
  }, [performance, plotPoints, dailyRecords]);

  // Max value for Y-axis scaling
  const { maxY, totalUnitsInRange, totalRevenueInRange } = useMemo(() => {
    let max = 0;
    let sumUnits = 0;
    let sumRev = 0;

    plotPoints.forEach((p) => {
      const u = Number(p.units_sold || p.units) || 0;
      if (u > max) max = u;
      sumUnits += u;
      sumRev += Number(p.revenue) || 0;
    });

    // Ensure nice integer step for Y-axis
    let safeMax = Math.max(max, 5);
    // Round up to multiple of 5 or 10
    if (safeMax <= 10) safeMax = 10;
    else if (safeMax <= 25) safeMax = 25;
    else if (safeMax <= 50) safeMax = 50;
    else if (safeMax <= 100) safeMax = 100;
    else safeMax = Math.ceil(safeMax / 50) * 50;

    return {
      maxY: safeMax,
      totalUnitsInRange: sumUnits,
      totalRevenueInRange: sumRev,
    };
  }, [plotPoints]);

  // Geometry dimensions
  const svgW = 1000;
  const svgH = height;
  const padLeft = 56;
  const padRight = 32;
  const padTop = 28;
  const padBottom = 42;
  const plotW = svgW - padLeft - padRight;
  const plotH = svgH - padTop - padBottom;

  // Normalized Coordinates for each point
  const coords = useMemo(() => {
    const len = plotPoints.length;
    if (len === 0) return [];

    return plotPoints.map((p, i) => {
      const x = len === 1 ? padLeft + plotW / 2 : padLeft + (i / (len - 1)) * plotW;
      const u = Number(p.units_sold || p.units) || 0;
      const yFraction = u / (maxY || 1);
      const y = padTop + plotH - yFraction * plotH;
      return {
        ...p,
        unitsVal: u,
        cx: x,
        cy: y,
        index: i,
      };
    });
  }, [plotPoints, plotW, plotH, padLeft, padTop, maxY]);

  // Area Paths
  const { linePath, areaPath } = useMemo(() => {
    if (coords.length === 0) return { linePath: '', areaPath: '' };
    if (coords.length === 1) {
      const c = coords[0];
      return {
        linePath: `M ${c.cx - 10} ${c.cy} L ${c.cx + 10} ${c.cy}`,
        areaPath: `M ${c.cx - 10} ${c.cy} L ${c.cx + 10} ${c.cy} L ${c.cx + 10} ${padTop + plotH} L ${c.cx - 10} ${padTop + plotH} Z`,
      };
    }

    const points = coords.map((c) => ({ x: c.cx, y: c.cy }));
    const lPath = getCatmullRomBezierPath(points);
    const firstX = coords[0].cx;
    const lastX = coords[coords.length - 1].cx;
    const baseY = padTop + plotH;
    const aPath = `${lPath} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;

    return { linePath: lPath, areaPath: aPath };
  }, [coords, padTop, plotH]);

  // Y-axis Ticks
  const yTicks = useMemo(() => {
    const count = 4;
    const ticks = [];
    for (let i = 0; i <= count; i++) {
      const val = Math.round((maxY / count) * i);
      const y = padTop + plotH - (val / maxY) * plotH;
      ticks.push({ val, y });
    }
    return ticks;
  }, [maxY, padTop, plotH]);

  const currentHover = hoveredPoint !== null && coords[hoveredPoint] ? coords[hoveredPoint] : null;

  return (
    <section
      aria-label="Product Sales Velocity and Units Sold Chart"
      className="glass-panel product-chart-card"
      style={{
        width: '100%',
        marginTop: '28px',
        borderRadius: '20px',
        padding: '28px 32px',
        background: 'var(--bg-surface-solid, #161B2C)',
        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
        boxShadow: 'var(--shadow-md, 0 20px 45px rgba(0,0,0,0.3))',
        display: 'flex',
        flexDirection: 'column',
        gap: '22px',
      }}
    >
      {/* 1. TOP HEADER & TIMELINE RANGE SELECTOR */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          paddingBottom: '18px',
          borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.22) 0%, rgba(245, 158, 11, 0.18) 100%)',
              border: '1px solid rgba(139, 92, 246, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#A78BFA',
              flexShrink: 0,
            }}
          >
            <Package size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2
                style={{
                  fontSize: '1.22rem',
                  fontWeight: 800,
                  color: 'var(--text-primary, #F8FAFC)',
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                Product Sales Velocity &amp; Units Sold
              </h2>
              <span
                style={{
                  fontSize: '0.70rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '100px',
                  background: 'rgba(139, 92, 246, 0.15)',
                  border: '1px solid rgba(139, 92, 246, 0.35)',
                  color: '#C4B5FD',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Sparkles size={11} style={{ color: '#A78BFA' }} /> Volume &amp; Peak Tracker
              </span>
            </div>
            <p
              style={{
                fontSize: '0.78rem',
                color: 'var(--text-secondary, #94A3B8)',
                margin: '3px 0 0 0',
              }}
            >
              Tracking historical units sold, daily velocity cadence, and peak sales milestones.
            </p>
          </div>
        </div>

        {/* Controls: Mode Toggle + TimelineRangeSelector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Chart Mode Toggle */}
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
              type="button"
              onClick={() => setChartMode('area')}
              style={{
                padding: '5px 11px',
                borderRadius: '7px',
                fontSize: '0.74rem',
                fontWeight: chartMode === 'area' ? 700 : 500,
                backgroundColor: chartMode === 'area' ? '#8B5CF6' : 'transparent',
                color: chartMode === 'area' ? '#FFFFFF' : 'var(--text-secondary, #94A3B8)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
              }}
            >
              <LineChart size={13} /> Curve
            </button>
            <button
              type="button"
              onClick={() => setChartMode('bar')}
              style={{
                padding: '5px 11px',
                borderRadius: '7px',
                fontSize: '0.74rem',
                fontWeight: chartMode === 'bar' ? 700 : 500,
                backgroundColor: chartMode === 'bar' ? '#8B5CF6' : 'transparent',
                color: chartMode === 'bar' ? '#FFFFFF' : 'var(--text-secondary, #94A3B8)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
              }}
            >
              <BarChart3 size={13} /> Bars
            </button>
          </div>

          {/* Timeline Range Selector */}
          <TimelineRangeSelector
            defaultUnit="month"
            defaultCount={1}
            minDate={minDate}
            allowAllTime={true}
            compact={true}
            chartType="quantity_sales"
            onChange={setRangeConfig}
          />
        </div>
      </div>

      {/* 2. PEAK SALES VELOCITY CALLOUT CARDS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
        }}
      >
        {/* Highest Quantity Sold (Day) */}
        <div
          style={{
            padding: '14px 16px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.02) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Flame size={12} /> Highest Day Sales
            </span>
            <span style={{ fontSize: '0.66rem', color: 'var(--text-muted, #64748B)', fontWeight: 600 }}>Single Day Peak</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
            <span style={{ fontSize: '1.45rem', fontWeight: 800, color: '#FBBF24', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {peakMetrics.bestDay?.units != null ? `${Number(peakMetrics.bestDay.units).toLocaleString('en-IN')}` : '0'}
            </span>
            <span style={{ fontSize: '0.76rem', color: '#FBBF24', fontWeight: 700 }}>units</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94A3B8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {peakMetrics.bestDay?.label || 'No daily sales peak yet'}
          </div>
        </div>

        {/* Highest Quantity Sold (Week) */}
        <div
          style={{
            padding: '14px 16px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(139, 92, 246, 0.02) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Crown size={12} /> Highest Week Sales
            </span>
            <span style={{ fontSize: '0.66rem', color: 'var(--text-muted, #64748B)', fontWeight: 600 }}>Weekly Peak</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
            <span style={{ fontSize: '1.45rem', fontWeight: 800, color: '#C4B5FD', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {peakMetrics.bestWeek?.units != null ? `${Number(peakMetrics.bestWeek.units).toLocaleString('en-IN')}` : '0'}
            </span>
            <span style={{ fontSize: '0.76rem', color: '#C4B5FD', fontWeight: 700 }}>units</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94A3B8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {peakMetrics.bestWeek?.label || 'No weekly peak yet'}
          </div>
        </div>

        {/* Highest Quantity Sold (Month) */}
        <div
          style={{
            padding: '14px 16px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.02) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#34D399', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Award size={12} /> Highest Month Sales
            </span>
            <span style={{ fontSize: '0.66rem', color: 'var(--text-muted, #64748B)', fontWeight: 600 }}>Monthly Record</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
            <span style={{ fontSize: '1.45rem', fontWeight: 800, color: '#34D399', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {peakMetrics.bestMonth?.units != null ? `${Number(peakMetrics.bestMonth.units).toLocaleString('en-IN')}` : '0'}
            </span>
            <span style={{ fontSize: '0.76rem', color: '#34D399', fontWeight: 700 }}>units</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94A3B8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {peakMetrics.bestMonth?.label || 'No monthly record yet'}
          </div>
        </div>

        {/* Sales Velocity */}
        <div
          style={{
            padding: '14px 16px',
            borderRadius: '14px',
            background: 'var(--bg-main, #0B0E17)',
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Zap size={12} color="#38BDF8" /> Sales Velocity
            </span>
            <span style={{ fontSize: '0.66rem', color: '#38BDF8', fontWeight: 700 }}>
              {peakMetrics.weeklyVelocity ? `${peakMetrics.weeklyVelocity}/wk` : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
            <span style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {peakMetrics.dailyVelocity || 0}
            </span>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary, #94A3B8)', fontWeight: 600 }}>units / day</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748B)' }}>
            Average rate since cataloged
          </div>
        </div>

        {/* Stock Runout Forecast */}
        <div
          style={{
            padding: '14px 16px',
            borderRadius: '14px',
            background: 'var(--bg-main, #0B0E17)',
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Boxes size={12} color="#EC4899" /> Runout Forecast
            </span>
            <span style={{ fontSize: '0.66rem', color: item?.quantity > 0 ? '#34D399' : '#EF4444', fontWeight: 700 }}>
              {item?.quantity ?? 0} in stock
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
            <span style={{ fontSize: '1.45rem', fontWeight: 800, color: peakMetrics.daysLeft != null && peakMetrics.daysLeft <= 7 ? '#F87171' : 'var(--text-primary, #F8FAFC)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {peakMetrics.daysLeft != null ? peakMetrics.daysLeft : '—'}
            </span>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary, #94A3B8)', fontWeight: 600 }}>days left</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748B)' }}>
            {peakMetrics.daysLeft != null && peakMetrics.daysLeft <= 14 ? '⚠️ Reorder suggested soon' : 'Coverage at current velocity'}
          </div>
        </div>
      </div>

      {/* 3. INTERACTIVE SVG CHART SURFACE */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: `${height}px`,
          backgroundColor: 'var(--bg-main, #0B0E17)',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
          padding: '8px',
          overflow: 'hidden',
        }}
        onMouseLeave={() => setHoveredPoint(null)}
      >
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
          preserveAspectRatio="none"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            {/* Area Gradient */}
            <linearGradient id="qtyAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.45" />
              <stop offset="60%" stopColor="#8B5CF6" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0" />
            </linearGradient>

            {/* Bar Gradients */}
            <linearGradient id="qtyBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#6D28D9" stopOpacity="0.75" />
            </linearGradient>

            <linearGradient id="qtyBarGradHover" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="1" />
              <stop offset="100%" stopColor="#D97706" stopOpacity="0.9" />
            </linearGradient>

            {/* Glow Filter */}
            <filter id="qtyGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Horizontal Gridlines & Y-Axis Labels */}
          {yTicks.map((t, idx) => (
            <g key={`ytick-${idx}`} style={{ pointerEvents: 'none' }}>
              <line
                x1={padLeft}
                y1={t.y}
                x2={svgW - padRight}
                y2={t.y}
                stroke="var(--border-subtle, rgba(255, 255, 255, 0.08))"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={padLeft - 10}
                y={t.y + 4}
                textAnchor="end"
                fontSize="10"
                fontWeight="600"
                fill="var(--text-muted, #64748B)"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {t.val}
              </text>
            </g>
          ))}

          {/* Area Chart Mode */}
          {chartMode === 'area' && (
            <g style={{ pointerEvents: 'none' }}>
              {areaPath && <path d={areaPath} fill="url(#qtyAreaGrad)" />}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#8B5CF6"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#qtyGlow)"
                />
              )}
            </g>
          )}

          {/* Bar Chart Mode */}
          {chartMode === 'bar' && (
            <g style={{ pointerEvents: 'none' }}>
              {coords.map((c, i) => {
                const isHovered = hoveredPoint === i;
                const barW = Math.max(6, Math.min(28, (plotW / coords.length) * 0.65));
                const barH = Math.max(2, (padTop + plotH) - c.cy);
                const barX = c.cx - barW / 2;
                const barY = c.cy;

                return (
                  <rect
                    key={`qty-bar-${i}`}
                    x={barX}
                    y={barY}
                    width={barW}
                    height={barH}
                    rx="4"
                    fill={isHovered ? 'url(#qtyBarGradHover)' : 'url(#qtyBarGrad)'}
                    filter={isHovered ? 'url(#qtyGlow)' : 'none'}
                    style={{
                      transition: 'all 0.15s ease',
                      opacity: hoveredPoint !== null && !isHovered ? 0.5 : 1,
                    }}
                  />
                );
              })}
            </g>
          )}

          {/* Data Points on Line Curve */}
          {chartMode === 'area' && (
            <g style={{ pointerEvents: 'none' }}>
              {coords.map((c, i) => {
                const isHovered = hoveredPoint === i;
                const hasSales = c.unitsVal > 0;

                return (
                  <g key={`point-${i}`}>
                    {/* Outer glow ring on hover or peak */}
                    {isHovered && (
                      <circle
                        cx={c.cx}
                        cy={c.cy}
                        r="9"
                        fill="none"
                        stroke="#A78BFA"
                        strokeWidth="2.5"
                        opacity="0.8"
                      />
                    )}

                    {/* Core point */}
                    <circle
                      cx={c.cx}
                      cy={c.cy}
                      r={isHovered ? 5.5 : hasSales ? 4 : 2.5}
                      fill={isHovered ? '#F59E0B' : hasSales ? '#8B5CF6' : '#475569'}
                      stroke="var(--bg-main, #0B0E17)"
                      strokeWidth="2"
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* Hover Crosshair Line */}
          {currentHover && (
            <line
              x1={currentHover.cx}
              y1={padTop}
              x2={currentHover.cx}
              y2={padTop + plotH}
              stroke="#A78BFA"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              opacity="0.8"
              style={{ pointerEvents: 'none' }}
            />
          )}

          {/* X-axis date labels */}
          {coords.map((c, i) => {
            // Adaptive decimation to prevent text overlap
            const maxLabels = Math.floor(plotW / 70);
            const step = Math.ceil(coords.length / maxLabels);
            const showLabel = i % step === 0 || i === coords.length - 1;
            if (!showLabel) return null;

            return (
              <text
                key={`xlabel-${i}`}
                x={c.cx}
                y={padTop + plotH + 20}
                textAnchor="middle"
                fontSize="10"
                fontWeight={hoveredPoint === i ? '700' : '500'}
                fill={hoveredPoint === i ? '#C4B5FD' : 'var(--text-muted, #64748B)'}
                fontFamily="system-ui, -apple-system, sans-serif"
                style={{ pointerEvents: 'none' }}
              >
                {c.plotLabel || c.label || c.date}
              </text>
            );
          })}

          {/* Full-Height Hit Columns for Seamless, Flicker-Free Hover */}
          {coords.map((c, i) => {
            const colW = coords.length > 1
              ? Math.max(16, plotW / coords.length)
              : plotW;
            return (
              <rect
                key={`hit-col-${i}`}
                x={c.cx - colW / 2}
                y={padTop}
                width={colW}
                height={plotH + 26}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredPoint(i)}
              />
            );
          })}
        </svg>

        {/* FLOATING HOVER CARD WITH COMPARATIVE PERCENTAGE CHANGE */}
        {currentHover && (() => {
          const prevHover = hoveredPoint > 0 ? coords[hoveredPoint - 1] : null;
          const currLabel = getPointDisplayLabel(currentHover);
          const prevLabel = getPointDisplayLabel(prevHover);
          const unitsChange = calculatePointChange(
            currentHover.unitsVal,
            prevHover ? prevHover.unitsVal : null,
            currLabel,
            prevLabel,
            (v) => `${Number(v || 0).toLocaleString('en-IN')} units`
          );
          const revChange = currentHover.revenue != null
            ? calculatePointChange(
                currentHover.revenue,
                prevHover ? prevHover.revenue : null,
                currLabel,
                prevLabel,
                formatIndianCurrencyCompact
              )
            : null;

          return (
            <div
              style={{
                position: 'absolute',
                top: '14px',
                left: `${Math.min(Math.max(12, (currentHover.cx / svgW) * 100), 80)}%`,
                transform: 'translate(-50%, 0)',
                backgroundColor: 'var(--chart-card-bg, #0F172A)',
                border: '1.5px solid #8B5CF6',
                boxShadow: '0 10px 25px -3px rgba(139, 92, 246, 0.4), 0 0 12px rgba(139, 92, 246, 0.2)',
                borderRadius: '12px',
                padding: '11px 15px',
                pointerEvents: 'none',
                zIndex: 10,
                minWidth: '240px',
                maxWidth: '360px',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  paddingBottom: '4px',
                }}
              >
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-secondary, #94A3B8)' }}>
                  {currentHover.full_date || currentHover.subLabel || currentHover.plotLabel || currentHover.date}
                </span>
                <span style={{ fontSize: '0.67rem', color: 'var(--text-muted, #64748B)', fontWeight: 600 }}>
                  Point {hoveredPoint + 1} of {coords.length}
                </span>
              </div>

              {/* Units Sold with Percentage Change */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontSize: '0.74rem', color: '#C4B5FD', fontWeight: 600 }}>Units Sold:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.94rem', fontWeight: 800, color: '#FBBF24' }}>
                      {Number(currentHover.unitsVal).toLocaleString('en-IN')} units
                    </span>
                    <span
                      style={{
                        fontSize: '0.67rem',
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: '5px',
                        backgroundColor: unitsChange.badgeBg,
                        color: unitsChange.badgeColor,
                        border: `1px solid ${unitsChange.badgeBorder}`,
                      }}
                    >
                      {unitsChange.badgeText}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: '0.66rem', color: 'var(--text-muted, #94A3B8)', marginTop: '2px', lineHeight: 1.25 }}>
                  {unitsChange.detailedText}
                </div>
              </div>

              {/* Revenue with Percentage Change */}
              {currentHover.revenue != null && revChange && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '0.70rem', color: 'var(--text-muted, #64748B)' }}>Revenue:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#34D399' }}>
                        {formatIndianCurrencyCompact(currentHover.revenue)}
                      </span>
                      <span
                        style={{
                          fontSize: '0.66rem',
                          fontWeight: 800,
                          padding: '1px 5px',
                          borderRadius: '5px',
                          backgroundColor: revChange.badgeBg,
                          color: revChange.badgeColor,
                          border: `1px solid ${revChange.badgeBorder}`,
                        }}
                      >
                        {revChange.badgeText}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.66rem', color: 'var(--text-muted, #94A3B8)', marginTop: '2px', lineHeight: 1.25 }}>
                    {revChange.detailedText}
                  </div>
                </div>
              )}

              {currentHover.stock_level != null && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '4px' }}>
                  <span style={{ fontSize: '0.70rem', color: 'var(--text-muted, #64748B)' }}>Stock Level:</span>
                  <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)' }}>
                    {currentHover.stock_level} in stock
                  </span>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* 4. SUMMARY FOOTER & RANGE INSIGHTS */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          fontSize: '0.78rem',
          color: 'var(--text-secondary, #94A3B8)',
          borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
          paddingTop: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
          <div>
            Period Units Sold: <strong style={{ color: '#FBBF24', fontSize: '0.88rem' }}>{Number(totalUnitsInRange).toLocaleString('en-IN')}</strong> units
          </div>
          <div>
            Period Revenue: <strong style={{ color: '#34D399', fontSize: '0.88rem' }}>{formatIndianCurrencyCompact(totalRevenueInRange)}</strong>
          </div>
          {peakMetrics.inRangePeak.units_sold > 0 && (
            <div>
              Period Peak: <strong style={{ color: '#A78BFA' }}>{peakMetrics.inRangePeak.units_sold} units</strong> on {peakMetrics.inRangePeak.plotLabel}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted, #64748B)', fontSize: '0.72rem' }}>
          <Info size={13} />
          <span>Showing real sales logs starting from product catalog date.</span>
        </div>
      </div>
    </section>
  );
}
