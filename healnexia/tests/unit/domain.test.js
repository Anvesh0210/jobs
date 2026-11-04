import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS, WORK, SOURCES, DEMO_TODAY } from '../../src/data/seed.js';
import {
  TRANSITIONS, STATUSES, canTransition, planCommand, availableCommands, isPastDue, summarise, nextPatientAction, DomainError
} from '../../src/domain/actions.js';
import { deriveWorkItems, sortWorkItems, filterWorkItems, flagFor } from '../../src/domain/worklist.js';
import { looksUrgent, validateMessage, parseContext } from '../../src/domain/messages.js';

const byId = (id) => ACTIONS.find((a) => a.id === id);
const opts = { today: DEMO_TODAY, timestamp: '4 Nov, 10:00' };

test('transition table covers every status and only references known statuses', () => {
  for (const s of STATUSES) assert.ok(Array.isArray(TRANSITIONS[s]), s);
  for (const targets of Object.values(TRANSITIONS)) for (const t of targets) assert.ok(STATUSES.includes(t), t);
  assert.equal(canTransition('cancelled', 'completed'), false);
  assert.equal(canTransition('completed', 'scheduled'), false);
});

test('acknowledge is only offered when unacknowledged and records patient-reported state', () => {
  const a = byId('A-1042');
  assert.ok(availableCommands(a).some((c) => c.name === 'acknowledge'));
  const plan = planCommand(a, 'acknowledge', opts);
  assert.deepEqual(plan.patch, { status: 'acknowledged', verification: 'reported' });
  assert.equal(plan.entry.who, 'You');
  assert.throws(() => planCommand({ ...a, status: 'acknowledged' }, 'acknowledge', opts), DomainError);
});

test('patients cannot act on provider-owned steps', () => {
  const a = byId('A-1029');
  assert.deepEqual(availableCommands(a), []);
  assert.throws(() => planCommand(a, 'markComplete', opts), DomainError);
});

test('source-verified completion cannot be reopened; patient-reported can', () => {
  assert.throws(() => planCommand(byId('A-1017'), 'reopen', opts), DomainError);
  assert.equal(planCommand(byId('A-1009'), 'reopen', opts).patch.status, 'acknowledged');
});

test('unknown and prototype-polluting command names are rejected', () => {
  for (const name of ['nope', '__proto__', 'constructor', 'toString']) {
    assert.throws(() => planCommand(byId('A-1042'), name, opts), DomainError);
  }
});

test('marking complete is patient-reported with no evidence', () => {
  const plan = planCommand(byId('A-1042'), 'markComplete', opts);
  assert.deepEqual(plan.patch, { status: 'completed', verification: 'reported', completedAt: DEMO_TODAY, evidence: null });
});

test('past due is derived and ignores scheduled and closed steps', () => {
  assert.equal(isPastDue(byId('A-1029'), DEMO_TODAY), true);
  assert.equal(isPastDue({ ...byId('A-1029'), status: 'scheduled' }, DEMO_TODAY), false);
  assert.equal(isPastDue(byId('A-1017'), DEMO_TODAY), false);
});

test('summary counts match the seed scenario', () => {
  assert.deepEqual(summarise(ACTIONS, DEMO_TODAY), { open: 5, pastDue: 1, awaitingProvider: 2, completed: 2 });
});

test('next patient action follows the documented ordering', () => {
  assert.equal(nextPatientAction(ACTIONS, DEMO_TODAY).id, 'A-1042');
  const overdueCheckin = ACTIONS.map((a) => (a.id === 'A-1051' ? { ...a, due: '2026-11-01' } : a));
  assert.equal(nextPatientAction(overdueCheckin, DEMO_TODAY).id, 'A-1051', 'past due outranks priority');
  assert.equal(nextPatientAction(ACTIONS.filter((a) => a.owner === 'provider'), DEMO_TODAY), null);
});

test('worklist flags live actions from their current state', () => {
  const get = (id) => ({ ...byId(id), history: byId(id).history });
  const items = deriveWorkItems(WORK, get, SOURCES, DEMO_TODAY);
  assert.equal(items.find((i) => i.id === 'W-1').reason, 'unacknowledged');
  assert.equal(items.find((i) => i.id === 'W-2').reason, 'overdue');
  assert.equal(flagFor({ ...byId('A-1042'), status: 'acknowledged' }, DEMO_TODAY), null);
  assert.equal(flagFor({ ...byId('A-1042'), status: 'completed' }, DEMO_TODAY), null);
  const sorted = sortWorkItems(items.filter((i) => i.reason)).map((i) => i.reason);
  assert.deepEqual(sorted, ['overdue', 'overdue', 'blocked', 'missing_result', 'unacknowledged', 'unacknowledged', 'approaching_due']);
  assert.equal(filterWorkItems(items, { reason: 'blocked' }).length, 1);
  assert.equal(filterWorkItems(items, { org: 'Harbour Pharmacy' }).length, 2);
});

test('urgent-language backstop', () => {
  assert.ok(looksUrgent('I have CHEST PAIN since this morning'));
  assert.ok(looksUrgent("I can't breathe properly"));
  assert.ok(!looksUrgent('Can I move my appointment to Tuesday?'));
});

test('message validation', () => {
  assert.equal(validateMessage('   ').ok, false);
  assert.equal(validateMessage('x'.repeat(1001)).ok, false);
  assert.deepEqual(validateMessage('  hello\u0000 '), { ok: true, text: 'hello' });
});

test('message contexts are a closed set', () => {
  const ids = { actionIds: ['A-1042'], medIds: ['ramipril'] };
  assert.deepEqual(parseContext('action:A-1042', ids), { kind: 'action', id: 'A-1042' });
  assert.deepEqual(parseContext('general', ids), { kind: 'general' });
  assert.deepEqual(parseContext('pharmacist', ids), { kind: 'pharmacist' });
  for (const bad of ['action:A-9999', 'med:../../x', 'action:A-1042"><script>', 'other:1', '', null]) {
    assert.equal(parseContext(bad, ids), null, String(bad));
  }
});
