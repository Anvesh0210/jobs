/** Patient-facing views. Each view is a pure function of (services, clock, seed, ui state) → SafeHtml. */
import { html } from '../../lib/html.js';
import { TYPE_LABEL, availableCommands, isOpen } from '../../domain/actions.js';
import { CHECKIN_OPTIONS } from '../../app/services.js';
import { chip, actionChips, freshness, notice, tiles, dl, plural, filterGroup } from '../components.js';

const EV_TYPES = [['all', 'All'], ['consultation', 'Consultations'], ['test', 'Tests and results'], ['medication', 'Medication'], ['referral', 'Referrals'], ['admission', 'Admission and discharge'], ['followup', 'Follow-ups']];
const EV_LABEL = Object.fromEntries(EV_TYPES);
export const REC_TYPES = Object.freeze({ result: 'Results', letter: 'Letters', summary: 'Summaries' });

function actionButtons(a, scope) {
  const buttons = availableCommands(a).map((c) => html`<button type="button" class="btn ${c.primary ? '' : 'secondary'}" data-do="command" data-command="${c.name}" data-id="${a.id}" data-fk="${scope}-${c.name}-${a.id}">${c.label}</button>`);
  if (isOpen(a) && a.owner === 'patient' && a.type === 'checkin') buttons.push(html`<a class="btn secondary" href="#/overview">Do the check-in on Overview</a>`);
  if (isOpen(a)) {
    buttons.push(html`<button type="button" class="btn secondary" data-do="compose" data-ctx="action:${a.id}" data-fk="${scope}-ask-${a.id}">Ask a question</button>`);
    buttons.push(html`<button type="button" class="btn secondary" data-do="compose" data-ctx="action:${a.id}" data-prefix="problem" data-fk="${scope}-problem-${a.id}">Report a problem</button>`);
  }
  return html`<div class="btn-row">${buttons}</div>`;
}

function staleNotice(seed) {
  const stale = seed.SOURCES.filter((s) => s.status !== 'ok');
  if (!stale.length) return '';
  return notice('attn', '⚠', html`<p><strong>This view may be incomplete.</strong> ${stale.map((s) => s.name).join(', ')} has not updated since ${stale[0].last}, so some medication information may be out of date.</p><p><a href="#/team">See data coverage</a></p>`);
}

function heroCard(a, { clock, seed }) {
  return html`<div class="card hero">
    <div class="eyebrow">Your next step</div>
    <h2>${a.title}</h2>
    ${actionChips(a, clock.today)}
    <p>${a.rationale}</p>
    ${dl([['Requested by', `${a.requestedBy}, ${a.org}`], ['Due', clock.dueText(a.due)], ['Source', html`${a.system} · ${freshness(seed.SOURCES, a.org)}`]])}
    <details><summary>Why is this shown first?</summary><p class="small-text">Open steps that are waiting on you are ordered by (1) past due date, (2) the priority set by the requesting team, then (3) the nearest due date. This is an administrative ordering to help you plan. It is not a measure of clinical urgency.</p></details>
    ${actionButtons(a, 'hero')}
  </div>`;
}

function checkinCard({ svc, clock }, checkin) {
  const safety = 'Check-ins are not monitored in real time. If you feel unwell or worried, contact your care team or, in an emergency, your local emergency number.';
  if (checkin) {
    return html`<section class="card" aria-labelledby="h-ci"><h2 id="h-ci">Wellbeing check-in</h2>
      <p>Saved on ${clock.format(checkin.date)}: <strong>${checkin.value}</strong>.${checkin.note ? html` Your note: “${checkin.note}”` : ''}</p>
      <p class="small-text muted">${safety}</p></section>`;
  }
  const available = isOpen(svc.actions.get('A-1051'));
  return html`<section class="card" aria-labelledby="h-ci"><h2 id="h-ci">Wellbeing check-in</h2>
    ${available ? html`<form id="checkin" data-form="checkin" novalidate>
      <fieldset><legend>How have you been feeling this week?</legend>
        <div class="radio-row">${CHECKIN_OPTIONS.map((v) => html`<label><input type="radio" name="mood" value="${v}">${v}</label>`)}</div>
      </fieldset>
      <div class="field"><label for="ci-note">Anything you would like to share (optional)</label><textarea id="ci-note" name="note" maxlength="400"></textarea></div>
      <p class="hint">${safety}</p>
      <p id="ci-err" class="form-error" role="alert"></p>
      <button class="btn" type="submit">Save check-in</button>
    </form>` : html`<p>No check-in is due this week.</p>`}</section>`;
}

export function overview(ctx) {
  const { svc, clock, seed } = ctx;
  const c = svc.actions.summary(); const hero = svc.actions.next();
  const bloodTest = svc.actions.get('A-1042');
  const testDone = bloodTest.status === 'completed';
  const step = (state, n, title, sub) => html`<li class="${state}"${state === 'current' ? html` aria-current="step"` : ''}><span class="dot" aria-hidden="true">${state === 'done' ? '✓' : n}</span><div><span class="step-title">${title}</span><br><span class="muted small-text">${sub}</span></div></li>`;
  return html`
    <h1 tabindex="-1">Good morning, ${seed.PATIENT.first}</h1>
    <p class="lede">Here is where your care stands on ${clock.longToday()}. Everything shown comes from your connected care providers.</p>
    ${staleNotice(seed)}
    <section class="section" aria-labelledby="h-next">
      <h2 id="h-next" class="sr">What needs your attention now</h2>
      ${hero ? heroCard(hero, ctx) : html`<div class="card hero"><div class="eyebrow">Next step</div><h2>Nothing needs your attention right now</h2><p>Based on what your connected providers have shared, no open steps are waiting on you. Some sources may update later.</p></div>`}
    </section>
    <section class="section" aria-labelledby="h-counts"><h2 id="h-counts" class="sr">Your actions at a glance</h2>
      ${tiles([[c.open, 'Open actions'], [c.pastDue, 'Past due date'], [c.awaitingProvider, 'Waiting on a provider'], [c.completed, 'Completed']])}
      <p class="hint">Counts update when you act. <a href="#/actions">Go to Action centre</a></p>
    </section>
    <div class="grid two section">
      <section class="card" aria-labelledby="h-prog">
        <h2 id="h-prog">Care progress</h2>
        <p class="muted small-text">${seed.EPISODES['EP-1']}</p>
        <ol class="steps">
          ${step('done', 1, 'GP appointment', '21 Oct · Completed')}
          ${step('done', 2, 'Medication dose changed', '21 Oct · Completed')}
          ${step('done', 3, 'Blood test requested', '2 Nov · Completed')}
          ${step(testDone ? 'done' : 'current', 4, 'Blood test taken', testDone ? 'Reported by you, awaiting confirmation from the lab' : `Waiting for you · ${clock.dueText(bloodTest.due)}`)}
          ${step('', 5, 'Result received and reviewed', 'Not yet received')}
        </ol>
      </section>
      <section class="card" aria-labelledby="h-appt">
        <h2 id="h-appt">Next appointment</h2>
        <p><strong>Cardiology outpatient clinic</strong><br>18 November 2026, 10:20<br>Outpatients Level 2, Northbank Hospital</p>
        <div class="chips">${chip('info', '◷', 'Scheduled')}${chip('ok', '✓', 'Verified by Northbank Hospital')}</div>
        <p class="small-text">${freshness(seed.SOURCES, 'Northbank Hospital')}</p>
        <h3>Recent change and result</h3>
        <ul class="small-text list">
          <li><strong>Change:</strong> Ramipril dose changed, 21 Oct. <a href="#/meds">View medications</a></li>
          <li><strong>Result:</strong> Cholesterol blood test received, 25 Oct. <a href="#/records">View records</a></li>
        </ul>
      </section>
    </div>
    <div class="grid two section">
      <section class="card" aria-labelledby="h-act">
        <h2 id="h-act">Recent activity</h2>
        <ul class="list">${seed.EVENTS.slice(0, 4).map((e) => html`<li><span class="tl-date">${clock.format(e.date, { day: 'numeric', month: 'short' })}</span> · ${e.title}<br><span class="muted small-text">${e.org}</span></li>`)}</ul>
        <p class="section"><a href="#/journey">See your full care journey</a></p>
      </section>
      ${checkinCard(ctx, ctx.state.checkin)}
    </div>
    <section class="card section" aria-labelledby="h-team">
      <h2 id="h-team">Your care team</h2>
      <ul class="grid two">${seed.TEAM.map((t) => html`<li><strong>${t.name}</strong><br>${t.role} · ${t.org}<br><span class="muted small-text">${t.note}</span></li>`)}</ul>
      <div class="btn-row"><a class="btn secondary" href="#/messages">Send a non-urgent message</a></div>
    </section>`;
}

export function journey({ clock, seed, ui }) {
  const list = seed.EVENTS.filter((e) => ui.timeline === 'all' || e.type === ui.timeline);
  const card = (e) => html`<li class="tl-item">
    <div class="tl-date">${clock.format(e.date)}</div>
    <h3>${e.title}</h3>
    <div class="chips">${chip('info', '•', EV_LABEL[e.type])}${e.episode ? chip('neutral', '⛓', `Episode: ${seed.EPISODES[e.episode]}`) : ''}</div>
    <p class="small-text">${e.detail}</p>
    <details><summary>Source and provenance</summary>
      ${dl([['Organisation', e.org], ['Author', e.author], ['Source system', e.system], ['Event date', clock.format(e.date)],
        ['Received', `${clock.format(e.recv)}${e.recv !== e.date ? ' (arrived after the event)' : ''}`], ['Correction state', 'No corrections or flagged errors'], ['Freshness', freshness(seed.SOURCES, e.org)]])}
    </details></li>`;
  let body;
  if (!list.length) body = html`<p>No events match this filter.</p>`;
  else if (ui.groupEpisodes) {
    const keys = [...new Set(list.map((e) => e.episode || 'none'))];
    body = keys.map((k) => {
      const title = k === 'none' ? 'Not part of an episode' : seed.EPISODES[k];
      return html`<section class="episode-group" aria-label="${title}"><h3>${title}</h3><ol class="timeline">${list.filter((e) => (e.episode || 'none') === k).map(card)}</ol></section>`;
    });
  } else body = html`<ol class="timeline">${list.map(card)}</ol>`;
  return html`<h1 tabindex="-1">Care journey</h1>
    <p class="lede">Events from all your connected providers, newest first. Related events can be grouped into an episode.</p>
    ${filterGroup('Filter events by type', 'timeline', EV_TYPES, ui.timeline)}
    <label class="toggle"><input type="checkbox" id="tl-group" data-change="groupEpisodes"${ui.groupEpisodes ? html` checked` : ''}> Group related events into episodes</label>
    <p class="small-text muted" role="status">Showing ${list.length} of ${seed.EVENTS.length} events.</p>
    <div class="stack">${body}</div>`;
}

export function actionCentre({ svc, clock, seed, ui }) {
  const all = svc.actions.list(); const c = svc.actions.summary();
  const list = all.filter((a) => ui.actionTab === 'all' || (ui.actionTab === 'open' ? isOpen(a) : a.status === 'completed'))
    .sort((x, y) => (Number(isOpen(y)) - Number(isOpen(x))) || (x.priority - y.priority));
  const eventTitle = (id) => (seed.EVENTS.find((e) => e.id === id) || { title: id }).title;
  const card = (a) => html`<li class="row-card" id="${a.id}">
    <div class="meta"><span>${TYPE_LABEL[a.type]}</span><span>${a.due ? clock.dueText(a.due) : a.scheduledNote || 'No due date'}</span></div>
    <h3>${a.title}</h3>
    ${actionChips(a, clock.today)}
    <p>${a.rationale}</p>
    <p class="small-text"><strong>Who has the next step:</strong> ${a.responsible}</p>
    ${a.status === 'completed' ? html`<p class="small-text"><strong>Completion evidence:</strong> ${a.evidence || 'None yet. Reported by you and awaiting confirmation from your care team.'}</p>` : ''}
    ${actionButtons(a, 'ac')}
    <details data-details="${a.id}"${ui.openDetails.has(a.id) ? html` open` : ''}><summary>Details, source and history</summary>
      ${dl([['Requested by', a.requestedBy], ['Organisation', a.org], ['Source system', a.system], ['Last updated', html`${clock.format(a.updated)} · ${freshness(seed.SOURCES, a.org)}`], ['Related events', a.links.length ? a.links.map(eventTitle).join('; ') : 'None']])}
      <h4 class="small-text">Status history (cannot be edited)</h4>
      <ol class="history">${a.history.map((h) => html`<li><strong>${h.what}</strong><br><span class="muted">${h.who} · ${h.t}</span></li>`)}</ol>
    </details></li>`;
  return html`<h1 tabindex="-1">Action centre</h1>
    <p class="lede">Every next step in your care, who requested it, who owns it and what state it is in.</p>
    ${tiles([[c.open, 'Open'], [c.pastDue, 'Past due date'], [c.awaitingProvider, 'Waiting on a provider'], [c.completed, 'Completed']])}
    ${notice('', 'i', html`<p>When you mark something done, it is recorded as <strong>patient-reported</strong>. It becomes <strong>verified</strong> only when the source provider confirms it.</p>`)}
    ${filterGroup('Show actions', 'tab', [['open', 'Open'], ['completed', 'Completed'], ['all', 'All']], ui.actionTab)}
    ${list.length ? html`<ul class="list">${list.map(card)}</ul>` : html`<p>No actions in this view.</p>`}`;
}

export function filterRecords(records, { query, type }) {
  const q = query.trim().toLowerCase();
  return records.filter((r) => (type === 'all' || r.type === type) && (!q || `${r.title} ${r.official} ${r.org}`.toLowerCase().includes(q)));
}

export function recordItems({ clock, seed, ui }) {
  const list = filterRecords(seed.RECORDS, ui.records);
  return {
    count: list.length,
    html: list.length ? html`${list.map((r) => html`<li class="row-card">
      <div class="meta"><span>${REC_TYPES[r.type]}</span><span>Received ${clock.format(r.date)}</span></div>
      <h3>${r.title}</h3>
      <p class="small-text">Official title: <code>${r.official}</code><br>${r.org} · ${freshness(seed.SOURCES, r.org)}</p>
      <p class="small-text">${r.flag || 'No interpretation label was supplied by the source. HEALNEXIA does not interpret results.'}</p>
      <div class="chips">${chip('ok', '✓', 'Result received')}</div></li>`)}` : html`<li>No records match your search.</li>`
  };
}

export function records(ctx) {
  const { ui } = ctx; const r = recordItems(ctx);
  return html`<h1 tabindex="-1">Health records</h1>
    <p class="lede">Documents and results from your providers. Titles are shown in plain language with the official source title underneath.</p>
    <div class="filter-form">
      <div><label for="rec-q">Search records</label><input id="rec-q" type="search" maxlength="100" autocomplete="off" data-input="recordQuery" value="${ui.records.query}" placeholder="For example: cholesterol, Northbank"></div>
      <div><label for="rec-t">Type</label><select id="rec-t" data-change="recordType"><option value="all">All types</option>${Object.entries(REC_TYPES).map(([k, l]) => html`<option value="${k}"${ui.records.type === k ? html` selected` : ''}>${l}</option>`)}</select></div>
    </div>
    <p id="rec-count" class="small-text muted spaced" role="status">${plural(r.count, 'record')} shown.</p>
    <ul class="list" id="rec-list">${r.html}</ul>`;
}

export function medications({ svc, clock, seed }) {
  const pharmacy = seed.SOURCES.find((s) => s.name === 'Harbour Pharmacy');
  return html`<h1 tabindex="-1">Medications</h1>
    <p class="lede">Your current medicines as recorded by your providers, with a visible history of changes.</p>
    ${notice('attn', '⚠', html`<p><strong>Always follow the instructions on your medicine label and from your prescriber.</strong> This page does not give dosing advice. Report suspected side effects or urgent symptoms to a clinician or emergency service, not through messages.</p>${pharmacy.status !== 'ok' ? html`<p>Harbour Pharmacy data is out of date (last updated ${pharmacy.last}).</p>` : ''}`)}
    <ul class="list">${seed.MEDS.map((m) => html`<li class="row-card">
      <h3>${m.name}</h3>
      ${m.discrepancy ? html`<div class="chips">${chip('warn', '▲', 'Sources disagree')}</div><p>${m.discrepancy}</p>` : html`<div class="chips">${chip('ok', '✓', `Reconciled ${clock.format(m.reconciled)}`)}</div>`}
      ${dl([['Schedule (from source)', m.schedule], ['Reason', m.indication], ['Prescriber', m.prescriber], ['Source', m.source], ['Review date', m.review ? clock.format(m.review) : 'Not set']])}
      <details><summary>Change history</summary><ol class="history">${m.history.map((h) => html`<li><strong>${h.d}</strong><br>${h.t}</li>`)}</ol></details>
      <div class="btn-row"><button type="button" class="btn secondary" data-do="compose" data-ctx="med:${m.id}" data-fk="med-ask-${m.id}">Ask about this medicine</button></div>
      <label class="toggle"><input type="checkbox" data-change="reminder" data-med="${m.id}"${svc.preferences.reminderOn(m.id) ? html` checked` : ''}> Remind me about this medicine</label>
      <p class="hint">Prototype: no notifications are sent. Reminders are prompts only and do not record whether you have taken a medicine.</p>
    </li>`)}</ul>`;
}

export function messages({ svc, ui }) {
  const draft = ui.compose || { ctx: 'general', text: '' };
  return html`<h1 tabindex="-1">Messages</h1>
    <p class="lede">Non-urgent messages linked to a care step, so you never have to retell your story.</p>
    ${notice('warn', '▲', html`<p><strong>Messages are not for emergencies or urgent symptoms.</strong> Expected reply: within 2 working days (fictional). For urgent help call your local emergency number.</p>`)}
    <section class="card" aria-labelledby="h-new"><h2 id="h-new">New message</h2>
      <form id="msgform" data-form="message" novalidate>
        <div class="field"><label for="m-ctx">About</label>
          <select id="m-ctx" name="ctx" data-change="messageContext">${svc.contexts.options().map((o) => html`<option value="${o.value}"${o.value === draft.ctx ? html` selected` : ''}>${o.label}</option>`)}</select>
          <p class="hint" id="m-to">To: ${svc.contexts.describe(draft.ctx).withWho}</p></div>
        <div class="field"><label for="m-text">Your message</label><textarea id="m-text" name="text" maxlength="1000" aria-describedby="m-err">${draft.text}</textarea></div>
        <p id="m-err" role="alert" class="form-error"></p>
        <button class="btn" type="submit" id="m-send">Send message</button>
      </form></section>
    <section class="section" aria-labelledby="h-conv"><h2 id="h-conv">Conversations</h2>
      <ul class="list">${svc.messages.list().map((c) => html`<li class="row-card"><h3>${c.subject}</h3><p class="small-text muted">With ${c.withWho}</p>
        <ul class="thread">${c.msgs.map((m) => html`<li class="msg${m.me ? ' me' : ''}"><span class="who">${m.who}</span> <span class="when">${m.t}</span><br><span class="msg-text">${m.text}</span><br><span class="when">${m.status}</span></li>`)}</ul></li>`)}</ul></section>`;
}

export function careTeam({ seed }) {
  return html`<h1 tabindex="-1">Care team and sharing</h1>
    <p class="lede">The organisations connected to HEALNEXIA, and how up to date each one is.</p>
    <section class="card" aria-labelledby="h-cov"><h2 id="h-cov">Data coverage</h2>
      <ul class="list">${seed.SOURCES.map((s) => html`<li><strong>${s.name}</strong> · ${s.kind}<br>${s.status === 'ok' ? chip('ok', '✓', 'Up to date') : chip('attn', '⚠', 'Source may be out of date')} <span class="muted small-text">Last updated ${s.last}</span></li>`)}</ul>
      <p class="hint">HEALNEXIA shows what connected sources have shared. It is not a complete medical record.</p></section>
    <section class="card section" aria-labelledby="h-prof"><h2 id="h-prof">Professionals</h2>
      <ul class="grid two">${seed.TEAM.map((t) => html`<li><strong>${t.name}</strong><br>${t.role}, ${t.org}<br><span class="muted small-text">${t.note}</span></li>`)}</ul></section>
    ${notice('', 'i', html`<p>Consent management, proxy access and time-limited sharing are part of the planned product but are not included in this prototype.</p>`)}`;
}
