/**
 * Time and Date formatting utilities for Wondersale
 * Enforces 12-hour AM/PM formatting across Employee Management, Kiosk, and Payroll.
 */

/**
 * Formats a time value (string "09:00:00", "09:00", ISO string, or Date) into 12-hour AM/PM format (e.g. "09:00 AM", "06:30 PM").
 * @param {string|Date|null|undefined} timeVal
 * @param {boolean} withSeconds
 * @returns {string}
 */
export function formatTime12h(timeVal, withSeconds = false) {
  if (!timeVal) return '--:--';

  if (timeVal instanceof Date) {
    if (isNaN(timeVal.getTime())) return '--:--';
    return timeVal.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: withSeconds ? '2-digit' : undefined,
      hour12: true,
    });
  }

  const str = String(timeVal).trim();
  if (!str) return '--:--';

  // Check if it already contains AM or PM
  if (/am|pm/i.test(str)) {
    return str;
  }

  // Check if it's an ISO datetime string
  if (str.includes('T') || str.includes('-') && str.includes(':')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: withSeconds ? '2-digit' : undefined,
        hour12: true,
      });
    }
  }

  // Check "HH:MM:SS" or "HH:MM"
  const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const seconds = match[3];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    const hoursStr = hours < 10 ? `0${hours}` : `${hours}`;
    if (withSeconds && seconds !== undefined) {
      return `${hoursStr}:${minutes}:${seconds} ${ampm}`;
    }
    return `${hoursStr}:${minutes} ${ampm}`;
  }

  return str;
}

/**
 * Formats start and end times into a clean range string: "09:00 AM - 06:00 PM".
 * @param {string|null|undefined} startTime
 * @param {string|null|undefined} endTime
 * @returns {string}
 */
export function formatTimeRange12h(startTime, endTime) {
  if (!startTime && !endTime) return 'Flexible Hours';
  const start = formatTime12h(startTime);
  const end = formatTime12h(endTime);
  if (start === '--:--' && end === '--:--') return 'Flexible Hours';
  if (end === '--:--') return `From ${start}`;
  return `${start} - ${end}`;
}

/**
 * Formats a Date or ISO timestamp into "DD MMM YYYY, HH:MM AM/PM" (e.g. "19 Sep 2026, 09:30 AM").
 * @param {string|Date|null|undefined} dtVal
 * @param {boolean} withSeconds
 * @returns {string}
 */
export function formatDateTime12h(dtVal, withSeconds = false) {
  if (!dtVal) return '--';
  const d = dtVal instanceof Date ? dtVal : new Date(dtVal);
  if (isNaN(d.getTime())) return String(dtVal);

  const dateStr = d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hour12: true,
  });

  return `${dateStr}, ${timeStr}`;
}

/**
 * Formats currency amount into Indian Rupee formatted string (e.g. "₹25,000.00").
 * @param {number|string|null|undefined} amount
 * @param {number} decimals
 * @returns {string}
 */
export function formatCurrencyINR(amount, decimals = 2) {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return '₹0.00';
  return `₹${Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/**
 * Formats a time string, Date object, or ISO timestamp into 24-hour "HH:MM" format
 * suitable for HTML `<input type="time" />` fields without UTC slicing artifacts.
 * @param {string|Date|null|undefined} timeVal
 * @returns {string} e.g. "09:30", "18:00", or ""
 */
export function formatTimeTo24h(timeVal) {
  if (!timeVal) return '';

  if (timeVal instanceof Date) {
    if (isNaN(timeVal.getTime())) return '';
    const hh = String(timeVal.getHours()).padStart(2, '0');
    const mm = String(timeVal.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  const str = String(timeVal).trim();
  if (!str) return '';

  // 1. Direct "HH:MM" or "HH:MM:SS" match
  const hhmmMatch = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (hhmmMatch) {
    return `${hhmmMatch[1].padStart(2, '0')}:${hhmmMatch[2]}`;
  }

  // 2. 12-hour AM/PM format (e.g. "09:30 AM", "6:15 PM")
  const ampmMatch = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const mins = ampmMatch[2];
    const isPM = ampmMatch[3].toUpperCase() === 'PM';
    if (isPM && hours < 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${mins}`;
  }

  // 3. ISO timestamp or date-time string (e.g. "2026-10-01T04:30:00Z")
  if (str.includes('T') || (str.includes('-') && str.includes(':'))) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    }
  }

  return '';
}

