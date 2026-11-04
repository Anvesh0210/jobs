# HEALNEXIA prototype architecture

Zero-runtime-dependency ES modules, layered so each piece has one reason to change and depends only on the layers below it.

```text
src/main.js                composition root: wires concrete implementations together
  └─ ui/app.js             routing, rendering, focus, event delegation (handler registries)
       └─ ui/views/*.js    pure functions: (services, clock, seed, ui state) → SafeHtml
       └─ ui/components.js presentational atoms (chips, notices, tiles)
  └─ app/services.js       use cases: actions, messages, preferences, provider, audit, contexts
  └─ app/store.js          single state container: frozen, validated on every write, persisted
  └─ infra/schema.js       persisted-state schema, migration, sanitisation (storage is untrusted)
  └─ infra/storage.js      KeyValueStorage adapters: WebStorage (with fallback) and MemoryStorage
  └─ domain/*.js           pure business rules: CareAction state machine, worklist rules, messaging rules
  └─ lib/*.js              html templating + single DOM sink, clock, text hygiene
  └─ data/seed.js          deep-frozen fictional source data
```

## SOLID in practice

| Principle | Where |
|---|---|
| Single responsibility | Domain rules, persistence, sanitisation, use cases and rendering live in separate modules; views never mutate state and services never touch the DOM. |
| Open/closed | Patient commands are entries in `domain/actions.js#COMMANDS`; worklist flags are ordered rules in `domain/worklist.js`; UI handlers are registries in `ui/app.js`. You add behaviour by adding an entry, not by editing a switch. |
| Liskov substitution | `WebStorage` and `MemoryStorage` implement the same `KeyValueStorage` contract and are interchangeable (tests use memory, browsers use web storage, and blocked storage degrades transparently). |
| Interface segregation | Services expose small, purpose-specific facades (`actions`, `messages`, `preferences`, `provider`, `audit`, `contexts`) instead of one wide API. |
| Dependency inversion | Store, services and app receive storage, clock, seed data and DOM handles as parameters. Only `main.js` knows concrete implementations. |

## Key invariants

- **CareAction state machine.** Status changes must be allowed by `TRANSITIONS`, and commands check `available()` before planning. Overdue is derived, never stored.
- **Patient-reported ≠ verified.** Any patient-initiated change sets `verification: 'reported'`. Only a patient-reported completion can be reopened.
- **Append-only history and audit.** Base history is frozen seed data; user history is appended and capped. The change and its audit entry commit in one store update.
- **No partial writes.** `store.update()` runs the mutator on a clone and rejects the result if it would not survive schema sanitisation unchanged.
- **One HTML sink.** `lib/html.js#mount()` is the only `innerHTML` assignment and accepts only `SafeHtml` from the auto-escaping `html` tag. `tools/check.mjs` enforces this in CI.

## Data flow for a patient action

```text
click [data-do="command"] → ui/app.js clicks.command
  → services.actions.run(id, command)
      → domain.planCommand(action, command)   (validates availability + transition)
      → store.update(draft → apply patch, append history, append audit)
           → schema check → freeze → persist → notify
  → announce (aria-live) → re-render, restore focus
```

## Testing

- `npm run check`: syntax, banned DOM sinks, dynamic code, inline handlers/styles, direct storage access.
- `npm test`: unit tests for templating/escaping, the state machine, worklist rules, schema sanitisation against hostile input, store invariants, services and server path handling.
- `npm run test:e2e`: Playwright against the app served with production headers. It covers PRD §16 acceptance criteria, keyboard use, 320/768/1280px reflow, XSS payloads, hostile storage and zero CSP violations.
