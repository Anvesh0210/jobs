/** Provider-facing views: continuity worklist, summary drawer, integrations and audit. */
import { html } from '../../lib/html.js';
import { TYPE_LABEL } from '../../domain/actions.js';
import { REASONS, REASON_ORDER, sortWorkItems, filterWorkItems } from '../../domain/worklist.js';
import { chip, notice, tiles, dl, plural } from '../components.js';

const dueState = (clock, due) => {
  if (!due) return 'No due date';
  const n = clock.daysUntil(due);
  return n < 0 ? `Past due by ${plural(-n, 'day')}` : `Due in ${plural(n, 'day')}`;
};

export function dashboard({ svc, clock, seed, ui }) {
  const items = svc.provider.items();
  const flagged = items.filter((i) => i.reason);
  const shown = sortWorkItems(filterWorkItems(items, ui.worklist));
  const orgs = [...new Set(items.map((i) => i.org))];
  const resolved = items.length - flagged.length;
  const row = (i) => {
    const r = REASONS[i.reason]; const contacts = svc.provider.contacts(i.id);
    return html`<li class="work-item">
      <div><h3>${i.patient} · ${i.title}</h3><div class="chips">${chip(r.tone, r.tone === 'attn' ? '!' : 'i', r.label)}</div><span class="muted small-text">${i.org} · ${TYPE_LABEL[i.type]} · item age ${plural(i.age, 'day')}</span></div>
      <div class="small-text"><strong>Acknowledgement:</strong> ${i.ack ? 'Acknowledged' : 'Not acknowledged'}<br><strong>Due state:</strong> ${dueState(clock, i.due)}<br><strong>Last contact:</strong> ${contacts.length ? contacts[contacts.length - 1] : 'none recorded'}</div>
      <button type="button" class="btn secondary" data-do="openSummary" data-id="${i.id}" data-fk="pv-${i.id}">Open summary<span class="sr"> for ${i.patient}, ${i.title}</span></button></li>`;
  };
  return html`<h1 tabindex="-1">Continuity dashboard</h1>
    <p class="lede">Care steps that may need coordination. The list is ordered by explicit rules, not by a risk score.</p>
    ${tiles([[flagged.length, 'Flagged items'], [flagged.filter((i) => i.reason === 'unacknowledged').length, 'Not yet acknowledged'],
      [flagged.filter((i) => ['overdue', 'blocked', 'missing_result'].includes(i.reason)).length, 'Overdue, blocked or missing'], [resolved, 'No longer flagged']])}
    ${seed.SOURCES.some((s) => s.status !== 'ok') ? notice('attn', '⚠', html`<p><strong>Integration warning:</strong> Harbour Pharmacy feed is stale. Items from that source cannot be confirmed. <a href="#/integrations">View integration status</a></p>`) : ''}
    <div class="filter-form spaced">
      <div><label for="pf-r">Reason flagged</label><select id="pf-r" data-change="worklistReason"><option value="all">All reasons</option>${REASON_ORDER.map((k) => html`<option value="${k}"${ui.worklist.reason === k ? html` selected` : ''}>${REASONS[k].label}</option>`)}</select></div>
      <div><label for="pf-o">Organisation</label><select id="pf-o" data-change="worklistOrg"><option value="all">All organisations</option>${orgs.map((o) => html`<option value="${o}"${ui.worklist.org === o ? html` selected` : ''}>${o}</option>`)}</select></div>
    </div>
    <details><summary>How this list is ordered</summary><p class="small-text">Overdue, then blocked, then result not received, then not yet acknowledged, then due soon; ties broken by earliest due date. Not acknowledged is shown separately from overdue so you can tell a missing acknowledgement from a missed step.</p></details>
    <p class="small-text muted" role="status">${plural(shown.length, 'item')} shown. ${resolved} no longer flagged (for example after the patient acts).</p>
    <ul class="work">${shown.length ? shown.map(row) : html`<li>No items match these filters.</li>`}</ul>`;
}

export function summaryDrawer({ svc, seed }, id) {
  const i = svc.provider.get(id);
  if (!i) return html`<p>Item not found.</p><button type="button" class="btn secondary" data-do="closeSummary">Close</button>`;
  const contacts = svc.provider.contacts(i.id);
  const r = i.reason ? REASONS[i.reason] : { label: 'No longer flagged', tone: 'ok', explain: 'This item no longer meets a flag rule.' };
  const src = i.sourceInfo;
  return html`
    <div class="dialog-head"><div><p class="eyebrow">Patient summary (fictional)</p><h2 id="drawer-title">${i.patient} · ${i.title}</h2></div>
      <button type="button" class="btn secondary small" data-do="closeSummary" aria-label="Close summary">Close</button></div>
    <div class="chips">${chip(r.tone, i.reason ? '!' : '✓', r.label)}</div>
    <p class="small-text"><strong>Why flagged:</strong> ${r.explain}</p>
    ${dl([['Requested by', i.requestedBy], ['Next step owner', i.owner], ['Source', `${i.org} · ${i.source}`],
      ['Source status', src && src.status === 'ok' ? `Up to date (${src.last})` : html`<span class="sync-stale">⚠ Feed stale since ${src ? src.last : 'unknown'}. Status may be out of date.</span>`],
      ['Acknowledgement', i.ack ? 'Acknowledged by patient' : 'Not acknowledged'], ['Latest activity', i.activity],
      ['Contact attempts', contacts.length ? html`<ul>${contacts.map((c) => html`<li>${c}</li>`)}</ul>` : 'None recorded']])}
    <form id="pvform" data-form="reminder" data-id="${i.id}">
      <div class="field"><label for="pv-tpl">Pre-approved reminder template</label>
        <select id="pv-tpl" name="template">${seed.REMINDER_TEMPLATES.map((t, idx) => html`<option value="${idx}">${t}</option>`)}</select></div>
      ${contacts.length ? notice('attn', '⚠', html`<p>A contact was already recorded (${contacts[contacts.length - 1]}). Sending another may create duplicate reminders.</p>`) : ''}
      <div class="field"><label for="pv-note">Coordination note (optional)</label><textarea id="pv-note" name="note" maxlength="300"></textarea></div>
      <div class="btn-row"><button class="btn" type="submit">Send reminder (simulated)</button></div>
    </form>
    <p class="hint">Simulated: no message leaves this browser. Every contact is added to the audit log. Escalation follows your organisation's approved protocol; this prototype does not decide escalation.</p>`;
}

export function integrations({ seed }) {
  return html`<h1 tabindex="-1">Integration status</h1>
    <p class="lede">Last successful sync and affected records for each connected source.</p>
    <ul class="list">${seed.SOURCES.map((s) => html`<li class="row-card"><h3>${s.name}</h3>
      <div class="chips">${s.status === 'ok' ? chip('ok', '✓', 'Up to date') : chip('attn', '⚠', 'Source may be out of date')}</div>
      ${dl([['System', s.kind], ['Last successful sync', s.last], ['Affected records', s.affected], ['Failure reason', s.reason || 'None']])}</li>`)}</ul>`;
}

export function auditLog({ svc }) {
  return html`<h1 tabindex="-1">Audit log</h1>
    <p class="lede">Append-only record of access and change events (simulated). Your actions in this demo appear at the top.</p>
    <ol class="list">${svc.audit.list().map((r) => html`<li class="row-card"><strong>${r.what}</strong><br><span class="muted small-text">${r.who} · ${r.t}</span></li>`)}</ol>`;
}
