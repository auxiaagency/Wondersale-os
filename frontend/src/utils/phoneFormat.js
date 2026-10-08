/**
 * Standard Phone Number Utilities for Retail POS & Workforce Directory.
 * Formats 10-digit Indian numbers cleanly as `+91 98765 43210`.
 * Preserves international numbers starting with `+` cleanly.
 * Strictly prevents non-numeric characters (letters, symbols).
 */

export function sanitizePhoneNumber(value) {
  if (!value) return '';
  const hasPlus = String(value).trim().startsWith('+');
  const digits = String(value).replace(/\D/g, '');
  if (hasPlus) return `+${digits}`;
  return digits;
}

export function isValidPhoneNumber(value) {
  if (!value) return false;
  const str = String(value).trim();
  // Reject any alphabetical letters or illegal characters
  if (/[a-zA-Z]/.test(str)) return false;
  const digits = str.replace(/\D/g, '');
  // Valid telephone number: between 10 and 15 digits (E.164 standard)
  return digits.length >= 10 && digits.length <= 15;
}

export function formatPhoneNumber(value) {
  if (!value) return '';
  const str = String(value).trim();
  const digits = str.replace(/\D/g, '');

  if (!digits) return '';

  // 10-digit Indian standard: +91 XXXXX XXXXX
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }

  // 12-digit starting with 91: +91 XXXXX XXXXX
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }

  // 11-digit starting with 0: +91 XXXXX XXXXX
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91 ${digits.slice(1, 6)} ${digits.slice(6)}`;
  }

  // If already starts with + and has space/formatting, return as is (without letters)
  if (str.startsWith('+')) {
    return `+${digits}`;
  }

  return digits;
}

export function handlePhoneInputChange(rawValue) {
  // Real-time input sanitizer: strictly allows only digits and optional leading '+'
  if (!rawValue) return '';
  const str = String(rawValue);
  const hasPlus = str.startsWith('+');
  // Strip ALL non-digit characters
  const digits = str.replace(/\D/g, '');

  if (hasPlus) {
    if (digits.length === 0) return '+';
    if (digits.startsWith('91')) {
      const local = digits.slice(2, 12);
      if (local.length <= 5) return `+91 ${local}`;
      return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
    }
    return `+${digits.slice(0, 15)}`;
  }

  // Direct digits entered without +
  if (digits.length <= 5) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7, 12)}`;
  }
  return digits.slice(0, 15);
}
