import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as seed from '../../src/data/seed.js';
import { sanitizeState, emptyState, CAPS, SCHEMA_VERSION, canonical } from '../../src/infra/schema.js';
import { MemoryStorage, WebStorage } from '../../src/infra/storage.js';
import { createStore, StateInvariantError } from '../../src/app/store.js';
import { createServices } from '../../src/app/services.js';
import { createClock } from '../../src/lib/clock.js';
import { parseContext } from '../../src/domain/messages.js';
import { DomainError } from '../../src/domain/actions.js';

const ids = { actionIds: seed.ACTIONS.map((a) => a.id), medIds: seed.MEDS.map((m) => m.id), workIds: seed.WORK.map((w) => w.id) };
const sanitize = (input) => sanitizeState(input, { ...ids, seedConversations: seed.SEED_CONVERSATIONS, isKnownContext: (c) => parseContext(c, ids) !== null });
const clock = createClock({ today: seed.DEMO_TODAY, now: () => new Date(2026, 10, 4, 9, 41) });

function setup(raw) {
  const storage = new MemoryStorage();
  if (raw !== undefined) storage.write('k', raw);
  const store = createStore({ storage, key: 'k', sanitize });
  return { storage, store, svc: createServices({ store, clock, seed }) };
}

test('fresh state is valid and canonical', () => {
  const { state, repaired } = sanitize(null);
  assert.equal(repaired, false);
  assert.equal(state.v, SCHEMA_VERSION);
  assert.equal(canonical(sanitize(state).state), canonical(state));
});

test('corrupted JSON and wrong shapes reset safely and report repair', () => {
  for (const raw of ['{not json', '[]', '"x"', '42', JSON.stringify({ v: 99 })]) {
    const { store } = setup(raw);
    assert.equal(store.getState().v, SCHEMA_VERSION, raw);
    assert.equal(store.status().repaired, true, raw);
  }
});

test('hostile stored data is sanitised: unknown ids, bad enums, prototype keys, oversized arrays', () => {
  const hostile = JSON.parse(JSON.stringify({
    v: 2,
    actions: { 'A-1042': { status: 'hacked', verification: 'source', hist: [{ t: 'x', who: 'y', what: 'z' }, 'junk'] }, 'A-0000': { status: 'completed' } },
    reminders: { ramipril: true, evil: true, atorvastatin: 'yes' },
    conversations: [
      { id: 'c1', ctx: 'action:A-1042', subject: 's', withWho: 'w', msgs: [{ me: true, who: 'You', t: 't', text: '<img src=x onerror=alert(1)>', status: 's' }] },
      { id: 'bad id!', ctx: 'general', msgs: [] },
      { id: 'c9', ctx: 'javascript:alert(1)', msgs: [] }
    ],
    checkin: { date: 'not-a-date', value: 'x' },
    audit: Array.from({ length: CAPS.audit + 50 }, (_, i) => ({ t: 't', who: 'w', what: `e${i}` })),
    contacts: { 'W-3': ['ok', 7], 'W-999': ['x'] },
    extra: 'dropped'
  }));
  // An own "__proto__" key, exactly as JSON.parse would create from attacker-controlled storage.
  Object.defineProperty(hostile.actions, '__proto__', { value: { status: 'completed' }, enumerable: true });
  const { state, repaired } = sanitize(hostile);
  assert.equal(Object.hasOwn(state.actions, '__proto__'), false);
  assert.equal(repaired, true);
  assert.equal(state.actions['A-1042'].status, undefined, 'invalid enum dropped');
  assert.equal(state.actions['A-1042'].verification, 'source');
  assert.equal(state.actions['A-1042'].hist.length, 1);
  assert.equal(state.actions['A-0000'], undefined);
  assert.deepEqual(state.reminders, { ramipril: true });
  assert.equal(state.conversations.length, 1);
  assert.equal(state.conversations[0].msgs[0].text, '<img src=x onerror=alert(1)>', 'stored as text; escaped at render time');
  assert.equal(state.checkin, null);
  assert.equal(state.audit.length, CAPS.audit);
  assert.equal(state.audit.at(-1).what, `e${CAPS.audit + 49}`, 'keeps newest entries');
  assert.deepEqual(state.contacts, { 'W-3': ['ok'] });
  assert.equal('extra' in state, false);
  assert.equal(Object.getPrototypeOf(state.actions), Object.prototype);
});

test('v1 state from the first prototype migrates', () => {
  const v1 = { v: 1, act: { 'A-1042': { status: 'completed', verification: 'reported', completedAt: '2026-11-04', hist: [] } }, remind: { ramipril: true }, convos: [], checkin: null, audit: [], sent: {} };
  const { store, svc } = setup(JSON.stringify(v1));
  assert.equal(svc.actions.get('A-1042').status, 'completed');
  assert.equal(store.getState().reminders.ramipril, true);
});

test('state is deeply frozen', () => {
  const { store } = setup();
  assert.throws(() => { store.getState().audit.push({}); }, TypeError);
});

test('store rejects updates that would break the schema (no partial writes)', () => {
  const { store, storage } = setup();
  const before = storage.read('k');
  assert.throws(() => store.update((d) => { d.actions['A-1042'] = { status: 'bogus', hist: [] }; }), StateInvariantError);
  assert.equal(storage.read('k'), before);
  assert.equal(store.getState().actions['A-1042'], undefined);
});

test('command flow updates counts, history and audit atomically, and persists', () => {
  const { svc, storage } = setup();
  svc.actions.run('A-1042', 'acknowledge');
  svc.actions.run('A-1042', 'markComplete');
  const a = svc.actions.get('A-1042');
  assert.equal(a.status, 'completed');
  assert.equal(a.verification, 'reported');
  assert.equal(a.history.at(-1).what, 'Marked complete (patient-reported; awaiting verification)');
  assert.deepEqual(svc.actions.summary(), { open: 4, pastDue: 1, awaitingProvider: 2, completed: 3 });
  assert.match(svc.audit.list()[0].what, /^Marked complete/);
  // Reload from the same storage: state survives.
  const store2 = createStore({ storage, key: 'k', sanitize });
  assert.equal(createServices({ store: store2, clock, seed }).actions.get('A-1042').status, 'completed');
});

test('disallowed commands throw DomainError and change nothing', () => {
  const { svc, store } = setup();
  const before = store.getState();
  assert.throws(() => svc.actions.run('A-1029', 'markComplete'), DomainError);
  assert.throws(() => svc.actions.run('A-9999', 'acknowledge'), DomainError);
  assert.equal(store.getState(), before);
});

test('check-in validates the option and completes the check-in action', () => {
  const { svc, store } = setup();
  assert.equal(svc.actions.saveCheckin('<script>', 'x').ok, false);
  assert.equal(svc.actions.saveCheckin('Mostly well', ' note\u0000 ').ok, true);
  assert.deepEqual(store.getState().checkin, { date: seed.DEMO_TODAY, value: 'Mostly well', note: 'note' });
  assert.equal(svc.actions.get('A-1051').status, 'completed');
  assert.throws(() => svc.actions.saveCheckin('Mostly well', ''), DomainError, 'cannot complete twice');
});

test('messages: validation, urgent confirmation, unknown contexts, persistence', () => {
  const { svc } = setup();
  assert.equal(svc.messages.send('general', '').status, 'invalid');
  assert.equal(svc.messages.send('action:A-0000', 'hi').status, 'invalid');
  assert.equal(svc.messages.send('general', 'I have chest pain').status, 'needs_confirmation');
  assert.equal(svc.messages.send('general', 'I have chest pain', { confirmedNonUrgent: true }).status, 'sent');
  assert.equal(svc.messages.send('med:ramipril', 'Question about timing').status, 'sent');
  const convo = svc.messages.list()[0];
  assert.equal(convo.ctx, 'med:ramipril');
  assert.equal(convo.withWho, 'Harbour Pharmacy team');
});

test('reminder preferences only accept known medicines', () => {
  const { svc } = setup();
  svc.preferences.setReminder('ramipril', true);
  assert.equal(svc.preferences.reminderOn('ramipril'), true);
  svc.preferences.setReminder('ramipril', false);
  assert.equal(svc.preferences.reminderOn('ramipril'), false);
  assert.throws(() => svc.preferences.setReminder('__proto__', true), DomainError);
});

test('provider reminders: template by index only, audited, routed to the patient thread', () => {
  const { svc } = setup();
  assert.throws(() => svc.provider.sendReminder('W-1', 'Free text template', ''), DomainError);
  assert.throws(() => svc.provider.sendReminder('W-1', '7', ''), DomainError);
  assert.throws(() => svc.provider.sendReminder('W-404', '0', ''), DomainError);
  svc.provider.sendReminder('W-1', '1', 'Called, no answer');
  assert.equal(svc.provider.contacts('W-1').length, 1);
  assert.match(svc.audit.list()[0].what, /Called, no answer/);
  const thread = svc.messages.list().find((c) => c.ctx === 'action:A-1042');
  assert.equal(thread.msgs.at(-1).text, seed.REMINDER_TEMPLATES[1]);
});

test('patient acting removes the item from the provider worklist (closed loop)', () => {
  const { svc } = setup();
  assert.equal(svc.provider.get('W-1').reason, 'unacknowledged');
  svc.actions.run('A-1042', 'acknowledge');
  assert.equal(svc.provider.get('W-1').reason, null);
});

test('reset clears persisted state', () => {
  const { svc, store, storage } = setup();
  svc.actions.run('A-1042', 'acknowledge');
  store.reset();
  assert.equal(svc.actions.get('A-1042').status, 'unacknowledged');
  assert.equal(storage.read('k'), null);
  assert.deepEqual(store.getState(), emptyState(seed.SEED_CONVERSATIONS));
});

test('WebStorage degrades to memory when the backend throws', () => {
  const broken = { setItem() { throw new Error('denied'); }, getItem() { throw new Error('denied'); }, removeItem() {} };
  const s = new WebStorage(broken);
  assert.equal(s.persistent, false);
  assert.equal(s.write('a', '1'), false);
  assert.equal(s.read('a'), '1');
  let quota = false;
  const full = { setItem(k) { if (quota && k !== '__healnexia_probe__') throw new Error('QuotaExceeded'); }, getItem: () => null, removeItem() {} };
  const s2 = new WebStorage(full); quota = true;
  assert.equal(s2.write('a', '1'), false, 'quota errors are reported, not thrown');
});
