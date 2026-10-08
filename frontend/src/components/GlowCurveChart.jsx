import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Calendar, Clock, ChevronRight, RotateCcw, TrendingUp, Info, BarChart2 } from 'lucide-react';
import TimelineRangeSelector, { filterTimelineSeries } from './TimelineRangeSelector';
import { calculatePointChange, getPointDisplayLabel, getPointFullLabel } from '../utils/chartChangeHelper';

export { calculatePointChange, getPointDisplayLabel, getPointFullLabel };

/**
 * Formats values into Indian notation: ₹3.4L, ₹85k, ₹0, etc.
 */
export function formatIndianCurrencyCompact(val) {
  if (val === 0 || !val) return '₹0';
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 10000000) {
    return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`;
  }
  if (abs >= 100000) {
    const lakh = abs / 100000;
    const str = lakh.toFixed(2);
    const trimmed = str.endsWith('00') ? lakh.toFixed(0) : str.endsWith('0') ? lakh.toFixed(1) : str;
    return `${sign}₹${trimmed}L`;
  }
  if (abs >= 1000) {
    return `${sign}₹${(abs / 1000).toFixed(0)}k`;
  }
  return `${sign}₹${Math.round(abs)}`;
}

/**
 * Calculates a smooth Catmull-Rom spline to cubic Bezier curve path string
 */
export function getCatmullRomBezierPath(points, tension = 0.3) {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} L ${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)}`;

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : p2;

    const cp1x = p1.x + ((p2.x - p0.x) / 6) * (1 - tension);
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * (1 - tension);

    const cp2x = p2.x - ((p3.x - p1.x) / 6) * (1 - tension);
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * (1 - tension);

    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return path;
}

const PERIOD_LEVELS = ['year', 'month', 'week', 'day'];

const PERIOD_CONFIG = {
  year: { label: 'Year', sublabel: '12 Months', icon: Calendar },
  month: { label: 'Month', sublabel: '30 Days', icon: Calendar },
  week: { label: 'Week', sublabel: '7 Days', icon: Calendar },
  day: { label: 'Day', sublabel: 'Hourly Breakdown', icon: Clock },
};

export default function GlowCurveChart({
  id = 'chart',
  title,
  yearlyData = [],
  monthlyData = [],
  weeksData = [],
  hourlyByDay = {},
  lines = [], // [{ key, name, color, secondaryColor }]
  initialPeriod = 'year',
  activeMonthKey = 9,
  selectedYear = 2026,
  selectedMonthName = 'September',
  availableYears = [2026, 2025, 2024, 2023],
  onYearChange = null,
  onMonthChange = null,
  onWeekChange = null,
  onDayChange = null,
  height = 300,
  minWidth = 650,
  extraLegendItems = null,
  timelineRange: propTimelineRange = null,
  minDate = '2026-09-04',
  earliestRecordDate = null,
}) {
  const containerRef = useRef(null);
  const [period, setPeriod] = useState(initialPeriod);
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(0);
  const [selectedDayNum, setSelectedDayNum] = useState(7);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Store records earliest inception anchor (Default: 2026-09-04)
  const minDateStr = useMemo(() => {
    const candidate = minDate || earliestRecordDate || propTimelineRange?.minDate || '2026-09-04';
    if (!candidate) return '2026-09-04';
    return typeof candidate === 'string' ? candidate.slice(0, 10) : formatDateYMD(candidate);
  }, [minDate, earliestRecordDate, propTimelineRange]);

  const minYearMonth = useMemo(() => (minDateStr ? minDateStr.slice(0, 7) : '2026-09'), [minDateStr]);
  const minYear = useMemo(() => (minDateStr ? parseInt(minDateStr.slice(0, 4), 10) : 2026), [minDateStr]);
  const minMonthIdx = useMemo(() => (minDateStr ? parseInt(minDateStr.slice(5, 7), 10) - 1 : 8), [minDateStr]);

  // Range configuration state managed by TimelineRangeSelector
  const [timelineRange, setTimelineRange] = useState(() => {
    if (propTimelineRange) return propTimelineRange;
    return {
      unit: initialPeriod || 'year',
      count: initialPeriod === 'year' ? 1 : initialPeriod === 'month' ? 1 : 7,
      xAxisGrouping: initialPeriod === 'year' ? 'month' : initialPeriod === 'month' ? 'week' : 'day',
      isAllTime: false,
      minDate: minDateStr,
    };
  });

  // Sync internal timelineRange when parent passes propTimelineRange
  useEffect(() => {
    if (propTimelineRange) {
      setTimelineRange(propTimelineRange);
      const u = propTimelineRange.unit === 'all' || propTimelineRange.unit === 'custom'
        ? (propTimelineRange.granularity || 'month')
        : (propTimelineRange.xAxisGrouping || propTimelineRange.unit);
      if (PERIOD_LEVELS.includes(u) && u !== period) {
        changePeriod(u);
      }
    }
  }, [propTimelineRange]);

  // Cinematic zoom animation state
  const [zoomAnimDir, setZoomAnimDir] = useState(null);
  const [animKey, setAnimKey] = useState(0);
  const [hudMessage, setHudMessage] = useState(null);

  const triggerCinematicZoom = (newPeriod, dir, message) => {
    setZoomAnimDir(dir);
    setAnimKey((prev) => prev + 1);
    setHudMessage(message);
    setPeriod(newPeriod);
    setHoveredIndex(null);

    // Auto-clear HUD message
    setTimeout(() => {
      setHudMessage(null);
    }, 750);
  };

  const changePeriod = (newPeriod, dir = null) => {
    if (newPeriod === period) return;
    const oldIdx = PERIOD_LEVELS.indexOf(period);
    const newIdx = PERIOD_LEVELS.indexOf(newPeriod);
    const determinedDir = dir || (newIdx > oldIdx ? 'in' : 'out');
    const msg = determinedDir === 'in' ? `Zooming In to ${PERIOD_CONFIG[newPeriod].label}...` : `Zooming Out to ${PERIOD_CONFIG[newPeriod].label}...`;

    triggerCinematicZoom(newPeriod, determinedDir, msg);
  };

  // Determine active dataset based on timeline range and adaptive groupings
  const { activeDataset, activeXKey, activePeriodLabel } = useMemo(() => {
    const unit = timelineRange.unit || 'month';
    const count = Number(timelineRange.count) || 1;
    const xAxisGrouping = timelineRange.xAxisGrouping || (unit === 'year' ? 'month' : unit === 'month' ? 'week' : 'day');

    // 1. Single Day hourly breakdown
    if (unit === 'day' && count === 1) {
      const daySlots = hourlyByDay[selectedDayNum] || hourlyByDay[7] || [];
      const formatted = daySlots.map((s, i) => ({
        ...s,
        pointKey: `hour-${i}`,
        plotLabel: s.label,
        label: s.label,
        full_date: `${selectedMonthName} ${selectedDayNum}, ${selectedYear} • ${s.label}`,
      }));
      return {
        activeDataset: formatted,
        activeXKey: 'plotLabel',
        activePeriodLabel: `${selectedMonthName} ${selectedDayNum}, ${selectedYear} • Intraday Hourly Trajectory`,
      };
    }

    // 2. Year level (1 year, multiple years, or "all")
    if (unit === 'year' || timelineRange.isAllTime || unit === 'all') {
      const rawSource = yearlyData && yearlyData.length > 0 ? yearlyData : [];
      // Filter out any months strictly prior to earliest store record date
      const validSource = rawSource.filter((m) => {
        const mNum = m.month;
        const dStr = m.date || (mNum ? `${selectedYear}-${String(mNum).padStart(2, '0')}-01` : '');
        if (dStr && minYearMonth && dStr.slice(0, 7) < minYearMonth) {
          return false;
        }
        return true;
      });

      const preparedSource = validSource.map((m, i) => {
        const mNum = m.month || i + 1;
        const mName = m.month_name || m.label || `Month ${mNum}`;
        const mLabel = m.label || m.short_label || `M${mNum}`;
        return {
          ...m,
          month: mNum,
          date: m.date || `${selectedYear}-${String(mNum).padStart(2, '0')}-01`,
          label: mLabel,
          plotLabel: mLabel,
          month_name: mName,
          full_date: `${mName} ${selectedYear}`,
        };
      });

      const formatted = (!timelineRange.isAllTime && count === 1)
        ? preparedSource
        : filterTimelineSeries(preparedSource, {
            ...timelineRange,
            minDate: minDateStr,
            xAxisGrouping: xAxisGrouping === 'day' ? 'month' : xAxisGrouping,
          });

      const startMonthLabel = selectedYear === minYear ? MONTH_ABBR[minMonthIdx] : 'Jan';
      return {
        activeDataset: formatted,
        activeXKey: 'plotLabel',
        activePeriodLabel: timelineRange.isAllTime
          ? `All-Time Monthly Financial Trajectory (${selectedYear})`
          : `Full Year ${selectedYear} • Monthly Timeline (${startMonthLabel}–Dec)`,
      };
    }

    // 3. Multi-Month span (count > 1)
    if (unit === 'month' && count > 1) {
      if (monthlyData && monthlyData.length > 1 && (xAxisGrouping === 'day' || xAxisGrouping === 'week' || !yearlyData || yearlyData.length === 0)) {
        const validMonthly = monthlyData.filter((d) => {
          const dStr = d.date || d.key;
          if (dStr && minDateStr && dStr < minDateStr) return false;
          return true;
        });
        const filtered = filterTimelineSeries(validMonthly, { ...timelineRange, minDate: minDateStr });
        const formatted = filtered.map((d, i) => ({
          ...d,
          pointKey: d.pointKey || d.date || `d-${i}`,
          plotLabel: d.plotLabel || d.label || `Day ${d.day || i + 1}`,
          full_date: d.full_date || d.date || `${selectedMonthName} ${d.day || i + 1}, ${selectedYear}`,
        }));
        return {
          activeDataset: formatted,
          activeXKey: 'plotLabel',
          activePeriodLabel: `${count}-Month Financial Trajectory (${timelineRange.label || `${count} Months`})`,
        };
      }
      if (yearlyData && yearlyData.length > 0) {
        const validYearly = yearlyData.filter((m) => {
          const mNum = m.month;
          const dStr = m.date || (mNum ? `${selectedYear}-${String(mNum).padStart(2, '0')}-01` : '');
          if (dStr && minYearMonth && dStr.slice(0, 7) < minYearMonth) return false;
          return true;
        });
        const preparedSource = validYearly.map((m, i) => {
          const mNum = m.month || i + 1;
          const mName = m.month_name || m.label || `Month ${mNum}`;
          const mLabel = m.label || m.short_label || `M${mNum}`;
          return {
            ...m,
            month: mNum,
            date: m.date || `${selectedYear}-${String(mNum).padStart(2, '0')}-01`,
            label: mLabel,
            plotLabel: mLabel,
            month_name: mName,
            full_date: `${mName} ${selectedYear}`,
          };
        });
        const filtered = filterTimelineSeries(preparedSource, { ...timelineRange, minDate: minDateStr });
        const formatted = filtered.map((m, i) => ({
          ...m,
          pointKey: m.month ? `month-${m.month}` : `m-${i}`,
          plotLabel: m.plotLabel || m.label || `M${i + 1}`,
          full_date: m.month_name ? `${m.month_name} ${selectedYear}` : (m.full_date || m.label),
        }));
        return {
          activeDataset: formatted,
          activeXKey: 'plotLabel',
          activePeriodLabel: `${count}-Month Financial Trajectory • ${selectedYear}`,
        };
      }
    }

    // 4. Monthly / Weekly / Daily level from monthlyData
    if (monthlyData && monthlyData.length > 0) {
      const validMonthly = monthlyData.filter((d) => {
        const dStr = d.date || d.key;
        if (dStr && minDateStr && dStr < minDateStr) return false;
        return true;
      });

      // 1 Week count === 1 and weeksData exists
      if (unit === 'week' && count === 1 && xAxisGrouping === 'day' && weeksData.length > 0) {
        const wk = weeksData[selectedWeekIdx] || weeksData[0];
        const rawWkDays = (wk.days && wk.days.length > 0) ? wk.days : validMonthly.slice(0, 7);
        const wkDays = rawWkDays.filter((d) => {
          const dStr = d.date || d.key;
          if (dStr && minDateStr && dStr < minDateStr) return false;
          return true;
        });
        const formatted = wkDays.map((d, i) => ({
          ...d,
          pointKey: d.date || `wk-day-${i}`,
          plotLabel: d.label || `Day ${d.day}`,
          full_date: d.date || `${selectedMonthName} ${d.day}, ${selectedYear}`,
        }));
        return {
          activeDataset: formatted,
          activeXKey: 'plotLabel',
          activePeriodLabel: `${wk.label || 'Week 1'} • 7-Day Performance (${selectedMonthName} ${selectedYear})`,
        };
      }

      // 1 Month with xAxisGrouping === 'week' and weeksData exists
      if (unit === 'month' && count === 1 && xAxisGrouping === 'week' && weeksData.length > 0) {
        const formatted = weeksData.map((w) => ({
          ...w,
          pointKey: `week-${w.week_number}`,
          plotLabel: w.short_label || `Wk ${w.week_number}`,
          subLabel: w.label,
          full_date: `${w.label}, ${selectedYear}`,
        }));
        return {
          activeDataset: formatted,
          activeXKey: 'plotLabel',
          activePeriodLabel: `Month of ${selectedMonthName} ${selectedYear} • Weekly Breakdown`,
        };
      }

      const filtered = filterTimelineSeries(validMonthly, { ...timelineRange, minDate: minDateStr });
      const formatted = filtered.map((d, i) => ({
        ...d,
        pointKey: d.pointKey || d.date || `d-${i}`,
        plotLabel: d.plotLabel || d.label || `Day ${d.day || i + 1}`,
        full_date: d.full_date || d.date || `${selectedMonthName} ${d.day || i + 1}, ${selectedYear}`,
      }));
      return {
        activeDataset: formatted,
        activeXKey: 'plotLabel',
        activePeriodLabel: unit === 'week'
          ? `${count} Week(s) Trajectory • ${selectedMonthName} ${selectedYear}`
          : unit === 'day'
          ? `${count} Day(s) Trajectory • ${selectedMonthName} ${selectedYear}`
          : `Month of ${selectedMonthName} ${selectedYear} • Daily Trajectory`,
      };
    }

    // Fallback
    const fallback = (yearlyData && yearlyData.length > 0 ? yearlyData : []).map((m, i) => ({
      ...m,
      plotLabel: m.label || `M${i + 1}`,
    }));
    return {
      activeDataset: fallback,
      activeXKey: 'plotLabel',
      activePeriodLabel: `Financial Trajectory (${selectedYear})`,
    };
  }, [timelineRange, yearlyData, monthlyData, weeksData, hourlyByDay, selectedWeekIdx, selectedDayNum, selectedMonthName, selectedYear]);

  // Default active index in the dataset
  const defaultActiveIndex = useMemo(() => {
    if (!activeDataset || activeDataset.length === 0) return 0;

    if (period === 'year') {
      const idx = activeDataset.findIndex((d) => d.month === activeMonthKey || d.label === 'Sep');
      if (idx !== -1) return idx;
    }

    if (period === 'month') {
      const idx = activeDataset.findIndex((d) => d.day === selectedDayNum);
      if (idx !== -1) return idx;
    }

    if (period === 'day') {
      const maxRevHourIdx = activeDataset.reduce(
        (acc, d, i) => (d.revenue > (activeDataset[acc]?.revenue || 0) ? i : acc),
        0
      );
      return maxRevHourIdx;
    }

    const lastActiveIdx = activeDataset.reduce(
      (acc, d, i) => (d.revenue > 0 || d.operating_profit > 0 ? i : acc),
      activeDataset.length - 1
    );
    return lastActiveIdx;
  }, [activeDataset, period, activeMonthKey, selectedDayNum]);

  const activeIndex = hoveredIndex !== null ? hoveredIndex : defaultActiveIndex;
  const activeItem = activeDataset[activeIndex] || activeDataset[0];

  // SVG Dimensions & Padding
  const svgWidth = 860;
  const svgHeight = height;
  const padLeft = 68;
  const padRight = 50;
  const padTop = 45;
  const padBottom = 42;

  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  // Maximum scale value & Negative bounds calculation
  const { ticks, zeroY, ceilPos, ceilNeg, posHeight, negHeight, hasNegative } = useMemo(() => {
    let maxPos = 0;
    let maxNeg = 0;
    activeDataset.forEach((d) => {
      lines.forEach((ln) => {
        const val = Number(d[ln.key]) || 0;
        if (val > maxPos) maxPos = val;
        if (val < 0 && Math.abs(val) > maxNeg) maxNeg = Math.abs(val);
      });
    });

    const hasNeg = maxNeg > 0;

    if (!hasNeg) {
      const rawPos = maxPos <= 0 ? 10000 : maxPos;
      const factor = Math.pow(10, Math.floor(Math.log10(rawPos)));
      const ceil = Math.max(Math.ceil((rawPos * 1.18) / factor) * factor, 1000);
      const zY = padTop + plotHeight;

      const tList = [
        { ratio: 1.0, val: ceil, y: padTop, isZero: false, isNeg: false },
        { ratio: 0.75, val: ceil * 0.75, y: padTop + plotHeight * 0.25, isZero: false, isNeg: false },
        { ratio: 0.5, val: ceil * 0.5, y: padTop + plotHeight * 0.5, isZero: false, isNeg: false },
        { ratio: 0.25, val: ceil * 0.25, y: padTop + plotHeight * 0.75, isZero: false, isNeg: false },
        { ratio: 0.0, val: 0, y: zY, isZero: true, isNeg: false },
      ];

      return {
        ticks: tList,
        zeroY: zY,
        ceilPos: ceil,
        ceilNeg: 0,
        posHeight: plotHeight,
        negHeight: 0,
        hasNegative: false,
      };
    }

    // Has Negative Values (e.g. October 2026 Week 1 Loss of -₹33.4k)
    const rawPos = Math.max(maxPos, 5000);
    const factorPos = Math.pow(10, Math.floor(Math.log10(rawPos)));
    const ceilP = Math.max(Math.ceil((rawPos * 1.18) / factorPos) * factorPos, 1000);

    const rawNeg = Math.max(maxNeg, 5000);
    const factorNeg = Math.pow(10, Math.floor(Math.log10(rawNeg)));
    const ceilN = Math.max(Math.ceil((rawNeg * 1.25) / factorNeg) * factorNeg, 1000);

    const totalRange = ceilP + ceilN;
    const zY = padTop + (ceilP / totalRange) * plotHeight;
    const pH = zY - padTop;
    const nH = padTop + plotHeight - zY;

    const tList = [
      { ratio: 1.0, val: ceilP, y: padTop, isZero: false, isNeg: false },
      { ratio: 0.5, val: ceilP * 0.5, y: zY - pH * 0.5, isZero: false, isNeg: false },
      { ratio: 0.0, val: 0, y: zY, isZero: true, isNeg: false },
      { ratio: -0.5, val: -ceilN * 0.5, y: zY + nH * 0.5, isZero: false, isNeg: true },
      { ratio: -1.0, val: -ceilN, y: padTop + plotHeight, isZero: false, isNeg: true },
    ];

    return {
      ticks: tList,
      zeroY: zY,
      ceilPos: ceilP,
      ceilNeg: ceilN,
      posHeight: pH,
      negHeight: nH,
      hasNegative: true,
    };
  }, [activeDataset, lines, padTop, plotHeight]);

  const pointsCount = activeDataset.length;
  const getX = (index) => {
    if (pointsCount <= 1) return padLeft + plotWidth / 2;
    return padLeft + (index / (pointsCount - 1)) * plotWidth;
  };
  const getY = (val) => {
    const num = Number(val) || 0;
    if (!hasNegative) {
      return padTop + plotHeight - (num / ceilPos) * plotHeight;
    }
    if (num >= 0) {
      return zeroY - (num / ceilPos) * posHeight;
    } else {
      return zeroY + (Math.abs(num) / ceilNeg) * negHeight;
    }
  };

  const baselineY = zeroY;

  // Lines calculation with single-point graceful baseline
  const linesData = useMemo(() => {
    return lines.map((ln) => {
      let points = activeDataset.map((d, i) => ({
        x: getX(i),
        y: getY(d[ln.key]),
        val: d[ln.key],
        item: d,
      }));

      let curvePath = '';
      let areaPath = '';
      if (points.length === 1) {
        const singleY = points[0].y;
        curvePath = `M ${padLeft} ${singleY.toFixed(2)} L ${(padLeft + plotWidth).toFixed(2)} ${singleY.toFixed(2)}`;
        areaPath = `M ${padLeft} ${singleY.toFixed(2)} L ${(padLeft + plotWidth).toFixed(2)} ${singleY.toFixed(2)} L ${(padLeft + plotWidth).toFixed(2)} ${baselineY.toFixed(2)} L ${padLeft} ${baselineY.toFixed(2)} Z`;
        points = [
          { x: padLeft + plotWidth / 2, y: singleY, val: points[0].val, item: points[0].item },
        ];
      } else {
        curvePath = getCatmullRomBezierPath(points);
        const firstX = points[0]?.x || padLeft;
        const lastX = points[points.length - 1]?.x || padLeft + plotWidth;
        areaPath = curvePath
          ? `${curvePath} L ${lastX.toFixed(2)} ${baselineY.toFixed(2)} L ${firstX.toFixed(2)} ${baselineY.toFixed(2)} Z`
          : '';
      }

      return {
        ...ln,
        points,
        curvePath,
        areaPath,
      };
    });
  }, [activeDataset, lines, plotWidth, padLeft, baselineY, getY]);

  const primaryLine = linesData[0];
  const secondaryLine = linesData[1] || null;

  const prevItem = activeIndex > 0 ? activeDataset[activeIndex - 1] : null;
  const currPointLabel = getPointDisplayLabel(activeItem);
  const prevPointLabel = getPointDisplayLabel(prevItem);
  const currPointFullLabel = getPointFullLabel(activeItem);

  const primaryVal = activeItem && primaryLine ? activeItem[primaryLine.key] : 0;
  const prevPrimaryVal = prevItem && primaryLine ? prevItem[primaryLine.key] : null;
  const primaryChange = calculatePointChange(
    primaryVal,
    prevPrimaryVal,
    currPointLabel,
    prevPointLabel,
    formatIndianCurrencyCompact
  );

  const secondaryVal = secondaryLine && activeItem ? activeItem[secondaryLine.key] : 0;
  const prevSecondaryVal = prevItem && secondaryLine ? prevItem[secondaryLine.key] : null;
  const secondaryChange = secondaryLine
    ? calculatePointChange(
        secondaryVal,
        prevSecondaryVal,
        currPointLabel,
        prevPointLabel,
        formatIndianCurrencyCompact
      )
    : null;

  const activeX = primaryLine?.points[activeIndex]?.x ?? getX(activeIndex);
  const activeYPrimary = primaryLine?.points[activeIndex]?.y ?? baselineY;
  const activeYSecondary = secondaryLine ? secondaryLine.points[activeIndex]?.y : null;
  const isHovering = hoveredIndex !== null;

  // Floating pill badge dimensions
  const isRightEdge = activeIndex >= pointsCount - 2;
  const badgeWidth = secondaryLine ? 330 : (primaryChange.hasPrev ? 205 : 155);
  const badgeHeight = secondaryLine ? 40 : 36;
  const badgeX = isRightEdge
    ? Math.max(padLeft, activeX - badgeWidth - 10)
    : Math.min(Math.max(padLeft, activeX - 20), svgWidth - padRight - badgeWidth);
  const badgeY = Math.max(10, Math.min(activeYPrimary - 48, padTop - 12));

  const leaderAnchorX = isRightEdge ? badgeX + badgeWidth : badgeX + 30;
  const leaderAnchorY = badgeY + badgeHeight / 2;

  const primaryColor = primaryLine?.color || '#00E5A3';
  const secondaryColor = secondaryLine?.color || '#818CF8';

  const glowFilterId = `glow-${id}-${period}`;
  const arrowUpId = `arrow-up-${id}-${period}`;
  const arrowDownId = `arrow-down-${id}-${period}`;
  const arrowRightId = `arrow-right-${id}-${period}`;

  // For area gradient split when there are negative values
  const zeroRatio = hasNegative && plotHeight > 0
    ? Math.max(0.05, Math.min(0.95, (zeroY - padTop) / plotHeight))
    : 1;

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
      {/* Cinematic Keyframes for Literal Animated Zoom (Zero Fade / 100% Solid Opacity) */}
      <style>{`
        @keyframes cinematicCurveZoomIn {
          0% { transform: scale(0.72); opacity: 1; }
          70% { transform: scale(1.02); opacity: 1; }
          100% { transform: scale(1.0); opacity: 1; }
        }
        @keyframes cinematicCurveZoomOut {
          0% { transform: scale(1.35); opacity: 1; }
          70% { transform: scale(0.98); opacity: 1; }
          100% { transform: scale(1.0); opacity: 1; }
        }
        .cinematic-zoom-in {
          animation: cinematicCurveZoomIn 0.38s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transform-origin: center center;
        }
        .cinematic-zoom-out {
          animation: cinematicCurveZoomOut 0.38s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transform-origin: center center;
        }
      `}</style>

      {/* Floating HUD Feedback Badge during Zoom */}
      {hudMessage && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 30,
            padding: '8px 18px',
            borderRadius: '20px',
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            border: '1.5px solid #00E5A3',
            color: '#FFFFFF',
            fontSize: '0.85rem',
            fontWeight: 800,
            boxShadow: '0 0 25px rgba(0, 229, 163, 0.5)',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeInOut 0.75s ease forwards',
          }}
        >
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#00E5A3' }} />
          <span>{hudMessage}</span>
        </div>
      )}

      {/* Top Header Row with Title and Year Selector */}
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
            <h3
              style={{
                margin: 0,
                fontSize: '1.08rem',
                fontWeight: 700,
                color: 'var(--text-primary, #F8FAFC)',
                letterSpacing: '-0.01em',
              }}
            >
              {typeof title === 'function' ? title(period) : title}
            </h3>

            {/* Chosen Year Pill / Selector */}
            {period === 'year' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748B' }}>Year:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => {
                    if (onYearChange) onYearChange(Number(e.target.value));
                    setAnimKey((prev) => prev + 1);
                  }}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-input, #1E293B)',
                    border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))',
                    color: '#38BDF8',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: '#94A3B8' }}>
            {activePeriodLabel}
          </p>
        </div>

        {/* Universal Timeline Range Selector Module */}
        <TimelineRangeSelector
          value={timelineRange}
          defaultUnit={initialPeriod || 'month'}
          defaultCount={initialPeriod === 'year' ? 1 : initialPeriod === 'month' ? 1 : 7}
          allowAllTime={true}
          minDate={minDateStr}
          compact={false}
          chartType="curve_chart"
          onChange={(newRange) => {
            setTimelineRange(newRange);
            const u = newRange.unit === 'all' || newRange.unit === 'custom'
              ? (newRange.granularity || 'month')
              : newRange.unit;
            if (PERIOD_LEVELS.includes(u) && u !== period) {
              changePeriod(u);
            }
          }}
        />
      </div>

      {/* Subheader: Active Legends & Drilldown Breadcrumbs */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {lines.map((ln) => (
            <div key={ln.key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: ln.color,
                  boxShadow: `0 0 8px ${ln.color}`,
                  display: 'inline-block',
                }}
              />
              <span style={{ color: '#E2E8F0', fontWeight: 600 }}>{ln.name}</span>
            </div>
          ))}
          {extraLegendItems}
        </div>

        {/* Subheader info badge showing active timeframe */}
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
            <Calendar size={13} style={{ color: '#38BDF8' }} />
            <span>{activePeriodLabel}</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas Container with Animated Zoom Class */}
      {pointsCount === 0 ? (
        <div
          style={{
            height: `${height}px`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.15)',
            borderRadius: '12px',
            border: '1px dashed rgba(255, 255, 255, 0.1)',
            margin: '12px 0',
          }}
        >
          <Calendar size={28} color="#64748B" />
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#CBD5E1' }}>
            No Store Records for Selected Period
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748B' }}>
            Store operations began on {new Date(minDateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      ) : (
      <div
        key={`canvas-${period}-${animKey}`}
        className={zoomAnimDir === 'in' ? 'cinematic-zoom-in' : zoomAnimDir === 'out' ? 'cinematic-zoom-out' : ''}
        style={{ position: 'relative', width: '100%', overflowX: 'auto' }}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{
            width: '100%',
            height: 'auto',
            minWidth: `${minWidth}px`,
            display: 'block',
            overflow: 'visible',
          }}
          onMouseLeave={() => setHoveredIndex(null)}
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

            {/* ▼ Downward arrow — placed at markerStart when chart has negative values */}
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

            <filter id={glowFilterId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="glowBlur" />
              <feMerge>
                <feMergeNode in="glowBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {lines.map((ln) => {
              if (hasNegative) {
                // Multi-stop gradient transitioning at zero baseline:
                // Top to zeroY uses ln.color, below zeroY transitions to red
                return (
                  <linearGradient
                    key={`grad-${ln.key}-${period}`}
                    id={`grad-${id}-${ln.key}-${period}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={ln.color} stopOpacity="0.32" />
                    <stop offset={`${Math.max(0, zeroRatio * 85)}%`} stopColor={ln.color} stopOpacity="0.04" />
                    <stop offset={`${zeroRatio * 100}%`} stopColor={ln.color} stopOpacity="0.01" />
                    <stop offset={`${zeroRatio * 100}%`} stopColor="#EF4444" stopOpacity="0.02" />
                    <stop offset="100%" stopColor="#EF4444" stopOpacity="0.30" />
                  </linearGradient>
                );
              }
              return (
                <linearGradient
                  key={`grad-${ln.key}-${period}`}
                  id={`grad-${id}-${ln.key}-${period}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={ln.color} stopOpacity="0.32" />
                  <stop offset="85%" stopColor={ln.color} stopOpacity="0.03" />
                  <stop offset="100%" stopColor={ln.color} stopOpacity="0.0" />
                </linearGradient>
              );
            })}
          </defs>

          {/* Horizontal Gridlines & Y-Axis Ticks */}
          {ticks.map((t, idx) => {
            const y = t.y;
            const isZeroLine = t.isZero;
            return (
              <g key={`tick-${idx}`}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={svgWidth - padRight + 10}
                  y2={y}
                  stroke={isZeroLine ? 'var(--chart-axis, #64748B)' : 'var(--chart-grid, #334155)'}
                  strokeWidth={isZeroLine ? '1.5' : '1'}
                  strokeDasharray={isZeroLine ? 'none' : '3 4'}
                  opacity={isZeroLine ? 0.9 : 0.6}
                />
                <text
                  x={padLeft - 10}
                  y={y + 4}
                  fill={t.isNeg ? '#F87171' : (isZeroLine ? 'var(--chart-text, #94A3B8)' : 'var(--chart-axis, #64748B)')}
                  fontSize="11"
                  textAnchor="end"
                  fontWeight={isZeroLine || t.isNeg ? '700' : '600'}
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {formatIndianCurrencyCompact(t.val)}
                </text>
              </g>
            );
          })}

          {/* Y-Axis Line (arrows at both top and bottom if negative region present) */}
          <line
            x1={padLeft}
            y1={hasNegative ? padTop + plotHeight + 14 : zeroY}
            x2={padLeft}
            y2={padTop - 18}
            stroke="var(--chart-axis, #64748B)"
            strokeWidth="1.5"
            markerStart={hasNegative ? `url(#${arrowDownId})` : undefined}
            markerEnd={`url(#${arrowUpId})`}
          />

          {/* X-Axis Baseline Line (₹0) with Rightward Arrow */}
          <line
            x1={padLeft}
            y1={zeroY}
            x2={svgWidth - padRight + 26}
            y2={zeroY}
            stroke="var(--chart-axis, #64748B)"
            strokeWidth="1.5"
            markerEnd={`url(#${arrowRightId})`}
          />

          {/* Area Fills Under Curves */}
          {linesData.map((ln) => (
            ln.areaPath && (
              <path
                key={`area-${ln.key}-${period}`}
                d={ln.areaPath}
                fill={`url(#grad-${id}-${ln.key}-${period})`}
                style={{ transition: 'all 0.3s ease' }}
              />
            )
          ))}

          {/* Active Drop Line Down to X-Axis */}
          {activeItem && (
            <line
              x1={activeX}
              y1={Math.min(activeYPrimary, activeYSecondary ?? activeYPrimary)}
              x2={activeX}
              y2={baselineY}
              stroke="rgba(148, 163, 184, 0.4)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          )}

          {/* Glowing Curve Strokes */}
          {linesData.map((ln) => (
            ln.curvePath && (
              <path
                key={`curve-${ln.key}-${period}`}
                d={ln.curvePath}
                fill="none"
                stroke={ln.color}
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={`url(#${glowFilterId})`}
                style={{ transition: 'all 0.25s ease' }}
              />
            )
          ))}

          {/* Full-Height Invisible Hit Columns for Smooth Interactive Hover Detection */}
          {activeDataset.map((d, i) => {
            const colW = Math.max(plotWidth / Math.max(pointsCount, 1), 22);
            const x = getX(i);
            return (
              <rect
                key={`hit-col-${i}-${period}`}
                x={x - colW / 2}
                y={padTop}
                width={colW}
                height={plotHeight}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredIndex(i)}
                onClick={() => {
                  if (period === 'year') {
                    if (onMonthChange && d.month) onMonthChange(d.month);
                    changePeriod('month', 'in');
                  } else if (period === 'month' || period === 'week') {
                    const dayNum = d.day || i + 1;
                    setSelectedDayNum(dayNum);
                    if (onDayChange) onDayChange(dayNum);
                    changePeriod('day', 'in');
                  }
                }}
              />
            );
          })}

          {/* Concentric Data Points on the Curves */}
          {linesData.map((ln) => (
            <g key={`dots-${ln.key}-${period}`} style={{ pointerEvents: 'none' }}>
              {ln.points.map((pt, i) => {
                const isSelected = i === activeIndex;
                if (isSelected) return null;
                const isNeg = Number(pt.val) < 0;
                const dotColor = isNeg ? '#EF4444' : ln.color;
                return (
                  <circle
                    key={`dot-${ln.key}-${i}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={pointsCount > 22 ? '3.5' : '4.5'}
                    fill="var(--chart-card-bg, #0F172A)"
                    stroke={dotColor}
                    strokeWidth="2.5"
                  />
                );
              })}
            </g>
          ))}

          {/* Active Highlighted Point & Halo Radar */}
          {linesData.map((ln) => {
            const pt = ln.points[activeIndex];
            if (!pt) return null;
            const isNeg = Number(pt.val) < 0;
            const activePointColor = isNeg ? '#EF4444' : ln.color;
            return (
              <g key={`active-halo-${ln.key}-${period}`} style={{ pointerEvents: 'none' }}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="13"
                  fill={activePointColor}
                  fillOpacity="0.22"
                  stroke={activePointColor}
                  strokeOpacity="0.5"
                  strokeWidth="1.5"
                />
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="5.5"
                  fill="var(--chart-card-bg, #0F172A)"
                  stroke={activePointColor}
                  strokeWidth="3.5"
                />
                <circle cx={pt.x} cy={pt.y} r="2" fill={activePointColor} />
              </g>
            );
          })}

          {/* Leader Line to Floating Badge (hidden when hovering to avoid visual collision with hover card) */}
          {!isHovering && activeItem && (
            <line
              x1={activeX}
              y1={activeYPrimary - 14}
              x2={leaderAnchorX}
              y2={leaderAnchorY}
              stroke="var(--chart-axis, #64748B)"
              strokeWidth="1.2"
              strokeDasharray="3 3"
            />
          )}

          {/* Floating Pill Badge at Top (hidden when hovering; dedicated hover card takes over) */}
          {!isHovering && activeItem && (
            <g transform={`translate(${badgeX}, ${badgeY})`} style={{ pointerEvents: 'none' }}>
              <rect
                x="0"
                y="0"
                width={badgeWidth}
                height={badgeHeight}
                rx={badgeHeight / 2}
                ry={badgeHeight / 2}
                fill="var(--chart-card-bg, #0F172A)"
                stroke={primaryColor}
                strokeWidth="1.8"
                filter="drop-shadow(0 2px 8px rgba(0, 0, 0, 0.18))"
              />

              {secondaryLine ? (
                <g transform="translate(14, 18)">
                  <circle cx="2" cy="0" r="3.5" fill={primaryColor} />
                  <text
                    x="10"
                    y="3"
                    fill="var(--chart-text, var(--text-primary, #0F172A))"
                    fontSize="10"
                    fontWeight="800"
                    fontFamily="system-ui, -apple-system, sans-serif"
                  >
                    Total: {formatIndianCurrencyCompact(activeItem[primaryLine.key])} ({primaryChange.badgeText})
                  </text>

                  <circle cx={badgeWidth / 2 + 8} cy="0" r="3.5" fill={secondaryColor} />
                  <text
                    x={badgeWidth / 2 + 16}
                    y="3"
                    fill="var(--chart-text, var(--text-primary, #0F172A))"
                    fontSize="10"
                    fontWeight="800"
                    fontFamily="system-ui, -apple-system, sans-serif"
                  >
                    Retained: {formatIndianCurrencyCompact(activeItem[secondaryLine.key])} ({secondaryChange ? secondaryChange.badgeText : ''})
                  </text>
                </g>
              ) : (
                <g transform="translate(14, 23)">
                  <circle cx="0" cy="-4" r="3.5" fill={primaryColor} />
                  <text
                    x="10"
                    y="0"
                    fill="var(--chart-text, var(--text-primary, #0F172A))"
                    fontSize="12.5"
                    fontWeight="800"
                    fontFamily="system-ui, -apple-system, sans-serif"
                  >
                    {formatIndianCurrencyCompact(activeItem[primaryLine.key])}
                  </text>
                  <text
                    x="86"
                    y="0"
                    fill={primaryChange.badgeColor}
                    fontSize="10.5"
                    fontWeight="800"
                    fontFamily="system-ui, -apple-system, sans-serif"
                  >
                    {primaryChange.shortText}
                  </text>
                </g>
              )}
            </g>
          )}

          {/* X-Axis Labels (always positioned at the bottom of the chart area) */}
          {activeDataset.map((d, i) => {
            const x = getX(i);
            const isSelected = i === activeIndex;

            if (pointsCount > 22 && i % 2 !== 0 && i !== pointsCount - 1 && i !== activeIndex) {
              return null;
            }

            const bottomY = padTop + plotHeight;

            return (
              <g
                key={`xlabel-${i}-${period}`}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredIndex(i)}
                onClick={() => {
                  if (period === 'year') {
                    if (onMonthChange && d.month) onMonthChange(d.month);
                    changePeriod('month', 'in');
                  } else if (period === 'month' || period === 'week') {
                    const dayNum = d.day || i + 1;
                    setSelectedDayNum(dayNum);
                    if (onDayChange) onDayChange(dayNum);
                    changePeriod('day', 'in');
                  }
                }}
              >
                <rect
                  x={x - 18}
                  y={bottomY}
                  width="36"
                  height={padBottom}
                  fill="transparent"
                />
                <text
                  x={x}
                  y={bottomY + 22}
                  fill={isSelected ? 'var(--text-primary, #FFFFFF)' : 'var(--chart-text-muted, #64748B)'}
                  fontSize={isSelected ? '12.5' : '11.5'}
                  fontWeight={isSelected ? '800' : '500'}
                  textAnchor="middle"
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {d[activeXKey]}
                </text>
              </g>
            );
          })}
        </svg>

        {/* FLOATING HOVER CARD WITH DETAILED PERCENTAGE CHANGE */}
        {activeItem && hoveredIndex !== null && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: `${Math.min(Math.max(16, (activeX / svgWidth) * 100), 84)}%`,
              transform: 'translate(-50%, 0)',
              backgroundColor: 'var(--chart-card-bg, #0F172A)',
              border: `1.5px solid ${primaryColor}`,
              boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.55), 0 0 16px rgba(0, 229, 163, 0.18)',
              borderRadius: '12px',
              padding: '11px 15px',
              pointerEvents: 'none',
              zIndex: 25,
              minWidth: '240px',
              maxWidth: '380px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              backdropFilter: 'blur(10px)',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                paddingBottom: '5px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-primary, #F8FAFC)' }}>
                <Calendar size={13} style={{ color: '#38BDF8' }} />
                <span>{currPointFullLabel || currPointLabel}</span>
              </div>
              <span style={{ fontSize: '0.67rem', color: 'var(--text-muted, #64748B)', fontWeight: 600 }}>
                Point {activeIndex + 1} of {pointsCount}
              </span>
            </div>

            {/* Primary Line Comparison */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: primaryColor }} />
                  <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#E2E8F0' }}>{primaryLine.name}:</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <strong style={{ fontSize: '0.84rem', color: 'var(--text-primary, #FFFFFF)' }}>
                    {formatIndianCurrencyCompact(activeItem[primaryLine.key])}
                  </strong>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: '5px',
                      backgroundColor: primaryChange.badgeBg,
                      color: primaryChange.badgeColor,
                      border: `1px solid ${primaryChange.badgeBorder}`,
                    }}
                  >
                    {primaryChange.badgeText}
                  </span>
                </div>
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94A3B8)', paddingLeft: '14px', lineHeight: 1.3 }}>
                {primaryChange.detailedText}
              </div>
            </div>

            {/* Secondary Line Comparison (if exists) */}
            {secondaryLine && secondaryChange && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: secondaryColor }} />
                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#E2E8F0' }}>{secondaryLine.name}:</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <strong style={{ fontSize: '0.84rem', color: 'var(--text-primary, #FFFFFF)' }}>
                      {formatIndianCurrencyCompact(activeItem[secondaryLine.key])}
                    </strong>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: '5px',
                        backgroundColor: secondaryChange.badgeBg,
                        color: secondaryChange.badgeColor,
                        border: `1px solid ${secondaryChange.badgeBorder}`,
                      }}
                    >
                      {secondaryChange.badgeText}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94A3B8)', paddingLeft: '14px', lineHeight: 1.3 }}>
                  {secondaryChange.detailedText}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Helpful context notice if viewed at a high zoom level with only 1 period */}
      {activeDataset.length === 1 && (
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
            Displaying 1 aggregated period (<strong>{activeDataset[0]?.plotLabel || activeDataset[0]?.label || 'Current Period'}</strong>) for {selectedMonthName} {selectedYear}.
            {' '}Switch <strong>X-Axis</strong> to <strong>Week</strong> or <strong>Day</strong> above to inspect detailed breakdown without fake historical data.
          </span>
        </div>
      )}
    </div>
  );
}
