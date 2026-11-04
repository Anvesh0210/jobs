/* HEALNEXIA prototype — vanilla JS, zero dependencies.
   All data below is fictional. State persists only in this browser's localStorage. */
(() => {
  'use strict';

  const TODAY = '2026-11-04';
  const KEY = 'healnexia-prototype-v1';

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (iso, o) => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short', year: 'numeric' });
  const days = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
  const stamp = () => {
    const d = new Date();
    return `${fmt(TODAY, { day: 'numeric', month: 'short' })}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const announce = (m) => { const l = $('#live'); l.textContent = ''; setTimeout(() => { l.textContent = m; }, 30); };
  const dueText = (iso) => {
    const n = days(TODAY, iso);
    if (n < 0) return `${-n} day${n === -1 ? '' : 's'} past due date (${fmt(iso, { day: 'numeric', month: 'short' })})`;
    if (n === 0) return 'Due today';
    return `Due in ${n} day${n === 1 ? '' : 's'} (${fmt(iso, { day: 'numeric', month: 'short' })})`;
  };

  /* ---------- fictional data ---------- */
  const PATIENT = { name: 'Alex Morgan', first: 'Alex' };

  const SOURCES = [
    { id: 'riv', name: 'Riverside Medical Practice', kind: 'GP clinical system', last: '4 Nov 2026, 07:30', status: 'ok', affected: 'None', reason: '' },
    { id: 'nor', name: 'Northbank Hospital', kind: 'Hospital outpatient system', last: '3 Nov 2026, 22:10', status: 'ok', affected: 'None', reason: '' },
    { id: 'lak', name: 'Lakeside Diagnostics', kind: 'Laboratory system', last: '4 Nov 2026, 06:00', status: 'ok', affected: 'None', reason: '' },
    { id: 'har', name: 'Harbour Pharmacy', kind: 'Pharmacy system', last: '1 Nov 2026, 18:45', status: 'stale', affected: '2 medication records, 1 vaccination record', reason: 'Connection timed out (simulated). Retrying hourly.' }
  ];
  const srcByName = (n) => SOURCES.find((s) => s.name === n);

  const TEAM = [
    { name: 'Dr Priya Nair', role: 'GP', org: 'Riverside Medical Practice', note: 'Usual GP' },
    { name: 'Sam Whitlock', role: 'Care coordinator', org: 'Riverside Medical Practice', note: 'Arranges tests and follow-ups' },
    { name: 'Dr Marcus Obi', role: 'Consultant cardiologist', org: 'Northbank Hospital', note: 'Outpatient clinic' },
    { name: 'Hana Rahimi', role: 'Pharmacist', org: 'Harbour Pharmacy', note: 'Medicine reviews' }
  ];

  const BASE_ACTIONS = [
    {
      id: 'A-1042', type: 'test', title: 'Follow-up blood test', status: 'unacknowledged', owner: 'patient', priority: 1,
      rationale: 'Dr Nair asked for a blood test after your ramipril dose changed on 21 October. The care team will review the result with you.',
      requestedBy: 'Dr Priya Nair (GP)', responsible: 'You (to book and attend)', org: 'Riverside Medical Practice', system: 'GP clinical system',
      due: '2026-11-09', updated: '2026-11-02', verification: 'source', episode: 'EP-1', links: ['E-10', 'E-4'], med: 'ramipril',
      history: [{ t: '2 Nov, 16:10', who: 'Dr Priya Nair', what: 'Request created' }, { t: '2 Nov, 16:12', who: 'System', what: 'Sent to you (unacknowledged)' }]
    },
    {
      id: 'A-1038', type: 'appointment', title: 'Cardiology outpatient appointment', status: 'scheduled', owner: 'provider', priority: 3,
      rationale: 'A clinic review with the cardiology team at Northbank Hospital.',
      requestedBy: 'Dr Marcus Obi (Cardiology)', responsible: 'Northbank Hospital (appointment booked)', org: 'Northbank Hospital', system: 'Hospital outpatient system',
      due: null, scheduledAt: '2026-11-18', scheduledNote: '18 Nov 2026, 10:20, Outpatients Level 2', updated: '2026-10-28', verification: 'source', episode: 'EP-2', links: ['E-8'],
      history: [{ t: '12 Oct, 11:00', who: 'Northbank Hospital', what: 'Appointment created' }, { t: '28 Oct, 09:15', who: 'Northbank Hospital', what: 'Scheduled for 18 Nov' }]
    },
    {
      id: 'A-1033', type: 'medication_review', title: 'Pharmacist medicine review', status: 'acknowledged', owner: 'patient', priority: 2,
      rationale: 'A short chat with your pharmacist about your current medicines and the recent dose change.',
      requestedBy: 'Dr Priya Nair (GP)', responsible: 'You (to book a slot)', org: 'Harbour Pharmacy', system: 'Pharmacy system',
      due: '2026-11-14', updated: '2026-10-30', verification: 'source', episode: 'EP-1', links: ['E-4'], med: 'ramipril',
      history: [{ t: '21 Oct, 12:00', who: 'Dr Priya Nair', what: 'Request created' }, { t: '30 Oct, 18:00', who: 'You', what: 'Acknowledged' }]
    },
    {
      id: 'A-1029', type: 'referral', title: 'Echocardiogram booking', status: 'blocked', owner: 'provider', priority: 2,
      rationale: 'Northbank received the referral on 28 October and has not yet offered a date. The booking team owns the next step; you do not need to act.',
      requestedBy: 'Dr Marcus Obi (Cardiology)', responsible: 'Northbank Hospital booking team', org: 'Northbank Hospital', system: 'Hospital outpatient system',
      due: '2026-11-01', updated: '2026-10-28', verification: 'source', episode: 'EP-2', links: ['E-9'],
      history: [{ t: '2 Sep, 15:30', who: 'Dr Marcus Obi', what: 'Referral requested' }, { t: '28 Oct, 08:40', who: 'Northbank Hospital', what: 'Received, awaiting booking slot' }]
    },
    {
      id: 'A-1051', type: 'checkin', title: 'Weekly wellbeing check-in', status: 'created', owner: 'patient', priority: 3,
      rationale: 'A short, optional note about how you are feeling, to share at your next contact. It is not monitored in real time.',
      requestedBy: 'Riverside Medical Practice', responsible: 'You', org: 'Riverside Medical Practice', system: 'HEALNEXIA check-in',
      due: '2026-11-06', updated: '2026-11-02', verification: 'source', episode: null, links: [],
      history: [{ t: '2 Nov, 09:00', who: 'System', what: 'Weekly check-in created' }]
    },
    {
      id: 'A-1017', type: 'document', title: 'Flu vaccination recorded', status: 'completed', owner: 'patient', priority: 3,
      rationale: 'Vaccination recorded by your pharmacy.',
      requestedBy: 'Riverside Medical Practice', responsible: 'Harbour Pharmacy', org: 'Harbour Pharmacy', system: 'Pharmacy system',
      due: '2026-10-31', completedAt: '2026-10-12', updated: '2026-10-12', verification: 'source', evidence: 'Administration record received from Harbour Pharmacy on 12 Oct 2026', episode: null, links: ['E-6'],
      history: [{ t: '5 Oct, 10:00', who: 'Riverside', what: 'Request created' }, { t: '12 Oct, 14:20', who: 'Harbour Pharmacy', what: 'Completed (source-verified)' }]
    },
    {
      id: 'A-1009', type: 'document', title: 'Home blood pressure diary sent', status: 'completed', owner: 'patient', priority: 3,
      rationale: 'You sent a week of home readings to your GP.',
      requestedBy: 'Dr Priya Nair (GP)', responsible: 'You', org: 'Riverside Medical Practice', system: 'HEALNEXIA',
      due: '2026-10-20', completedAt: '2026-10-18', updated: '2026-10-18', verification: 'reported', evidence: null, episode: 'EP-1', links: [],
      history: [{ t: '13 Oct, 09:00', who: 'Dr Priya Nair', what: 'Request created' }, { t: '18 Oct, 19:05', who: 'You', what: 'Marked complete (patient-reported)' }]
    }
  ];

  const TYPE_LABEL = { test: 'Test', appointment: 'Appointment', referral: 'Referral', medication_review: 'Medication review', checkin: 'Check-in', document: 'Document', task: 'Care-team task' };

  const EVENTS = [
    { id: 'E-10', date: '2026-11-02', recv: '2026-11-02', type: 'followup', title: 'Blood test requested', org: 'Riverside Medical Practice', author: 'Dr Priya Nair', system: 'GP clinical system', episode: 'EP-1', detail: 'Follow-up blood test requested after the medication change.' },
    { id: 'E-9', date: '2026-10-28', recv: '2026-10-28', type: 'referral', title: 'Echocardiogram referral received', org: 'Northbank Hospital', author: 'Booking team', system: 'Hospital outpatient system', episode: 'EP-2', detail: 'Referral received. Awaiting a booking slot.' },
    { id: 'E-8', date: '2026-10-28', recv: '2026-10-28', type: 'followup', title: 'Cardiology appointment scheduled', org: 'Northbank Hospital', author: 'Outpatient admin', system: 'Hospital outpatient system', episode: 'EP-2', detail: 'Appointment on 18 Nov 2026, 10:20.' },
    { id: 'E-7', date: '2026-10-25', recv: '2026-10-25', type: 'test', title: 'Cholesterol panel result received', org: 'Lakeside Diagnostics', author: 'Laboratory', system: 'Laboratory system', episode: 'EP-1', detail: 'Result received. Reviewed by Dr Nair on 27 Oct (source note).' },
    { id: 'E-4', date: '2026-10-21', recv: '2026-10-21', type: 'medication', title: 'Ramipril dose changed (5 mg to 10 mg)', org: 'Riverside Medical Practice', author: 'Dr Priya Nair', system: 'GP clinical system', episode: 'EP-1', detail: 'Dose changed following the blood pressure review.' },
    { id: 'E-3', date: '2026-10-21', recv: '2026-10-21', type: 'consultation', title: 'GP appointment: blood pressure review', org: 'Riverside Medical Practice', author: 'Dr Priya Nair', system: 'GP clinical system', episode: 'EP-1', detail: 'Consultation summary filed to your record.' },
    { id: 'E-6', date: '2026-10-12', recv: '2026-10-12', type: 'followup', title: 'Flu vaccination recorded', org: 'Harbour Pharmacy', author: 'Hana Rahimi', system: 'Pharmacy system', episode: null, detail: 'Vaccination administered and recorded.' },
    { id: 'E-2', date: '2026-09-15', recv: '2026-09-17', type: 'admission', title: 'Day-unit attendance: discharge summary received', org: 'Northbank Hospital', author: 'Day unit', system: 'Hospital outpatient system', episode: 'EP-2', detail: 'Discharge summary received two days after the attendance.' },
    { id: 'E-1', date: '2026-09-02', recv: '2026-09-02', type: 'consultation', title: 'Cardiology outpatient clinic', org: 'Northbank Hospital', author: 'Dr Marcus Obi', system: 'Hospital outpatient system', episode: 'EP-2', detail: 'Clinic letter filed to your record.' },
    { id: 'E-0', date: '2026-08-04', recv: '2026-08-04', type: 'medication', title: 'Atorvastatin 20 mg repeat issued', org: 'Harbour Pharmacy', author: 'Hana Rahimi', system: 'Pharmacy system', episode: null, detail: 'Repeat prescription dispensed.' }
  ];
  const EPISODES = { 'EP-1': 'Blood pressure review (Oct to Nov 2026)', 'EP-2': 'Cardiology assessment (Aug to Nov 2026)' };
  const EV_TYPES = [['all', 'All'], ['consultation', 'Consultations'], ['test', 'Tests and results'], ['medication', 'Medication'], ['referral', 'Referrals'], ['admission', 'Admission and discharge'], ['followup', 'Follow-ups']];
  const EV_LABEL = Object.fromEntries(EV_TYPES);

  const RECORDS = [
    { id: 'R-1', type: 'result', title: 'Cholesterol blood test', official: 'LIPID PROFILE - SERUM', org: 'Lakeside Diagnostics', date: '2026-10-25', flag: null },
    { id: 'R-2', type: 'result', title: 'Kidney function blood test', official: 'U&E PROFILE', org: 'Lakeside Diagnostics', date: '2026-09-30', flag: 'Source note: "Reviewed, no further action" (supplied by Riverside Medical Practice)' },
    { id: 'R-3', type: 'letter', title: 'Cardiology clinic letter', official: 'OPD LETTER - CARDIOLOGY', org: 'Northbank Hospital', date: '2026-09-02', flag: null },
    { id: 'R-4', type: 'letter', title: 'Day-unit discharge summary', official: 'DISCHARGE SUMMARY - DAY UNIT', org: 'Northbank Hospital', date: '2026-09-15', flag: null },
    { id: 'R-5', type: 'summary', title: 'GP consultation summary, 21 October', official: 'CONSULTATION SUMMARY', org: 'Riverside Medical Practice', date: '2026-10-21', flag: null },
    { id: 'R-6', type: 'result', title: 'Heart tracing (ECG) report', official: 'ECG 12-LEAD REPORT', org: 'Northbank Hospital', date: '2026-08-20', flag: null },
    { id: 'R-7', type: 'summary', title: 'Flu vaccination record', official: 'IMMUNISATION ADMIN RECORD', org: 'Harbour Pharmacy', date: '2026-10-12', flag: null }
  ];
  const REC_TYPES = { result: 'Results', letter: 'Letters', summary: 'Summaries' };

  const MEDS = [
    {
      id: 'ramipril', name: 'Ramipril 10 mg capsules', schedule: 'Take one capsule once a day (as written on the prescription)', indication: 'High blood pressure', prescriber: 'Dr Priya Nair',
      source: 'Riverside Medical Practice', reconciled: '2026-10-21', review: '2026-11-14', discrepancy: null,
      history: [{ d: '21 Oct 2026', t: 'Dose changed from 5 mg to 10 mg by Dr Priya Nair (Riverside Medical Practice).' }, { d: '3 Mar 2025', t: 'Started at 5 mg by Dr Priya Nair.' }]
    },
    {
      id: 'atorvastatin', name: 'Atorvastatin 20 mg tablets', schedule: 'Take one tablet in the evening (as written on the prescription)', indication: 'Cholesterol', prescriber: 'Dr Priya Nair',
      source: 'Riverside Medical Practice, Harbour Pharmacy', reconciled: '2026-08-04', review: '2027-02-01', discrepancy: null,
      history: [{ d: '4 Aug 2026', t: 'Repeat issued by Harbour Pharmacy. No change to dose.' }, { d: '12 Jun 2024', t: 'Started by Dr Priya Nair.' }]
    },
    {
      id: 'amlodipine', name: 'Amlodipine 5 mg tablets', schedule: 'Schedule not stated in the source', indication: 'Not stated', prescriber: 'Not stated',
      source: 'Northbank Hospital clinic letter (2 Sep 2026) only', reconciled: null, review: null,
      discrepancy: 'The Northbank clinic letter lists this medicine, but your GP record does not. HEALNEXIA has not chosen between the two. Please ask your pharmacist or GP to confirm before relying on either list.',
      history: [{ d: '2 Sep 2026', t: 'Mentioned in the cardiology clinic letter. No matching entry in the GP record.' }]
    }
  ];

  const WORK = [
    { id: 'W-1', actionId: 'A-1042', patient: 'Alex Morgan', age: 2 },
    { id: 'W-2', actionId: 'A-1029', patient: 'Alex Morgan', age: 7 },
    { id: 'W-3', patient: 'Sam Okafor', type: 'test', title: 'Post-discharge blood test', org: 'Riverside Medical Practice', source: 'GP clinical system', requestedBy: 'Dr Priya Nair', owner: 'Patient', status: 'unacknowledged', due: '2026-11-06', age: 6, reason: 'unacknowledged', activity: 'Request sent 29 Oct. No patient activity since.', sync: 'riv' },
    { id: 'W-4', patient: 'Jordan Lee', type: 'referral', title: 'Dermatology referral booking', org: 'Northbank Hospital', source: 'Hospital outpatient system', requestedBy: 'Dr Priya Nair', owner: 'Northbank booking team', status: 'blocked', due: '2026-10-30', age: 15, reason: 'overdue', activity: 'Patient acknowledged on 21 Oct. Awaiting slot.', sync: 'nor', ack: true },
    { id: 'W-5', patient: 'Priya Shah', type: 'test', title: 'Repeat urine test', org: 'Lakeside Diagnostics', source: 'Laboratory system', requestedBy: 'Riverside Medical Practice', owner: 'Lakeside Diagnostics (result)', status: 'in_progress', due: '2026-11-03', age: 12, reason: 'missing_result', activity: 'Patient reports sample given 24 Oct (patient-reported). No result received.', sync: 'lak', ack: true },
    { id: 'W-6', patient: 'Mateo Silva', type: 'medication_review', title: 'Medication review', org: 'Harbour Pharmacy', source: 'Pharmacy system', requestedBy: 'Dr Priya Nair', owner: 'Patient (to book)', status: 'acknowledged', due: '2026-11-08', age: 9, reason: 'approaching_due', activity: 'Patient acknowledged 2 Nov. Not yet booked.', sync: 'har', ack: true },
    { id: 'W-7', patient: 'Chen Wei', type: 'document', title: 'Collect new prescription', org: 'Harbour Pharmacy', source: 'Pharmacy system', requestedBy: 'Dr Priya Nair', owner: 'Harbour Pharmacy (status feed)', status: 'blocked', due: '2026-11-05', age: 4, reason: 'blocked', activity: 'Pharmacy feed has not updated since 1 Nov, so collection cannot be confirmed.', sync: 'har', ack: true }
  ];
  const REASONS = {
    overdue: ['Overdue', 'attn', 'The due date has passed and the step is not complete.'],
    blocked: ['Blocked', 'attn', 'The step cannot progress until another party or source responds.'],
    missing_result: ['Result not received', 'attn', 'The step is reported done but no result has arrived from the source.'],
    unacknowledged: ['Not yet acknowledged', 'info', 'The patient has not seen or acknowledged this step. This is an administrative flag, not a clinical urgency.'],
    approaching_due: ['Due soon', 'info', 'The due date is within 7 days and the step is not complete.']
  };
  const REASON_ORDER = ['overdue', 'blocked', 'missing_result', 'unacknowledged', 'approaching_due'];

  const SEED_AUDIT = [
    { t: '4 Nov, 07:30', who: 'System', what: 'Sync completed: Riverside Medical Practice' },
    { t: '4 Nov, 06:00', who: 'System', what: 'Sync completed: Lakeside Diagnostics' },
    { t: '3 Nov, 22:10', who: 'System', what: 'Sync completed: Northbank Hospital' },
    { t: '3 Nov, 14:05', who: 'Sam Whitlock', what: 'Opened patient summary: Sam Okafor (purpose: care coordination)' },
    { t: '1 Nov, 18:45', who: 'System', what: 'Sync failed: Harbour Pharmacy (timeout, retrying)' }
  ];

  const SEED_CONVOS = [
    {
      id: 'c1', ctx: 'action:A-1042', subject: 'Your follow-up blood test', withWho: 'Riverside Medical Practice care coordinator',
      msgs: [{ me: false, who: 'Sam Whitlock, Riverside care coordinator', t: '2 Nov, 16:12', text: 'Hello Alex, Dr Nair has asked for a follow-up blood test. You can start booking from the Action centre, or tell us if you have already arranged it elsewhere.', status: 'Delivered · read 3 Nov' }]
    },
    {
      id: 'c2', ctx: 'action:A-1038', subject: 'Cardiology appointment details', withWho: 'Northbank Hospital outpatient admin',
      msgs: [
        { me: true, who: 'You', t: '29 Oct, 10:02', text: 'Is there step-free access to Outpatients Level 2?', status: 'Delivered · read' },
        { me: false, who: 'Northbank outpatient admin', t: '30 Oct, 11:40', text: 'Yes, lifts are signposted from the main entrance. Reception can also meet you at the entrance if you let us know.', status: 'Delivered · read' }
      ]
    }
  ];

  /* ---------- state ---------- */
  let S;
  const fresh = () => ({ v: 1, act: {}, remind: {}, convos: JSON.parse(JSON.stringify(SEED_CONVOS)), checkin: null, audit: [], sent: {} });
  const load = () => {
    try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
    if (!S || S.v !== 1) S = fresh();
  };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable: prototype still works in memory */ } };
  const UI = { tl: 'all', group: false, tab: 'open', open: new Set(), compose: null, rec: { q: '', type: 'all' }, pf: { reason: 'all', org: 'all' } };

  const A = (id) => {
    const b = BASE_ACTIONS.find((a) => a.id === id); const o = S.act[id] || {};
    return { ...b, ...o, history: [...b.history, ...(o.hist || [])] };
  };
  const allActions = () => BASE_ACTIONS.map((a) => A(a.id));
  const isOpen = (a) => !['completed', 'cancelled'].includes(a.status);
  const isPast = (a) => isOpen(a) && a.due && a.due < TODAY && a.status !== 'scheduled';
  const mutate = (id, patch, who, what) => {
    const o = S.act[id] || (S.act[id] = {});
    Object.assign(o, patch); (o.hist = o.hist || []).push({ t: stamp(), who, what }); save();
  };
  const counts = (all) => ({
    open: all.filter(isOpen).length, overdue: all.filter(isPast).length,
    awaiting: all.filter((a) => isOpen(a) && a.owner === 'provider').length, done: all.filter((a) => a.status === 'completed').length
  });
  const heroAction = (all) => all.filter((a) => isOpen(a) && a.owner === 'patient')
    .sort((x, y) => (isPast(y) - isPast(x)) || (x.priority - y.priority) || String(x.due || '9').localeCompare(String(y.due || '9')))[0];

  /* ---------- UI atoms ---------- */
  const chip = (cls, icon, text) => `<span class="chip ${cls}"><span aria-hidden="true">${icon}</span>${esc(text)}</span>`;
  const STATUS = {
    created: ['neutral', '○', 'New'], unacknowledged: ['attn', '!', 'Needs attention'], acknowledged: ['info', '◐', 'Acknowledged'],
    scheduled: ['info', '◷', 'Scheduled'], in_progress: ['info', '↻', 'In progress'], blocked: ['attn', '⏸', 'Awaiting booking'],
    completed: ['ok', '✓', 'Completed'], cancelled: ['neutral', '×', 'Cancelled'], overdue: ['attn', '!', 'Overdue']
  };
  const statusChip = (s) => { const [c, i, t] = STATUS[s]; return chip(c, i, t); };
  const verifyChip = (a) => a.verification === 'reported'
    ? chip('neutral', '◌', 'Patient-reported, not yet verified')
    : chip('ok', '✓', `Verified by ${a.org}`);
  const stateChips = (a) => `<div class="chips">${statusChip(a.status)}${isPast(a) ? chip('attn', '!', 'Past due date') : ''}${verifyChip(a)}</div>`;
  const freshness = (orgName) => {
    const s = srcByName(orgName); if (!s) return '';
    return s.status === 'ok' ? `<span class="muted small-text">Source updated ${esc(s.last)}</span>`
      : `<span class="sync-stale small-text">⚠ Source may be out of date (last updated ${esc(s.last)})</span>`;
  };

  /* ---------- views ---------- */
  const PATIENT_NAV = [['overview', 'Overview'], ['journey', 'Care journey'], ['actions', 'Action centre'], ['records', 'Health records'], ['meds', 'Medications'], ['messages', 'Messages'], ['team', 'Care team and sharing']];
  const PROVIDER_NAV = [['dashboard', 'Continuity dashboard'], ['integrations', 'Integration status'], ['audit', 'Audit log']];

  function viewOverview() {
    const all = allActions(); const c = counts(all); const hero = heroAction(all);
    const stale = SOURCES.filter((s) => s.status !== 'ok');
    const recentEvents = EVENTS.slice(0, 4);
    const a42 = A('A-1042');
    const step4 = a42.status === 'completed' ? 'done' : 'current';
    return `
      <h1 tabindex="-1">Good morning, ${esc(PATIENT.first)}</h1>
      <p class="lede">Here is where your care stands on ${fmt(TODAY, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}. Everything shown comes from your connected care providers.</p>
      ${stale.length ? `<div class="notice attn" role="note"><span aria-hidden="true">⚠</span><div><p><strong>This view may be incomplete.</strong> ${esc(stale.map((s) => s.name).join(', '))} has not updated since ${esc(stale[0].last)}, so some medication information may be out of date.</p><p><a href="#/team">See data coverage</a></p></div></div>` : ''}
      <section class="section" aria-labelledby="h-next">
        <h2 id="h-next" class="sr">What needs your attention now</h2>
        ${hero ? heroCard(hero) : `<div class="card hero"><div class="eyebrow">Next step</div><h2>Nothing needs your attention right now</h2><p>Based on what your connected providers have shared, you have no open steps waiting on you. Some sources may update later.</p></div>`}
      </section>
      <section class="section" aria-labelledby="h-counts"><h2 id="h-counts" class="sr">Your actions at a glance</h2>
        <ul class="tiles">
          <li><strong>${c.open}</strong><span>Open actions</span></li>
          <li><strong>${c.overdue}</strong><span>Past due date</span></li>
          <li><strong>${c.awaiting}</strong><span>Waiting on a provider</span></li>
          <li><strong>${c.done}</strong><span>Completed</span></li>
        </ul>
        <p class="hint">Counts update when you act. <a href="#/actions">Go to Action centre</a></p>
      </section>
      <div class="grid two section">
        <section class="card" aria-labelledby="h-prog">
          <h2 id="h-prog">Care progress</h2>
          <p class="muted small-text">${esc(EPISODES['EP-1'])}</p>
          <ol class="steps">
            <li class="done"><span class="dot" aria-hidden="true">✓</span><div><span class="step-title">GP appointment</span><br><span class="muted small-text">21 Oct · Completed</span></div></li>
            <li class="done"><span class="dot" aria-hidden="true">✓</span><div><span class="step-title">Medication dose changed</span><br><span class="muted small-text">21 Oct · Completed</span></div></li>
            <li class="done"><span class="dot" aria-hidden="true">✓</span><div><span class="step-title">Blood test requested</span><br><span class="muted small-text">2 Nov · Completed</span></div></li>
            <li class="${step4}"${step4 === 'current' ? ' aria-current="step"' : ''}><span class="dot" aria-hidden="true">${step4 === 'done' ? '✓' : '4'}</span><div><span class="step-title">Blood test taken</span><br><span class="muted small-text">${step4 === 'done' ? 'Reported by you, awaiting confirmation from the lab' : 'Waiting for you · ' + dueText(a42.due)}</span></div></li>
            <li><span class="dot" aria-hidden="true">5</span><div><span class="step-title">Result received and reviewed</span><br><span class="muted small-text">Not yet received</span></div></li>
          </ol>
        </section>
        <section class="card" aria-labelledby="h-appt">
          <h2 id="h-appt">Next appointment</h2>
          <p><strong>Cardiology outpatient clinic</strong><br>18 November 2026, 10:20<br>Outpatients Level 2, Northbank Hospital</p>
          <div class="chips">${chip('info', '◷', 'Scheduled')}${chip('ok', '✓', 'Verified by Northbank Hospital')}</div>
          <p class="small-text">${freshness('Northbank Hospital')}</p>
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
          <ul class="list">${recentEvents.map((e) => `<li><span class="tl-date">${fmt(e.date, { day: 'numeric', month: 'short' })}</span> · ${esc(e.title)}<br><span class="muted small-text">${esc(e.org)}</span></li>`).join('')}</ul>
          <p class="section"><a href="#/journey">See your full care journey</a></p>
        </section>
        ${checkinCard()}
      </div>
      <section class="card section" aria-labelledby="h-team">
        <h2 id="h-team">Your care team</h2>
        <ul class="grid two">${TEAM.map((t) => `<li><strong>${esc(t.name)}</strong><br>${esc(t.role)} · ${esc(t.org)}<br><span class="muted small-text">${esc(t.note)}</span></li>`).join('')}</ul>
        <div class="btn-row"><a class="btn secondary" href="#/messages">Send a non-urgent message</a></div>
      </section>`;
  }

  function heroCard(a) {
    return `<div class="card hero">
      <div class="eyebrow">Your next step</div>
      <h2>${esc(a.title)}</h2>
      ${stateChips(a)}
      <p>${esc(a.rationale)}</p>
      <dl class="dl"><dt>Requested by</dt><dd>${esc(a.requestedBy)}, ${esc(a.org)}</dd><dt>Due</dt><dd>${a.due ? esc(dueText(a.due)) : 'No due date'}</dd><dt>Source</dt><dd>${esc(a.system)} · ${freshness(a.org)}</dd></dl>
      <details><summary>Why is this shown first?</summary><p class="small-text">Open steps that are waiting on you are ordered by (1) past due date, (2) the priority set by the requesting team, then (3) the nearest due date. This is an administrative ordering to help you plan. It is not a measure of clinical urgency.</p></details>
      ${actionButtons(a, 'hero')}
    </div>`;
  }

  function actionButtons(a, k) {
    const b = [];
    const btn = (verb, label, cls = 'secondary') => `<button type="button" class="btn ${cls}" data-do="${verb}:${a.id}" data-fk="${k}-${verb}-${a.id}">${label}</button>`;
    if (a.status === 'unacknowledged') b.push(btn('ack', 'Acknowledge', ''));
    if (isOpen(a) && a.owner === 'patient') {
      if (['test', 'appointment', 'medication_review'].includes(a.type) && !['scheduled', 'in_progress'].includes(a.status)) b.push(btn('booking', 'Start booking (simulated)'));
      if (['test', 'appointment', 'medication_review'].includes(a.type) && a.status !== 'scheduled') b.push(btn('booked', 'Mark as booked elsewhere'));
      if (a.type === 'checkin') b.push(`<a class="btn secondary" href="#/overview">Do the check-in on Overview</a>`);
      else b.push(btn('complete', 'Mark as complete'));
    }
    if (isOpen(a)) { b.push(btn('ask', 'Ask a question')); b.push(btn('problem', 'Report a problem')); }
    if (a.status === 'completed' && a.verification === 'reported') b.push(btn('reopen', 'Reopen'));
    return `<div class="btn-row">${b.join('')}</div>`;
  }

  function checkinCard() {
    const c = S.checkin;
    if (c) return `<section class="card" aria-labelledby="h-ci"><h2 id="h-ci">Wellbeing check-in</h2><p>Saved on ${fmt(c.date)}: <strong>${esc(c.value)}</strong>.${c.note ? ' Your note: “' + esc(c.note) + '”' : ''}</p><p class="small-text muted">Check-ins are not monitored in real time. If you feel unwell or worried, contact your care team or, in an emergency, your local emergency number.</p></section>`;
    return `<section class="card" aria-labelledby="h-ci"><h2 id="h-ci">Wellbeing check-in</h2>
      <form id="checkin" novalidate>
        <fieldset><legend>How have you been feeling this week?</legend>
          <div class="radio-row">${['Feeling well', 'Mostly well', 'Not great', 'Unwell', 'Prefer not to say'].map((v, i) => `<label><input type="radio" name="mood" value="${v}"${i === 0 ? ' required' : ''}>${v}</label>`).join('')}</div>
        </fieldset>
        <div class="field"><label for="ci-note">Anything you would like to share (optional)</label><textarea id="ci-note" maxlength="400"></textarea></div>
        <p class="hint">Not monitored in real time. For urgent help, call your local emergency number.</p>
        <p id="ci-err" class="small-text" style="color:var(--coral-800)" role="alert"></p>
        <button class="btn" type="submit">Save check-in</button>
      </form></section>`;
  }

  function viewJourney() {
    const list = EVENTS.filter((e) => UI.tl === 'all' || e.type === UI.tl);
    const card = (e) => `<li class="tl-item">
      <div class="tl-date">${fmt(e.date)}</div>
      <h3>${esc(e.title)}</h3>
      <div class="chips">${chip('info', '•', EV_LABEL[e.type])}${e.episode ? chip('neutral', '⛓', 'Episode: ' + EPISODES[e.episode]) : ''}</div>
      <p class="small-text">${esc(e.detail)}</p>
      <details><summary>Source and provenance</summary>
        <dl class="dl"><dt>Organisation</dt><dd>${esc(e.org)}</dd><dt>Author</dt><dd>${esc(e.author)}</dd><dt>Source system</dt><dd>${esc(e.system)}</dd><dt>Event date</dt><dd>${fmt(e.date)}</dd><dt>Received</dt><dd>${fmt(e.recv)}${e.recv !== e.date ? ' (arrived after the event)' : ''}</dd><dt>Correction state</dt><dd>No corrections or flagged errors</dd><dt>Freshness</dt><dd>${freshness(e.org)}</dd></dl>
      </details></li>`;
    let body;
    if (!list.length) body = '<p>No events match this filter.</p>';
    else if (UI.group) {
      const keys = [...new Set(list.map((e) => e.episode || 'none'))];
      body = keys.map((k) => `<section class="episode-group" aria-label="${esc(k === 'none' ? 'Events not in an episode' : EPISODES[k])}"><h3>${esc(k === 'none' ? 'Not part of an episode' : EPISODES[k])}</h3><ol class="timeline">${list.filter((e) => (e.episode || 'none') === k).map(card).join('')}</ol></section>`).join('<div style="height:.9rem"></div>');
    } else body = `<ol class="timeline">${list.map(card).join('')}</ol>`;
    return `<h1 tabindex="-1">Care journey</h1>
      <p class="lede">Events from all your connected providers, newest first. Related events can be grouped into an episode.</p>
      <div class="filters" role="group" aria-label="Filter events by type">${EV_TYPES.map(([k, l]) => `<button type="button" data-tl="${k}" data-fk="tl-${k}" aria-pressed="${UI.tl === k}">${l}</button>`).join('')}</div>
      <label class="toggle"><input type="checkbox" id="tl-group"${UI.group ? ' checked' : ''}> Group related events into episodes</label>
      <p class="small-text muted" role="status">Showing ${list.length} of ${EVENTS.length} events.</p>
      ${body}`;
  }

  function viewActions() {
    const all = allActions();
    const c = counts(all);
    const list = all.filter((a) => UI.tab === 'all' || (UI.tab === 'open' ? isOpen(a) : a.status === 'completed'))
      .sort((x, y) => (isOpen(y) - isOpen(x)) || (x.priority - y.priority));
    const card = (a) => `<li class="row-card" id="${a.id}">
      <div class="meta"><span>${esc(TYPE_LABEL[a.type])}</span><span>${a.due ? esc(dueText(a.due)) : a.scheduledNote ? esc(a.scheduledNote) : 'No due date'}</span></div>
      <h3>${esc(a.title)}</h3>
      ${stateChips(a)}
      <p>${esc(a.rationale)}</p>
      <p class="small-text"><strong>Who has the next step:</strong> ${esc(a.responsible)}</p>
      ${a.status === 'completed' ? `<p class="small-text"><strong>Completion evidence:</strong> ${a.evidence ? esc(a.evidence) : 'None yet. Reported by you and awaiting confirmation from your care team.'}</p>` : ''}
      ${actionButtons(a, 'ac')}
      <details data-d="${a.id}"${UI.open.has(a.id) ? ' open' : ''}><summary>Details, source and history</summary>
        <dl class="dl"><dt>Requested by</dt><dd>${esc(a.requestedBy)}</dd><dt>Organisation</dt><dd>${esc(a.org)}</dd><dt>Source system</dt><dd>${esc(a.system)}</dd><dt>Last updated</dt><dd>${fmt(a.updated)} · ${freshness(a.org)}</dd><dt>Related events</dt><dd>${a.links.length ? a.links.map((id) => esc(EVENTS.find((e) => e.id === id).title)).join('; ') : 'None'}</dd></dl>
        <h4 class="small-text" style="margin:.5rem 0 0">Status history (cannot be edited)</h4>
        <ol class="history">${a.history.map((h) => `<li><strong>${esc(h.what)}</strong><br><span class="muted">${esc(h.who)} · ${esc(h.t)}</span></li>`).join('')}</ol>
      </details></li>`;
    return `<h1 tabindex="-1">Action centre</h1>
      <p class="lede">Every next step in your care, who requested it, who owns it and what state it is in.</p>
      <ul class="tiles">
        <li><strong>${c.open}</strong><span>Open</span></li><li><strong>${c.overdue}</strong><span>Past due date</span></li>
        <li><strong>${c.awaiting}</strong><span>Waiting on a provider</span></li><li><strong>${c.done}</strong><span>Completed</span></li>
      </ul>
      <div class="notice"><span aria-hidden="true">i</span><p>When you mark something done, it is recorded as <strong>patient-reported</strong>. It becomes <strong>verified</strong> only when the source provider confirms it.</p></div>
      <div class="filters" role="group" aria-label="Show actions">${[['open', 'Open'], ['completed', 'Completed'], ['all', 'All']].map(([k, l]) => `<button type="button" data-tab="${k}" data-fk="tab-${k}" aria-pressed="${UI.tab === k}">${l}</button>`).join('')}</div>
      ${list.length ? `<ul class="list">${list.map(card).join('')}</ul>` : '<p>No actions in this view.</p>'}`;
  }

  function recordList() {
    const q = UI.rec.q.trim().toLowerCase();
    const list = RECORDS.filter((r) => (UI.rec.type === 'all' || r.type === UI.rec.type) && (!q || `${r.title} ${r.official} ${r.org}`.toLowerCase().includes(q)));
    return { count: list.length, html: list.length ? list.map((r) => `<li class="row-card">
      <div class="meta"><span>${esc(REC_TYPES[r.type])}</span><span>Received ${fmt(r.date)}</span></div>
      <h3>${esc(r.title)}</h3>
      <p class="small-text">Official title: <code>${esc(r.official)}</code><br>${esc(r.org)} · ${freshness(r.org)}</p>
      <p class="small-text">${r.flag ? esc(r.flag) : 'No interpretation label was supplied by the source. HEALNEXIA does not interpret results.'}</p>
      <div class="chips">${chip('ok', '✓', 'Result received')}</div></li>`).join('') : '' };
  }
  function viewRecords() {
    const r = recordList();
    return `<h1 tabindex="-1">Health records</h1>
      <p class="lede">Documents and results from your providers. Titles are shown in plain language with the official source title underneath.</p>
      <div class="filter-form">
        <div><label for="rec-q">Search records</label><input id="rec-q" type="search" value="${esc(UI.rec.q)}" placeholder="For example: cholesterol, Northbank"></div>
        <div><label for="rec-t">Type</label><select id="rec-t"><option value="all">All types</option>${Object.entries(REC_TYPES).map(([k, l]) => `<option value="${k}"${UI.rec.type === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
      </div>
      <p id="rec-count" class="small-text muted" role="status" style="margin-top:.75rem">${r.count} record${r.count === 1 ? '' : 's'} shown.</p>
      <ul class="list" id="rec-list">${r.html || '<li>No records match your search.</li>'}</ul>`;
  }

  function viewMeds() {
    return `<h1 tabindex="-1">Medications</h1>
      <p class="lede">Your current medicines as recorded by your providers, with a visible history of changes.</p>
      <div class="notice attn"><span aria-hidden="true">⚠</span><div><p><strong>Always follow the instructions on your medicine label and from your prescriber.</strong> This page does not give dosing advice. Report suspected side effects or urgent symptoms to a clinician or emergency service, not through messages.</p>${srcByName('Harbour Pharmacy').status !== 'ok' ? `<p>Harbour Pharmacy data is out of date (last updated ${esc(srcByName('Harbour Pharmacy').last)}).</p>` : ''}</div></div>
      <ul class="list">${MEDS.map((m) => `<li class="row-card">
        <h3>${esc(m.name)}</h3>
        ${m.discrepancy ? `<div class="chips">${chip('warn', '▲', 'Sources disagree')}</div><p>${esc(m.discrepancy)}</p>` : `<div class="chips">${chip('ok', '✓', 'Reconciled ' + fmt(m.reconciled))}</div>`}
        <dl class="dl"><dt>Schedule (from source)</dt><dd>${esc(m.schedule)}</dd><dt>Reason</dt><dd>${esc(m.indication)}</dd><dt>Prescriber</dt><dd>${esc(m.prescriber)}</dd><dt>Source</dt><dd>${esc(m.source)}</dd><dt>Review date</dt><dd>${m.review ? fmt(m.review) : 'Not set'}</dd></dl>
        <details><summary>Change history</summary><ol class="history">${m.history.map((h) => `<li><strong>${esc(h.d)}</strong><br>${esc(h.t)}</li>`).join('')}</ol></details>
        <div class="btn-row"><button type="button" class="btn secondary" data-do="medask:${m.id}" data-fk="med-ask-${m.id}">Ask about this medicine</button></div>
        <label class="toggle"><input type="checkbox" data-med="${m.id}"${S.remind[m.id] ? ' checked' : ''}> Remind me about this medicine</label>
        <p class="hint">Prototype: no notifications are sent. Reminders are prompts only and do not record whether you have taken a medicine.</p>
      </li>`).join('')}</ul>`;
  }

  function ctxOptions() {
    return [['general', 'General (non-urgent)']].concat(BASE_ACTIONS.filter((a) => isOpen(A(a.id))).map((a) => ['action:' + a.id, 'Action: ' + a.title])).concat(MEDS.map((m) => ['med:' + m.id, 'Medication: ' + m.name]));
  }
  function ctxInfo(ctx) {
    if (ctx === 'general') return { subject: 'General question', withWho: 'Riverside Medical Practice care team' };
    const [k, id] = ctx.split(':');
    if (k === 'action') { const a = A(id); return { subject: a.title, withWho: a.org + ' team' }; }
    const m = MEDS.find((x) => x.id === id); return { subject: m.name, withWho: m.source.split(',')[0] + ' team' };
  }
  function viewMessages() {
    const pre = UI.compose; UI.compose = null;
    const ctx = pre ? pre.ctx : 'general';
    return `<h1 tabindex="-1">Messages</h1>
      <p class="lede">Non-urgent messages linked to a care step, so you never have to retell your story.</p>
      <div class="notice warn"><span aria-hidden="true">▲</span><p><strong>Messages are not for emergencies or urgent symptoms.</strong> Expected reply: within 2 working days (fictional). For urgent help call your local emergency number.</p></div>
      <section class="card" aria-labelledby="h-new"><h2 id="h-new">New message</h2>
        <form id="msgform" novalidate>
          <div class="field"><label for="m-ctx">About</label><select id="m-ctx">${ctxOptions().map(([v, l]) => `<option value="${esc(v)}"${v === ctx ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select><p class="hint" id="m-to">To: ${esc(ctxInfo(ctx).withWho)}</p></div>
          <div class="field"><label for="m-text">Your message</label><textarea id="m-text" maxlength="1000" aria-describedby="m-err">${pre && pre.prefix ? esc(pre.prefix) : ''}</textarea></div>
          <p id="m-err" role="alert" class="small-text" style="color:var(--coral-800)"></p>
          <button class="btn" type="submit" id="m-send">Send message</button>
        </form></section>
      <section class="section" aria-labelledby="h-conv"><h2 id="h-conv">Conversations</h2>
        <ul class="list">${S.convos.map((c) => `<li class="row-card"><h3>${esc(c.subject)}</h3><p class="small-text muted">With ${esc(c.withWho)}</p>
          <ul class="thread">${c.msgs.map((m) => `<li class="msg${m.me ? ' me' : ''}"><span class="who">${esc(m.who)}</span> <span class="when">${esc(m.t)}</span><br>${esc(m.text)}<br><span class="when">${esc(m.status)}</span></li>`).join('')}</ul></li>`).join('')}</ul></section>`;
  }

  function viewTeam() {
    return `<h1 tabindex="-1">Care team and sharing</h1>
      <p class="lede">The organisations connected to HEALNEXIA, and how up to date each one is.</p>
      <section class="card" aria-labelledby="h-cov"><h2 id="h-cov">Data coverage</h2>
        <ul class="list">${SOURCES.map((s) => `<li><strong>${esc(s.name)}</strong> · ${esc(s.kind)}<br>${s.status === 'ok' ? chip('ok', '✓', 'Up to date') : chip('attn', '⚠', 'Source may be out of date')} <span class="muted small-text">Last updated ${esc(s.last)}</span></li>`).join('')}</ul>
        <p class="hint">HEALNEXIA shows what connected sources have shared. It is not a complete medical record.</p></section>
      <section class="card section" aria-labelledby="h-prof"><h2 id="h-prof">Professionals</h2>
        <ul class="grid two">${TEAM.map((t) => `<li><strong>${esc(t.name)}</strong><br>${esc(t.role)}, ${esc(t.org)}<br><span class="muted small-text">${esc(t.note)}</span></li>`).join('')}</ul></section>
      <div class="notice"><span aria-hidden="true">i</span><p>Consent management, proxy access and time-limited sharing are part of the planned product but are not included in this prototype.</p></div>`;
  }

  /* ----- provider ----- */
  function workItems() {
    return WORK.map((w) => {
      if (w.actionId) {
        const a = A(w.actionId);
        const reason = !isOpen(a) ? null : a.status === 'unacknowledged' ? 'unacknowledged' : isPast(a) && a.status === 'blocked' ? 'overdue' : null;
        return { id: w.id, patient: w.patient, type: a.type, title: a.title, org: a.org, source: a.system, requestedBy: a.requestedBy, owner: a.responsible, status: a.status, due: a.due, age: w.age, reason, ack: a.status !== 'unacknowledged', actionId: a.id, sync: (SOURCES.find((s) => s.name === a.org) || {}).id, activity: `Last status change: ${a.history[a.history.length - 1].what} (${a.history[a.history.length - 1].t})`, live: true };
      }
      return { ...w };
    });
  }
  const sortWork = (a, b) => (REASON_ORDER.indexOf(a.reason) - REASON_ORDER.indexOf(b.reason)) || String(a.due).localeCompare(String(b.due));

  function viewDashboard() {
    const items = workItems(); const flagged = items.filter((i) => i.reason);
    const shown = flagged.filter((i) => (UI.pf.reason === 'all' || i.reason === UI.pf.reason) && (UI.pf.org === 'all' || i.org === UI.pf.org)).sort(sortWork);
    const orgs = [...new Set(items.map((i) => i.org))];
    const resolved = items.length - flagged.length;
    const li = (i) => {
      const [rl, rc] = REASONS[i.reason]; const n = i.due ? days(TODAY, i.due) : null;
      return `<li class="work-item">
        <div><h3>${esc(i.patient)} · ${esc(i.title)}</h3><div class="chips">${chip(rc, rc === 'attn' ? '!' : 'i', rl)}</div><span class="muted small-text">${esc(i.org)} · ${esc(TYPE_LABEL[i.type])} · item age ${i.age} days</span></div>
        <div class="small-text"><strong>Acknowledgement:</strong> ${i.ack ? 'Acknowledged' : 'Not acknowledged'}<br><strong>Due state:</strong> ${n === null ? 'No due date' : n < 0 ? `Past due by ${-n} day${n === -1 ? '' : 's'}` : `Due in ${n} day${n === 1 ? '' : 's'}`}<br>${S.sent[i.id] ? `<strong>Last contact:</strong> ${esc(S.sent[i.id][S.sent[i.id].length - 1])}` : '<strong>Last contact:</strong> none recorded'}</div>
        <button type="button" class="btn secondary" data-do="pv:${i.id}" data-fk="pv-${i.id}">Open summary<span class="sr"> for ${esc(i.patient)}, ${esc(i.title)}</span></button></li>`;
    };
    return `<h1 tabindex="-1">Continuity dashboard</h1>
      <p class="lede">Care steps that may need coordination. The list is ordered by explicit rules, not by a risk score.</p>
      <ul class="tiles">
        <li><strong>${flagged.length}</strong><span>Flagged items</span></li>
        <li><strong>${flagged.filter((i) => i.reason === 'unacknowledged').length}</strong><span>Not yet acknowledged</span></li>
        <li><strong>${flagged.filter((i) => ['overdue', 'blocked', 'missing_result'].includes(i.reason)).length}</strong><span>Overdue, blocked or missing</span></li>
        <li><strong>${resolved}</strong><span>No longer flagged</span></li>
      </ul>
      ${SOURCES.some((s) => s.status !== 'ok') ? `<div class="notice attn"><span aria-hidden="true">⚠</span><p><strong>Integration warning:</strong> Harbour Pharmacy feed is stale. Items from that source cannot be confirmed. <a href="#/integrations">View integration status</a></p></div>` : ''}
      <div class="filter-form" style="margin-top:1rem">
        <div><label for="pf-r">Reason flagged</label><select id="pf-r"><option value="all">All reasons</option>${REASON_ORDER.map((k) => `<option value="${k}"${UI.pf.reason === k ? ' selected' : ''}>${REASONS[k][0]}</option>`).join('')}</select></div>
        <div><label for="pf-o">Organisation</label><select id="pf-o"><option value="all">All organisations</option>${orgs.map((o) => `<option${UI.pf.org === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></div>
      </div>
      <details><summary>How this list is ordered</summary><p class="small-text">Overdue, then blocked, then result not received, then not yet acknowledged, then due soon; ties broken by earliest due date. Rules are configurable by your organisation. Not acknowledged is shown separately from overdue so you can tell a missing acknowledgement from a missed step.</p></details>
      <p class="small-text muted" role="status">${shown.length} item${shown.length === 1 ? '' : 's'} shown. ${resolved} no longer flagged (for example after the patient acts).</p>
      <ul class="work">${shown.length ? shown.map(li).join('') : '<li>No items match these filters.</li>'}</ul>`;
  }

  function openDrawer(id) {
    const i = workItems().find((x) => x.id === id); if (!i) return;
    const d = $('#drawer'); const src = SOURCES.find((s) => s.id === i.sync);
    const sent = S.sent[i.id] || [];
    const [rl, rc, rexp] = i.reason ? REASONS[i.reason] : ['No longer flagged', 'ok', 'This item no longer meets a flag rule.'];
    d.innerHTML = `
      <div class="dialog-head"><div><p class="eyebrow">Patient summary (fictional)</p><h2 id="drawer-title">${esc(i.patient)} · ${esc(i.title)}</h2></div>
      <button type="button" class="btn secondary small" data-do="pvclose:x" aria-label="Close summary">Close</button></div>
      <div class="chips">${chip(rc, '!', rl)}</div>
      <p class="small-text"><strong>Why flagged:</strong> ${esc(rexp)}</p>
      <dl class="dl"><dt>Requested by</dt><dd>${esc(i.requestedBy)}</dd><dt>Next step owner</dt><dd>${esc(i.owner)}</dd><dt>Source</dt><dd>${esc(i.org)} · ${esc(i.source)}</dd><dt>Source status</dt><dd>${src && src.status === 'ok' ? 'Up to date (' + esc(src.last) + ')' : '<span class="sync-stale">⚠ Feed stale since ' + esc(src ? src.last : 'unknown') + '. Status may be out of date.</span>'}</dd><dt>Acknowledgement</dt><dd>${i.ack ? 'Acknowledged by patient' : 'Not acknowledged'}</dd><dt>Latest activity</dt><dd>${esc(i.activity)}</dd><dt>Contact attempts</dt><dd>${sent.length ? '<ul>' + sent.map((s) => `<li>${esc(s)}</li>`).join('') + '</ul>' : 'None recorded'}</dd></dl>
      <form id="pvform" data-id="${i.id}">
        <div class="field"><label for="pv-tpl">Pre-approved reminder template</label>
          <select id="pv-tpl"><option>Gentle reminder: please check your ${esc(i.title.toLowerCase())}</option><option>Please tell us if you have already arranged this elsewhere</option><option>We are chasing this on your behalf; no action needed from you</option></select></div>
        ${sent.length ? `<div class="notice attn"><span aria-hidden="true">⚠</span><p>A contact was already recorded (${esc(sent[sent.length - 1])}). Sending another may create duplicate reminders.</p></div>` : ''}
        <div class="field"><label for="pv-note">Coordination note (optional)</label><textarea id="pv-note" maxlength="300"></textarea></div>
        <div class="btn-row"><button class="btn" type="submit">Send reminder (simulated)</button></div>
      </form>
      <p class="hint">Simulated: no message leaves this browser. Every contact is added to the audit log. Escalation follows your organisation's approved protocol; this prototype does not decide escalation.</p>`;
    if (!d.open) d.showModal();
  }

  function viewIntegrations() {
    return `<h1 tabindex="-1">Integration status</h1>
      <p class="lede">Last successful sync and affected records for each connected source.</p>
      <ul class="list">${SOURCES.map((s) => `<li class="row-card"><h3>${esc(s.name)}</h3>
        <div class="chips">${s.status === 'ok' ? chip('ok', '✓', 'Up to date') : chip('attn', '⚠', 'Source may be out of date')}</div>
        <dl class="dl"><dt>System</dt><dd>${esc(s.kind)}</dd><dt>Last successful sync</dt><dd>${esc(s.last)}</dd><dt>Affected records</dt><dd>${esc(s.affected)}</dd><dt>Failure reason</dt><dd>${esc(s.reason || 'None')}</dd></dl></li>`).join('')}</ul>`;
  }
  function viewAudit() {
    const rows = [...S.audit].reverse().concat(SEED_AUDIT);
    return `<h1 tabindex="-1">Audit log</h1>
      <p class="lede">Append-only record of access and change events (simulated). Your actions in this demo appear at the top.</p>
      <ol class="list">${rows.map((r) => `<li class="row-card"><strong>${esc(r.what)}</strong><br><span class="muted small-text">${esc(r.who)} · ${esc(r.t)}</span></li>`).join('')}</ol>`;
  }

  /* ---------- routing / render ---------- */
  const ROUTES = { overview: viewOverview, journey: viewJourney, actions: viewActions, records: viewRecords, meds: viewMeds, messages: viewMessages, team: viewTeam, dashboard: viewDashboard, integrations: viewIntegrations, audit: viewAudit };
  let current = '';

  function renderNav(route) {
    const provider = PROVIDER_NAV.some(([k]) => k === route);
    const nav = provider ? PROVIDER_NAV : PATIENT_NAV;
    const open = counts(allActions()).open;
    $('#nav').innerHTML = `<ul>${nav.map(([k, l]) => `<li><a href="#/${k}"${k === route ? ' aria-current="page"' : ''}>${l}${k === 'actions' && open ? `<span class="nav-badge" aria-label="${open} open">${open}</span>` : ''}</a></li>`).join('')}</ul>`;
    $('#p-patient').setAttribute('aria-current', provider ? 'false' : 'page');
    $('#p-provider').setAttribute('aria-current', provider ? 'page' : 'false');
  }

  function render(navigated) {
    const route = (location.hash.replace(/^#\//, '') || 'overview').split('?')[0];
    const key = ROUTES[route] ? route : 'overview';
    const focusKey = !navigated && document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk : null;
    const scroll = window.scrollY;
    $('#main').innerHTML = ROUTES[key]();
    renderNav(key);
    document.title = `${(PATIENT_NAV.concat(PROVIDER_NAV).find(([k]) => k === key) || [0, 'Overview'])[1]} · HEALNEXIA prototype`;
    if (navigated) {
      window.scrollTo(0, 0);
      const h = $('#main h1'); if (h) h.focus();
      if (key === 'messages' && $('#m-text').value) { $('#m-text').focus(); $('#m-text').setSelectionRange(1e4, 1e4); }
    } else {
      window.scrollTo(0, scroll);
      if (focusKey) { const el = $(`[data-fk="${focusKey}"]`); if (el) el.focus(); }
    }
    current = key;
  }

  /* ---------- events ---------- */
  const H = {
    ack: (id) => { mutate(id, { status: 'acknowledged', verification: 'reported' }, 'You', 'Acknowledged (patient-reported)'); announce('Action acknowledged.'); },
    booking: (id) => { mutate(id, { status: 'in_progress' }, 'You', 'Opened scheduling handoff (simulated)'); announce('Booking started in simulated scheduling handoff.'); },
    booked: (id) => { mutate(id, { status: 'scheduled', verification: 'reported' }, 'You', 'Marked as booked elsewhere (patient-reported)'); announce('Marked as booked elsewhere.'); },
    complete: (id) => { mutate(id, { status: 'completed', verification: 'reported', completedAt: TODAY, evidence: null }, 'You', 'Marked complete (patient-reported; awaiting verification)'); announce('Marked complete. Counts updated. This is recorded as patient-reported until your provider verifies it.'); },
    reopen: (id) => { mutate(id, { status: 'acknowledged', completedAt: null }, 'You', 'Reopened'); announce('Action reopened.'); },
    ask: (id) => { UI.compose = { ctx: 'action:' + id, prefix: '' }; location.hash = '#/messages'; },
    problem: (id) => { UI.compose = { ctx: 'action:' + id, prefix: 'Problem with this step: ' }; location.hash = '#/messages'; },
    medask: (id) => { UI.compose = { ctx: 'med:' + id, prefix: '' }; location.hash = '#/messages'; },
    pv: (id) => openDrawer(id),
    pvclose: () => $('#drawer').close(),
    reset: () => { if (confirm('Reset all demo interactions in this browser?')) { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } load(); UI.compose = null; announce('Demo reset.'); } }
  };

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-do]');
    if (b) {
      const [verb, ...rest] = b.dataset.do.split(':'); const id = rest.join(':');
      if (!H[verb]) return;
      const before = location.hash; H[verb](id);
      if (location.hash === before) render(false);
      else renderNav(current);
      return;
    }
    const tl = e.target.closest('[data-tl]'); if (tl) { UI.tl = tl.dataset.tl; render(false); return; }
    const tab = e.target.closest('[data-tab]'); if (tab) { UI.tab = tab.dataset.tab; render(false); }
  });

  document.addEventListener('toggle', (e) => {
    const d = e.target.dataset && e.target.dataset.d; if (d) { e.target.open ? UI.open.add(d) : UI.open.delete(d); }
  }, true);

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'tl-group') { UI.group = t.checked; render(false); $('#tl-group').focus(); }
    else if (t.dataset && t.dataset.med) { S.remind[t.dataset.med] = t.checked; save(); announce(`Reminder ${t.checked ? 'on' : 'off'} for this medicine.`); }
    else if (t.id === 'rec-t') { UI.rec.type = t.value; updateRecords(); }
    else if (t.id === 'm-ctx') { $('#m-to').textContent = 'To: ' + ctxInfo(t.value).withWho; }
    else if (t.id === 'pf-r') { UI.pf.reason = t.value; render(false); $('#pf-r').focus(); }
    else if (t.id === 'pf-o') { UI.pf.org = t.value; render(false); $('#pf-o').focus(); }
  });
  document.addEventListener('input', (e) => { if (e.target.id === 'rec-q') { UI.rec.q = e.target.value; updateRecords(); } });
  function updateRecords() {
    const r = recordList();
    $('#rec-list').innerHTML = r.html || '<li>No records match your search.</li>';
    $('#rec-count').textContent = `${r.count} record${r.count === 1 ? '' : 's'} shown.`;
  }

  const URGENT = /chest pain|can'?t breathe|cannot breathe|collaps|overdose|suicid|self[- ]harm|severe bleeding|stroke|unconscious|allergic reaction/i;
  document.addEventListener('submit', (e) => {
    const f = e.target;
    if (f.id === 'checkin') {
      e.preventDefault();
      const v = f.querySelector('input[name="mood"]:checked');
      if (!v) { $('#ci-err').textContent = 'Please choose one option.'; return; }
      S.checkin = { date: TODAY, value: v.value, note: $('#ci-note').value.trim() };
      mutate('A-1051', { status: 'completed', verification: 'reported', completedAt: TODAY, evidence: null }, 'You', 'Check-in saved (patient-reported)');
      announce('Check-in saved. Counts updated.'); render(false);
    } else if (f.id === 'msgform') {
      e.preventDefault();
      const text = $('#m-text').value.trim(); const err = $('#m-err');
      if (!text) { err.textContent = 'Please write a message first.'; return; }
      if (URGENT.test(text) && f.dataset.confirm !== '1') {
        err.textContent = 'This sounds like it may be urgent. Messages are not monitored for emergencies. Please call your local emergency number or contact an urgent care service now. If you are sure this is not urgent, press Send message again.';
        f.dataset.confirm = '1'; return;
      }
      const ctx = $('#m-ctx').value; const info = ctxInfo(ctx);
      let c = S.convos.find((x) => x.ctx === ctx);
      if (!c) { c = { id: 'c' + Date.now(), ctx, subject: info.subject, withWho: info.withWho, msgs: [] }; S.convos.unshift(c); }
      c.msgs.push({ me: true, who: 'You', t: stamp(), text, status: 'Delivered (simulated) · not yet read' });
      S.audit.push({ t: stamp(), who: 'Alex Morgan (patient)', what: `Message sent about “${info.subject}”` }); save();
      announce('Message added to the conversation.'); render(false);
    } else if (f.id === 'pvform') {
      e.preventDefault();
      const id = f.dataset.id; const item = workItems().find((x) => x.id === id);
      const tpl = $('#pv-tpl').value; const note = $('#pv-note').value.trim();
      const line = `${stamp()} · “${tpl}”`;
      (S.sent[id] = S.sent[id] || []).push(line);
      S.audit.push({ t: stamp(), who: 'Dr Priya Nair (provider, simulated)', what: `Sent reminder “${tpl}” to ${item.patient} about ${item.title}${note ? '. Note: ' + note : ''}` });
      if (item.live) {
        const c = S.convos.find((x) => x.ctx === 'action:' + item.actionId);
        if (c) c.msgs.push({ me: false, who: 'Riverside care team (reminder)', t: stamp(), text: tpl, status: 'Delivered (simulated)' });
      }
      save(); announce('Reminder recorded in the audit log (simulated).');
      openDrawer(id); render(false);
    }
  });

  $('#drawer').addEventListener('click', (e) => { if (e.target === $('#drawer')) $('#drawer').close(); });
  window.addEventListener('hashchange', () => render(true));

  load();
  render(true);
})();
