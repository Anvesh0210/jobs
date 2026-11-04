/** Input hygiene for free text entered by users or read back from storage. */

// C0/C1 control characters except tab and newline, plus bidi overrides that can disguise text.
const UNSAFE_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F‪-‮⁦-⁩]/g;

export function sanitizeText(value, maxLength) {
  if (typeof value !== 'string') return '';
  const cleaned = value.normalize('NFC').replace(/\r\n?/g, '\n').replace(UNSAFE_CHARS, '').trim();
  // Trim again after truncation so sanitizeText is idempotent (the store relies on this).
  return [...cleaned].slice(0, maxLength).join('').trim();
}

export const LIMITS = Object.freeze({
  message: 1000,
  checkinNote: 400,
  providerNote: 300,
  shortText: 160,
  auditText: 500,
  searchQuery: 100
});
