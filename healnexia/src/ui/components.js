/** Small presentational components. Status is always text + icon, never colour alone. */
import { html } from '../lib/html.js';
import { isPastDue } from '../domain/actions.js';

export const chip = (tone, icon, text) => html`<span class="chip ${tone}"><span aria-hidden="true">${icon}</span>${text}</span>`;

const STATUS_CHIP = {
  created: ['neutral', '○', 'New'], unacknowledged: ['attn', '!', 'Needs attention'], acknowledged: ['info', '◐', 'Acknowledged'],
  scheduled: ['info', '◷', 'Scheduled'], in_progress: ['info', '↻', 'In progress'], blocked: ['attn', '⏸', 'Awaiting booking'],
  completed: ['ok', '✓', 'Completed'], cancelled: ['neutral', '×', 'Cancelled']
};
export const statusChip = (status) => chip(...(STATUS_CHIP[status] || ['neutral', '•', 'Unknown']));

export const verificationChip = (a) => (a.verification === 'reported'
  ? chip('neutral', '◌', 'Patient-reported, not yet verified')
  : chip('ok', '✓', `Verified by ${a.org}`));

export const actionChips = (a, today) => html`<div class="chips">${statusChip(a.status)}${isPastDue(a, today) ? chip('attn', '!', 'Past due date') : ''}${verificationChip(a)}</div>`;

export function freshness(sources, orgName) {
  const s = sources.find((x) => x.name === orgName);
  if (!s) return '';
  return s.status === 'ok'
    ? html`<span class="muted small-text">Source updated ${s.last}</span>`
    : html`<span class="sync-stale small-text"><span aria-hidden="true">⚠ </span>Source may be out of date (last updated ${s.last})</span>`;
}

export const notice = (tone, icon, body) => html`<div class="notice ${tone}"><span aria-hidden="true">${icon}</span><div>${body}</div></div>`;

export const tiles = (items) => html`<ul class="tiles">${items.map(([n, label]) => html`<li><strong>${n}</strong><span>${label}</span></li>`)}</ul>`;

export const dl = (rows) => html`<dl class="dl">${rows.filter(Boolean).map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl>`;

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Toggle-button group; pressed state exposed via aria-pressed. */
export const filterGroup = (label, attr, options, current) => html`<div class="filters" role="group" aria-label="${label}">${options.map(([value, text]) => html`<button type="button" data-${attr}="${value}" data-fk="${attr}-${value}" aria-pressed="${String(current === value)}">${text}</button>`)}</div>`;
