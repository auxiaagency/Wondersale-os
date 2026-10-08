import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sliders,
  Check,
  CheckCheck,
  X,
  Sparkles,
  ArrowRight,
  SlidersHorizontal,
  Layers,
  Grid,
  AlertCircle,
  Info,
} from 'lucide-react';
import { playVipRejectedSound } from '../utils/vipCardSounds';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const UNIT_CONFIG = {
  day: {
    id: 'day',
    label: 'Day',
    plural: 'Days',
    presets: [7, 15, 30, 60, 90],
    defaultCount: 30,
  },
  week: {
    id: 'week',
    label: 'Week',
    plural: 'Weeks',
    presets: [1, 2, 3, 4, 8],
    defaultCount: 1,
  },
  month: {
    id: 'month',
    label: 'Month',
    plural: 'Months',
    presets: [1, 2, 3, 4, 6, 12],
    defaultCount: 1,
  },
  year: {
    id: 'year',
    label: 'Year',
    plural: 'Years',
    presets: [1, 2, 3, 5],
    defaultCount: 1,
  },
};

export function formatDateYMD(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateYMD(str) {
  if (!str) return new Date();
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/**
 * Calculates start and end dates for a specific unit and count ending at referenceEndDate
 */
export function calculateDatesForDuration(unit, count, referenceEndDate = new Date()) {
  const end = new Date(referenceEndDate);
  end.setHours(23, 59, 59, 999);

  if (unit === 'day') {
    const start = new Date(end);
    start.setDate(start.getDate() - (count - 1));
    start.setHours(0, 0, 0, 0);
    return {
      startDate: formatDateYMD(start),
      endDate: formatDateYMD(end),
    };
  } else if (unit === 'week') {
    const start = new Date(end);
    start.setDate(start.getDate() - (count * 7 - 1));
    start.setHours(0, 0, 0, 0);
    return {
      startDate: formatDateYMD(start),
      endDate: formatDateYMD(end),
    };
  } else if (unit === 'month') {
    // Aligns with calendar months: 1 Month is 1st to last day of current month.
    // N Months is 1st of (endMonth - N + 1) to last day of endMonth.
    const endYear = end.getFullYear();
    const endMonth = end.getMonth();
    const lastDayOfMonth = new Date(endYear, endMonth + 1, 0).getDate();
    end.setDate(lastDayOfMonth);
    const startMonth = endMonth - (count - 1);
    const start = new Date(endYear, startMonth, 1);
    start.setHours(0, 0, 0, 0);
    return {
      startDate: formatDateYMD(start),
      endDate: formatDateYMD(end),
    };
  } else if (unit === 'year') {
    const endYear = end.getFullYear();
    end.setFullYear(endYear, 11, 31);
    const startYear = endYear - (count - 1);
    const start = new Date(startYear, 0, 1);
    start.setHours(0, 0, 0, 0);
    return {
      startDate: formatDateYMD(start),
      endDate: formatDateYMD(end),
    };
  }

  const start = new Date(end);
  start.setHours(0, 0, 0, 0);
  return {
    startDate: formatDateYMD(start),
    endDate: formatDateYMD(end),
  };
}

/**
 * Universal Smart Default X-Axis Rule:
 * - If 1 Year selected -> shows inside it: 'month' (12 months: Jan..Dec)
 * - If Multiple Years selected (e.g. 3 years) -> shows: 'year' (2024, 2025, 2026)
 * - If 1 Month selected -> shows inside it: 'week' (Week 1..Week 5)
 * - If Multiple Months selected (e.g. 3 months) -> shows: 'month' (Jun, Jul, Aug)
 * - If 1 Week selected -> shows inside it: 'day' (7 days: Mon..Sun)
 * - If Multiple Weeks selected (e.g. 3 weeks) -> shows: 'week' (Week 1, Week 2, Week 3)
 * - If 1 Day selected -> shows: 'day' (or hours)
 * - If Multiple Days selected (e.g. 10 days) -> shows: 'day'
 */
export function getSmartDefaultXAxis(unit, count) {
  if (unit === 'year') {
    return count === 1 ? 'month' : 'year';
  }
  if (unit === 'month') {
    return count === 1 ? 'week' : 'month';
  }
  if (unit === 'week') {
    return count === 1 ? 'day' : 'week';
  }
  return 'day';
}

export default function TimelineRangeSelector({
  value = null,
  defaultUnit = 'month',
  defaultCount = 1,
  defaultGranularity = null,
  availableUnits = ['day', 'week', 'month', 'year'],
  allowAllTime = true,
  minDate = '2026-09-04',
  maxDate = null,
  onChange,
  compact = false,
  chartType = 'generic',
  showXAxis = true,
}) {
  const currentDate = useMemo(() => new Date(), []);
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Store records earliest inception anchor (Default: 2026-09-04)
  const minDateStr = useMemo(() => {
    if (!minDate) return '2026-09-04';
    if (typeof minDate === 'string') return minDate.slice(0, 10);
    return formatDateYMD(minDate);
  }, [minDate]);

  const minYear = useMemo(() => parseInt(minDateStr.slice(0, 4), 10), [minDateStr]);
  const minMonthIdx = useMemo(() => parseInt(minDateStr.slice(5, 7), 10) - 1, [minDateStr]); // 8 = September
  const minDayNum = useMemo(() => parseInt(minDateStr.slice(8, 10), 10), [minDateStr]);

  // Modal alert popup state for rejected out-of-bounds periods with zero records
  const [noRecordsAlert, setNoRecordsAlert] = useState(null);

  // Core range state
  const [activeUnit, setActiveUnit] = useState(defaultUnit);
  const [activeCount, setActiveCount] = useState(defaultCount);
  const [isAllTime, setIsAllTime] = useState(defaultUnit === 'all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // X-Axis explicit breakdown state
  const [xAxisGrouping, setXAxisGrouping] = useState(() => {
    return defaultGranularity || getSmartDefaultXAxis(defaultUnit, defaultCount);
  });

  // Calendar Modal Navigation & Hierarchy State
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarView, setCalendarView] = useState(defaultUnit === 'year' ? 'year' : 'month'); // 'day' | 'week' | 'month' | 'year'
  const [viewYear, setViewYear] = useState(currentYear);
  const [viewMonth, setViewMonth] = useState(currentMonth);

  // Multi-Selection Draft States
  // Month multi-selection (e.g. start: 5, end: 7 = Jun, Jul, Aug)
  const [draftMonthStart, setDraftMonthStart] = useState(currentMonth);
  const [draftMonthEnd, setDraftMonthEnd] = useState(currentMonth);

  // Year multi-selection (e.g. start: 2024, end: 2026)
  const [draftYearStart, setDraftYearStart] = useState(currentYear);
  const [draftYearEnd, setDraftYearEnd] = useState(currentYear);

  // Week multi-selection (e.g. start: 1, end: 3 = Weeks 1, 2, 3)
  const [draftWeekStart, setDraftWeekStart] = useState(1);
  const [draftWeekEnd, setDraftWeekEnd] = useState(1);

  // Day multi-selection (e.g. start: '2026-09-03', end: '2026-09-12')
  const [draftDayStart, setDraftDayStart] = useState(() => formatDateYMD(currentDate));
  const [draftDayEnd, setDraftDayEnd] = useState(() => formatDateYMD(currentDate));

  const popoverRef = useRef(null);
  const lastEmittedRangeKeyRef = useRef('');

  // Controlled value synchronization
  useEffect(() => {
    if (!value) return;
    const incomingKey = `${value.isAllTime ? 'all' : value.unit}_${value.count}_${value.granularity || value.xAxisGrouping}_${value.startDate}_${value.endDate}_${value.label}`;
    if (lastEmittedRangeKeyRef.current === incomingKey) return;
    lastEmittedRangeKeyRef.current = incomingKey;

    if (value.isAllTime) {
      setIsAllTime(true);
      setCustomStartDate('');
      setCustomEndDate('');
    } else if (value.unit === 'custom' || (value.startDate && value.endDate && value.unit === 'custom')) {
      setIsAllTime(false);
      setCustomStartDate(value.startDate);
      setCustomEndDate(value.endDate);
      if (value.count) setActiveCount(value.count);
    } else {
      setIsAllTime(false);
      if (value.unit) setActiveUnit(value.unit);
      if (value.count) setActiveCount(value.count);
      if (value.startDate && value.endDate && value.count > 1) {
        setCustomStartDate(value.startDate);
        setCustomEndDate(value.endDate);
      } else {
        setCustomStartDate('');
        setCustomEndDate('');
      }
    }
    if (value.granularity || value.xAxisGrouping) {
      setXAxisGrouping(value.granularity || value.xAxisGrouping);
    }
  }, [value]);

  // Close calendar popover on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsCalendarOpen(false);
      }
    }
    if (isCalendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCalendarOpen]);

  // Derived active dates & human label
  const { currentRange, rangeLabel, daysDifference } = useMemo(() => {
    if (isAllTime) {
      return {
        currentRange: {
          startDate: minDateStr || '2026-09-04',
          endDate: maxDate ? formatDateYMD(maxDate) : formatDateYMD(new Date()),
        },
        rangeLabel: 'All Time History',
        daysDifference: 3650,
      };
    }

    if (customStartDate && customEndDate) {
      const s = parseDateYMD(customStartDate);
      const e = parseDateYMD(customEndDate);
      const diffDays = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);

      // Check if it's an exact single week
      if (diffDays === 7) {
        return {
          currentRange: { startDate: customStartDate, endDate: customEndDate },
          rangeLabel: `1 Week (${customStartDate} – ${customEndDate})`,
          daysDifference: 7,
        };
      }

      // Check if it's multiple weeks (exact multiple of 7)
      if (diffDays % 7 === 0 && diffDays <= 42) {
        const numW = diffDays / 7;
        return {
          currentRange: { startDate: customStartDate, endDate: customEndDate },
          rangeLabel: `${numW} Weeks (${customStartDate} – ${customEndDate})`,
          daysDifference: diffDays,
        };
      }

      // Check if it's an exact single month
      if (s.getDate() === 1 && s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
        const lastDayOfMonth = new Date(s.getFullYear(), s.getMonth() + 1, 0).getDate();
        if (e.getDate() === lastDayOfMonth) {
          return {
            currentRange: { startDate: customStartDate, endDate: customEndDate },
            rangeLabel: `${MONTH_NAMES[s.getMonth()]} ${s.getFullYear()}`,
            daysDifference: diffDays,
          };
        }
      }

      // Check if it's multiple months
      if (s.getDate() === 1) {
        const lastDayOfEndMonth = new Date(e.getFullYear(), e.getMonth() + 1, 0).getDate();
        if (e.getDate() === lastDayOfEndMonth) {
          const mCount = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
          if (mCount > 1) {
            return {
              currentRange: { startDate: customStartDate, endDate: customEndDate },
              rangeLabel: `${MONTH_ABBR[s.getMonth()]} – ${MONTH_ABBR[e.getMonth()]} ${e.getFullYear()} (${mCount} Months)`,
              daysDifference: diffDays,
            };
          }
        }
      }

      // Check if it's an exact single year
      if (s.getDate() === 1 && s.getMonth() === 0 && e.getDate() === 31 && e.getMonth() === 11 && s.getFullYear() === e.getFullYear()) {
        return {
          currentRange: { startDate: customStartDate, endDate: customEndDate },
          rangeLabel: `${s.getFullYear()} (1 Year)`,
          daysDifference: diffDays,
        };
      }

      // Check if it's multiple years
      if (s.getDate() === 1 && s.getMonth() === 0 && e.getDate() === 31 && e.getMonth() === 11 && s.getFullYear() < e.getFullYear()) {
        const yCount = e.getFullYear() - s.getFullYear() + 1;
        return {
          currentRange: { startDate: customStartDate, endDate: customEndDate },
          rangeLabel: `${s.getFullYear()} – ${e.getFullYear()} (${yCount} Years)`,
          daysDifference: diffDays,
        };
      }

      return {
        currentRange: { startDate: customStartDate, endDate: customEndDate },
        rangeLabel: `${customStartDate} – ${customEndDate} (${diffDays}d)`,
        daysDifference: diffDays,
      };
    }

    const { startDate, endDate } = calculateDatesForDuration(activeUnit, activeCount, maxDate || new Date());
    const unitCfg = UNIT_CONFIG[activeUnit] || UNIT_CONFIG.month;
    let unitLabel = activeCount === 1 ? unitCfg.label : unitCfg.plural;
    let label = `${activeCount} ${unitLabel}`;
    if (activeUnit === 'month') {
      const s = parseDateYMD(startDate);
      const e = parseDateYMD(endDate);
      if (activeCount === 1) {
        label = `${MONTH_NAMES[s.getMonth()]} ${s.getFullYear()}`;
      } else {
        label = `${MONTH_ABBR[s.getMonth()]} – ${MONTH_ABBR[e.getMonth()]} ${e.getFullYear()} (${activeCount} Months)`;
      }
    } else if (activeUnit === 'year' && activeCount === 1) {
      const s = parseDateYMD(startDate);
      label = `${s.getFullYear()} (1 Year)`;
    }
    const diffDays = activeUnit === 'day' ? activeCount : activeUnit === 'week' ? activeCount * 7 : activeUnit === 'month' ? activeCount * 30 : activeCount * 365;

    return {
      currentRange: { startDate, endDate },
      rangeLabel: label,
      daysDifference: diffDays,
    };
  }, [activeUnit, activeCount, isAllTime, customStartDate, customEndDate, minDate, maxDate]);

  // Available options for X-Axis selector based on range length
  const availableXAxisOptions = useMemo(() => {
    if (daysDifference <= 3) return ['day'];
    if (daysDifference <= 14) return ['day', 'week'];
    if (daysDifference <= 90) return ['day', 'week', 'month'];
    return ['day', 'week', 'month', 'year'];
  }, [daysDifference]);

  // Synchronize with parent callback on state changes
  useEffect(() => {
    const key = `${isAllTime ? 'all' : customStartDate ? 'custom' : activeUnit}_${activeCount}_${xAxisGrouping}_${currentRange.startDate}_${currentRange.endDate}_${rangeLabel}`;
    if (lastEmittedRangeKeyRef.current === key) return;
    lastEmittedRangeKeyRef.current = key;

    if (onChange) {
      onChange({
        unit: isAllTime ? 'all' : customStartDate ? 'custom' : activeUnit,
        count: activeCount,
        granularity: xAxisGrouping,
        xAxisGrouping,
        startDate: currentRange.startDate,
        endDate: currentRange.endDate,
        label: rangeLabel,
        isAllTime,
      });
    }
  }, [activeUnit, activeCount, xAxisGrouping, currentRange.startDate, currentRange.endDate, isAllTime, customStartDate, rangeLabel, onChange]);

  // Scope pill switcher
  const handleScopeChange = (unit, count = null) => {
    setIsAllTime(false);
    setCustomStartDate('');
    setCustomEndDate('');
    setActiveUnit(unit);
    const newCount = count !== null ? count : (UNIT_CONFIG[unit]?.defaultCount || 1);
    setActiveCount(newCount);

    // Smart default X-axis
    const smartX = getSmartDefaultXAxis(unit, newCount);
    setXAxisGrouping(smartX);
  };

  const handleSelectAll = () => {
    setIsAllTime(true);
    setCustomStartDate('');
    setCustomEndDate('');
    setActiveUnit('year');
    setActiveCount(1);
    setXAxisGrouping((prev) => (prev === 'day' ? 'month' : prev || 'month'));
    setIsCalendarOpen(false);
  };

  const handleAllTimeChange = handleSelectAll;

  // -------------------------------------------------------------
  // VALIDATION & INCEPTION CLAMPING ENGINE
  // -------------------------------------------------------------
  const validateAndProcessRange = useCallback((startDateStr, endDateStr, periodLabel) => {
    if (!startDateStr || !endDateStr) return null;

    // Check if the selected time span is COMPLETELY before store records began
    if (endDateStr < minDateStr) {
      if (typeof playVipRejectedSound === 'function') {
        try { playVipRejectedSound(); } catch (err) {}
      }
      const parsedEarliest = parseDateYMD(minDateStr);
      const formattedEarliest = parsedEarliest.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      setNoRecordsAlert({
        title: 'No Store Records Found',
        periodLabel: periodLabel || `${startDateStr} – ${endDateStr}`,
        message: `There are no transactions, sales, or expense records for ${periodLabel || `${startDateStr} – ${endDateStr}`}. Store operations and record keeping began on ${formattedEarliest}.`,
        earliestDate: minDateStr,
        earliestFormatted: formattedEarliest,
      });
      return null;
    }

    // If range starts prior to store records inception, clamp startDate to minDateStr
    let finalStart = startDateStr;
    let clamped = false;
    if (startDateStr < minDateStr) {
      finalStart = minDateStr;
      clamped = true;
    }

    return {
      startDate: finalStart,
      endDate: endDateStr,
      clamped,
    };
  }, [minDateStr]);

  const handleJumpToFirstRecords = useCallback(() => {
    const parsedMin = parseDateYMD(minDateStr);
    const y = parsedMin.getFullYear();
    const m = parsedMin.getMonth();
    const lastDayOfMonth = new Date(y, m + 1, 0).getDate();
    const sStr = minDateStr;
    const eStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

    setIsAllTime(false);
    setCustomStartDate(sStr);
    setCustomEndDate(eStr);
    setActiveUnit('month');
    setActiveCount(1);
    setXAxisGrouping('week');
    setViewYear(y);
    setViewMonth(m);
    setDraftMonthStart(m);
    setDraftMonthEnd(m);
    setNoRecordsAlert(null);
    setIsCalendarOpen(false);
  }, [minDateStr]);

  const handleSelectAllMonthsInYear = () => {
    const start = new Date(viewYear, 0, 1);
    const end = new Date(viewYear, 11, 31);
    const sStr = formatDateYMD(start);
    const eStr = formatDateYMD(end);

    const processed = validateAndProcessRange(sStr, eStr, `Year ${viewYear}`);
    if (!processed) return;

    const startM = viewYear === minYear ? minMonthIdx : 0;
    setDraftMonthStart(startM);
    setDraftMonthEnd(11);

    setIsAllTime(false);
    setCustomStartDate(processed.startDate);
    setCustomEndDate(processed.endDate);
    setActiveUnit('month');
    setActiveCount(12 - startM);
    setXAxisGrouping('month');
    setIsCalendarOpen(false);
  };

  const handleSelectAllWeeksInMonth = () => {
    const lastDayOfMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const start = new Date(viewYear, viewMonth, 1);
    const end = new Date(viewYear, viewMonth, lastDayOfMonth);
    const sStr = formatDateYMD(start);
    const eStr = formatDateYMD(end);
    const label = `${MONTH_NAMES[viewMonth]} ${viewYear}`;

    const processed = validateAndProcessRange(sStr, eStr, label);
    if (!processed) return;

    setDraftWeekStart(1);
    setDraftWeekEnd(5);
    setIsAllTime(false);
    setCustomStartDate(processed.startDate);
    setCustomEndDate(processed.endDate);
    setActiveUnit('week');
    setActiveCount(Math.ceil(lastDayOfMonth / 7));
    setXAxisGrouping('week');
    setIsCalendarOpen(false);
  };

  const handleSelectAllDaysInMonth = () => {
    const lastDayOfMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const sStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-01`;
    const eStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
    const label = `${MONTH_NAMES[viewMonth]} ${viewYear}`;

    const processed = validateAndProcessRange(sStr, eStr, label);
    if (!processed) return;

    setDraftDayStart(processed.startDate);
    setDraftDayEnd(processed.endDate);

    setIsAllTime(false);
    setCustomStartDate(processed.startDate);
    setCustomEndDate(processed.endDate);
    setActiveUnit('day');
    setActiveCount(lastDayOfMonth);
    setXAxisGrouping('day');
    setIsCalendarOpen(false);
  };

  // Stepper helper
  const handleCountStep = (delta) => {
    const newCount = Math.max(1, activeCount + delta);
    setActiveCount(newCount);
    const smartX = getSmartDefaultXAxis(activeUnit, newCount);
    setXAxisGrouping(smartX);
  };

  // -------------------------------------------------------------
  // MULTI-SELECTION HANDLERS FOR CALENDAR
  // -------------------------------------------------------------

  // 1. Month Multi-Selection
  const handleMonthTileClick = (monthIdx) => {
    if (draftMonthStart !== draftMonthEnd) {
      // Start fresh selection
      setDraftMonthStart(monthIdx);
      setDraftMonthEnd(monthIdx);
    } else {
      // Second click sets range
      const minM = Math.min(draftMonthStart, monthIdx);
      const maxM = Math.max(draftMonthStart, monthIdx);
      setDraftMonthStart(minM);
      setDraftMonthEnd(maxM);
    }
  };

  const applyMonthSelection = () => {
    const minM = Math.min(draftMonthStart, draftMonthEnd);
    const maxM = Math.max(draftMonthStart, draftMonthEnd);
    const count = maxM - minM + 1;

    const start = new Date(viewYear, minM, 1);
    const end = new Date(viewYear, maxM + 1, 0);
    const sStr = formatDateYMD(start);
    const eStr = formatDateYMD(end);
    const label = count === 1
      ? `${MONTH_NAMES[minM]} ${viewYear}`
      : `${MONTH_ABBR[minM]} – ${MONTH_ABBR[maxM]} ${viewYear} (${count} Months)`;

    const processed = validateAndProcessRange(sStr, eStr, label);
    if (!processed) {
      return; // Pre-inception range rejected! Modal displayed.
    }

    setIsAllTime(false);
    setCustomStartDate(processed.startDate);
    setCustomEndDate(processed.endDate);
    setActiveUnit('month');
    setActiveCount(count);

    // Smart Default X-Axis:
    // If 1 Month: 'week' (shows Week 1..5)
    // If Multiple Months: 'month' (shows Month tiles)
    setXAxisGrouping(count === 1 ? 'week' : 'month');
    setIsCalendarOpen(false);
  };

  // 2. Year Multi-Selection
  const handleYearTileClick = (yr) => {
    if (draftYearStart !== draftYearEnd) {
      setDraftYearStart(yr);
      setDraftYearEnd(yr);
    } else {
      const minY = Math.min(draftYearStart, yr);
      const maxY = Math.max(draftYearStart, yr);
      setDraftYearStart(minY);
      setDraftYearEnd(maxY);
    }
  };

  const applyYearSelection = () => {
    const minY = Math.min(draftYearStart, draftYearEnd);
    const maxY = Math.max(draftYearStart, draftYearEnd);
    const count = maxY - minY + 1;

    const start = new Date(minY, 0, 1);
    const end = new Date(maxY, 11, 31);
    const sStr = formatDateYMD(start);
    const eStr = formatDateYMD(end);
    const label = count === 1 ? `${minY} (1 Year)` : `${minY} – ${maxY} (${count} Years)`;

    const processed = validateAndProcessRange(sStr, eStr, label);
    if (!processed) {
      return; // Pre-inception range rejected! Modal displayed.
    }

    setIsAllTime(false);
    setCustomStartDate(processed.startDate);
    setCustomEndDate(processed.endDate);
    setActiveUnit('year');
    setActiveCount(count);

    // Smart Default X-Axis:
    // If 1 Year: 'month' (shows 12 months inside it)
    // If Multiple Years: 'year' (shows 2024, 2025, 2026)
    setXAxisGrouping(count === 1 ? 'month' : 'year');
    setIsCalendarOpen(false);
  };

  // 3. Week Multi-Selection
  const handleWeekTileClick = (wNum) => {
    if (draftWeekStart !== draftWeekEnd) {
      setDraftWeekStart(wNum);
      setDraftWeekEnd(wNum);
    } else {
      const minW = Math.min(draftWeekStart, wNum);
      const maxW = Math.max(draftWeekStart, wNum);
      setDraftWeekStart(minW);
      setDraftWeekEnd(maxW);
    }
  };

  const applyWeekSelection = () => {
    const minW = Math.min(draftWeekStart, draftWeekEnd);
    const maxW = Math.max(draftWeekStart, draftWeekEnd);
    const count = maxW - minW + 1;

    const lastDayOfMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const startDay = 1 + (minW - 1) * 7;
    const endDay = Math.min(1 + (maxW - 1) * 7 + 6, lastDayOfMonth);

    const start = new Date(viewYear, viewMonth, startDay);
    const end = new Date(viewYear, viewMonth, endDay);
    const sStr = formatDateYMD(start);
    const eStr = formatDateYMD(end);
    const label = `${MONTH_NAMES[viewMonth]} Week ${minW}${count > 1 ? `–${maxW}` : ''} ${viewYear}`;

    const processed = validateAndProcessRange(sStr, eStr, label);
    if (!processed) {
      return; // Pre-inception range rejected! Modal displayed.
    }

    setIsAllTime(false);
    setCustomStartDate(processed.startDate);
    setCustomEndDate(processed.endDate);
    setActiveUnit('week');
    setActiveCount(count);

    // Smart Default X-Axis:
    // If 1 Week: 'day' (shows all 7 days of that week)
    // If Multiple Weeks: 'week' (shows Week 1, Week 2, Week 3)
    setXAxisGrouping(count === 1 ? 'day' : 'week');
    setIsCalendarOpen(false);
  };

  // 4. Day Multi-Selection
  const handleDayCellClick = (dStr) => {
    if (draftDayStart !== draftDayEnd) {
      setDraftDayStart(dStr);
      setDraftDayEnd(dStr);
    } else {
      const s = dStr < draftDayStart ? dStr : draftDayStart;
      const e = dStr < draftDayStart ? draftDayStart : dStr;
      setDraftDayStart(s);
      setDraftDayEnd(e);
    }
  };

  const applyDaySelection = () => {
    const s = draftDayStart <= draftDayEnd ? draftDayStart : draftDayEnd;
    const e = draftDayStart <= draftDayEnd ? draftDayEnd : draftDayStart;

    const sDt = parseDateYMD(s);
    const eDt = parseDateYMD(e);
    const diff = Math.max(1, Math.round((eDt - sDt) / (1000 * 60 * 60 * 24)) + 1);
    const label = s === e ? s : `${s} – ${e} (${diff} Days)`;

    const processed = validateAndProcessRange(s, e, label);
    if (!processed) {
      return; // Pre-inception range rejected! Modal displayed.
    }

    setIsAllTime(false);
    setCustomStartDate(processed.startDate);
    setCustomEndDate(processed.endDate);
    setActiveUnit('day');
    setActiveCount(diff);

    // Smart Default X-Axis:
    setXAxisGrouping('day');
    setIsCalendarOpen(false);
  };

  // Days grid setup
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun

  return (
    <div
      className="timeline-range-container"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
        position: 'relative',
        fontSize: '0.82rem',
        zIndex: isCalendarOpen ? 100 : 'auto',
      }}
    >
      {/* 1. Main Range Selector & Calendar Modal Trigger */}
      <div className="timeline-main-controls" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <button
          type="button"
          onClick={() => {
            setCalendarView(activeUnit === 'year' ? 'year' : activeUnit === 'week' ? 'week' : 'month');
            setIsCalendarOpen(!isCalendarOpen);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            borderRadius: '10px',
            backgroundColor: 'var(--bg-surface-solid, #1E293B)',
            border: isCalendarOpen
              ? '1.5px solid #10B981'
              : '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
            color: 'var(--text-primary, #F8FAFC)',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: isCalendarOpen ? '0 0 14px rgba(16, 185, 129, 0.25)' : 'none',
            transition: 'all 0.2s ease',
          }}
          title="Open Calendar Range Picker to select days, weeks, months, or years"
        >
          <CalendarIcon size={14} color="#10B981" />
          <span style={{ letterSpacing: '-0.01em' }}>{rangeLabel}</span>
          <ChevronDown
            size={13}
            color="var(--text-muted, #94A3B8)"
            style={{
              transform: isCalendarOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
            }}
          />
        </button>

        {/* Quick Stepper for selected unit (e.g. [-] 3 Weeks [+]) */}
        {!isAllTime && !customStartDate && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-main, rgba(255, 255, 255, 0.03))',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => handleCountStep(-1)}
              disabled={activeCount <= 1}
              style={{
                width: '24px',
                height: '28px',
                border: 'none',
                backgroundColor: 'transparent',
                color: activeCount <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: activeCount <= 1 ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.85rem',
              }}
              title={`Decrease ${activeUnit} count`}
            >
              −
            </button>
            <span
              style={{
                padding: '0 6px',
                fontSize: '0.74rem',
                fontWeight: 800,
                color: '#38BDF8',
              }}
            >
              {activeCount}
            </span>
            <button
              type="button"
              onClick={() => handleCountStep(1)}
              style={{
                width: '24px',
                height: '28px',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.85rem',
              }}
              title={`Increase ${activeUnit} count`}
            >
              +
            </button>
          </div>
        )}

        {/* Prominent Select All Button on Toolbar */}
        {allowAllTime && (
          <button
            type="button"
            onClick={handleSelectAll}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '10px',
              backgroundColor: isAllTime
                ? 'rgba(16, 185, 129, 0.18)'
                : 'var(--bg-surface-solid, #1E293B)',
              border: isAllTime
                ? '1.5px solid #10B981'
                : '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
              color: isAllTime ? '#10B981' : 'var(--text-primary, #F8FAFC)',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '0.78rem',
              boxShadow: isAllTime ? '0 0 12px rgba(16, 185, 129, 0.25)' : 'none',
              transition: 'all 0.2s ease',
            }}
            title="Select entire available timeline history and update graph"
          >
            <CheckCheck size={14} color={isAllTime ? '#10B981' : 'var(--text-muted, #94A3B8)'} />
            <span>Select All</span>
          </button>
        )}
      </div>

      {/* 2. DEDICATED X-AXIS GROUPING SELECTOR ("X-Axis: Day | Week | Month | Year") */}
      {showXAxis && chartType !== 'pie_chart' && (
        <div
          className="timeline-xaxis-controls"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 4px',
            borderRadius: '10px',
            backgroundColor: 'var(--bg-main, rgba(0, 0, 0, 0.2))',
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '0 6px',
              color: 'var(--text-muted, #64748B)',
              fontSize: '0.72rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
            title="Controls what units the horizontal X-axis breaks down into"
          >
            <Layers size={11} color="#10B981" />
            <span>X-Axis:</span>
          </div>

          {['day', 'week', 'month', 'year'].map((lvl) => {
            const isActive = xAxisGrouping === lvl;
            const isAllowed = availableXAxisOptions.includes(lvl);

            return (
              <button
                key={lvl}
                type="button"
                disabled={!isAllowed}
                onClick={() => {
                  if (isAllowed) setXAxisGrouping(lvl);
                }}
                style={{
                  border: 'none',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.74rem',
                  fontWeight: isActive ? 800 : 600,
                  backgroundColor: isActive
                    ? lvl === 'day'
                      ? '#F59E0B'
                      : lvl === 'week'
                      ? '#10B981'
                      : lvl === 'month'
                      ? '#38BDF8'
                      : '#8B5CF6'
                    : 'transparent',
                  color: isActive ? '#0F172A' : isAllowed ? 'var(--text-secondary, #94A3B8)' : 'var(--text-muted, #475569)',
                  opacity: isAllowed ? 1 : 0.35,
                  cursor: isAllowed ? 'pointer' : 'not-allowed',
                  boxShadow: isActive ? '0 1px 8px rgba(16, 185, 129, 0.3)' : 'none',
                  transition: 'all 0.15s ease',
                }}
                title={
                  isAllowed
                    ? `Break down X-axis into ${lvl.toUpperCase()} buckets`
                    : `Not applicable for selected time range span`
                }
              >
                {lvl === 'day' ? 'Day' : lvl === 'week' ? 'Week' : lvl === 'month' ? 'Month' : 'Year'}
              </button>
            );
          })}
        </div>
      )}

      {/* 3. RICH HIERARCHICAL CALENDAR POPOVER MODAL (Day -> Week -> Month -> Year) */}
      {isCalendarOpen && (
        <div
          ref={popoverRef}
          className="timeline-calendar-popover"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            zIndex: 9999,
            width: '360px',
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100vh - 120px)',
            overflowY: 'auto',
            backgroundColor: 'var(--bg-surface-solid, #0F172A)',
            border: '1.5px solid var(--border-subtle, rgba(255, 255, 255, 0.15))',
            borderRadius: '16px',
            padding: '16px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(16, 185, 129, 0.15)',
            backdropFilter: 'blur(16px)',
          }}
        >
          {/* Header Row: Zoom Level Switcher Tabs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '12px',
              borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              marginBottom: '12px',
            }}
          >
            <div style={{ display: 'flex', gap: '3px', background: 'var(--bg-main, rgba(255, 255, 255, 0.04))', padding: '3px', borderRadius: '10px' }}>
              {['day', 'week', 'month', 'year'].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCalendarView(v)}
                  style={{
                    border: 'none',
                    borderRadius: '7px',
                    padding: '3px 10px',
                    fontSize: '0.73rem',
                    fontWeight: calendarView === v ? 800 : 600,
                    backgroundColor: calendarView === v ? '#10B981' : 'transparent',
                    color: calendarView === v ? '#0F172A' : 'var(--text-secondary, #94A3B8)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsCalendarOpen(false)}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted, #64748B)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* HIERARCHICAL DRILL-OUT HEADER (e.g. "< September 2026 >" or "< 2026 >") */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '14px',
            }}
          >
            <button
              type="button"
              onClick={() => {
                if (calendarView === 'day' || calendarView === 'week') {
                  if (viewMonth === 0) {
                    setViewMonth(11);
                    setViewYear((y) => y - 1);
                  } else {
                    setViewMonth((m) => m - 1);
                  }
                } else if (calendarView === 'month') {
                  setViewYear((y) => y - 1);
                } else {
                  setViewYear((y) => y - 8);
                }
              }}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                background: 'var(--bg-main, rgba(255, 255, 255, 0.04))',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <ChevronLeft size={14} />
            </button>

            {/* Drill-out Breadcrumb Button */}
            <button
              type="button"
              onClick={() => {
                if (calendarView === 'day' || calendarView === 'week') {
                  setCalendarView('month');
                } else if (calendarView === 'month') {
                  setCalendarView('year');
                }
              }}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: '0.9rem',
                fontWeight: 800,
                color: 'var(--text-primary, #F8FAFC)',
                cursor: calendarView !== 'year' ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title={calendarView !== 'year' ? 'Click to zoom out to higher level' : ''}
            >
              <span>
                {calendarView === 'day' || calendarView === 'week'
                  ? `${MONTH_NAMES[viewMonth]} ${viewYear}`
                  : calendarView === 'month'
                  ? `${viewYear} (Click for Years)`
                  : `${viewYear - 3} – ${viewYear + 4}`}
              </span>
              {calendarView !== 'year' && <ChevronRight size={13} color="#10B981" />}
            </button>

            <button
              type="button"
              onClick={() => {
                if (calendarView === 'day' || calendarView === 'week') {
                  if (viewMonth === 11) {
                    setViewMonth(0);
                    setViewYear((y) => y + 1);
                  } else {
                    setViewMonth((m) => m + 1);
                  }
                } else if (calendarView === 'month') {
                  setViewYear((y) => y + 1);
                } else {
                  setViewYear((y) => y + 8);
                }
              }}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                background: 'var(--bg-main, rgba(255, 255, 255, 0.04))',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* VIEW 1: MONTH GRID (Multi-Month Selectable) */}
          {calendarView === 'month' && (
            <div>
              <div
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-muted, #94A3B8)',
                  marginBottom: '10px',
                  fontWeight: 600,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Range:</span>
                  <span style={{ color: '#10B981', fontWeight: 800 }}>
                    {Math.abs(draftMonthEnd - draftMonthStart) + 1} {Math.abs(draftMonthEnd - draftMonthStart) === 0 ? 'Month' : 'Months'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSelectAllMonthsInYear}
                  style={{
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: '#10B981',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title={`Select all 12 months in ${viewYear} and update graph`}
                >
                  <CheckCheck size={11} />
                  <span>Select All (12m)</span>
                </button>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                }}
              >
                {MONTH_NAMES.map((name, idx) => {
                  const isCurrent = viewYear === currentYear && idx === currentMonth;
                  const minM = Math.min(draftMonthStart, draftMonthEnd);
                  const maxM = Math.max(draftMonthStart, draftMonthEnd);
                  const isSelected = idx >= minM && idx <= maxM;
                  const isPreInceptionMonth = (viewYear < minYear) || (viewYear === minYear && idx < minMonthIdx);

                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => handleMonthTileClick(idx)}
                      style={{
                        padding: '10px 4px',
                        borderRadius: '10px',
                        border: isSelected
                          ? '1.5px solid #10B981'
                          : isPreInceptionMonth
                          ? '1px dashed rgba(255, 255, 255, 0.1)'
                          : '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                        backgroundColor: isSelected
                          ? 'rgba(16, 185, 129, 0.2)'
                          : isCurrent
                          ? 'rgba(56, 189, 248, 0.12)'
                          : isPreInceptionMonth
                          ? 'rgba(0, 0, 0, 0.2)'
                          : 'var(--bg-main, rgba(255, 255, 255, 0.03))',
                        color: isSelected
                          ? '#10B981'
                          : isCurrent
                          ? '#38BDF8'
                          : isPreInceptionMonth
                          ? 'var(--text-muted, #64748B)'
                          : 'var(--text-primary, #F8FAFC)',
                        fontSize: '0.8rem',
                        fontWeight: isSelected || isCurrent ? 800 : 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        textAlign: 'center',
                        opacity: isPreInceptionMonth && !isSelected ? 0.65 : 1,
                      }}
                      title={
                        isPreInceptionMonth
                          ? `No records exist for ${name} ${viewYear}. Store records began on September 04, 2026.`
                          : `${name} ${viewYear}`
                      }
                    >
                      <div>{MONTH_ABBR[idx]}</div>
                      {isCurrent ? (
                        <div style={{ fontSize: '0.62rem', color: '#38BDF8', marginTop: '2px' }}>Current</div>
                      ) : isPreInceptionMonth ? (
                        <div style={{ fontSize: '0.58rem', color: '#F87171', marginTop: '2px', opacity: 0.85 }}>No records</div>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {/* Action Banner & Apply Button */}
              <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  {Math.abs(draftMonthEnd - draftMonthStart) === 0 ? (
                    <span><strong>1 Month</strong> &rarr; X-Axis: <strong>Weeks</strong></span>
                  ) : (
                    <span><strong>{Math.abs(draftMonthEnd - draftMonthStart) + 1} Months</strong> &rarr; X-Axis: <strong>Months</strong></span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={applyMonthSelection}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#10B981',
                    color: '#0F172A',
                    fontWeight: 800,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.76rem',
                  }}
                >
                  Apply Selection
                </button>
              </div>
            </div>
          )}

          {/* VIEW 2: YEAR GRID (Multi-Year Selectable) */}
          {calendarView === 'year' && (
            <div>
              <div
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-muted, #94A3B8)',
                  marginBottom: '10px',
                  fontWeight: 600,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Range:</span>
                  <span style={{ color: '#38BDF8', fontWeight: 800 }}>
                    {Math.abs(draftYearEnd - draftYearStart) + 1} {Math.abs(draftYearEnd - draftYearStart) === 0 ? 'Year' : 'Years'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  style={{
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    background: 'rgba(56, 189, 248, 0.12)',
                    color: '#38BDF8',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="Select All available timeline history and update graph"
                >
                  <CheckCheck size={11} />
                  <span>Select All Time</span>
                </button>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                }}
              >
                {[viewYear - 4, viewYear - 3, viewYear - 2, viewYear - 1, viewYear, viewYear + 1, viewYear + 2, viewYear + 3].map((yr) => {
                  const isCurrent = yr === currentYear;
                  const minY = Math.min(draftYearStart, draftYearEnd);
                  const maxY = Math.max(draftYearStart, draftYearEnd);
                  const isSelected = yr >= minY && yr <= maxY;

                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => handleYearTileClick(yr)}
                      style={{
                        padding: '14px 8px',
                        borderRadius: '10px',
                        border: isSelected ? '1.5px solid #38BDF8' : '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                        backgroundColor: isSelected
                          ? 'rgba(56, 189, 248, 0.2)'
                          : isCurrent
                          ? 'rgba(16, 185, 129, 0.12)'
                          : 'var(--bg-main, rgba(255, 255, 255, 0.03))',
                        color: isSelected ? '#38BDF8' : isCurrent ? '#10B981' : 'var(--text-primary, #F8FAFC)',
                        fontSize: '0.85rem',
                        fontWeight: isSelected || isCurrent ? 800 : 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        textAlign: 'center',
                      }}
                    >
                      <div>{yr}</div>
                      {isCurrent && (
                        <div style={{ fontSize: '0.62rem', color: '#10B981', marginTop: '2px' }}>This Year</div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Action Banner & Apply Button */}
              <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  {Math.abs(draftYearEnd - draftYearStart) === 0 ? (
                    <span><strong>1 Year</strong> &rarr; X-Axis: <strong>Months</strong></span>
                  ) : (
                    <span><strong>{Math.abs(draftYearEnd - draftYearStart) + 1} Years</strong> &rarr; X-Axis: <strong>Years</strong></span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={applyYearSelection}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#38BDF8',
                    color: '#0F172A',
                    fontWeight: 800,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.76rem',
                  }}
                >
                  Apply Selection
                </button>
              </div>
            </div>
          )}

          {/* VIEW 3: WEEK LIST (Multi-Week Selectable) */}
          {calendarView === 'week' && (
            <div>
              <div
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-muted, #94A3B8)',
                  marginBottom: '10px',
                  fontWeight: 600,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Range:</span>
                  <span style={{ color: '#10B981', fontWeight: 800 }}>
                    {Math.abs(draftWeekEnd - draftWeekStart) + 1} {Math.abs(draftWeekEnd - draftWeekStart) === 0 ? 'Week' : 'Weeks'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSelectAllWeeksInMonth}
                  style={{
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: '#10B981',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title={`Select all weeks in ${MONTH_NAMES[viewMonth]} and update graph`}
                >
                  <CheckCheck size={11} />
                  <span>Select All Weeks</span>
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[1, 2, 3, 4, 5].map((wNum) => {
                  const lastDayOfMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
                  const startDay = 1 + (wNum - 1) * 7;
                  if (startDay > lastDayOfMonth) return null;
                  const endDay = Math.min(startDay + 6, lastDayOfMonth);

                  const minW = Math.min(draftWeekStart, draftWeekEnd);
                  const maxW = Math.max(draftWeekStart, draftWeekEnd);
                  const isSelected = wNum >= minW && wNum <= maxW;

                  return (
                    <button
                      key={wNum}
                      type="button"
                      onClick={() => handleWeekTileClick(wNum)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: isSelected ? '1.5px solid #10B981' : '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                        backgroundColor: isSelected
                          ? 'rgba(16, 185, 129, 0.2)'
                          : 'var(--bg-main, rgba(255, 255, 255, 0.03))',
                        color: 'var(--text-primary, #F8FAFC)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: '0.82rem' }}>
                        Week {wNum}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: isSelected ? '#10B981' : 'var(--text-muted, #94A3B8)' }}>
                        {MONTH_ABBR[viewMonth]} {startDay} – {endDay}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Action Banner & Apply Button */}
              <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  {Math.abs(draftWeekEnd - draftWeekStart) === 0 ? (
                    <span><strong>1 Week</strong> &rarr; X-Axis: <strong>Days</strong></span>
                  ) : (
                    <span><strong>{Math.abs(draftWeekEnd - draftWeekStart) + 1} Weeks</strong> &rarr; X-Axis: <strong>Weeks</strong></span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={applyWeekSelection}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#10B981',
                    color: '#0F172A',
                    fontWeight: 800,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.76rem',
                  }}
                >
                  Apply Selection
                </button>
              </div>
            </div>
          )}

          {/* VIEW 4: DAY CALENDAR GRID (Multi-Day Selectable) */}
          {calendarView === 'day' && (
            <div>
              <div
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-muted, #94A3B8)',
                  marginBottom: '10px',
                  fontWeight: 600,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Range:</span>
                  <span style={{ color: '#F59E0B', fontWeight: 800 }}>
                    {draftDayStart && draftDayEnd
                      ? `${Math.max(1, Math.round((parseDateYMD(draftDayEnd) - parseDateYMD(draftDayStart)) / 86400000) + 1)} Days`
                      : 'Select days'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSelectAllDaysInMonth}
                  style={{
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    background: 'rgba(245, 158, 11, 0.12)',
                    color: '#F59E0B',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title={`Select all ${daysInMonth} days in ${MONTH_NAMES[viewMonth]} and update graph`}
                >
                  <CheckCheck size={11} />
                  <span>Select All Days</span>
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  textAlign: 'center',
                  marginBottom: '8px',
                  color: 'var(--text-muted, #64748B)',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                }}
              >
                {DAY_NAMES_SHORT.map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: '4px',
                }}
              >
                {/* Empty lead cells */}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}

                {/* Day cells */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const thisDateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const isToday = viewYear === currentYear && viewMonth === currentMonth && dayNum === currentDate.getDate();

                  const minD = draftDayStart <= draftDayEnd ? draftDayStart : draftDayEnd;
                  const maxD = draftDayStart <= draftDayEnd ? draftDayEnd : draftDayStart;
                  const isSelected = thisDateStr >= minD && thisDateStr <= maxD;
                  const isEdge = thisDateStr === minD || thisDateStr === maxD;

                  return (
                    <button
                      key={dayNum}
                      type="button"
                      onClick={() => handleDayCellClick(thisDateStr)}
                      style={{
                        height: '32px',
                        borderRadius: isEdge ? '8px' : '4px',
                        border: isEdge ? '1.5px solid #F59E0B' : isToday ? '1.5px solid #38BDF8' : '1px solid transparent',
                        backgroundColor: isSelected
                          ? 'rgba(245, 158, 11, 0.22)'
                          : isToday
                          ? 'rgba(56, 189, 248, 0.15)'
                          : 'var(--bg-main, rgba(255, 255, 255, 0.02))',
                        color: isSelected ? '#F59E0B' : isToday ? '#38BDF8' : 'var(--text-primary, #F8FAFC)',
                        fontSize: '0.78rem',
                        fontWeight: isSelected || isToday ? 800 : 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {dayNum}
                    </button>
                  );
                })}
              </div>

              {/* Action Banner & Apply Button */}
              <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  <span>X-Axis: <strong>Days</strong></span>
                </div>
                <button
                  type="button"
                  onClick={applyDaySelection}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#F59E0B',
                    color: '#0F172A',
                    fontWeight: 800,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.76rem',
                  }}
                >
                  Apply Days
                </button>
              </div>
            </div>
          )}

          {/* Quick Presets Bar */}
          <div
            style={{
              marginTop: '14px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              display: 'flex',
              gap: '6px',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={() => {
                const sStr = formatDateYMD(new Date(currentYear, currentMonth, 1));
                const eStr = formatDateYMD(new Date(currentYear, currentMonth + 1, 0));
                const processed = validateAndProcessRange(sStr, eStr, `${MONTH_NAMES[currentMonth]} ${currentYear}`);
                if (!processed) return;

                setIsAllTime(false);
                setCustomStartDate(processed.startDate);
                setCustomEndDate(processed.endDate);
                setActiveUnit('month');
                setActiveCount(1);
                setXAxisGrouping('week');
                setIsCalendarOpen(false);
              }}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.7rem',
                fontWeight: 700,
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                background: 'var(--bg-main, rgba(255, 255, 255, 0.04))',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              This Month
            </button>

            <button
              type="button"
              onClick={() => {
                const prevM = currentMonth === 0 ? 11 : currentMonth - 1;
                const prevY = currentMonth === 0 ? currentYear - 1 : currentYear;
                const sStr = formatDateYMD(new Date(prevY, prevM, 1));
                const eStr = formatDateYMD(new Date(prevY, prevM + 1, 0));
                const processed = validateAndProcessRange(sStr, eStr, `${MONTH_NAMES[prevM]} ${prevY}`);
                if (!processed) return;

                setIsAllTime(false);
                setCustomStartDate(processed.startDate);
                setCustomEndDate(processed.endDate);
                setActiveUnit('month');
                setActiveCount(1);
                setXAxisGrouping('week');
                setIsCalendarOpen(false);
              }}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.7rem',
                fontWeight: 700,
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                background: 'var(--bg-main, rgba(255, 255, 255, 0.04))',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              Last Month
            </button>

            <button
              type="button"
              onClick={() => {
                const sStr = formatDateYMD(new Date(currentYear, 0, 1));
                const eStr = formatDateYMD(new Date(currentYear, 11, 31));
                const processed = validateAndProcessRange(sStr, eStr, `Year ${currentYear}`);
                if (!processed) return;

                setIsAllTime(false);
                setCustomStartDate(processed.startDate);
                setCustomEndDate(processed.endDate);
                setActiveUnit('year');
                setActiveCount(1);
                setXAxisGrouping('month');
                setIsCalendarOpen(false);
              }}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.7rem',
                fontWeight: 700,
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                background: 'var(--bg-main, rgba(255, 255, 255, 0.04))',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              This Year
            </button>

            <button
              type="button"
              onClick={() => {
                const startM = currentMonth >= 3 ? currentMonth - 3 : 0;
                const sStr = formatDateYMD(new Date(currentYear, startM, 1));
                const eStr = formatDateYMD(new Date(currentYear, currentMonth + 1, 0));
                const processed = validateAndProcessRange(sStr, eStr, 'Last 4 Months');
                if (!processed) return;

                setIsAllTime(false);
                setCustomStartDate(processed.startDate);
                setCustomEndDate(processed.endDate);
                setActiveUnit('month');
                setActiveCount(currentMonth - startM + 1);
                setXAxisGrouping('month');
                setIsCalendarOpen(false);
              }}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.7rem',
                fontWeight: 700,
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                background: 'var(--bg-main, rgba(255, 255, 255, 0.04))',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              Last 4 Months
            </button>

            {allowAllTime && (
              <button
                type="button"
                onClick={handleSelectAll}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  border: isAllTime ? '1.5px solid #10B981' : '1px solid rgba(16, 185, 129, 0.3)',
                  background: isAllTime ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.12)',
                  color: '#10B981',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Select All available timeline history"
              >
                <CheckCheck size={12} />
                <span>Select All (All Time)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. MODAL POPUP ALERT: NO STORE RECORDS FOR SELECTED PERIOD */}
      {noRecordsAlert && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '16px',
          }}
          onClick={() => setNoRecordsAlert(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: '#0F172A',
              border: '1.5px solid rgba(239, 68, 68, 0.45)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(239, 68, 68, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Header Icon + Title */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertCircle size={24} color="#EF4444" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#F8FAFC' }}>
                  {noRecordsAlert.title}
                </h3>
                <div
                  style={{
                    display: 'inline-block',
                    marginTop: '4px',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(239, 68, 68, 0.18)',
                    color: '#FCA5A5',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                  }}
                >
                  {noRecordsAlert.periodLabel}
                </div>
              </div>
            </div>

            {/* Explanatory Message */}
            <p
              style={{
                margin: 0,
                fontSize: '0.85rem',
                lineHeight: '1.5',
                color: '#CBD5E1',
              }}
            >
              {noRecordsAlert.message}
            </p>

            {/* Note badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                fontSize: '0.78rem',
                color: '#38BDF8',
              }}
            >
              <Info size={16} color="#38BDF8" style={{ flexShrink: 0 }} />
              <span>
                Historical ranges prior to <strong>{noRecordsAlert.earliestFormatted || 'September 04, 2026'}</strong> have no financial activity.
              </span>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setNoRecordsAlert(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '9px',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#94A3B8',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={handleJumpToFirstRecords}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  borderRadius: '9px',
                  backgroundColor: '#10B981',
                  border: 'none',
                  color: '#0F172A',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>Jump to First Records</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Filter & Group continuous daily time-series records along the active X-Axis grouping
 */
export function filterTimelineSeries(rawRecords = [], rangeConfig = {}) {
  if (!rawRecords || rawRecords.length === 0) return [];

  const {
    startDate,
    endDate,
    xAxisGrouping = 'day',
    granularity,
    isAllTime,
  } = rangeConfig;

  const targetGrouping = xAxisGrouping || granularity || 'day';

  // 1. Slice by date boundary
  let filtered = rawRecords;
  if (!isAllTime && (startDate || endDate)) {
    filtered = rawRecords.filter((r) => {
      const d = r.date || r.key;
      if (!d) return true;
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });
  }

  // Filter out any records before earliest record date anchor (defaults to store inception 2026-09-04)
  const minBoundary = rangeConfig.minDate === false
    ? null
    : (rangeConfig.minDate
        ? (typeof rangeConfig.minDate === 'string' ? rangeConfig.minDate.slice(0, 10) : formatDateYMD(rangeConfig.minDate))
        : '2026-09-04');

  if (minBoundary) {
    filtered = filtered.filter((r) => {
      const d = r.date || r.key;
      if (!d) return true;
      return d >= minBoundary;
    });
  }

  if (filtered.length === 0) {
    return [];
  }

  const getVal = (r, key, fallback = 0) => {
    const v = Number(r?.[key]);
    return isNaN(v) ? fallback : v;
  };

  // -------------------------------------------------------------
  // GROUPING 1: DAY (Show individual days)
  // -------------------------------------------------------------
  if (targetGrouping === 'day') {
    return filtered.map((r, i) => {
      const dStr = r.date || r.key;
      const dt = parseDateYMD(dStr);
      const isShortSpan = filtered.length <= 10;

      return {
        ...r,
        pointKey: dStr || `day-${i}`,
        plotLabel: isShortSpan
          ? `${DAY_NAMES_SHORT[dt.getDay()]} ${dt.getDate()}`
          : `${MONTH_ABBR[dt.getMonth()]} ${dt.getDate()}`,
        subLabel: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        full_date: dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
        selling_price: getVal(r, 'selling_price'),
        cost_price: getVal(r, 'cost_price'),
        revenue: getVal(r, 'revenue'),
        units_sold: getVal(r, 'units_sold', getVal(r, 'units')),
        units: getVal(r, 'units', getVal(r, 'units_sold')),
      };
    });
  }

  const NUMERIC_METRICS = [
    'revenue',
    'gross_sales',
    'gross_revenue',
    'returns_amount',
    'taxable_base',
    'gst_amount',
    'net_revenue_after_gst',
    'net_revenue',
    'cogs',
    'gross_profit',
    'expenses',
    'operating_expenses',
    'counter_payouts',
    'salaries',
    'total_expenses',
    'total_outflows',
    'operating_profit',
    'stakeholder_share',
    'retained_profit',
  ];

  const aggregateBucketMetrics = (recs, lastRec) => {
    const agg = {};
    NUMERIC_METRICS.forEach((k) => {
      const hasMetric = recs.some((r) => r[k] !== undefined && r[k] !== null);
      if (hasMetric) {
        const sum = recs.reduce((acc, r) => acc + (Number(r[k]) || 0), 0);
        agg[k] = Math.round(sum * 100) / 100;
      }
    });

    const sumUnits = recs.reduce((acc, x) => acc + (Number(x.units_sold ?? x.units) || 0), 0);
    agg.units_sold = sumUnits;
    agg.units = sumUnits;

    if (lastRec.selling_price !== undefined) {
      agg.selling_price = Number(lastRec.selling_price) || 0;
    }
    if (lastRec.cost_price !== undefined) {
      agg.cost_price = Number(lastRec.cost_price) || 0;
    }

    return agg;
  };

  // -------------------------------------------------------------
  // GROUPING 2: WEEK (Natural month weeks: Week 1..5 or ISO weeks)
  // -------------------------------------------------------------
  if (targetGrouping === 'week') {
    const firstDate = filtered[0]?.date || '';
    const lastDate = filtered[filtered.length - 1]?.date || '';
    const isSingleMonth = firstDate.slice(0, 7) === lastDate.slice(0, 7) && firstDate.length >= 7;

    if (isSingleMonth) {
      // Divide into 5 natural weeks: 1..7, 8..14, 15..21, 22..28, 29..end
      const dtSample = parseDateYMD(firstDate);
      const monthAbbr = MONTH_ABBR[dtSample.getMonth()];
      const yearVal = dtSample.getFullYear();

      const weekBuckets = {
        w1: { name: 'Week 1', days: '1–7', records: [] },
        w2: { name: 'Week 2', days: '8–14', records: [] },
        w3: { name: 'Week 3', days: '15–21', records: [] },
        w4: { name: 'Week 4', days: '22–28', records: [] },
        w5: { name: 'Week 5', days: '29–end', records: [] },
      };

      filtered.forEach((r) => {
        const dt = parseDateYMD(r.date || r.key);
        const dayNum = dt.getDate();
        if (dayNum <= 7) weekBuckets.w1.records.push(r);
        else if (dayNum <= 14) weekBuckets.w2.records.push(r);
        else if (dayNum <= 21) weekBuckets.w3.records.push(r);
        else if (dayNum <= 28) weekBuckets.w4.records.push(r);
        else weekBuckets.w5.records.push(r);
      });

      const resultWeeks = [];
      Object.entries(weekBuckets).forEach(([key, b], idx) => {
        if (b.records.length === 0) return;
        const recs = b.records;
        const lastRec = recs[recs.length - 1];
        const aggregated = aggregateBucketMetrics(recs, lastRec);

        resultWeeks.push({
          ...lastRec,
          ...aggregated,
          pointKey: `month-week-${idx + 1}`,
          plotLabel: b.name,
          subLabel: `${monthAbbr} ${b.days}`,
          full_date: `${b.name} (${monthAbbr} ${b.days}, ${yearVal})`,
        });
      });

      return resultWeeks.length > 0 ? resultWeeks : filtered;
    }

    // Multi-month: group by ISO 7-day windows
    const isoBuckets = {};
    filtered.forEach((r) => {
      const dt = parseDateYMD(r.date || r.key);
      const y = dt.getFullYear();
      const firstDayOfYear = new Date(y, 0, 1);
      const pastDays = (dt - firstDayOfYear) / 86400000;
      const weekNum = Math.ceil((pastDays + firstDayOfYear.getDay() + 1) / 7);
      const k = `${y}-W${String(weekNum).padStart(2, '0')}`;

      if (!isoBuckets[k]) {
        isoBuckets[k] = {
          key: k,
          label: `Wk ${weekNum}`,
          full_date: `Week ${weekNum}, ${y}`,
          records: [],
        };
      }
      isoBuckets[k].records.push(r);
    });

    return Object.values(isoBuckets).map((b) => {
      const recs = b.records;
      const lastRec = recs[recs.length - 1];
      const aggregated = aggregateBucketMetrics(recs, lastRec);

      return {
        ...lastRec,
        ...aggregated,
        pointKey: b.key,
        plotLabel: b.label,
        subLabel: b.key,
        full_date: b.full_date,
      };
    });
  }

  // -------------------------------------------------------------
  // GROUPING 3: MONTH (Jan, Feb, Mar ... Dec)
  // -------------------------------------------------------------
  if (targetGrouping === 'month') {
    const monthBuckets = {};
    filtered.forEach((r, idx) => {
      const mNum = r.month || (r.date ? parseDateYMD(r.date).getMonth() + 1 : null);
      const dStr = r.date || r.key || (mNum ? `2026-${String(mNum).padStart(2, '0')}-01` : '');
      const mKey = dStr ? dStr.slice(0, 7) : (mNum ? `month-${mNum}` : `idx-${idx}`);
      if (!monthBuckets[mKey]) {
        const dt = dStr ? parseDateYMD(dStr) : null;
        const mIdx = mNum ? mNum - 1 : (dt ? dt.getMonth() : 0);
        const yVal = dt ? dt.getFullYear() : (r.year || 2026);
        const mName = r.month_name || (dt ? dt.toLocaleDateString('en-US', { month: 'long' }) : `Month ${mIdx + 1}`);
        monthBuckets[mKey] = {
          key: mKey,
          label: r.label || MONTH_ABBR[mIdx] || mKey,
          subLabel: yVal ? `'${String(yVal).slice(2)}` : '',
          full_date: r.full_date || `${mName} ${yVal}`,
          records: [],
        };
      }
      monthBuckets[mKey].records.push(r);
    });

    const monthList = Object.values(monthBuckets);
    if (monthList.length > 0) {
      return monthList.map((b) => {
        const recs = b.records;
        const lastRec = recs[recs.length - 1];
        const aggregated = aggregateBucketMetrics(recs, lastRec);

        return {
          ...lastRec,
          ...aggregated,
          pointKey: b.key,
          plotLabel: b.label,
          subLabel: b.subLabel,
          full_date: b.full_date,
        };
      });
    }
  }

  // -------------------------------------------------------------
  // GROUPING 4: YEAR (2024, 2025, 2026)
  // -------------------------------------------------------------
  if (targetGrouping === 'year') {
    const yearBuckets = {};
    filtered.forEach((r) => {
      const dStr = r.date || r.key || '';
      const yKey = dStr ? dStr.slice(0, 4) : 'unknown'; // YYYY
      if (!yearBuckets[yKey]) {
        yearBuckets[yKey] = {
          key: yKey,
          label: yKey,
          full_date: `Year ${yKey}`,
          records: [],
        };
      }
      yearBuckets[yKey].records.push(r);
    });

    return Object.values(yearBuckets).map((b) => {
      const recs = b.records;
      const lastRec = recs[recs.length - 1];
      const aggregated = aggregateBucketMetrics(recs, lastRec);

      return {
        ...lastRec,
        ...aggregated,
        pointKey: b.key,
        plotLabel: b.label,
        subLabel: b.key,
        full_date: b.full_date,
      };
    });
  }

  return filtered;
}
