/**
 * chartChangeHelper.js
 *
 * Universal utility for calculating and formatting percentage change
 * between consecutive marked points on line graphs across the application.
 *
 * Handles:
 *  - First marked point (Baseline / No previous point)
 *  - Division by zero / Transitions from 0
 *  - Positive, negative, and neutral changes
 *  - Clear descriptive text specifying what the change is between
 *    (e.g., "Change from Aug to Sep: ▲ +15.2% (₹42.0k → ₹48.4k)")
 */

/**
 * Calculates the percentage change and comparison details between current and previous point values.
 *
 * @param {number|string} currentVal Current point numerical value
 * @param {number|string|null|undefined} prevVal Previous point numerical value
 * @param {string} currentLabel Label of the current point (e.g., "Sep", "Day 14", "2025", "14:00")
 * @param {string} prevLabel Label of the previous point (e.g., "Aug", "Day 13", "2024", "13:00")
 * @param {function} [valueFormatter] Optional formatter function for numeric values
 * @returns {object} Comparison metadata
 */
export function calculatePointChange(
  currentVal,
  prevVal,
  currentLabel = '',
  prevLabel = '',
  valueFormatter = null
) {
  const curr = Number(currentVal) || 0;
  const format = typeof valueFormatter === 'function' ? valueFormatter : (v) => String(v);
  const currFmt = format(curr);

  // If no previous point exists (this is the first marked point in the series)
  if (prevVal === undefined || prevVal === null) {
    const cLabel = currentLabel || 'Point 1';
    return {
      hasPrev: false,
      isBaseline: true,
      pct: 0,
      pctFormatted: 'Baseline',
      diff: 0,
      diffFormatted: '0',
      isUp: false,
      isDown: false,
      isNeutral: true,
      icon: '—',
      badgeColor: '#94A3B8',
      badgeBg: 'rgba(148, 163, 184, 0.14)',
      badgeBorder: 'rgba(148, 163, 184, 0.3)',
      currentLabel: cLabel,
      prevLabel: '',
      currentFormatted: currFmt,
      prevFormatted: null,
      betweenText: `${cLabel} (Initial marked point)`,
      shortText: 'Initial Baseline',
      detailedText: `Initial baseline at ${cLabel} (${currFmt}) • No prior point`,
      badgeText: 'Baseline',
    };
  }

  const prev = Number(prevVal) || 0;
  const prevFmt = format(prev);
  const diff = curr - prev;

  let pct = 0;
  let statusNote = '';

  if (prev !== 0) {
    pct = ((curr - prev) / Math.abs(prev)) * 100;
  } else if (curr > 0) {
    pct = 100.0;
  } else if (curr < 0) {
    pct = -100.0;
  } else {
    pct = 0.0;
  }

  // Handle financial context labels for transition across 0 or negative base values
  if (prev < 0 && curr === 0) {
    statusNote = 'Break-even';
  } else if (prev < 0 && curr > 0) {
    statusNote = 'Profit Turnaround';
  } else if (prev > 0 && curr < 0) {
    statusNote = 'Operating Deficit';
  } else if (prev === 0 && curr < 0) {
    statusNote = 'Entered Deficit';
  } else if (prev < 0 && curr < 0) {
    statusNote = curr > prev ? 'Deficit Reduced' : 'Deficit Increased';
  }

  const isUp = diff > 0;
  const isDown = diff < 0;
  const isNeutral = diff === 0;

  const sign = isUp ? '+' : '';
  const icon = isUp ? '▲' : isDown ? '▼' : '—';
  const badgeColor = isUp ? '#10B981' : isDown ? '#EF4444' : '#94A3B8';
  const badgeBg = isUp
    ? 'rgba(16, 185, 129, 0.16)'
    : isDown
    ? 'rgba(239, 68, 68, 0.16)'
    : 'rgba(148, 163, 184, 0.12)';
  const badgeBorder = isUp
    ? 'rgba(16, 185, 129, 0.38)'
    : isDown
    ? 'rgba(239, 68, 68, 0.38)'
    : 'rgba(148, 163, 184, 0.25)';

  const pctFormatted = `${sign}${pct.toFixed(1)}%`;
  const pLabel = prevLabel || 'Previous';
  const cLabel = currentLabel || 'Current';

  const betweenText = `Change from ${pLabel} to ${cLabel}`;
  const shortText = statusNote
    ? `${icon} ${pctFormatted} (${statusNote})`
    : `${icon} ${pctFormatted} vs ${pLabel}`;
  const detailedText = statusNote
    ? `${betweenText}: ${icon} ${pctFormatted} [${statusNote}] (${prevFmt} → ${currFmt})`
    : `${betweenText}: ${icon} ${pctFormatted} (${prevFmt} → ${currFmt})`;

  return {
    hasPrev: true,
    isBaseline: false,
    diff,
    pct,
    pctFormatted,
    isUp,
    isDown,
    isNeutral,
    icon,
    badgeColor,
    badgeBg,
    badgeBorder,
    currentLabel: cLabel,
    prevLabel: pLabel,
    currentFormatted: currFmt,
    prevFormatted: prevFmt,
    betweenText,
    shortText,
    detailedText,
    badgeText: `${icon} ${pctFormatted}`,
  };
}

/**
 * Extracts a concise display label for a data point object.
 */
export function getPointDisplayLabel(item) {
  if (!item) return '';
  return item.short_label || item.plotLabel || item.month_name || item.label || item.date || item.key || '';
}

/**
 * Extracts a descriptive full label for a data point object.
 */
export function getPointFullLabel(item) {
  if (!item) return '';
  return item.full_date || item.month_name || item.label || item.plotLabel || item.date || item.key || '';
}
