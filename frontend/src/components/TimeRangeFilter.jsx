import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Calendar, X, Check, RotateCcw, ChevronDown } from 'lucide-react';

export const RANGE_OPTIONS = [
  // Minutes & Hours
  { value: '1m', label: '±1 Minute (Exact)', windowMinutes: 1, category: 'time' },
  { value: '5m', label: '±5 Minutes', windowMinutes: 5, category: 'time' },
  { value: '15m', label: '±15 Minutes', windowMinutes: 15, category: 'time' },
  { value: '30m', label: '±30 Minutes', windowMinutes: 30, category: 'time' },
  { value: '1h', label: '±1 Hour', windowMinutes: 60, category: 'time' },
  { value: '2h', label: '±2 Hours', windowMinutes: 120, category: 'time' },
  { value: '4h', label: '±4 Hours', windowMinutes: 240, category: 'time' },
  { value: '6h', label: '±6 Hours', windowMinutes: 360, category: 'time' },
  { value: '12h', label: '±12 Hours', windowMinutes: 720, category: 'time' },

  // Days & Weeks
  { value: 'day', label: 'Full Day (Selected Date 00:00 - 23:59)', windowMinutes: null, category: 'day' },
  { value: '1d', label: '±1 Day (Total 2 Days)', windowDays: 1, category: 'day' },
  { value: '3d', label: '±3 Days (Total 6 Days)', windowDays: 3, category: 'day' },
  { value: '7d', label: '±7 Days / 1 Week (Total 2 Weeks)', windowDays: 7, category: 'day' },
  { value: '15d', label: '±15 Days (Total 1 Month)', windowDays: 15, category: 'day' },

  // Months & 1-Year Range
  { value: '1mo', label: '±1 Month (Total 2 Months)', windowMonths: 1, category: 'month' },
  { value: '2mo', label: '±2 Months (Total 4 Months)', windowMonths: 2, category: 'month' },
  { value: '3mo', label: '±3 Months / Quarter (Total 6 Months)', windowMonths: 3, category: 'month' },
  { value: '6mo', label: '±6 Months (Total 1 Year)', windowMonths: 6, category: 'month' },
];

/**
 * Format local Date object to YYYY-MM-DD
 */
function toLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format local Date object to HH:mm
 */
function toLocalTimeString(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Utility: Checks if an ISO timestamp or date falls within the active filter window.
 */
export function isWithinTimeRange(itemTimestamp, filterState) {
  if (!filterState || !filterState.active) return true;
  if (!itemTimestamp) return false;

  try {
    const t = new Date(itemTimestamp).getTime();
    if (isNaN(t)) return true;
    const { startTimestamp, endTimestamp } = filterState;
    if (startTimestamp && t < startTimestamp) return false;
    if (endTimestamp && t > endTimestamp) return false;
    return true;
  } catch (e) {
    return true;
  }
}

/**
 * Utility: Filters an array of logs using given candidate timestamp keys.
 */
export function filterLogsByTimeRange(
  items = [],
  filterState,
  timestampKeys = ['created_at', 'paid_at', 'opened_at', 'disbursed_at', 'expense_date', 'payout_date']
) {
  if (!filterState || !filterState.active || !Array.isArray(items)) return items;

  return items.filter((item) => {
    if (!item) return false;
    let val = null;
    for (const k of timestampKeys) {
      if (item[k] !== undefined && item[k] !== null && item[k] !== '') {
        val = item[k];
        break;
      }
    }
    if (!val) return true;
    return isWithinTimeRange(val, filterState);
  });
}

/**
 * Compute start and end timestamps given date, time, and range.
 */
export function computeTimeWindow(dateStr, timeStr, rangeKey) {
  if (!dateStr) return null;

  const [year, month, day] = dateStr.split('-').map(Number);

  if (rangeKey === 'day') {
    const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);
    return {
      startDate,
      endDate,
      startTimestamp: startDate.getTime(),
      endTimestamp: endDate.getTime(),
      startTimeIso: startDate.toISOString(),
      endTimeIso: endDate.toISOString(),
      label: `${startDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} (All Day)`,
      timeSpanLabel: '00:00 – 23:59',
    };
  }

  const opt = RANGE_OPTIONS.find((o) => o.value === rangeKey) || RANGE_OPTIONS.find((o) => o.value === '30m') || RANGE_OPTIONS[0];

  let startDate;
  let endDate;
  let label;
  let timeSpanLabel;
  const centerDate = new Date(year, month - 1, day);

  if (opt.windowMonths) {
    const m = opt.windowMonths;
    // Set start date to 00:00:00 on the day m months prior
    startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    startDate.setMonth(startDate.getMonth() - m);

    // Set end date to 23:59:59.999 on the day m months after
    endDate = new Date(year, month - 1, day, 23, 59, 59, 999);
    endDate.setMonth(endDate.getMonth() + m);

    const startFmt = startDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    const endFmt = endDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    const centerFmt = centerDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

    timeSpanLabel = `${startFmt} – ${endFmt}`;
    label = m === 6 ? `${centerFmt} (±6 Mo / 1 Year)` : `${centerFmt} (±${m} Mo)`;
  } else if (opt.windowDays) {
    const d = opt.windowDays;
    startDate = new Date(year, month - 1, day - d, 0, 0, 0, 0);
    endDate = new Date(year, month - 1, day + d, 23, 59, 59, 999);

    const startFmt = startDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    const endFmt = endDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    const centerFmt = centerDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

    timeSpanLabel = `${startFmt} – ${endFmt}`;
    label = `${centerFmt} (±${d}d)`;
  } else {
    // Window in minutes around exact center time
    const [hours, minutes] = (timeStr || '12:00').split(':').map(Number);
    const centerDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);

    const windowMinutes = opt.windowMinutes || 30;
    const windowMs = windowMinutes * 60 * 1000;
    startDate = new Date(centerDateTime.getTime() - windowMs);
    endDate = new Date(centerDateTime.getTime() + windowMs);

    const centerTimeFmt = centerDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const startFmt = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endFmt = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateFmt = centerDateTime.toLocaleDateString([], { month: 'short', day: 'numeric' });

    const durLabel = windowMinutes >= 60 ? `${windowMinutes / 60}h` : `${windowMinutes}m`;
    label = `${dateFmt} ${centerTimeFmt} (±${durLabel})`;
    timeSpanLabel = `${startFmt} – ${endFmt}`;
  }

  return {
    centerDate,
    startDate,
    endDate,
    startTimestamp: startDate.getTime(),
    endTimestamp: endDate.getTime(),
    startTimeIso: startDate.toISOString(),
    endTimeIso: endDate.toISOString(),
    label,
    timeSpanLabel,
  };
}

export default function TimeRangeFilter({
  onFilterChange,
  filterState = null,
  compact = false,
  align = 'right',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);

  const now = new Date();
  const [selectedDate, setSelectedDate] = useState(
    filterState?.targetDate || toLocalDateString(now)
  );
  const [selectedTime, setSelectedTime] = useState(
    filterState?.targetTime || toLocalTimeString(now)
  );
  const [selectedRange, setSelectedRange] = useState(
    filterState?.windowRange || '30m'
  );

  useEffect(() => {
    if (filterState?.targetDate) setSelectedDate(filterState.targetDate);
    if (filterState?.targetTime) setSelectedTime(filterState.targetTime);
    if (filterState?.windowRange) setSelectedRange(filterState.windowRange);
  }, [filterState]);

  const selectedOpt = RANGE_OPTIONS.find((o) => o.value === selectedRange);
  const isTimeRangeType = !selectedOpt || selectedOpt.category === 'time';

  // Compute fixed position for portal popover
  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = 330;
    const popoverHeight = isTimeRangeType ? 360 : 290;

    let top = rect.bottom + 6;
    let left = align === 'left' ? rect.left : rect.right - popoverWidth;

    // Viewport horizontal boundary enforcement
    if (left + popoverWidth > window.innerWidth - 12) {
      left = window.innerWidth - popoverWidth - 12;
    }
    if (left < 12) {
      left = 12;
    }

    // Viewport vertical boundary: flip up if bottom is cut off and top has room
    if (top + popoverHeight > window.innerHeight - 12 && rect.top > popoverHeight + 12) {
      top = rect.top - popoverHeight - 6;
    }

    setCoords({ top, left });
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen, selectedRange, selectedDate, selectedTime]);

  // Event listeners for resize, scroll, and click outside
  useEffect(() => {
    if (!isOpen) return;

    function handleScrollOrResize() {
      updatePosition();
    }

    function handleClickOutside(e) {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(e.target) &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    }

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSnapNow = () => {
    const d = new Date();
    setSelectedDate(toLocalDateString(d));
    setSelectedTime(toLocalTimeString(d));
  };

  const handleSnapToday = () => {
    const d = new Date();
    setSelectedDate(toLocalDateString(d));
  };

  const handleSnapYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setSelectedDate(toLocalDateString(d));
  };

  const preview = computeTimeWindow(selectedDate, selectedTime, selectedRange);

  const handleApply = () => {
    if (!preview) return;
    const newState = {
      active: true,
      targetDate: selectedDate,
      targetTime: selectedTime,
      windowRange: selectedRange,
      startTime: preview.startTimeIso,
      endTime: preview.endTimeIso,
      startTimestamp: preview.startTimestamp,
      endTimestamp: preview.endTimestamp,
      label: preview.label,
      timeSpanLabel: preview.timeSpanLabel,
    };
    onFilterChange?.(newState);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e?.stopPropagation();
    const emptyState = {
      active: false,
      targetDate: selectedDate,
      targetTime: selectedTime,
      windowRange: selectedRange,
      startTime: null,
      endTime: null,
      startTimestamp: null,
      endTimestamp: null,
      label: '',
      timeSpanLabel: '',
    };
    onFilterChange?.(emptyState);
    setIsOpen(false);
  };

  const isFilterActive = !!filterState?.active;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!isOpen) updatePosition();
          setIsOpen(!isOpen);
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: compact ? '6px 10px' : '7px 12px',
          borderRadius: 'var(--radius-md, 8px)',
          fontSize: compact ? '0.75rem' : '0.80rem',
          fontWeight: 700,
          background: isFilterActive
            ? 'rgba(59, 130, 246, 0.14)'
            : 'var(--bg-surface, #FFFFFF)',
          border: isFilterActive
            ? '1px solid rgba(59, 130, 246, 0.5)'
            : '1px solid var(--border-subtle, #CBD5E1)',
          color: isFilterActive ? '#2563EB' : 'var(--text-primary, #0F172A)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          boxShadow: isFilterActive ? '0 0 12px rgba(59, 130, 246, 0.2)' : 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))',
        }}
        title="Search logs by exact date, time, and radius range"
      >
        <Clock size={compact ? 13 : 15} style={{ color: isFilterActive ? '#2563EB' : 'var(--text-muted, #94A3B8)' }} />

        {isFilterActive ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>{filterState.label}</span>
            {filterState.timeSpanLabel && !compact && isTimeRangeType && (
              <span style={{ fontSize: '0.70rem', opacity: 0.85, fontWeight: 600 }}>
                ({filterState.timeSpanLabel})
              </span>
            )}
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleClear(e);
              }}
              style={{
                marginLeft: '4px',
                padding: '2px',
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(239, 68, 68, 0.16)',
                color: '#EF4444',
                cursor: 'pointer',
              }}
              title="Reset Time Filter"
            >
              <X size={12} />
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span>Filter by Time</span>
            <ChevronDown size={12} style={{ color: 'var(--text-muted, #94A3B8)' }} />
          </div>
        )}
      </button>

      {/* Portal Popover (mounted to document.body so it NEVER clips or glitches behind anything) */}
      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: 999999,
              width: '330px',
              backgroundColor: 'var(--bg-surface-solid, var(--bg-surface, #FFFFFF))',
              border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.12))',
              borderRadius: 'var(--radius-lg, 14px)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.22), 0 4px 14px rgba(0, 0, 0, 0.08), 0 0 0 1px var(--border-subtle)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              color: 'var(--text-primary, #0F172A)',
              boxSizing: 'border-box',
              animation: 'fadeIn 0.15s ease-out',
            }}
          >
            {/* Popover Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '6px',
                    background: 'rgba(59, 130, 246, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2563EB',
                  }}
                >
                  <Clock size={14} />
                </div>
                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary, #0F172A)' }}>
                  Search Logs by Time
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted, #94A3B8)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Section 1: Date */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted, #64748B)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  1. Select Date
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={handleSnapToday}
                    style={{
                      background: 'var(--bg-surface-hover, rgba(0, 0, 0, 0.04))',
                      border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.1))',
                      color: 'var(--text-secondary, #475569)',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={handleSnapYesterday}
                    style={{
                      background: 'var(--bg-surface-hover, rgba(0, 0, 0, 0.04))',
                      border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.1))',
                      color: 'var(--text-secondary, #475569)',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Yesterday
                  </button>
                </div>
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="form-input"
                style={{
                  width: '100%',
                  fontSize: '0.82rem',
                  padding: '7px 10px',
                  boxSizing: 'border-box',
                  backgroundColor: 'var(--bg-input, var(--bg-surface, #FFFFFF))',
                  color: 'var(--text-primary, #0F172A)',
                  border: '1px solid var(--border-subtle, #CBD5E1)',
                  borderRadius: '8px',
                }}
              />
            </div>

            {/* Section 2: Time (Only relevant for minute & hour ranges) */}
            {isTimeRangeType && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted, #64748B)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    2. Select Time (Hour &amp; Minute)
                  </label>
                  <button
                    type="button"
                    onClick={handleSnapNow}
                    style={{
                      background: 'rgba(59, 130, 246, 0.12)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      color: '#2563EB',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Current Time
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <select
                      value={selectedTime.split(':')[0] || '12'}
                      onChange={(e) => {
                        const mins = selectedTime.split(':')[1] || '00';
                        setSelectedTime(`${e.target.value}:${mins}`);
                      }}
                      className="form-input"
                      style={{
                        width: '100%',
                        fontSize: '0.82rem',
                        padding: '7px 8px',
                        backgroundColor: 'var(--bg-input, var(--bg-surface, #FFFFFF))',
                        color: 'var(--text-primary, #0F172A)',
                        border: '1px solid var(--border-subtle, #CBD5E1)',
                        borderRadius: '8px',
                      }}
                    >
                      {Array.from({ length: 24 }, (_, i) => {
                        const h = String(i).padStart(2, '0');
                        const period = i >= 12 ? 'PM' : 'AM';
                        const h12 = i === 0 ? 12 : i > 12 ? i - 12 : i;
                        return (
                          <option
                            key={h}
                            value={h}
                            style={{
                              backgroundColor: 'var(--bg-surface, #FFFFFF)',
                              color: 'var(--text-primary, #0F172A)',
                            }}
                          >
                            {h}:00 ({h12} {period})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <select
                      value={selectedTime.split(':')[1] || '00'}
                      onChange={(e) => {
                        const hrs = selectedTime.split(':')[0] || '12';
                        setSelectedTime(`${hrs}:${e.target.value}`);
                      }}
                      className="form-input"
                      style={{
                        width: '100%',
                        fontSize: '0.82rem',
                        padding: '7px 8px',
                        backgroundColor: 'var(--bg-input, var(--bg-surface, #FFFFFF))',
                        color: 'var(--text-primary, #0F172A)',
                        border: '1px solid var(--border-subtle, #CBD5E1)',
                        borderRadius: '8px',
                      }}
                    >
                      {Array.from({ length: 60 }, (_, i) => {
                        const m = String(i).padStart(2, '0');
                        return (
                          <option
                            key={m}
                            value={m}
                            style={{
                              backgroundColor: 'var(--bg-surface, #FFFFFF)',
                              color: 'var(--text-primary, #0F172A)',
                            }}
                          >
                            :{m} min
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Section 3: Range */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted, #64748B)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {isTimeRangeType ? '3. Range Window Around Selected Minute' : '2. Range Window Around Selected Date'}
              </label>
              <select
                value={selectedRange}
                onChange={(e) => setSelectedRange(e.target.value)}
                className="form-input"
                style={{
                  width: '100%',
                  fontSize: '0.82rem',
                  padding: '7px 10px',
                  backgroundColor: 'var(--bg-input, var(--bg-surface, #FFFFFF))',
                  color: 'var(--text-primary, #0F172A)',
                  border: '1px solid var(--border-subtle, #CBD5E1)',
                  borderRadius: '8px',
                }}
              >
                <optgroup label="⏱️ Minutes &amp; Hours" style={{ fontWeight: 700, color: 'var(--text-muted, #64748B)' }}>
                  {RANGE_OPTIONS.filter((o) => o.category === 'time').map((opt) => (
                    <option
                      key={opt.value}
                      value={opt.value}
                      style={{
                        backgroundColor: 'var(--bg-surface, #FFFFFF)',
                        color: 'var(--text-primary, #0F172A)',
                      }}
                    >
                      {opt.label}
                    </option>
                  ))}
                </optgroup>

                <optgroup label="📅 Days &amp; Weeks" style={{ fontWeight: 700, color: 'var(--text-muted, #64748B)' }}>
                  {RANGE_OPTIONS.filter((o) => o.category === 'day').map((opt) => (
                    <option
                      key={opt.value}
                      value={opt.value}
                      style={{
                        backgroundColor: 'var(--bg-surface, #FFFFFF)',
                        color: 'var(--text-primary, #0F172A)',
                      }}
                    >
                      {opt.label}
                    </option>
                  ))}
                </optgroup>

                <optgroup label="📊 Months &amp; 1-Year Range" style={{ fontWeight: 700, color: 'var(--text-muted, #64748B)' }}>
                  {RANGE_OPTIONS.filter((o) => o.category === 'month').map((opt) => (
                    <option
                      key={opt.value}
                      value={opt.value}
                      style={{
                        backgroundColor: 'var(--bg-surface, #FFFFFF)',
                        color: 'var(--text-primary, #0F172A)',
                      }}
                    >
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Live Preview Window Banner */}
            {preview && (
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  fontSize: '0.72rem',
                  color: 'var(--text-secondary, #475569)',
                }}
              >
                <div style={{ fontWeight: 800, color: '#2563EB', marginBottom: '2px' }}>
                  Window to audit:
                </div>
                <div style={{ fontWeight: 600 }}>
                  {selectedRange === 'day'
                    ? `${preview.label} (00:00 – 23:59)`
                    : `${preview.timeSpanLabel} (${selectedOpt?.label || selectedRange})`}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
              {isFilterActive && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="btn btn-secondary"
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    borderRadius: '8px',
                  }}
                >
                  <RotateCcw size={12} />
                  <span>Clear</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleApply}
                className="btn btn-primary"
                style={{
                  flex: 2,
                  padding: '8px 14px',
                  fontSize: '0.80rem',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
                  border: 'none',
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                  cursor: 'pointer',
                }}
              >
                <Check size={14} />
                <span>Apply Filter</span>
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
