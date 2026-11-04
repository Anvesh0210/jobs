/**
 * Provider continuity worklist. Flags come from explicit, ordered rules (PRD 7.8) —
 * never from an opaque score.
 */
import { isOpen, isPastDue } from './actions.js';

export const REASONS = Object.freeze({
  overdue: { label: 'Overdue', tone: 'attn', explain: 'The due date has passed and the step is not complete.' },
  blocked: { label: 'Blocked', tone: 'attn', explain: 'The step cannot progress until another party or source responds.' },
  missing_result: { label: 'Result not received', tone: 'attn', explain: 'The step is reported done but no result has arrived from the source.' },
  unacknowledged: { label: 'Not yet acknowledged', tone: 'info', explain: 'The patient has not seen or acknowledged this step. This is an administrative flag, not a clinical urgency.' },
  approaching_due: { label: 'Due soon', tone: 'info', explain: 'The due date is within 7 days and the step is not complete.' }
});
export const REASON_ORDER = Object.freeze(Object.keys(REASONS));

/** Rules evaluated in order against a live CareAction; the first match is the flag. */
const LIVE_RULES = [
  { reason: 'overdue', test: (a, today) => isPastDue(a, today) },
  { reason: 'blocked', test: (a) => a.status === 'blocked' },
  { reason: 'unacknowledged', test: (a) => a.status === 'unacknowledged' }
];

export function flagFor(action, today) {
  if (!isOpen(action)) return null;
  const rule = LIVE_RULES.find((r) => r.test(action, today));
  return rule ? rule.reason : null;
}

/**
 * @param {ReadonlyArray} work seed worklist entries
 * @param {(id: string) => object} getAction resolves live patient actions
 * @param {ReadonlyArray} sources integration sources (to attach freshness)
 */
export function deriveWorkItems(work, getAction, sources, today) {
  const sourceFor = (org) => sources.find((s) => s.name === org) || null;
  return work.map((w) => {
    if (!w.actionId) return { ...w, live: false, sourceInfo: sourceFor(w.org) };
    const a = getAction(w.actionId);
    const last = a.history[a.history.length - 1];
    return {
      id: w.id, actionId: a.id, patient: w.patient, age: w.age, live: true,
      type: a.type, title: a.title, org: a.org, source: a.system, requestedBy: a.requestedBy, owner: a.responsible,
      due: a.due, ack: a.status !== 'unacknowledged' && a.status !== 'created',
      reason: flagFor(a, today), sourceInfo: sourceFor(a.org),
      activity: last ? `Last status change: ${last.what} (${last.t})` : 'No activity recorded'
    };
  });
}

export function sortWorkItems(items) {
  return [...items].sort((a, b) => (REASON_ORDER.indexOf(a.reason) - REASON_ORDER.indexOf(b.reason))
    || String(a.due || '9999').localeCompare(String(b.due || '9999')));
}

export function filterWorkItems(items, { reason = 'all', org = 'all' } = {}) {
  return items.filter((i) => i.reason && (reason === 'all' || i.reason === reason) && (org === 'all' || i.org === org));
}
