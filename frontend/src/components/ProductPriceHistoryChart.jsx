import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Tag,
  Info,
  Clock,
  ChevronDown,
  ChevronUp,
  Percent,
  Sparkles,
} from 'lucide-react';
import TimelineRangeSelector, { filterTimelineSeries } from './TimelineRangeSelector';
import { getCatmullRomBezierPath } from './GlowCurveChart';
import { calculatePointChange, getPointDisplayLabel } from '../utils/chartChangeHelper';

export default function ProductPriceHistoryChart({
  item,
  timeline,
  priceHistory = [],
  currencySymbol = 'Rs.',
  height = 320,
}) {

  const itemCreatedAt = useMemo(() => {
    if (!item?.created_at) return null;
    const d = new Date(item.created_at);
    return isNaN(d.getTime()) ? null : d;
  }, [item?.created_at]);

  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [showHistoryLedger, setShowHistoryLedger] = useState(false);

  // Raw continuous daily records from backend
  const dailyRecords = useMemo(() => {
    if (timeline?.levels?.day && timeline.levels.day.length > 0) {
      return timeline.levels.day;
    }
    // Fallback if no timeline: synthesize from item or priceHistory
    const cost = parseFloat(item?.cost_price) || 0;
    const sell = parseFloat(item?.selling_price) || 0;
    const today = new Date().toISOString().split('T')[0];
    return [
      {
        key: today,
        date: today,
        label: 'Today',
        cost_price: cost,
        selling_price: sell,
        margin: sell - cost,
        margin_pct: sell > 0 ? ((sell - cost) / sell) * 100 : 0,
        units_sold: 0,
        revenue: 0,
        stock_level: parseInt(item?.quantity, 10) || 0,
      },
    ];
  }, [timeline, item]);

  // Adaptive initial range based on product's actual lifetime in the store
  const { defaultUnit, defaultCount, defaultGranularity } = useMemo(() => {
    const daysCount = dailyRecords.length;
    if (daysCount <= 14) {
      return { defaultUnit: 'month', defaultCount: 1, defaultGranularity: 'day' };
    }
    if (daysCount <= 45) {
      return { defaultUnit: 'month', defaultCount: 1, defaultGranularity: 'week' };
    }
    if (daysCount <= 120) {
      return { defaultUnit: 'month', defaultCount: 3, defaultGranularity: 'month' };
    }
    return { defaultUnit: 'month', defaultCount: 6, defaultGranularity: 'month' };
  }, [dailyRecords.length]);

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

  // Sliced & filtered points based on TimelineRangeSelector
  const plotPoints = useMemo(() => {
    return filterTimelineSeries(dailyRecords, rangeConfig);
  }, [dailyRecords, rangeConfig]);

  // Max and Min values for Y-axis scaling
  const { maxY, minY, priceChangesCount } = useMemo(() => {
    let max = 0;
    let min = Infinity;

    plotPoints.forEach((p) => {
      const sp = Number(p.selling_price) || 0;
      const cp = Number(p.cost_price) || 0;
      const mrp = Number(p.mrp) || 0;
      if (sp > max) max = sp;
      if (cp > max) max = cp;
      if (mrp > max) max = mrp;
      if (sp > 0 && sp < min) min = sp;
      if (cp > 0 && cp < min) min = cp;
    });

    if (min === Infinity) min = 0;
    if (max <= 0) max = 100;

    const headroom = (max - min) * 0.18 || max * 0.15 || 10;
    const ceilMax = Math.ceil(max + headroom);
    const floorMin = Math.max(0, Math.floor(min - headroom * 0.6));

    return {
      maxY: ceilMax,
      minY: floorMin,
      priceChangesCount: priceHistory?.length || 0,
    };
  }, [plotPoints, priceHistory]);

  // Dimensions & Coordinates
  const svgWidth = 860;
  const svgHeight = height;
  const padLeft = 65;
  const padRight = 35;
  const padTop = 35;
  const padBottom = 42;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const yRange = Math.max(1, maxY - minY);
  const getX = (i) =>
    plotPoints.length === 1
      ? padLeft + plotW / 2
      : padLeft + (i / Math.max(plotPoints.length - 1, 1)) * plotW;
  const getY = (val) => padTop + plotH - ((Number(val || 0) - minY) / yRange) * plotH;

  const xStep = useMemo(() => {
    if (plotPoints.length <= 8) return 1;
    if (plotPoints.length <= 16) return 2;
    if (plotPoints.length <= 32) return 4;
    return Math.ceil(plotPoints.length / 8);
  }, [plotPoints.length]);

  // Build point coordinates
  const { sellCoords, costCoords, areaPath, sellCurvePath, costCurvePath } = useMemo(() => {
    const sCoords = plotPoints.map((p, i) => ({ x: getX(i), y: getY(p.selling_price), ...p }));
    const cCoords = plotPoints.map((p, i) => ({ x: getX(i), y: getY(p.cost_price), ...p }));

    const sPath = getCatmullRomBezierPath(sCoords, 0.2);
    const cPath = getCatmullRomBezierPath(cCoords, 0.2);

    let aPath = '';
    let finalSPath = sPath;
    let finalCPath = cPath;

    if (sCoords.length > 1) {
      const lastX = sCoords[sCoords.length - 1].x.toFixed(2);
      const firstX = sCoords[0].x.toFixed(2);
      const bottomY = (padTop + plotH).toFixed(2);
      aPath = `${sPath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
    } else if (sCoords.length === 1) {
      const yS = sCoords[0].y;
      const yC = cCoords[0].y;
      const x1 = padLeft;
      const x2 = padLeft + plotW;
      const bottomY = padTop + plotH;
      finalSPath = `M ${x1} ${yS} L ${x2} ${yS}`;
      finalCPath = `M ${x1} ${yC} L ${x2} ${yC}`;
      aPath = `M ${x1} ${yS} L ${x2} ${yS} L ${x2} ${bottomY} L ${x1} ${bottomY} Z`;
    }

    return {
      sellCoords: sCoords,
      costCoords: cCoords,
      areaPath: aPath,
      sellCurvePath: finalSPath,
      costCurvePath: finalCPath,
    };
  }, [plotPoints, maxY, minY, plotW, plotH, padLeft, padTop]);

  // Current stats
  const currentSelling = parseFloat(item?.selling_price) || 0;
  const currentCost = parseFloat(item?.cost_price) || 0;
  const currentGrossProfit = currentSelling - currentCost;
  const currentMarginPct = currentSelling > 0 ? ((currentGrossProfit / currentSelling) * 100).toFixed(1) : '0.0';

  // Y-axis ticks
  const yTicks = useMemo(() => {
    const steps = 4;
    const ticks = [];
    for (let i = 0; i <= steps; i++) {
      const val = minY + (yRange / steps) * i;
      ticks.push({
        val: Math.round(val),
        y: padTop + plotH - (i / steps) * plotH,
      });
    }
    return ticks;
  }, [minY, yRange, plotH, padTop]);

  return (
    <section
      aria-label="Product Price History and Margin Trajectory"
      className="glass-panel product-price-chart-card"
      style={{
        width: '100%',
        marginTop: '28px',
        borderRadius: '20px',
        padding: '30px 34px',
        background: 'var(--bg-surface-solid)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: '22px',
      }}
    >
      {/* 1. HEADER & TIMELINE RANGE SELECTOR */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          paddingBottom: '18px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, rgba(59, 130, 246, 0.18) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10B981',
              flexShrink: 0,
            }}
          >
            <TrendingUp size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2
                style={{
                  fontSize: '1.22rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                Price History &amp; Margin Trajectory
              </h2>
              <span
                style={{
                  fontSize: '0.70rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '100px',
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Sparkles size={11} style={{ color: '#10B981' }} /> Dual-Series Line
              </span>
            </div>
            <p style={{ fontSize: '0.80rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
              Historical progression of Cost Price and Selling Price, highlighting profit margin spread over time.
            </p>
          </div>
        </div>

        {/* Universal Timeline Range Selector */}
        <TimelineRangeSelector
          defaultUnit={defaultUnit}
          defaultCount={defaultCount}
          defaultGranularity={defaultGranularity}
          minDate={itemCreatedAt}
          allowAllTime={true}
          chartType="price_history"
          onChange={(newRange) => setRangeConfig(newRange)}
        />
      </div>

      {/* 2. SUMMARY KPI STAT CHIPS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '12px',
        }}
      >
        {/* Selling Price */}
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'var(--bg-main)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
            <span>Retail Selling Price</span>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#10B981' }}>
            {currencySymbol} {currentSelling.toFixed(2)}
          </div>
          <span style={{ fontSize: '0.70rem', color: 'var(--text-muted)' }}>Current active shelf price</span>
        </div>

        {/* Cost Price */}
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'var(--bg-main)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38BDF8' }} />
            <span>Unit Cost Price</span>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#38BDF8' }}>
            {currencySymbol} {currentCost.toFixed(2)}
          </div>
          <span style={{ fontSize: '0.70rem', color: 'var(--text-muted)' }}>Purchase cost per unit</span>
        </div>

        {/* Gross Profit Spread */}
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'var(--bg-main)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
          }}
        >
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Profit Margin Spread
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: currentGrossProfit >= 0 ? '#10B981' : '#EF4444' }}>
            +{currencySymbol} {currentGrossProfit.toFixed(2)}
          </div>
          <span style={{ fontSize: '0.70rem', color: 'var(--text-muted)' }}>
            <strong>{currentMarginPct}%</strong> markup on selling
          </span>
        </div>

        {/* Price Updates Count */}
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'var(--bg-main)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Historical Price Events
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '2px' }}>
              {priceChangesCount} {priceChangesCount === 1 ? 'Adjustment' : 'Adjustments'}
            </div>
          </div>
          {priceChangesCount > 0 && (
            <button
              type="button"
              onClick={() => setShowHistoryLedger((prev) => !prev)}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--brand-primary)',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: 0,
                marginTop: '4px',
              }}
            >
              <span>{showHistoryLedger ? 'Hide Event Log' : 'View Event Log'}</span>
              {showHistoryLedger ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>
      </div>

      {/* 3. INTERACTIVE SVG DUAL-LINE CHART */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          borderRadius: '16px',
          background: 'var(--bg-main)',
          border: '1px solid var(--border-subtle)',
          padding: '12px 16px 20px',
          overflow: 'hidden',
        }}
      >
        {/* Chart Legend */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '16px',
            paddingBottom: '8px',
            fontSize: '0.74rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '3px', background: '#10B981', borderRadius: '2px' }} />
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Selling Price</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '3px', background: '#38BDF8', borderRadius: '2px' }} />
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Cost Price</span>
          </div>
        </div>

        {/* SVG Canvas */}
        <div style={{ width: '100%', overflowX: 'auto' }} onMouseLeave={() => setHoveredPoint(null)}>
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            style={{ width: '100%', height: 'auto', minWidth: '680px', display: 'block' }}
            onMouseLeave={() => setHoveredPoint(null)}
          >
            <defs>
              {/* Soft luminous gradient area for selling price */}
              <linearGradient id="sellingPriceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
              </linearGradient>

              {/* Cost Price gradient */}
              <linearGradient id="costPriceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Gridlines & Y-Axis Labels */}
            {yTicks.map((t, i) => (
              <g key={i}>
                <line
                  x1={padLeft}
                  y1={t.y}
                  x2={padLeft + plotW}
                  y2={t.y}
                  stroke="var(--border-subtle)"
                  strokeWidth="1"
                  strokeDasharray={i === 0 || i === yTicks.length - 1 ? 'none' : '3 3'}
                  opacity={0.6}
                />
                <text
                  x={padLeft - 10}
                  y={t.y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fontWeight="600"
                  fill="var(--text-muted)"
                  fontFamily="var(--font-mono)"
                >
                  {currencySymbol}{t.val}
                </text>
              </g>
            ))}

            {/* Shaded Area Under Selling Curve */}
            {areaPath && (
              <path
                d={areaPath}
                fill="url(#sellingPriceGradient)"
                style={{ transition: 'd 0.3s ease' }}
              />
            )}

            {/* Cost Price Curve (Cyan / Blue) */}
            {costCurvePath && (
              <path
                d={costCurvePath}
                fill="none"
                stroke="#38BDF8"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ transition: 'd 0.3s ease' }}
              />
            )}

            {/* Selling Price Curve (Emerald Green) */}
            {sellCurvePath && (
              <path
                d={sellCurvePath}
                fill="none"
                stroke="#10B981"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ transition: 'd 0.3s ease' }}
              />
            )}

            {/* Points on Line for clean readability */}
            {plotPoints.length <= 20 && plotPoints.map((p, i) => {
              const x = getX(i);
              const sy = getY(p.selling_price);
              const cy = getY(p.cost_price);
              return (
                <g key={`marker-dot-${i}`}>
                  <circle cx={x} cy={sy} r="4" fill="#10B981" stroke="var(--bg-main, #0F172A)" strokeWidth="1.5" />
                  <circle cx={x} cy={cy} r="3.5" fill="#38BDF8" stroke="var(--bg-main, #0F172A)" strokeWidth="1.5" />
                </g>
              );
            })}

            {/* X-Axis Dates & Granularity Labels */}
            {plotPoints.map((p, i) => {
              const isFirst = i === 0;
              const isLast = i === plotPoints.length - 1;
              const isStep = i % xStep === 0;
              if (!isFirst && !isLast && !isStep) return null;
              const x = getX(i);

              return (
                <g key={p.pointKey || i}>
                  <text
                    x={x}
                    y={padTop + plotH + 18}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill="var(--text-primary)"
                  >
                    {p.plotLabel || p.label || p.key}
                  </text>
                  {p.subLabel && plotPoints.length <= 12 && (
                    <text
                      x={x}
                      y={padTop + plotH + 30}
                      textAnchor="middle"
                      fontSize="8"
                      fontWeight="500"
                      fill="var(--text-muted)"
                    >
                      {p.subLabel}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Interactive Overlay & Crosshairs */}
            {plotPoints.map((p, i) => {
              const x = getX(i);
              const sy = getY(p.selling_price);
              const cy = getY(p.cost_price);
              const isHovered = hoveredPoint && hoveredPoint.index === i;

              return (
                <g key={i}>
                  {/* Invisible hit column */}
                  <rect
                    x={x - (plotW / Math.max(plotPoints.length, 1)) / 2}
                    y={padTop}
                    width={plotW / Math.max(plotPoints.length, 1)}
                    height={plotH}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredPoint({ index: i, point: p, x, sy, cy })}
                  />

                  {/* Hover vertical line */}
                  {isHovered && (
                    <g style={{ pointerEvents: 'none' }}>
                      <line
                        x1={x}
                        y1={padTop}
                        x2={x}
                        y2={padTop + plotH}
                        stroke="var(--brand-primary)"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                        opacity={0.8}
                      />
                      {/* Selling point dot */}
                      <circle cx={x} cy={sy} r="5" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
                      {/* Cost point dot */}
                      <circle cx={x} cy={cy} r="4.5" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="2" />
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Floating Tooltip Card */}
        {hoveredPoint && (() => {
          const prevPoint = hoveredPoint.index > 0 ? plotPoints[hoveredPoint.index - 1] : null;
          const currPointLabel = getPointDisplayLabel(hoveredPoint.point);
          const prevPointLabel = getPointDisplayLabel(prevPoint);
          const sellingChange = calculatePointChange(
            hoveredPoint.point.selling_price,
            prevPoint ? prevPoint.selling_price : null,
            currPointLabel,
            prevPointLabel,
            (v) => `${currencySymbol} ${Number(v || 0).toFixed(2)}`
          );
          const costChange = calculatePointChange(
            hoveredPoint.point.cost_price,
            prevPoint ? prevPoint.cost_price : null,
            currPointLabel,
            prevPointLabel,
            (v) => `${currencySymbol} ${Number(v || 0).toFixed(2)}`
          );

          return (
            <div
              className="glass-panel"
              style={{
                position: 'absolute',
                left: `${Math.min(Math.max(hoveredPoint.x - 130, 16), svgWidth - 300)}px`,
                top: '16px',
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'var(--bg-surface-solid)',
                border: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-md)',
                pointerEvents: 'none',
                zIndex: 10,
                minWidth: '260px',
                maxWidth: '380px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: '5px',
                  marginBottom: '6px',
                }}
              >
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {hoveredPoint.point.full_date || hoveredPoint.point.label || hoveredPoint.point.date || hoveredPoint.point.key}
                </span>
                <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Point {hoveredPoint.index + 1} of {plotPoints.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.74rem' }}>
                {/* Selling Price */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ color: '#10B981', fontWeight: 600 }}>Selling Price:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {currencySymbol} {Number(hoveredPoint.point.selling_price || 0).toFixed(2)}
                      </strong>
                      <span
                        style={{
                          fontSize: '0.67rem',
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: '5px',
                          backgroundColor: sellingChange.badgeBg,
                          color: sellingChange.badgeColor,
                          border: `1px solid ${sellingChange.badgeBorder}`,
                        }}
                      >
                        {sellingChange.badgeText}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.25 }}>
                    {sellingChange.detailedText}
                  </div>
                </div>

                {/* Cost Price */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ color: '#38BDF8', fontWeight: 600 }}>Cost Price:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {currencySymbol} {Number(hoveredPoint.point.cost_price || 0).toFixed(2)}
                      </strong>
                      <span
                        style={{
                          fontSize: '0.67rem',
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: '5px',
                          backgroundColor: costChange.badgeBg,
                          color: costChange.badgeColor,
                          border: `1px solid ${costChange.badgeBorder}`,
                        }}
                      >
                        {costChange.badgeText}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.25 }}>
                    {costChange.detailedText}
                  </div>
                </div>

                {/* Gross Margin */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Gross Margin:</span>
                  <strong style={{ color: '#10B981' }}>
                    +{currencySymbol} {Number((hoveredPoint.point.selling_price || 0) - (hoveredPoint.point.cost_price || 0)).toFixed(2)} ({Number(hoveredPoint.point.margin_pct || 0).toFixed(1)}%)
                  </strong>
                </div>

                {hoveredPoint.point.units_sold > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Sales on Date:</span>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {hoveredPoint.point.units_sold} units ({currencySymbol} {Number(hoveredPoint.point.revenue || 0).toFixed(2)})
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Helpful context notice if product is viewed at a high zoom level with only 1 period */}
      {plotPoints.length === 1 && (
        <div
          style={{
            marginTop: '12px',
            padding: '8px 14px',
            borderRadius: '10px',
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.22)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.76rem',
            color: '#38BDF8',
          }}
        >
          <Info size={14} style={{ flexShrink: 0 }} />
          <span>
            Displaying 1 aggregated period (<strong>{plotPoints[0].plotLabel || plotPoints[0].label}</strong>) starting from when product was added on{' '}
            <strong>{itemCreatedAt ? itemCreatedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'recently'}</strong>.
            {' '}Switch <strong>X-Axis</strong> to <strong>Week</strong> or <strong>Day</strong> above to inspect performance without creating synthetic past dates.
          </span>
        </div>
      )}

      {/* 4. EXPANDABLE HISTORICAL PRICE CHANGE LEDGER */}
      {showHistoryLedger && priceHistory && priceHistory.length > 0 && (
        <div
          style={{
            borderRadius: '14px',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-main)',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Historical Price Update Log
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {priceHistory.length} Recorded Adjustments
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', scrollbarWidth: 'thin' }}>
            {priceHistory.map((rec, i) => (
              <div
                key={rec.id || i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface-solid)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.76rem',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>{rec.date}</strong>
                    <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>{rec.time}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span>
                    Cost: <strong style={{ color: '#38BDF8' }}>{currencySymbol}{rec.cost_price}</strong>
                  </span>
                  <span>
                    Sell: <strong style={{ color: '#10B981' }}>{currencySymbol}{rec.selling_price}</strong>
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {rec.reason || 'Catalog Update'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
