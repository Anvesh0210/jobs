/**
 * Persisted-state schema, migration and sanitisation.
 *
 * Anything read back from storage is treated as untrusted input: it may be stale, corrupted,
 * edited by hand, or written by an older version. We never trust it structurally. Unknown keys
 * are dropped, enums are checked, strings are length-limited and arrays are capped.
 */
import { STATUSES, VERIFICATIONS } from '../domain/actions.js';
import { sanitizeText, LIMITS } from '../lib/text.js';
import { isIsoDate } from '../lib/clock.js';

export const SCHEMA_VERSION = 2;
export const CAPS = Object.freeze({ history: 100, conversations: 50, messages: 200, audit: 500, contacts: 50 });

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const str = (v, max = LIMITS.shortText) => sanitizeText(v, max);
const takeLast = (arr, n) => (Array.isArray(arr) ? arr.slice(-n) : []);

export function emptyState(seedConversations) {
  return {
    v: SCHEMA_VERSION,
    actions: {},
    reminders: {},
    conversations: structuredClone(seedConversations),
    checkin: null,
    audit: [],
    contacts: {}
  };
}

function sanitizeEntry(e) {
  if (!isPlainObject(e)) return null;
  const what = str(e.what, LIMITS.auditText);
  return what ? { t: str(e.t, 40), who: str(e.who, 120), what } : null;
}

function sanitizeActionOverride(o) {
  if (!isPlainObject(o)) return null;
  const out = {};
  if (STATUSES.includes(o.status)) out.status = o.status;
  if (VERIFICATIONS.includes(o.verification)) out.verification = o.verification;
  if (o.completedAt === null || isIsoDate(o.completedAt)) out.completedAt = o.completedAt;
  if (o.evidence === null) out.evidence = null;
  out.hist = takeLast(o.hist, CAPS.history).map(sanitizeEntry).filter(Boolean);
  return out;
}

function sanitizeMessage(m) {
  if (!isPlainObject(m)) return null;
  const text = str(m.text, LIMITS.message);
  return text ? { me: m.me === true, who: str(m.who, 120), t: str(m.t, 40), text, status: str(m.status, 80) } : null;
}

function sanitizeConversation(c, isKnownContext) {
  if (!isPlainObject(c) || typeof c.ctx !== 'string' || !isKnownContext(c.ctx)) return null;
  const id = /^[a-z0-9-]{1,40}$/i.test(c.id) ? c.id : null;
  if (!id) return null;
  return {
    id, ctx: c.ctx, subject: str(c.subject), withWho: str(c.withWho),
    msgs: takeLast(c.msgs, CAPS.messages).map(sanitizeMessage).filter(Boolean)
  };
}

/** v1 (first prototype) → v2 key names. */
function migrate(input) {
  if (input.v === 1) {
    return { v: 2, actions: input.act, reminders: input.remind, conversations: input.convos, checkin: input.checkin, audit: input.audit, contacts: input.sent };
  }
  return input;
}

/**
 * @returns {{ state: object, repaired: boolean }} a fully valid state. `repaired` is true when
 *   anything had to be dropped or reset, so the UI can tell the user.
 */
export function sanitizeState(input, ctx) {
  const { actionIds, medIds, workIds, isKnownContext, seedConversations } = ctx;
  if (!isPlainObject(input) || (input.v !== 1 && input.v !== SCHEMA_VERSION)) {
    return { state: emptyState(seedConversations), repaired: input !== null && input !== undefined };
  }
  const src = migrate(input);
  const state = emptyState([]);

  if (isPlainObject(src.actions)) {
    for (const id of actionIds) {
      if (Object.hasOwn(src.actions, id)) {
        const o = sanitizeActionOverride(src.actions[id]);
        if (o) state.actions[id] = o;
      }
    }
  }
  if (isPlainObject(src.reminders)) {
    for (const id of medIds) if (src.reminders[id] === true) state.reminders[id] = true;
  }
  state.conversations = Array.isArray(src.conversations)
    ? takeLast(src.conversations, CAPS.conversations).map((c) => sanitizeConversation(c, isKnownContext)).filter(Boolean)
    : structuredClone(seedConversations);
  if (isPlainObject(src.checkin) && isIsoDate(src.checkin.date)) {
    const value = str(src.checkin.value, 40);
    if (value) state.checkin = { date: src.checkin.date, value, note: str(src.checkin.note, LIMITS.checkinNote) };
  }
  state.audit = takeLast(src.audit, CAPS.audit).map(sanitizeEntry).filter(Boolean);
  if (isPlainObject(src.contacts)) {
    for (const id of workIds) {
      if (Array.isArray(src.contacts[id])) {
        const list = takeLast(src.contacts[id], CAPS.contacts).map((s) => str(s, 240)).filter(Boolean);
        if (list.length) state.contacts[id] = list;
      }
    }
  }
  const repaired = src === input && canonical(state) !== canonical(input);
  return { state, repaired };
}

/** Key-order-independent JSON, used to detect whether sanitisation changed anything. */
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).filter((k) => value[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** Appends to a capped, append-only list without mutating the original. */
export const appendCapped = (list, item, cap) => [...list, item].slice(-cap);
