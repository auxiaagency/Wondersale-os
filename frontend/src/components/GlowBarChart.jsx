import React, { useState, useRef, useEffect, useMemo } from 'react';
import { formatIndianCurrencyCompact } from './GlowCurveChart';
import { Calendar, Clock, BarChart2, TrendingUp, Info } from 'lucide-react';
import TimelineRangeSelector, { filterTimelineSeries } from './TimelineRangeSelector';
import { isStakeholdersEnabled, onStakeholdersSettingChange } from '../utils/stakeholdersSettings';

const PERIOD_LEVELS = ['year', 'month', 'week', 'day'];

const PERIOD_CONFIG = {
  year: { label: 'Year', sublabel: 'Annual Totals', icon: Calendar },
  month: { label: 'Month', sublabel: 'Monthly Totals', icon: Calendar },
  week: { label: 'Week', sublabel: 'Week Totals', icon: Calendar },
  day: { label: 'Day', sublabel: 'Single Date Totals', icon: Clock },
};

export default function GlowBarChart({
  id = 'exec-bar-chart',
  title = 'Financial Executive Summary',
  summary = {},
  yearlySummary = null,
  weeksData = [],
  dailyData = [],
  selectedMonthName = 'September',
  selectedYear = 2026,
  onPeriodChange = null,
  timelineRange: propTimelineRange = null,
  minDate = '2026-09-04',
  earliestRecordDate = null,
}) {
  const containerRef = useRef(null);
  const [period, setPeriod] = useState('month');
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(0);
  const [selectedDayNum, setSelectedDayNum] = useState(7);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Store records earliest inception anchor (Default: 2026-09-04)
  const minDateStr = useMemo(() => {
    const candidate = minDate || earliestRecordDate || propTimelineRange?.minDate || '2026-09-04';
    if (!candidate) return '2026-09-04';
    return typeof candidate === 'string' ? candidate.slice(0, 10) : formatDateYMD(candidate);
  }, [minDate, earliestRecordDate, propTimelineRange]);

  const [stakeholdersSetting, setStakeholdersSetting] = useState(() => isStakeholdersEnabled());

  useEffect(() => {
    return onStakeholdersSettingChange(() => {
      setStakeholdersSetting(isStakeholdersEnabled());
    });
  }, []);

  // Range configuration state managed by TimelineRangeSelector
  const [timelineRange, setTimelineRange] = useState(() => {
    if (propTimelineRange) return propTimelineRange;
    return {
      unit: 'month',
      count: 1,
      xAxisGrouping: 'week',
      isAllTime: false,
      minDate: minDateStr,
    };
  });

  // Sync internal state when parent passes updated propTimelineRange
  useEffect(() => {
    if (propTimelineRange) {
      setTimelineRange(propTimelineRange);
      const u = propTimelineRange.xAxisGrouping || (propTimelineRange.unit === 'custom' || propTimelineRange.unit === 'all'
        ? propTimelineRange.granularity || 'month'
        : propTimelineRange.unit);
      if (PERIOD_LEVELS.includes(u) && u !== period) {
        changePeriod(u);
      }
    }
  }, [propTimelineRange]);

  // Cinematic zoom animation state
  const [zoomAnimDir, setZoomAnimDir] = useState(null);
  const [animKey, setAnimKey] = useState(0);

  const changePeriod = (newPeriod, dir = null) => {
    if (newPeriod === period) return;
    const oldIdx = PERIOD_LEVELS.indexOf(period);
    const newIdx = PERIOD_LEVELS.indexOf(newPeriod);
    const determinedDir = dir || (newIdx > oldIdx ? 'in' : 'out');

    setZoomAnimDir(determinedDir);
    setAnimKey((prev) => prev + 1);
    setPeriod(newPeriod);
    setHoveredIndex(null);
    if (onPeriodChange) onPeriodChange(newPeriod);
  };

  // Derive metrics for active period
  const { currentSummary, periodSubtitle, activeBreadcrumb } = useMemo(() => {
    const unit = timelineRange.unit || 'month';
    const count = Number(timelineRange.count) || 1;
    const isAllTime = timelineRange.isAllTime || unit === 'all';
    const startDate = timelineRange.startDate;
    const endDate = timelineRange.endDate;

    // Helper: build summary from a single week record
    const weekToSummary = (wk) => ({
      total_revenue: wk.gross_sales || wk.gross_revenue || wk.revenue,
      gross_sales: wk.gross_sales || wk.gross_revenue || wk.revenue,
      gross_revenue: wk.gross_sales || wk.gross_revenue || wk.revenue,
      net_revenue_after_gst: wk.net_revenue_after_gst || (wk.revenue - (wk.gst_amount || 0)),
      gst_amount: wk.gst_amount || 0,
      gst_mode: summary.gst_mode,
      total_cogs: wk.cogs,
      gross_profit: wk.gross_profit,
      total_operating_outflows: wk.total_outflows,
      total_non_salary_expenses: wk.expenses,
      total_salaries_expense: wk.salaries || 0,
      total_inventory_loss_expired: wk.expired_loss || wk.total_inventory_loss_expired || 0,
      total_inventory_loss_broken: wk.broken_loss || wk.total_inventory_loss_broken || 0,
      store_operating_net_profit: wk.operating_profit,
      stakeholder_contractual_share_allocated: wk.stakeholder_share,
      final_retained_net_profit: wk.retained_profit,
      total_orders_count: summary.total_orders_count,
      total_stakeholder_percentage: summary.total_stakeholder_percentage,
      active_stakeholders_count: summary.active_stakeholders_count,
    });

    // 1. Year level or All Time
    if (unit === 'year' || isAllTime) {
      if (yearlySummary) {
        return {
          currentSummary: yearlySummary,
          periodSubtitle: `Annual financial executive summary aggregating all months of ${selectedYear}.`,
          activeBreadcrumb: isAllTime
            ? `All-Time Financial Aggregates (${selectedYear})`
            : `Full Year (${selectedYear}) \u2022 Annual Aggregates`,
        };
      }
    }

    // 2. Date-range filter on dailyData — PREFERRED when startDate+endDate present.
    //    Covers week/day/custom ranges picked from TimelineRangeSelector.
    if (startDate && endDate && dailyData && dailyData.length > 0) {
      const validDaily = dailyData.filter((d) => {
        const dStr = d.date || d.key;
        if (dStr && minDateStr && dStr < minDateStr) return false;
        return true;
      });
      const filtered = filterTimelineSeries(validDaily, { ...timelineRange, minDate: minDateStr, xAxisGrouping: 'day' });
      if (filtered && filtered.length > 0) {
        const sumField = (f) => filtered.reduce((acc, d) => acc + (Number(d[f]) || 0), 0);
        const s = {
          total_revenue: sumField('revenue'),
          gross_sales: sumField('gross_sales') || sumField('revenue'),
          gross_revenue: sumField('gross_revenue') || sumField('revenue'),
          net_revenue_after_gst: sumField('net_revenue_after_gst') || sumField('net_revenue') || sumField('revenue'),
          gst_amount: sumField('gst_amount'),
          gst_mode: summary.gst_mode,
          total_cogs: sumField('cogs'),
          gross_profit: sumField('gross_profit'),
          total_operating_outflows: sumField('total_outflows'),
          total_non_salary_expenses: sumField('expenses'),
          total_salaries_expense: sumField('salaries'),
          total_inventory_loss_expired: sumField('expired_loss') || sumField('total_inventory_loss_expired'),
          total_inventory_loss_broken: sumField('broken_loss') || sumField('total_inventory_loss_broken'),
          store_operating_net_profit: sumField('operating_profit'),
          stakeholder_contractual_share_allocated: sumField('stakeholder_share'),
          final_retained_net_profit: sumField('retained_profit'),
          total_orders_count: summary.total_orders_count,
          total_stakeholder_percentage: summary.total_stakeholder_percentage,
          active_stakeholders_count: summary.active_stakeholders_count,
        };
        const firstLabel = filtered[0]?.label || startDate;
        const lastLabel = filtered[filtered.length - 1]?.label || endDate;
        const rangeLabel = timelineRange.label || `${startDate} \u2013 ${endDate}`;
        return {
          currentSummary: s,
          periodSubtitle: `Executive summary for ${rangeLabel} (${filtered.length} day${filtered.length !== 1 ? 's' : ''}).`,
          activeBreadcrumb: `${rangeLabel} \u2022 ${filtered.length} Day${filtered.length !== 1 ? 's' : ''}`,
        };
      }
    }

    // 3. Exact 1 Week from preloaded weeksData (fallback when no startDate/endDate)
    if (unit === 'week' && count === 1 && weeksData && weeksData.length > 0) {
      const wk = weeksData[selectedWeekIdx] || weeksData[0];
      return {
        currentSummary: weekToSummary(wk),
        periodSubtitle: `Weekly performance totals for ${wk.label}.`,
        activeBreadcrumb: `${wk.label} \u2022 7-Day Performance`,
      };
    }

    // 4. Exact 1 Day from dailyData (fallback when no startDate/endDate)
    if (unit === 'day' && count === 1 && dailyData && dailyData.length > 0) {
      const dObj = dailyData.find((d) => d.day === selectedDayNum) || dailyData[dailyData.length - 1] || {};
      const s = {
        total_revenue: dObj.gross_sales || dObj.gross_revenue || dObj.revenue || 0,
        gross_sales: dObj.gross_sales || dObj.gross_revenue || dObj.revenue || 0,
        gross_revenue: dObj.gross_revenue || dObj.gross_sales || dObj.revenue || 0,
        net_revenue_after_gst: dObj.net_revenue_after_gst || dObj.net_revenue || dObj.revenue || 0,
        gst_amount: dObj.gst_amount || 0,
        gst_mode: summary.gst_mode,
        total_cogs: dObj.cogs || 0,
        gross_profit: dObj.gross_profit || 0,
        total_operating_outflows: dObj.total_outflows || 0,
        total_non_salary_expenses: dObj.expenses || 0,
        total_salaries_expense: dObj.salaries || 0,
        total_inventory_loss_expired: dObj.expired_loss || dObj.total_inventory_loss_expired || 0,
        total_inventory_loss_broken: dObj.broken_loss || dObj.total_inventory_loss_broken || 0,
        store_operating_net_profit: dObj.operating_profit || 0,
        stakeholder_contractual_share_allocated: dObj.stakeholder_share || 0,
        final_retained_net_profit: dObj.retained_profit || 0,
        total_orders_count: summary.total_orders_count,
        total_stakeholder_percentage: summary.total_stakeholder_percentage,
        active_stakeholders_count: summary.active_stakeholders_count,
      };
      return {
        currentSummary: s,
        periodSubtitle: `Single day performance for ${selectedMonthName} ${selectedDayNum}, ${selectedYear}.`,
        activeBreadcrumb: `Day ${selectedDayNum} (${selectedMonthName} ${selectedDayNum}, ${selectedYear})`,
      };
    }

    // 5. Default: full month summary
    return {
      currentSummary: summary,
      periodSubtitle: `Monthly financial executive summary for ${selectedMonthName} ${selectedYear}.`,
      activeBreadcrumb: `Full Month (${selectedMonthName} ${selectedYear})`,
    };
  }, [timelineRange, summary, yearlySummary, weeksData, dailyData, selectedWeekIdx, selectedDayNum, selectedMonthName, selectedYear]);

  const totalRev = Number(currentSummary.total_revenue) || 0;
  const grossRev = Number(currentSummary.gross_sales || currentSummary.gross_revenue || (totalRev + (Number(currentSummary.gst_amount) || 0))) || totalRev;
  const gstAmt = Number(currentSummary.gst_amount) || 0;
  const netRev = Number(currentSummary.net_revenue_after_gst || currentSummary.total_revenue) || totalRev;
  const cogs = Number(currentSummary.total_cogs) || 0;
  const grossProfit = Number(currentSummary.gross_profit) || 0;
  const nonSalaryExp = Number(currentSummary.total_non_salary_expenses) || 0;
  const salariesExp = Number(currentSummary.total_salaries_expense || currentSummary.salaries) || 0;
  const expiredLoss = Number(currentSummary.total_inventory_loss_expired || currentSummary.expired_loss) || 0;
  const brokenLoss = Number(currentSummary.total_inventory_loss_broken || currentSummary.broken_loss) || 0;
  const opProfit = Number(currentSummary.store_operating_net_profit) || 0;
  const shShare = Number(currentSummary.stakeholder_contractual_share_allocated) || 0;
  const retProfit = Number(currentSummary.final_retained_net_profit) || 0;

  const hasRevenue = grossRev > 0 || totalRev > 0;
  const baseDenom = hasRevenue ? (grossRev > 0 ? grossRev : totalRev) : 0;
  const calcPct = (val) => {
    if (!hasRevenue || baseDenom <= 0) return null;
    return `${((Math.abs(val) / baseDenom) * 100).toFixed(1)}%`;
  };

  // Executive Metric Bars (with dedicated GST 18% reduction and Ex-GST Net Revenue)
  const bars = [];

  if (gstAmt > 0) {
    bars.push({
      id: 'gross_rev',
      label: 'Gross Sales',
      sublabel: 'Inflows',
      value: grossRev,
      isNegative: false,
      color: '#38BDF8', // Cyan
      secondaryColor: '#0284C7',
      pct: hasRevenue ? '100%' : null,
      description: `${currentSummary.total_orders_count || 0} completed sales`,
    });
    bars.push({
      id: 'gst_outflow',
      label: 'GST (18%)',
      sublabel: 'Tax Liability',
      value: -Math.abs(gstAmt), // NEGATIVE REDUCTION BAR
      isNegative: true,
      color: '#C084FC', // Purple
      secondaryColor: '#9333EA',
      pct: calcPct(gstAmt) ? `-${calcPct(gstAmt)}` : null,
      description: `18% GST reduction (${currentSummary.gst_mode === 'upi_only' ? 'UPI Only' : 'All Sales'})`,
    });
    bars.push({
      id: 'net_rev',
      label: 'Net Sales',
      sublabel: 'Ex-GST',
      value: netRev,
      isNegative: false,
      color: '#60A5FA', // Blue
      secondaryColor: '#2563EB',
      pct: calcPct(netRev),
      description: 'Taxable sales revenue after 18% GST',
    });
  } else {
    bars.push({
      id: 'rev',
      label: 'Gross Sales',
      sublabel: 'Revenue',
      value: totalRev,
      isNegative: false,
      color: '#38BDF8', // Cyan
      secondaryColor: '#0284C7',
      pct: hasRevenue ? '100%' : null,
      description: `${currentSummary.total_orders_count || 0} completed orders`,
    });
  }

  bars.push({
    id: 'gp',
    label: grossProfit < 0 ? 'Gross Deficit' : 'Gross Profit',
    sublabel: grossProfit < 0 ? 'Negative Margin' : 'Margin',
    value: grossProfit,
    isNegative: grossProfit < 0,
    color: grossProfit < 0 ? '#F87171' : '#34D399',
    secondaryColor: grossProfit < 0 ? '#DC2626' : '#059669',
    pct: calcPct(grossProfit) ? `${grossProfit < 0 ? '-' : ''}${calcPct(grossProfit)}` : null,
    description: grossProfit < 0 ? `Cost of goods (₹${formatIndianCurrencyCompact(cogs)}) exceeded net sales by ₹${formatIndianCurrencyCompact(Math.abs(grossProfit))}` : `After inventory COGS ₹${formatIndianCurrencyCompact(cogs)}`,
  });

  if (nonSalaryExp > 0 || (salariesExp === 0 && expiredLoss === 0)) {
    bars.push({
      id: 'outflows',
      label: 'Overheads',
      sublabel: 'Operating Exp',
      value: -Math.abs(nonSalaryExp), // NEGATIVE BAR!
      isNegative: true,
      color: '#F87171', // Coral Red
      secondaryColor: '#DC2626',
      pct: calcPct(nonSalaryExp) ? `-${calcPct(nonSalaryExp)}` : null,
      description: `Store operating overheads ₹${formatIndianCurrencyCompact(nonSalaryExp)}`,
    });
  }

  if (salariesExp > 0) {
    bars.push({
      id: 'salaries_outflow',
      label: 'Salaries',
      sublabel: 'Staff Wages',
      value: -Math.abs(salariesExp), // NEGATIVE BAR!
      isNegative: true,
      color: '#A855F7', // Violet / Purple
      secondaryColor: '#7E22CE',
      pct: calcPct(salariesExp) ? `-${calcPct(salariesExp)}` : null,
      description: `Staff salaries & counter wage disbursements ₹${formatIndianCurrencyCompact(salariesExp)}`,
    });
  }

  if (expiredLoss > 0) {
    bars.push({
      id: 'expired_loss',
      label: 'Expired Loss',
      sublabel: 'Write-Off',
      value: -Math.abs(expiredLoss), // NEGATIVE BAR!
      isNegative: true,
      color: '#F97316', // Orange / Amber
      secondaryColor: '#EA580C',
      pct: calcPct(expiredLoss) ? `-${calcPct(expiredLoss)}` : null,
      description: `Expired inventory loss written off ₹${formatIndianCurrencyCompact(expiredLoss)}`,
    });
  }

  if (brokenLoss > 0) {
    bars.push({
      id: 'broken_loss',
      label: 'Broken Goods',
      sublabel: 'Damage Loss',
      value: -Math.abs(brokenLoss), // NEGATIVE BAR!
      isNegative: true,
      color: '#F43F5E', // Rose / Red
      secondaryColor: '#BE123C',
      pct: calcPct(brokenLoss) ? `-${calcPct(brokenLoss)}` : null,
      description: `Damaged/broken goods written off ₹${formatIndianCurrencyCompact(brokenLoss)}`,
    });
  }

  const isStakeholdersActive = (currentSummary.enable_stakeholders !== false) && stakeholdersSetting;

  if (isStakeholdersActive) {
    bars.push(
      {
        id: 'op_profit',
        label: opProfit < 0 ? 'Op. Deficit' : 'Op. Profit',
        sublabel: opProfit < 0 ? 'Pre-Partner Deficit' : 'Pre-Partner',
        value: opProfit,
        isNegative: opProfit < 0,
        color: opProfit < 0 ? '#EF4444' : '#F59E0B',
        secondaryColor: opProfit < 0 ? '#DC2626' : '#D97706',
        pct: calcPct(opProfit) ? `${opProfit < 0 ? '-' : ''}${calcPct(opProfit)}` : null,
        description: opProfit < 0 ? 'Store operating loss before partner distribution' : 'Store net earnings before partner distribution',
      },
      {
        id: 'sh_share',
        label: 'Partner Share',
        sublabel: 'Stakeholders',
        value: -Math.abs(shShare), // NEGATIVE BAR!
        isNegative: true,
        color: '#EC4899', // Pink
        secondaryColor: '#DB2777',
        pct: calcPct(shShare) ? `-${calcPct(shShare)}` : null,
        description: `${currentSummary.total_stakeholder_percentage || 0}% pool across ${currentSummary.active_stakeholders_count || 0} partners`,
      },
      {
        id: 'ret_profit',
        label: retProfit < 0 ? 'Retained Deficit' : 'Final Retained',
        sublabel: retProfit < 0 ? 'Net Deficit' : 'Net Profit',
        value: retProfit,
        isNegative: retProfit < 0,
        color: retProfit < 0 ? '#EF4444' : '#00E5A3',
        secondaryColor: retProfit < 0 ? '#DC2626' : '#059669',
        pct: calcPct(retProfit) ? `${retProfit < 0 ? '-' : ''}${calcPct(retProfit)}` : null,
        description: retProfit < 0 ? 'Owner retained operational net loss' : 'Owner net retained business earnings',
        isHero: true,
      }
    );
  } else {
    bars.push({
      id: 'net_profit',
      label: opProfit < 0 ? 'Store Net Loss' : 'Net Profit',
      sublabel: opProfit < 0 ? 'Operating Deficit' : 'Operating Profit',
      value: opProfit,
      isNegative: opProfit < 0,
      color: opProfit < 0 ? '#EF4444' : '#00E5A3',
      secondaryColor: opProfit < 0 ? '#DC2626' : '#059669',
      pct: calcPct(opProfit) ? `${opProfit < 0 ? '-' : ''}${calcPct(opProfit)}` : null,
      description: opProfit < 0 ? 'Store net loss after overheads, salaries & inventory write-offs' : 'Store net earnings after operating overheads',
      isHero: true,
    });
  }

  // SVG Coordinates & Negative Y-Axis Layout - Dynamically sized so labels never collide
  const svgWidth = Math.max(1040, bars.length * 116);
  const svgHeight = 360; // Extra height for positive and negative regions
  const padLeft = 75;
  const padRight = 40;
  const padTop = 45;
  const padBottom = 65; // Dedicated room for X-axis labels at bottom

  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  // Compute maximum positive and maximum negative
  const posValues = bars.filter((b) => !b.isNegative).map((b) => b.value);
  const negValues = bars.filter((b) => b.isNegative).map((b) => Math.abs(b.value));

  const rawMaxPos = Math.max(...posValues, 10000);
  const rawMaxNeg = Math.max(...negValues, 5000);

  const factorPos = Math.pow(10, Math.floor(Math.log10(rawMaxPos)));
  const ceilPos = Math.ceil((rawMaxPos * 1.15) / factorPos) * factorPos;

  const factorNeg = Math.pow(10, Math.floor(Math.log10(rawMaxNeg)));
  const ceilNeg = Math.max(Math.ceil((rawMaxNeg * 1.25) / factorNeg) * factorNeg, factorNeg);

  const totalRange = ceilPos + ceilNeg;
  // Exact vertical position of y = 0 baseline
  const zeroY = padTop + (ceilPos / totalRange) * plotHeight;
  const posHeight = zeroY - padTop;
  const negHeight = padTop + plotHeight - zeroY;

  // Positive grid ticks (above zeroY)
  const posTicks = [
    { val: ceilPos, y: padTop },
    { val: ceilPos * 0.66, y: zeroY - posHeight * 0.66 },
    { val: ceilPos * 0.33, y: zeroY - posHeight * 0.33 },
  ];

  // Negative grid ticks (below zeroY)
  const negTicks = [
    { val: -ceilNeg * 0.5, y: zeroY + negHeight * 0.5 },
    { val: -ceilNeg, y: zeroY + negHeight },
  ];

  const barCount = bars.length;
  const slotWidth = plotWidth / barCount;
  const barWidth = Math.min(slotWidth * 0.56, 68);

  const arrowUpId = `arrow-up-${id}-${period}`;
  const arrowDownId = `arrow-down-${id}-${period}`;
  const arrowRightId = `arrow-right-${id}-${period}`;
  const glowId = `glow-${id}-${period}`;

  const periodIdx = PERIOD_LEVELS.indexOf(period);

  return (
    <div
      ref={containerRef}
      style={{
        borderRadius: '16px',
        backgroundColor: 'var(--chart-card-bg, #0F172A)',
        border: '1px solid var(--chart-card-border, rgba(255, 255, 255, 0.08))',
        padding: '22px 24px',
        boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.35)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        color: 'var(--text-primary, #F8FAFC)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Cinematic Keyframes for Literal Animated Zoom */}
      <style>{`
        @keyframes cinematicBarZoomIn {
          0% { transform: scale(0.86); opacity: 0.3; filter: blur(2px); }
          60% { transform: scale(1.02); opacity: 0.95; filter: blur(0.3px); }
          100% { transform: scale(1.0); opacity: 1; filter: blur(0); }
        }
        @keyframes cinematicBarZoomOut {
          0% { transform: scale(1.15); opacity: 0.3; filter: blur(2px); }
          60% { transform: scale(0.98); opacity: 0.95; filter: blur(0.3px); }
          100% { transform: scale(1.0); opacity: 1; filter: blur(0); }
        }
        .cinematic-bar-zoom-in {
          animation: cinematicBarZoomIn 0.44s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          transform-origin: center center;
        }
        .cinematic-bar-zoom-out {
          animation: cinematicBarZoomOut 0.44s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          transform-origin: center center;
        }
      `}</style>

      {/* Top Header Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 size={18} color="#00E5A3" />
            <h3
              style={{
                margin: 0,
                fontSize: '1.08rem',
                fontWeight: 700,
                color: 'var(--text-primary, #F8FAFC)',
                letterSpacing: '-0.01em',
              }}
            >
              {title}
            </h3>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 700,
                backgroundColor: 'rgba(0, 229, 163, 0.15)',
                color: '#00E5A3',
                border: '1px solid rgba(0, 229, 163, 0.3)',
              }}
            >
              Dual Y-Axis (+ / -)
            </span>
          </div>
          <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary, #64748B)' }}>
            {activeBreadcrumb} • {periodSubtitle}
          </p>
        </div>

        {/* Universal Timeline Range Selector Module */}
        <TimelineRangeSelector
          value={timelineRange}
          defaultUnit="month"
          defaultCount={1}
          allowAllTime={true}
          minDate={minDateStr}
          compact={false}
          chartType="bar_chart"
          onChange={(newRange) => {
            setTimelineRange(newRange);
            const u = newRange.xAxisGrouping || (newRange.unit === 'custom' || newRange.unit === 'all'
              ? newRange.granularity || 'month'
              : newRange.unit);
            if (PERIOD_LEVELS.includes(u) && u !== period) {
              changePeriod(u);
            }
          }}
        />
      </div>

      {/* Subheader: Focal Context Controls & Legends */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          fontSize: '0.78rem',
          color: 'var(--text-secondary, #94A3B8)',
          borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
          paddingBottom: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#00E5A3' }} />
            <span>Inflows & Profit (Upward ↑)</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F87171' }} />
            <span>Overheads (Downward ↓)</span>
          </span>
          {salariesExp > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#A855F7' }} />
              <span>Staff Salaries & Wages (↓)</span>
            </span>
          )}
          {expiredLoss > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F97316' }} />
              <span>Expired Inventory Loss (↓)</span>
            </span>
          )}
        </div>

        {/* Subheader badge showing active summary range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
            <BarChart2 size={13} style={{ color: '#00E5A3' }} />
            <span>{activeBreadcrumb}</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas Container with Animated Zoom Class */}
      <div
        key={`bcanvas-${period}-${animKey}`}
        className={zoomAnimDir === 'in' ? 'cinematic-bar-zoom-in' : zoomAnimDir === 'out' ? 'cinematic-bar-zoom-out' : ''}
        style={{ position: 'relative', width: '100%', overflowX: 'auto' }}
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{
            width: '100%',
            height: 'auto',
            minWidth: '680px',
            display: 'block',
            overflow: 'visible',
          }}
        >
          <defs>
            {/* ▲ Upward arrow — placed at markerEnd (top of Y-axis) */}
            <marker
              id={arrowUpId}
              markerWidth="8"
              markerHeight="8"
              refX="8"
              refY="4"
              orient="-90"
            >
              <polygon points="0 0, 8 4, 0 8" fill="var(--chart-axis, #64748B)" />
            </marker>

            {/* ▼ Downward arrow — placed at markerStart (bottom of Y-axis) */}
            <marker
              id={arrowDownId}
              markerWidth="8"
              markerHeight="8"
              refX="8"
              refY="4"
              orient="90"
            >
              <polygon points="0 0, 8 4, 0 8" fill="var(--chart-axis, #64748B)" />
            </marker>

            {/* ▶ Rightward arrow — placed at markerEnd (end of X-axis) */}
            <marker
              id={arrowRightId}
              markerWidth="8"
              markerHeight="8"
              refX="8"
              refY="4"
              orient="0"
            >
              <polygon points="0 0, 8 4, 0 8" fill="var(--chart-axis, #64748B)" />
            </marker>

            <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Bar Gradients */}
            {bars.map((b) => (
              <linearGradient
                key={`bgrad-${b.id}-${period}`}
                id={`bgrad-${id}-${b.id}-${period}`}
                x1="0"
                y1={b.isNegative ? '0' : '1'}
                x2="0"
                y2={b.isNegative ? '1' : '0'}
              >
                <stop offset="0%" stopColor={b.color} stopOpacity="0.95" />
                <stop offset="100%" stopColor={b.secondaryColor} stopOpacity="0.45" />
              </linearGradient>
            ))}
          </defs>

          {/* ========================================================================= */}
          {/* POSITIVE GRIDLINES & Y-AXIS LABELS (ABOVE ZERO)                          */}
          {/* ========================================================================= */}
          {posTicks.map((t, idx) => (
            <g key={`ptick-${idx}`}>
              <line
                x1={padLeft}
                y1={t.y}
                x2={svgWidth - padRight + 10}
                y2={t.y}
                stroke="var(--chart-grid, #334155)"
                strokeWidth="1"
                strokeDasharray="3 4"
                opacity={0.6}
              />
              <text
                x={padLeft - 10}
                y={t.y + 4}
                fill="var(--chart-axis, #64748B)"
                fontSize="11"
                textAnchor="end"
                fontWeight="600"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {formatIndianCurrencyCompact(t.val)}
              </text>
            </g>
          ))}

          {/* ========================================================================= */}
          {/* ZERO BASELINE (₹0) - HIGHLIGHTED CENTRAL LINE                            */}
          {/* ========================================================================= */}
          <g key="zero-line">
            <line
              x1={padLeft}
              y1={zeroY}
              x2={svgWidth - padRight + 26}
              y2={zeroY}
              stroke="var(--chart-axis, #64748B)"
              strokeWidth="1.5"
              markerEnd={`url(#${arrowRightId})`}
            />
            <text
              x={padLeft - 10}
              y={zeroY + 4}
              fill="var(--text-primary, #E2E8F0)"
              fontSize="12"
              textAnchor="end"
              fontWeight="800"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              ₹0
            </text>
          </g>

          {/* ========================================================================= */}
          {/* NEGATIVE GRIDLINES & Y-AXIS LABELS (BELOW ZERO) - THE "-y" AXIS!         */}
          {/* ========================================================================= */}
          {negTicks.map((t, idx) => (
            <g key={`ntick-${idx}`}>
              <line
                x1={padLeft}
                y1={t.y}
                x2={svgWidth - padRight + 10}
                y2={t.y}
                stroke="var(--chart-grid, #334155)"
                strokeWidth="1"
                strokeDasharray="3 4"
                opacity={0.6}
              />
              <text
                x={padLeft - 10}
                y={t.y + 4}
                fill="#F87171"
                fontSize="11"
                textAnchor="end"
                fontWeight="700"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                -{formatIndianCurrencyCompact(Math.abs(t.val)).replace('₹', '₹')}
              </text>
            </g>
          ))}

          {/* ========================================================================= */}
          {/* BIDIRECTIONAL Y-AXIS LINE (WITH UPWARD AND DOWNWARD ARROWS!)              */}
          {/* ========================================================================= */}
          <line
            x1={padLeft}
            y1={padTop + plotHeight + 14}
            x2={padLeft}
            y2={padTop - 18}
            stroke="var(--chart-axis, #64748B)"
            strokeWidth="1.5"
            markerStart={`url(#${arrowDownId})`}
            markerEnd={`url(#${arrowUpId})`}
          />

          {/* ========================================================================= */}
          {/* BARS: POSITIVE EXTEND UP, NEGATIVE EXTEND DOWN BELOW ZERO BASELINE!      */}
          {/* ========================================================================= */}
          {bars.map((b, idx) => {
            const slotCenterX = padLeft + slotWidth * idx + slotWidth / 2;
            const x = slotCenterX - barWidth / 2;
            const isHovered = hoveredIndex === idx;

            let barY = zeroY;
            let barH = 4;
            let badgeY = zeroY - 24;

            if (b.isNegative) {
              // EXTENDS DOWNWARD FROM zeroY!
              barH = Math.max((Math.abs(b.value) / ceilNeg) * negHeight, 6);
              barY = zeroY;
              // Value badge sits strictly BELOW the bar bottom (no overlap!)
              badgeY = zeroY + barH + 14;
            } else {
              // EXTENDS UPWARD FROM zeroY!
              barH = Math.max((b.value / ceilPos) * posHeight, 6);
              barY = zeroY - barH;
              // Value badge sits strictly ABOVE the bar top (no overlap!)
              badgeY = barY - 14;
            }

            return (
              <g
                key={`bar-${b.id}-${period}`}
                style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Full slot hover hit area */}
                <rect
                  x={slotCenterX - slotWidth / 2}
                  y={padTop}
                  width={slotWidth}
                  height={plotHeight + padBottom}
                  fill="transparent"
                />

                {/* Hero Glow Border for Final Retained Profit */}
                {b.isHero && (
                  <rect
                    x={x - 3}
                    y={barY - 3}
                    width={barWidth + 6}
                    height={barH + 6}
                    rx="8"
                    ry="8"
                    fill="none"
                    stroke={b.color}
                    strokeWidth="1.5"
                    strokeOpacity="0.5"
                    filter={`url(#${glowId})`}
                  />
                )}

                {/* The Bar Rect */}
                <rect
                  x={x}
                  y={barY}
                  width={barWidth}
                  height={barH}
                  rx="6"
                  ry="6"
                  fill={`url(#bgrad-${id}-${b.id}-${period})`}
                  stroke={b.color}
                  strokeWidth={isHovered ? 2.5 : b.isHero ? 2 : 1}
                  opacity={hoveredIndex !== null && !isHovered ? 0.6 : 1}
                  style={{ transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
                />

                {/* Floating Value Pill Badge (Positioned with zero overlap!) */}
                <g transform={`translate(${slotCenterX}, ${badgeY})`}>
                  <rect
                    x="-37"
                    y="-10"
                    width="74"
                    height="20"
                    rx="10"
                    ry="10"
                    fill="var(--chart-card-bg, #0F172A)"
                    stroke={b.color}
                    strokeWidth="1.5"
                    filter="drop-shadow(0 2px 6px rgba(0, 0, 0, 0.25))"
                  />
                  <text
                    x="0"
                    y="3.5"
                    fill={b.isNegative ? '#EF4444' : 'var(--chart-text, var(--text-primary, #0F172A))'}
                    fontSize="10"
                    fontWeight="700"
                    textAnchor="middle"
                    fontFamily="system-ui, -apple-system, sans-serif"
                  >
                    {b.isNegative ? '-' : ''}₹{formatIndianCurrencyCompact(Math.abs(b.value)).replace('₹', '')}
                  </text>
                </g>

                {/* In-Bar Percentage Badge */}
                {barH > 32 && b.pct && (
                  <g transform={`translate(${slotCenterX}, ${b.isNegative ? zeroY + 18 : zeroY - 12})`}>
                    <text
                      x="0"
                      y="0"
                      fill="var(--text-primary, #0F172A)"
                      fontSize="9.5"
                      fontWeight="700"
                      textAnchor="middle"
                      opacity={0.9}
                      fontFamily="system-ui, -apple-system, sans-serif"
                    >
                      {b.pct}
                    </text>
                  </g>
                )}

                {/* X-Axis Metric Title & Subtitle (Positioned with zero overlap and stable size on hover!) */}
                <text
                  x={slotCenterX}
                  y={svgHeight - 24}
                  fill={isHovered ? '#38BDF8' : (b.isHero ? (b.isNegative ? '#EF4444' : '#00E5A3') : 'var(--chart-text, var(--text-primary, #0F172A))')}
                  fontSize="10.5"
                  fontWeight={b.isHero ? '700' : '600'}
                  textAnchor="middle"
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {b.label}
                </text>
                <text
                  x={slotCenterX}
                  y={svgHeight - 10}
                  fill={isHovered ? '#94A3B8' : 'var(--chart-text-muted, var(--text-secondary, #64748B))'}
                  fontSize="9"
                  fontWeight="500"
                  textAnchor="middle"
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {b.sublabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Interactive Tooltip Card on Hover */}
      {hoveredIndex !== null && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: '10px',
            backgroundColor: 'var(--bg-surface-solid, var(--bg-surface, #FFFFFF))',
            border: `1px solid ${bars[hoveredIndex].color}`,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: bars[hoveredIndex].color,
                display: 'inline-block',
              }}
            />
            <strong style={{ color: 'var(--text-primary, #0F172A)' }}>{bars[hoveredIndex].label} ({bars[hoveredIndex].sublabel}):</strong>
            <span style={{ color: 'var(--text-secondary, #64748B)' }}>{bars[hoveredIndex].description}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--text-secondary, #64748B)' }}>Share of Revenue: <strong style={{ color: 'var(--text-primary, #0F172A)' }}>{bars[hoveredIndex].pct || '—'}</strong></span>
            <span style={{ fontWeight: 800, color: bars[hoveredIndex].color, fontSize: '0.95rem' }}>
              {bars[hoveredIndex].isNegative ? '-' : ''}₹{Math.abs(bars[hoveredIndex].value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
