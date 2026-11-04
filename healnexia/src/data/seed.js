/**
 * Fictional demonstration data. No real people, organisations or clinical records.
 * Deep-frozen so no module can mutate source "records"; mutable user state lives in the store.
 */

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

export const DEMO_TODAY = '2026-11-04';

export const PATIENT = deepFreeze({ name: 'Alex Morgan', first: 'Alex' });

export const SOURCES = deepFreeze([
  { id: 'riv', name: 'Riverside Medical Practice', kind: 'GP clinical system', last: '4 Nov 2026, 07:30', status: 'ok', affected: 'None', reason: '' },
  { id: 'nor', name: 'Northbank Hospital', kind: 'Hospital outpatient system', last: '3 Nov 2026, 22:10', status: 'ok', affected: 'None', reason: '' },
  { id: 'lak', name: 'Lakeside Diagnostics', kind: 'Laboratory system', last: '4 Nov 2026, 06:00', status: 'ok', affected: 'None', reason: '' },
  { id: 'har', name: 'Harbour Pharmacy', kind: 'Pharmacy system', last: '1 Nov 2026, 18:45', status: 'stale', affected: '2 medication records, 1 vaccination record', reason: 'Connection timed out (simulated). Retrying hourly.' }
]);

export const TEAM = deepFreeze([
  { name: 'Dr Priya Nair', role: 'GP', org: 'Riverside Medical Practice', note: 'Usual GP' },
  { name: 'Sam Whitlock', role: 'Care coordinator', org: 'Riverside Medical Practice', note: 'Arranges tests and follow-ups' },
  { name: 'Dr Marcus Obi', role: 'Consultant cardiologist', org: 'Northbank Hospital', note: 'Outpatient clinic' },
  { name: 'Hana Rahimi', role: 'Pharmacist', org: 'Harbour Pharmacy', note: 'Medicine reviews' }
]);

export const ACTIONS = deepFreeze([
  {
    id: 'A-1042', type: 'test', title: 'Follow-up blood test', status: 'unacknowledged', owner: 'patient', priority: 1,
    rationale: 'Dr Nair asked for a blood test after your ramipril dose changed on 21 October. The care team will review the result with you.',
    requestedBy: 'Dr Priya Nair (GP)', responsible: 'You (to book and attend)', org: 'Riverside Medical Practice', system: 'GP clinical system',
    due: '2026-11-09', updated: '2026-11-02', verification: 'source', episode: 'EP-1', links: ['E-10', 'E-4'], evidence: null,
    history: [{ t: '2 Nov, 16:10', who: 'Dr Priya Nair', what: 'Request created' }, { t: '2 Nov, 16:12', who: 'System', what: 'Sent to you (unacknowledged)' }]
  },
  {
    id: 'A-1038', type: 'appointment', title: 'Cardiology outpatient appointment', status: 'scheduled', owner: 'provider', priority: 3,
    rationale: 'A clinic review with the cardiology team at Northbank Hospital.',
    requestedBy: 'Dr Marcus Obi (Cardiology)', responsible: 'Northbank Hospital (appointment booked)', org: 'Northbank Hospital', system: 'Hospital outpatient system',
    due: null, scheduledNote: '18 Nov 2026, 10:20, Outpatients Level 2', updated: '2026-10-28', verification: 'source', episode: 'EP-2', links: ['E-8'], evidence: null,
    history: [{ t: '12 Oct, 11:00', who: 'Northbank Hospital', what: 'Appointment created' }, { t: '28 Oct, 09:15', who: 'Northbank Hospital', what: 'Scheduled for 18 Nov' }]
  },
  {
    id: 'A-1033', type: 'medication_review', title: 'Pharmacist medicine review', status: 'acknowledged', owner: 'patient', priority: 2,
    rationale: 'A short chat with your pharmacist about your current medicines and the recent dose change.',
    requestedBy: 'Dr Priya Nair (GP)', responsible: 'You (to book a slot)', org: 'Harbour Pharmacy', system: 'Pharmacy system',
    due: '2026-11-14', updated: '2026-10-30', verification: 'source', episode: 'EP-1', links: ['E-4'], evidence: null,
    history: [{ t: '21 Oct, 12:00', who: 'Dr Priya Nair', what: 'Request created' }, { t: '30 Oct, 18:00', who: 'You', what: 'Acknowledged' }]
  },
  {
    id: 'A-1029', type: 'referral', title: 'Echocardiogram booking', status: 'blocked', owner: 'provider', priority: 2,
    rationale: 'Northbank received the referral on 28 October and has not yet offered a date. The booking team owns the next step; you do not need to act.',
    requestedBy: 'Dr Marcus Obi (Cardiology)', responsible: 'Northbank Hospital booking team', org: 'Northbank Hospital', system: 'Hospital outpatient system',
    due: '2026-11-01', updated: '2026-10-28', verification: 'source', episode: 'EP-2', links: ['E-9'], evidence: null,
    history: [{ t: '2 Sep, 15:30', who: 'Dr Marcus Obi', what: 'Referral requested' }, { t: '28 Oct, 08:40', who: 'Northbank Hospital', what: 'Received, awaiting booking slot' }]
  },
  {
    id: 'A-1051', type: 'checkin', title: 'Weekly wellbeing check-in', status: 'created', owner: 'patient', priority: 3,
    rationale: 'A short, optional note about how you are feeling, to share at your next contact. It is not monitored in real time.',
    requestedBy: 'Riverside Medical Practice', responsible: 'You', org: 'Riverside Medical Practice', system: 'HEALNEXIA check-in',
    due: '2026-11-06', updated: '2026-11-02', verification: 'source', episode: null, links: [], evidence: null,
    history: [{ t: '2 Nov, 09:00', who: 'System', what: 'Weekly check-in created' }]
  },
  {
    id: 'A-1017', type: 'document', title: 'Flu vaccination recorded', status: 'completed', owner: 'patient', priority: 3,
    rationale: 'Vaccination recorded by your pharmacy.',
    requestedBy: 'Riverside Medical Practice', responsible: 'Harbour Pharmacy', org: 'Harbour Pharmacy', system: 'Pharmacy system',
    due: '2026-10-31', updated: '2026-10-12', verification: 'source', evidence: 'Administration record received from Harbour Pharmacy on 12 Oct 2026', episode: null, links: ['E-6'],
    history: [{ t: '5 Oct, 10:00', who: 'Riverside', what: 'Request created' }, { t: '12 Oct, 14:20', who: 'Harbour Pharmacy', what: 'Completed (source-verified)' }]
  },
  {
    id: 'A-1009', type: 'document', title: 'Home blood pressure diary sent', status: 'completed', owner: 'patient', priority: 3,
    rationale: 'You sent a week of home readings to your GP.',
    requestedBy: 'Dr Priya Nair (GP)', responsible: 'You', org: 'Riverside Medical Practice', system: 'HEALNEXIA',
    due: '2026-10-20', updated: '2026-10-18', verification: 'reported', evidence: null, episode: 'EP-1', links: [],
    history: [{ t: '13 Oct, 09:00', who: 'Dr Priya Nair', what: 'Request created' }, { t: '18 Oct, 19:05', who: 'You', what: 'Marked complete (patient-reported)' }]
  }
]);

export const EVENTS = deepFreeze([
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
]);

export const EPISODES = deepFreeze({ 'EP-1': 'Blood pressure review (Oct to Nov 2026)', 'EP-2': 'Cardiology assessment (Aug to Nov 2026)' });

export const RECORDS = deepFreeze([
  { id: 'R-1', type: 'result', title: 'Cholesterol blood test', official: 'LIPID PROFILE - SERUM', org: 'Lakeside Diagnostics', date: '2026-10-25', flag: null },
  { id: 'R-2', type: 'result', title: 'Kidney function blood test', official: 'U&E PROFILE', org: 'Lakeside Diagnostics', date: '2026-09-30', flag: 'Source note: "Reviewed, no further action" (supplied by Riverside Medical Practice)' },
  { id: 'R-3', type: 'letter', title: 'Cardiology clinic letter', official: 'OPD LETTER - CARDIOLOGY', org: 'Northbank Hospital', date: '2026-09-02', flag: null },
  { id: 'R-4', type: 'letter', title: 'Day-unit discharge summary', official: 'DISCHARGE SUMMARY - DAY UNIT', org: 'Northbank Hospital', date: '2026-09-15', flag: null },
  { id: 'R-5', type: 'summary', title: 'GP consultation summary, 21 October', official: 'CONSULTATION SUMMARY', org: 'Riverside Medical Practice', date: '2026-10-21', flag: null },
  { id: 'R-6', type: 'result', title: 'Heart tracing (ECG) report', official: 'ECG 12-LEAD REPORT', org: 'Northbank Hospital', date: '2026-08-20', flag: null },
  { id: 'R-7', type: 'summary', title: 'Flu vaccination record', official: 'IMMUNISATION ADMIN RECORD', org: 'Harbour Pharmacy', date: '2026-10-12', flag: null }
]);

export const MEDS = deepFreeze([
  {
    id: 'ramipril', name: 'Ramipril 10 mg capsules', schedule: 'Take one capsule once a day (as written on the prescription)', indication: 'High blood pressure', prescriber: 'Dr Priya Nair',
    source: 'Riverside Medical Practice', replyTo: 'Harbour Pharmacy', reconciled: '2026-10-21', review: '2026-11-14', discrepancy: null,
    history: [{ d: '21 Oct 2026', t: 'Dose changed from 5 mg to 10 mg by Dr Priya Nair (Riverside Medical Practice).' }, { d: '3 Mar 2025', t: 'Started at 5 mg by Dr Priya Nair.' }]
  },
  {
    id: 'atorvastatin', name: 'Atorvastatin 20 mg tablets', schedule: 'Take one tablet in the evening (as written on the prescription)', indication: 'Cholesterol', prescriber: 'Dr Priya Nair',
    source: 'Riverside Medical Practice, Harbour Pharmacy', replyTo: 'Harbour Pharmacy', reconciled: '2026-08-04', review: '2027-02-01', discrepancy: null,
    history: [{ d: '4 Aug 2026', t: 'Repeat issued by Harbour Pharmacy. No change to dose.' }, { d: '12 Jun 2024', t: 'Started by Dr Priya Nair.' }]
  },
  {
    id: 'amlodipine', name: 'Amlodipine 5 mg tablets', schedule: 'Schedule not stated in the source', indication: 'Not stated', prescriber: 'Not stated',
    source: 'Northbank Hospital clinic letter (2 Sep 2026) only', replyTo: 'Riverside Medical Practice', reconciled: null, review: null,
    discrepancy: 'The Northbank clinic letter lists this medicine, but your GP record does not. HEALNEXIA has not chosen between the two. Please ask your pharmacist or GP to confirm before relying on either list.',
    history: [{ d: '2 Sep 2026', t: 'Mentioned in the cardiology clinic letter. No matching entry in the GP record.' }]
  }
]);

/** Provider worklist. Items with actionId are derived live from the patient's action state. */
export const WORK = deepFreeze([
  { id: 'W-1', actionId: 'A-1042', patient: 'Alex Morgan', age: 2 },
  { id: 'W-2', actionId: 'A-1029', patient: 'Alex Morgan', age: 7 },
  { id: 'W-3', patient: 'Sam Okafor', type: 'test', title: 'Post-discharge blood test', org: 'Riverside Medical Practice', source: 'GP clinical system', requestedBy: 'Dr Priya Nair', owner: 'Patient', due: '2026-11-06', age: 6, reason: 'unacknowledged', activity: 'Request sent 29 Oct. No patient activity since.', ack: false },
  { id: 'W-4', patient: 'Jordan Lee', type: 'referral', title: 'Dermatology referral booking', org: 'Northbank Hospital', source: 'Hospital outpatient system', requestedBy: 'Dr Priya Nair', owner: 'Northbank booking team', due: '2026-10-30', age: 15, reason: 'overdue', activity: 'Patient acknowledged on 21 Oct. Awaiting slot.', ack: true },
  { id: 'W-5', patient: 'Priya Shah', type: 'test', title: 'Repeat urine test', org: 'Lakeside Diagnostics', source: 'Laboratory system', requestedBy: 'Riverside Medical Practice', owner: 'Lakeside Diagnostics (result)', due: '2026-11-03', age: 12, reason: 'missing_result', activity: 'Patient reports sample given 24 Oct (patient-reported). No result received.', ack: true },
  { id: 'W-6', patient: 'Mateo Silva', type: 'medication_review', title: 'Medication review', org: 'Harbour Pharmacy', source: 'Pharmacy system', requestedBy: 'Dr Priya Nair', owner: 'Patient (to book)', due: '2026-11-08', age: 9, reason: 'approaching_due', activity: 'Patient acknowledged 2 Nov. Not yet booked.', ack: true },
  { id: 'W-7', patient: 'Chen Wei', type: 'document', title: 'Collect new prescription', org: 'Harbour Pharmacy', source: 'Pharmacy system', requestedBy: 'Dr Priya Nair', owner: 'Harbour Pharmacy (status feed)', due: '2026-11-05', age: 4, reason: 'blocked', activity: 'Pharmacy feed has not updated since 1 Nov, so collection cannot be confirmed.', ack: true }
]);

/** Pre-approved reminder templates. The UI submits an index; free text is never accepted as a template. */
export const REMINDER_TEMPLATES = deepFreeze([
  'Gentle reminder: please check this care step in HEALNEXIA',
  'Please tell us if you have already arranged this elsewhere',
  'We are chasing this on your behalf; no action needed from you'
]);

export const SEED_AUDIT = deepFreeze([
  { t: '4 Nov, 07:30', who: 'System', what: 'Sync completed: Riverside Medical Practice' },
  { t: '4 Nov, 06:00', who: 'System', what: 'Sync completed: Lakeside Diagnostics' },
  { t: '3 Nov, 22:10', who: 'System', what: 'Sync completed: Northbank Hospital' },
  { t: '3 Nov, 14:05', who: 'Sam Whitlock', what: 'Opened patient summary: Sam Okafor (purpose: care coordination)' },
  { t: '1 Nov, 18:45', who: 'System', what: 'Sync failed: Harbour Pharmacy (timeout, retrying)' }
]);

export const SEED_CONVERSATIONS = deepFreeze([
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
]);
