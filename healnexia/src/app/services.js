/**
 * Application services. Each has a single responsibility and receives its dependencies
 * (store, clock, seed data) explicitly; none touches the DOM.
 */
import { planCommand, summarise, nextPatientAction, DomainError } from '../domain/actions.js';
import { deriveWorkItems } from '../domain/worklist.js';
import { validateMessage, looksUrgent, parseContext } from '../domain/messages.js';
import { appendCapped, CAPS } from '../infra/schema.js';
import { sanitizeText, LIMITS } from '../lib/text.js';

export const CHECKIN_OPTIONS = Object.freeze(['Feeling well', 'Mostly well', 'Not great', 'Unwell', 'Prefer not to say']);
const PATIENT_ACTOR = 'You';

export function createServices({ store, clock, seed }) {
  const baseById = new Map(seed.ACTIONS.map((a) => [a.id, a]));
  const medById = new Map(seed.MEDS.map((m) => [m.id, m]));
  const workById = new Map(seed.WORK.map((w) => [w.id, w]));

  const audit = {
    list: () => [...store.getState().audit].reverse().concat(seed.SEED_AUDIT),
    /** Used inside other services' updates so the change and its audit entry commit atomically. */
    append: (draft, who, what) => { draft.audit = appendCapped(draft.audit, { t: clock.stamp(), who, what: sanitizeText(what, LIMITS.auditText) }, CAPS.audit); }
  };

  const actions = {
    get(id) {
      const base = baseById.get(id);
      if (!base) throw new DomainError(`Unknown action ${id}`);
      const { hist = [], ...override } = store.getState().actions[id] || {};
      return { ...base, ...override, history: [...base.history, ...hist] };
    },
    list: () => seed.ACTIONS.map((a) => actions.get(a.id)),
    summary: () => summarise(actions.list(), clock.today),
    next: () => nextPatientAction(actions.list(), clock.today),

    /** Executes a patient command. Returns the text to announce. Throws DomainError if not allowed. */
    run(id, command) {
      const action = actions.get(id);
      const plan = planCommand(action, command, { today: clock.today, timestamp: clock.stamp(), actor: PATIENT_ACTOR });
      store.update((draft) => {
        applyPlan(draft, id, plan);
        audit.append(draft, 'Alex Morgan (patient)', `${plan.entry.what}: ${action.title}`);
      });
      return plan.announce;
    },

    saveCheckin(value, rawNote) {
      if (!CHECKIN_OPTIONS.includes(value)) return { ok: false, error: 'Please choose one option.' };
      const plan = planCommand(actions.get('A-1051'), 'completeCheckin', { today: clock.today, timestamp: clock.stamp(), actor: PATIENT_ACTOR });
      store.update((draft) => {
        applyPlan(draft, 'A-1051', plan);
        draft.checkin = { date: clock.today, value, note: sanitizeText(rawNote, LIMITS.checkinNote) };
        audit.append(draft, 'Alex Morgan (patient)', 'Wellbeing check-in saved');
      });
      return { ok: true, announce: plan.announce };
    }
  };

  function applyPlan(draft, id, plan) {
    const current = draft.actions[id] || { hist: [] };
    draft.actions[id] = { ...current, ...plan.patch, hist: appendCapped(current.hist || [], plan.entry, CAPS.history) };
  }

  const contexts = {
    parse: (ctx) => parseContext(ctx, { actionIds: [...baseById.keys()], medIds: [...medById.keys()] }),
    isKnown: (ctx) => contexts.parse(ctx) !== null,
    describe(ctx) {
      const p = contexts.parse(ctx);
      if (!p || p.kind === 'general') return { subject: 'General question', withWho: 'Riverside Medical Practice care team' };
      if (p.kind === 'pharmacist') return { subject: 'Question for a pharmacist', withWho: 'Harbour Pharmacy pharmacist' };
      if (p.kind === 'action') { const a = actions.get(p.id); return { subject: a.title, withWho: `${a.org} team` }; }
      const m = medById.get(p.id); return { subject: m.name, withWho: `${m.replyTo} team` };
    },
    /** Message contexts the patient can choose: general, open actions, and medications. */
    options() {
      return [{ value: 'general', label: 'General (non-urgent)' }, { value: 'pharmacist', label: 'Ask a pharmacist (medicines, supplements, over-the-counter)' }]
        .concat(actions.list().filter((a) => a.status !== 'completed' && a.status !== 'cancelled').map((a) => ({ value: `action:${a.id}`, label: `Action: ${a.title}` })))
        .concat(seed.MEDS.map((m) => ({ value: `med:${m.id}`, label: `Medication: ${m.name}` })));
    }
  };

  function appendToConversation(draft, ctx, message) {
    let convo = draft.conversations.find((c) => c.ctx === ctx);
    if (!convo) {
      const info = contexts.describe(ctx);
      convo = { id: `c-${Date.now().toString(36)}`, ctx, subject: info.subject, withWho: info.withWho, msgs: [] };
      draft.conversations = appendCapped(draft.conversations, convo, CAPS.conversations);
      convo = draft.conversations[draft.conversations.length - 1];
    }
    convo.msgs = appendCapped(convo.msgs, message, CAPS.messages);
  }

  const messages = {
    list: () => [...store.getState().conversations].reverse(),
    /**
     * @returns {{status:'sent'|'invalid'|'needs_confirmation', error?:string}}
     * Urgent-sounding text needs explicit confirmation that it is not urgent.
     */
    send(ctx, rawText, { confirmedNonUrgent = false } = {}) {
      if (!contexts.isKnown(ctx)) return { status: 'invalid', error: 'Please choose what your message is about.' };
      const v = validateMessage(rawText);
      if (!v.ok) return { status: 'invalid', error: v.error };
      if (looksUrgent(v.text) && !confirmedNonUrgent) {
        return { status: 'needs_confirmation', error: 'This sounds like it may be urgent. Messages are not monitored for emergencies. Please call your local emergency number or contact an urgent care service now. If you are sure this is not urgent, press Send message again.' };
      }
      store.update((draft) => {
        appendToConversation(draft, ctx, { me: true, who: 'You', t: clock.stamp(), text: v.text, status: 'Delivered (simulated) · not yet read' });
        audit.append(draft, 'Alex Morgan (patient)', `Message sent about "${contexts.describe(ctx).subject}"`);
      });
      return { status: 'sent' };
    }
  };

  const preferences = {
    reminderOn: (medId) => store.getState().reminders[medId] === true,
    setReminder(medId, on) {
      if (!medById.has(medId)) throw new DomainError(`Unknown medication ${medId}`);
      store.update((draft) => { if (on) draft.reminders[medId] = true; else delete draft.reminders[medId]; });
    }
  };

  const provider = {
    items: () => deriveWorkItems(seed.WORK, actions.get, seed.SOURCES, clock.today),
    get: (id) => provider.items().find((i) => i.id === id) || null,
    contacts: (id) => store.getState().contacts[id] || [],
    /** Simulated reminder. Template is chosen by index from the approved list; free text is only a note. */
    sendReminder(workId, templateIndex, rawNote) {
      if (!workById.has(workId)) throw new DomainError(`Unknown work item ${workId}`);
      const index = Number(templateIndex);
      if (!Number.isInteger(index) || index < 0 || index >= seed.REMINDER_TEMPLATES.length) throw new DomainError('Unknown reminder template');
      const item = provider.get(workId);
      const template = seed.REMINDER_TEMPLATES[index];
      const note = sanitizeText(rawNote, LIMITS.providerNote);
      store.update((draft) => {
        draft.contacts[workId] = appendCapped(draft.contacts[workId] || [], `${clock.stamp()} · "${template}"`, CAPS.contacts);
        audit.append(draft, 'Dr Priya Nair (provider, simulated)', `Reminder "${template}" to ${item.patient} about ${item.title}${note ? `. Note: ${note}` : ''}`);
        if (item.live) appendToConversation(draft, `action:${item.actionId}`, { me: false, who: `${item.org} (reminder)`, t: clock.stamp(), text: template, status: 'Delivered (simulated)' });
      });
    }
  };

  return Object.freeze({ actions, contexts, messages, preferences, provider, audit, reset: () => store.reset() });
}
