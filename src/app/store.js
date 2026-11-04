/**
 * Single source of truth for mutable user state.
 *
 * - State is deep-frozen; views cannot mutate it.
 * - Every update runs on a clone and must still satisfy the schema, or it is rejected (no partial writes).
 * - Persistence failures degrade to in-memory and are surfaced, never thrown at the user.
 */
import { canonical } from '../infra/schema.js';

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

export class StateInvariantError extends Error {
  constructor(message) { super(message); this.name = 'StateInvariantError'; }
}

export function createStore({ storage, key, sanitize }) {
  const listeners = new Set();
  let state;
  const status = { repaired: false, persistent: storage.persistent };

  function hydrate() {
    const raw = storage.read(key);
    let parsed = null; let corrupt = false;
    if (raw !== null) {
      try { parsed = JSON.parse(raw); } catch { corrupt = true; }
    }
    const result = sanitize(parsed);
    state = deepFreeze(result.state);
    status.repaired = corrupt || result.repaired;
    if (status.repaired) persist();
  }

  function persist() {
    status.persistent = storage.write(key, JSON.stringify(state)) && storage.persistent;
  }

  const emit = () => listeners.forEach((fn) => fn(state));

  hydrate();

  return {
    key,
    getState: () => state,
    status: () => ({ ...status }),
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    /**
     * Applies `mutator` to a draft copy. The result must already be schema-valid:
     * sanitisation is a check here, not a silent fix-up.
     */
    update(mutator) {
      const draft = structuredClone(state);
      const result = mutator(draft);
      const { state: checked } = sanitize(draft);
      if (canonical(checked) !== canonical(draft)) {
        throw new StateInvariantError('Update rejected: it would produce invalid state');
      }
      state = deepFreeze(checked);
      persist();
      emit();
      return result;
    },

    reset() {
      storage.remove(key);
      hydrate();
      status.repaired = false;
      emit();
    },

    /** Re-reads storage (e.g. after another tab changed it). */
    reload() { hydrate(); emit(); }
  };
}
