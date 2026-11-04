/**
 * Composition root: the only place that knows about concrete implementations.
 * Everything else receives its dependencies, which keeps modules testable and swappable.
 */
import * as seed from './data/seed.js';
import { createClock } from './lib/clock.js';
import { createBrowserStorage } from './infra/storage.js';
import { sanitizeState } from './infra/schema.js';
import { createStore } from './app/store.js';
import { createServices } from './app/services.js';
import { parseContext } from './domain/messages.js';
import { createApp } from './ui/app.js';

const STORAGE_KEY = 'healnexia-prototype';

const clock = createClock({ today: seed.DEMO_TODAY });
const ids = {
  actionIds: seed.ACTIONS.map((a) => a.id),
  medIds: seed.MEDS.map((m) => m.id),
  workIds: seed.WORK.map((w) => w.id)
};
const sanitize = (input) => sanitizeState(input, {
  ...ids,
  seedConversations: seed.SEED_CONVERSATIONS,
  isKnownContext: (ctx) => parseContext(ctx, ids) !== null
});

/** One-off migration from the first prototype's storage key. */
function migrateLegacyKey(storage) {
  const legacy = 'healnexia-prototype-v1';
  const old = storage.read(legacy);
  if (old !== null && storage.read(STORAGE_KEY) === null) storage.write(STORAGE_KEY, old);
  if (old !== null) storage.remove(legacy);
}

const storage = createBrowserStorage();
migrateLegacyKey(storage);
const store = createStore({ storage, key: STORAGE_KEY, sanitize });
const svc = createServices({ store, clock, seed });

createApp({ doc: document, win: window, store, svc, clock, seed }).start();
