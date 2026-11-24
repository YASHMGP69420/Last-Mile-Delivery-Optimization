/**
 * CSV Formula Injection Neutralization Utility (CWE-1236)
 * Sanitizes spreadsheet execution triggers (=, +, -, @, \t, \r)
 * while preserving valid numeric quantities (coordinates, weights).
 */

const FORMULA_TRIGGERS = new Set(['=', '+', '-', '@', '\t', '\r']);
const PHONE_REGEX = /^\+[0-9\s\-()]{7,25}$/;

/**
 * Sanitize a single CSV cell value
 * @param {any} value
 * @returns {any}
 */
function sanitizeCsvValue(value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (trimmed.length === 0) return value;

  // Preserve valid finite numbers (e.g. '-85.8645' or '+10' or '-1')
  if (!isNaN(Number(trimmed)) && isFinite(Number(trimmed))) {
    return value;
  }

  // Preserve valid international phone numbers starting with + (e.g. '+91 99999 00001')
  if (PHONE_REGEX.test(trimmed) && trimmed.replace(/\D/g, '').length >= 7) {
    return value;
  }

  const firstChar = trimmed.charAt(0);
  if (FORMULA_TRIGGERS.has(firstChar)) {
    return `'${value}`;
  }

  return value;
}

/**
 * Sanitize an entire CSV row (object or array)
 * @param {object|Array} row
 * @returns {object|Array}
 */
function sanitizeCsvRow(row) {
  if (!row || typeof row !== 'object') return row;

  if (Array.isArray(row)) {
    return row.map((val) => sanitizeCsvValue(val));
  }

  const sanitized = {};
  for (const [key, val] of Object.entries(row)) {
    sanitized[key] = sanitizeCsvValue(val);
  }
  return sanitized;
}

module.exports = {
  sanitizeCsvValue,
  sanitizeCsvRow,
};
