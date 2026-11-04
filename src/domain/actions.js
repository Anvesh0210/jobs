/**
 * CareAction domain model: statuses, the allowed state machine, and patient commands.
 * Pure functions only. No DOM, storage or clock access (dates are passed in).
 */

export const STATUSES = Object.freeze(['created', 'unacknowledged', 'acknowledged', 'scheduled', 'in_progress', 'blocked', 'completed', 'cancelled']);
export const VERIFICATIONS = Object.freeze(['source', 'reported']);
export const TYPE_LABEL = Object.freeze({ test: 'Test', appointment: 'Appointment', referral: 'Referral', medication_review: 'Medication review', checkin: 'Check-in', document: 'Document', task: 'Care-team task' });

/** Allowed status transitions (PRD 7.4). Anything else is rejected. */
export const TRANSITIONS = Object.freeze({
  created: ['unacknowledged', 'acknowledged', 'in_progress', 'completed', 'cancelled'],
  unacknowledged: ['acknowledged', 'in_progress', 'scheduled', 'completed', 'cancelled'],
  acknowledged: ['in_progress', 'scheduled', 'completed', 'cancelled'],
  in_progress: ['scheduled', 'blocked', 'completed', 'cancelled'],
  scheduled: ['in_progress', 'completed', 'cancelled'],
  blocked: ['in_progress', 'scheduled', 'cancelled'],
  completed: ['acknowledged'],
  cancelled: []
});

export class DomainError extends Error {
  constructor(message) { super(message); this.name = 'DomainError'; }
}

export function canTransition(from, to) {
  return from === to || (TRANSITIONS[from] || []).includes(to);
}

export const isOpen = (a) => a.status !== 'completed' && a.status !== 'cancelled';
/** Past due: open, has a due date before today, and not already scheduled. Overdue is derived, never stored. */
export const isPastDue = (a, today) => isOpen(a) && Boolean(a.due) && a.due < today && a.status !== 'scheduled';
const patientCanAct = (a) => isOpen(a) && a.owner === 'patient';
const BOOKABLE = new Set(['test', 'appointment', 'medication_review']);

export function summarise(actions, today) {
  return {
    open: actions.filter(isOpen).length,
    pastDue: actions.filter((a) => isPastDue(a, today)).length,
    awaitingProvider: actions.filter((a) => isOpen(a) && a.owner === 'provider').length,
    completed: actions.filter((a) => a.status === 'completed').length
  };
}

/**
 * Explicit, explainable ordering for the patient's next step:
 * past due first, then the requesting team's administrative priority, then nearest due date.
 * This is not clinical urgency.
 */
export function nextPatientAction(actions, today) {
  return actions
    .filter(patientCanAct)
    .sort((x, y) => (Number(isPastDue(y, today)) - Number(isPastDue(x, today)))
      || (x.priority - y.priority)
      || String(x.due || '9999').localeCompare(String(y.due || '9999')))[0] || null;
}

/**
 * Patient commands. Open/closed: add a command here without touching callers.
 * Each command declares when it is available and the change it makes.
 */
export const COMMANDS = Object.freeze({
  acknowledge: {
    label: 'Acknowledge', primary: true,
    available: (a) => a.status === 'unacknowledged',
    apply: () => ({ status: 'acknowledged', verification: 'reported' }),
    describe: 'Acknowledged (patient-reported)', announce: 'Action acknowledged.'
  },
  startBooking: {
    label: 'Start booking (simulated)',
    available: (a) => patientCanAct(a) && BOOKABLE.has(a.type) && !['scheduled', 'in_progress'].includes(a.status),
    apply: () => ({ status: 'in_progress' }),
    describe: 'Opened scheduling handoff (simulated)', announce: 'Booking started in the simulated scheduling handoff.'
  },
  markBookedElsewhere: {
    label: 'Mark as booked elsewhere',
    available: (a) => patientCanAct(a) && BOOKABLE.has(a.type) && a.status !== 'scheduled',
    apply: () => ({ status: 'scheduled', verification: 'reported' }),
    describe: 'Marked as booked elsewhere (patient-reported)', announce: 'Marked as booked elsewhere.'
  },
  markComplete: {
    label: 'Mark as complete',
    available: (a) => patientCanAct(a) && a.type !== 'checkin',
    apply: (a, today) => ({ status: 'completed', verification: 'reported', completedAt: today, evidence: null }),
    describe: 'Marked complete (patient-reported; awaiting verification)',
    announce: 'Marked complete. This is recorded as patient-reported until your provider verifies it.'
  },
  completeCheckin: {
    label: 'Save check-in', internal: true,
    available: (a) => patientCanAct(a) && a.type === 'checkin',
    apply: (a, today) => ({ status: 'completed', verification: 'reported', completedAt: today, evidence: null }),
    describe: 'Check-in saved (patient-reported)', announce: 'Check-in saved.'
  },
  reopen: {
    label: 'Reopen',
    // Only the patient's own unverified completion can be reopened; source-verified closure is authoritative.
    available: (a) => a.status === 'completed' && a.verification === 'reported' && a.owner === 'patient',
    apply: () => ({ status: 'acknowledged', completedAt: null }),
    describe: 'Reopened', announce: 'Action reopened.'
  }
});

/** Commands to offer as buttons for an action, in display order. */
export const availableCommands = (action) =>
  Object.entries(COMMANDS).filter(([, c]) => !c.internal && c.available(action)).map(([name, c]) => ({ name, ...c }));

/**
 * Validates and computes a command's effect. Returns the patch plus a history entry; never mutates.
 * @throws {DomainError} if the command is unknown, unavailable or would break the state machine.
 */
export function planCommand(action, name, { today, timestamp, actor = 'You' }) {
  if (!Object.hasOwn(COMMANDS, name)) throw new DomainError(`Unknown command: ${name}`);
  const command = COMMANDS[name];
  if (!command.available(action)) throw new DomainError(`"${command.label}" is not available for ${action.id} in status ${action.status}`);
  const patch = command.apply(action, today);
  if (patch.status && !canTransition(action.status, patch.status)) {
    throw new DomainError(`Transition ${action.status} → ${patch.status} is not allowed`);
  }
  return { patch, entry: { t: timestamp, who: actor, what: command.describe }, announce: command.announce };
}
