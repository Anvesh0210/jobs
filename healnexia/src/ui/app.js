/**
 * UI controller: routing, rendering, focus management and event delegation.
 * Handlers are looked up in small registries keyed by data-* attributes (open/closed:
 * adding a control means adding an entry, not editing a switch statement).
 */
import { html, mount } from '../lib/html.js';
import { sanitizeText, LIMITS } from '../lib/text.js';
import { DomainError } from '../domain/actions.js';
import * as patient from './views/patient.js';
import * as provider from './views/provider.js';

export const ROUTES = Object.freeze({
  overview: { title: 'Overview', persona: 'patient', view: patient.overview },
  journey: { title: 'Care journey', persona: 'patient', view: patient.journey },
  actions: { title: 'Action centre', persona: 'patient', view: patient.actionCentre },
  records: { title: 'Health records', persona: 'patient', view: patient.records },
  meds: { title: 'Medications', persona: 'patient', view: patient.medications },
  messages: { title: 'Messages', persona: 'patient', view: patient.messages },
  team: { title: 'Care team and sharing', persona: 'patient', view: patient.careTeam },
  dashboard: { title: 'Continuity dashboard', persona: 'provider', view: provider.dashboard },
  integrations: { title: 'Integration status', persona: 'provider', view: provider.integrations },
  audit: { title: 'Audit log', persona: 'provider', view: provider.auditLog }
});

export function parseRoute(hash) {
  const m = /^#\/([a-z]{1,20})$/.exec(hash || '');
  return m && Object.hasOwn(ROUTES, m[1]) ? m[1] : 'overview';
}

const COMPOSE_PREFIX = Object.freeze({ problem: 'Problem with this step: ' });

export function createApp({ doc, win, store, svc, clock, seed }) {
  const $ = (sel) => doc.querySelector(sel);
  const el = { main: $('#main'), nav: $('#nav'), live: $('#live'), status: $('#app-status'), drawer: $('#drawer'), patientLink: $('#p-patient'), providerLink: $('#p-provider') };
  const ui = {
    timeline: 'all', groupEpisodes: false, actionTab: 'open', openDetails: new Set(),
    compose: null, urgentConfirmed: false, records: { query: '', type: 'all' },
    worklist: { reason: 'all', org: 'all' }, drawerId: null, dismissedStatus: false
  };
  let route = parseRoute(win.location.hash);

  const ctx = () => ({ svc, clock, seed, ui, state: store.getState() });

  function announce(message) {
    el.live.textContent = '';
    win.setTimeout(() => { el.live.textContent = message; }, 30);
  }

  function renderStatus() {
    const s = store.status();
    const parts = [];
    if (s.repaired && !ui.dismissedStatus) parts.push(html`<p>Some saved demo data in this browser was invalid and has been reset.</p>`);
    if (!s.persistent) parts.push(html`<p>Browser storage is unavailable, so your changes last only until you close this tab.</p>`);
    mount(el.status, parts.length ? html`<div class="notice attn" role="status"><span aria-hidden="true">⚠</span><div>${parts}</div></div>` : html``);
  }

  function renderNav() {
    const persona = ROUTES[route].persona;
    const open = svc.actions.summary().open;
    const items = Object.entries(ROUTES).filter(([, r]) => r.persona === persona);
    mount(el.nav, html`<ul>${items.map(([key, r]) => html`<li><a href="#/${key}"${key === route ? html` aria-current="page"` : ''}>${r.title}${key === 'actions' && open ? html`<span class="nav-badge"><span class="sr">, </span>${open}<span class="sr"> open</span></span>` : ''}</a></li>`)}</ul>`);
    el.patientLink.setAttribute('aria-current', persona === 'patient' ? 'page' : 'false');
    el.providerLink.setAttribute('aria-current', persona === 'provider' ? 'page' : 'false');
  }

  function renderError(err) {
    win.console.error(err);
    mount(el.main, html`<h1 tabindex="-1">Something went wrong</h1><p>This page could not be shown. Your saved demo data has not been changed.</p><div class="btn-row"><a class="btn secondary" href="#/overview">Go to Overview</a><button type="button" class="btn" data-do="reset">Reset demo</button></div>`);
  }

  /**
   * @param {boolean} navigated true after a route change: scroll to top and move focus to the new view.
   * @param {boolean} moveFocus false on first load so keyboard users start at the skip link.
   */
  function render(navigated = false, moveFocus = navigated) {
    const focusKey = navigated ? null : doc.activeElement?.dataset?.fk;
    const scroll = win.scrollY;
    try {
      mount(el.main, ROUTES[route].view(ctx()));
      renderNav();
      renderStatus();
      if (ui.drawerId && el.drawer.open) mount(el.drawer, provider.summaryDrawer(ctx(), ui.drawerId));
    } catch (err) {
      renderError(err);
    }
    doc.title = `${ROUTES[route].title} · HEALNEXIA prototype`;
    if (navigated) {
      win.scrollTo(0, 0);
      const target = route === 'messages' && ui.compose ? $('#m-text') : $('#main h1');
      if (target && moveFocus) { target.focus(); if (target.tagName === 'TEXTAREA') target.setSelectionRange(target.value.length, target.value.length); }
    } else {
      win.scrollTo(0, scroll);
      if (focusKey) doc.querySelector(`[data-fk="${CSS.escape(focusKey)}"]`)?.focus();
    }
  }

  function navigate(to) {
    if (`#/${to}` === win.location.hash) render(true);
    else win.location.hash = `#/${to}`;
  }

  function openSummary(id) {
    ui.drawerId = id;
    mount(el.drawer, provider.summaryDrawer(ctx(), id));
    if (!el.drawer.open) el.drawer.showModal();
  }

  /* ----- registries ----- */
  const clicks = {
    command: (t) => { announce(svc.actions.run(t.dataset.id, t.dataset.command)); render(); },
    compose: (t) => {
      const context = svc.contexts.isKnown(t.dataset.ctx) ? t.dataset.ctx : 'general';
      ui.compose = { ctx: context, text: COMPOSE_PREFIX[t.dataset.prefix] || '' };
      ui.urgentConfirmed = false;
      navigate('messages');
    },
    openSummary: (t) => openSummary(t.dataset.id),
    closeSummary: () => el.drawer.close(),
    reset: () => {
      if (!win.confirm('Reset all demo interactions in this browser?')) return;
      svc.reset(); ui.compose = null; ui.drawerId = null; ui.dismissedStatus = false;
      if (el.drawer.open) el.drawer.close();
      announce('Demo reset.'); render(true);
    }
  };

  const toggles = {
    timeline: (v) => { ui.timeline = v; },
    tab: (v) => { ui.actionTab = v; }
  };

  const changes = {
    groupEpisodes: (t) => { ui.groupEpisodes = t.checked; render(); $('#tl-group')?.focus(); },
    recordType: (t) => { ui.records.type = Object.hasOwn(patient.REC_TYPES, t.value) ? t.value : 'all'; updateRecords(); },
    reminder: (t) => { svc.preferences.setReminder(t.dataset.med, t.checked); announce(`Reminder ${t.checked ? 'on' : 'off'} for this medicine.`); },
    messageContext: (t) => {
      ui.compose = { ...(ui.compose || { text: '' }), ctx: svc.contexts.isKnown(t.value) ? t.value : 'general' };
      $('#m-to').textContent = `To: ${svc.contexts.describe(ui.compose.ctx).withWho}`;
    },
    worklistReason: (t) => { ui.worklist.reason = t.value; render(); $('#pf-r')?.focus(); },
    worklistOrg: (t) => { ui.worklist.org = t.value; render(); $('#pf-o')?.focus(); }
  };

  const inputs = {
    recordQuery: (t) => { ui.records.query = sanitizeText(t.value, LIMITS.searchQuery); updateRecords(); }
  };

  const forms = {
    checkin(form) {
      const choice = form.querySelector('input[name="mood"]:checked');
      const result = svc.actions.saveCheckin(choice ? choice.value : '', form.elements.note.value);
      if (!result.ok) { $('#ci-err').textContent = result.error; return; }
      announce(result.announce); render();
    },
    message(form) {
      const ctxValue = form.elements.ctx.value; const text = form.elements.text.value;
      const result = svc.messages.send(ctxValue, text, { confirmedNonUrgent: ui.urgentConfirmed });
      if (result.status === 'needs_confirmation') { ui.urgentConfirmed = true; $('#m-err').textContent = result.error; return; }
      if (result.status === 'invalid') { $('#m-err').textContent = result.error; return; }
      ui.compose = null; ui.urgentConfirmed = false;
      announce('Message added to the conversation.'); render();
      $('#m-text')?.focus();
    },
    reminder(form) {
      svc.provider.sendReminder(form.dataset.id, form.elements.template.value, form.elements.note.value);
      announce('Reminder recorded in the audit log (simulated).');
      render();
      el.drawer.querySelector('h2')?.setAttribute('tabindex', '-1');
      el.drawer.querySelector('h2')?.focus();
    }
  };

  function updateRecords() {
    const r = patient.recordItems(ctx());
    mount($('#rec-list'), r.html);
    $('#rec-count').textContent = `${r.count} record${r.count === 1 ? '' : 's'} shown.`;
  }

  /** Wraps handlers: expected domain refusals are announced; anything else shows the error view. */
  function guard(fn) {
    try { fn(); } catch (err) {
      if (err instanceof DomainError) { announce(`That action is not available: ${err.message}`); render(); } else renderError(err);
    }
  }

  function bind() {
    doc.addEventListener('click', (e) => {
      const target = e.target.closest('[data-do]');
      if (target && Object.hasOwn(clicks, target.dataset.do)) { guard(() => clicks[target.dataset.do](target)); return; }
      for (const key of Object.keys(toggles)) {
        const btn = e.target.closest(`[data-${key}]`);
        if (btn && btn.tagName === 'BUTTON') { guard(() => { toggles[key](btn.dataset[key]); render(); }); return; }
      }
    });
    doc.addEventListener('change', (e) => {
      const key = e.target.dataset?.change;
      if (key && Object.hasOwn(changes, key)) guard(() => changes[key](e.target));
    });
    doc.addEventListener('input', (e) => {
      const key = e.target.dataset?.input;
      if (key && Object.hasOwn(inputs, key)) guard(() => inputs[key](e.target));
      if (e.target.id === 'm-text') {
        ui.compose = { ctx: $('#m-ctx').value, text: e.target.value };
        ui.urgentConfirmed = false; $('#m-err').textContent = '';
      }
    });
    doc.addEventListener('submit', (e) => {
      const key = e.target.dataset?.form;
      if (!key || !Object.hasOwn(forms, key)) return;
      e.preventDefault();
      guard(() => forms[key](e.target));
    });
    doc.addEventListener('toggle', (e) => {
      const id = e.target.dataset?.details;
      if (id) { if (e.target.open) ui.openDetails.add(id); else ui.openDetails.delete(id); }
    }, true);
    el.drawer.addEventListener('close', () => { ui.drawerId = null; });
    el.drawer.addEventListener('click', (e) => { if (e.target === el.drawer) el.drawer.close(); });
    win.addEventListener('hashchange', () => { route = parseRoute(win.location.hash); render(true); });
    // Another tab changed the demo state: re-read (and re-validate) it.
    win.addEventListener('storage', (e) => { if (e.key === null || e.key === store.key) { store.reload(); render(); } });
  }

  return {
    start() { bind(); render(true, false); },
    render
  };
}
