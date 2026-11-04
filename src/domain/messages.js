/** Messaging rules: validation and the governed urgent-language backstop (PRD 7.7, 10). */
import { sanitizeText, LIMITS } from '../lib/text.js';

/**
 * Backstop only. It never replaces the persistent urgent-care warning, and a production
 * version would need clinically governed wording and evaluation.
 */
const URGENT_PATTERNS = [
  /chest\s+pain/i, /can'?t\s+breathe/i, /cannot\s+breathe/i, /struggling\s+to\s+breathe/i, /collaps/i, /overdose/i,
  /suicid/i, /self[-\s]?harm/i, /kill\s+myself/i, /severe\s+bleeding/i, /stroke/i, /unconscious/i, /allergic\s+reaction/i, /anaphyla/i
];

export const looksUrgent = (text) => URGENT_PATTERNS.some((p) => p.test(text));

export function validateMessage(input) {
  const text = sanitizeText(input, LIMITS.message);
  if (!text) return { ok: false, error: 'Please write a message first.' };
  if (typeof input === 'string' && [...input.trim()].length > LIMITS.message) {
    return { ok: false, error: `Messages can be up to ${LIMITS.message} characters.` };
  }
  return { ok: true, text };
}

/** Context keys are a closed set: "general", "pharmacist", "action:<id>" or "med:<id>". */
export function parseContext(ctx, { actionIds, medIds }) {
  if (ctx === 'general') return { kind: 'general' };
  if (ctx === 'pharmacist') return { kind: 'pharmacist' };
  const m = /^(action|med):([A-Za-z0-9-]{1,32})$/.exec(String(ctx));
  if (!m) return null;
  const [, kind, id] = m;
  if (kind === 'action' && actionIds.includes(id)) return { kind, id };
  if (kind === 'med' && medIds.includes(id)) return { kind, id };
  return null;
}
