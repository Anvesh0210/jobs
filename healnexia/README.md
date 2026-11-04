# HEALNEXIA prototype

**Care, connected. Nothing important overlooked.**

Interactive prototype of the HEALNEXIA continuity-of-care platform (PRD v1.0). All people, organisations, dates and clinical details are **fictional**. This is not a medical device, gives no medical advice and connects to no healthcare system.

## Run

Requires Node 22 or later (no npm install needed to run).

```bash
npm start            # http://127.0.0.1:8080 (served with production security headers)
```

The app uses ES modules, so it must be served over HTTP; opening `index.html` from disk will not work. Any static host works (see [SECURITY.md](SECURITY.md#hosting) for headers).

## Test

```bash
npm run check        # static security checks
npm test             # unit tests (node:test, no dependencies)
npm run test:e2e     # browser tests (needs the playwright package + Chromium)
```

CI runs all three on Node 22 and 24 (`.github/workflows/healnexia.yml`).

## What it demonstrates

- **Patient view:**
  - Overview with the priority action and why it is first, care progress, counts, next appointment, care team and wellbeing check-in.
  - Care journey with type filters, episode grouping and provenance.
  - Action centre with a validated state machine (acknowledge, booking handoff, booked elsewhere, complete, reopen) and immutable history.
  - Searchable records, and medications with change history, source discrepancy and reminders.
  - Contextual messaging with an urgent-language backstop, plus data coverage and stale-source warnings.
- **Provider view:** a worklist ordered by explicit rules (not a risk score), a summary drawer, simulated reminders from approved templates with duplicate warnings, integration status and an audit log.
- **Closed loop:** patient actions update the provider worklist, provider reminders appear in the patient's thread, and every change is audited.
- Patient-reported and source-verified status are always distinguished.

## Engineering

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): layers, SOLID mapping, invariants and data flow.
- [SECURITY.md](SECURITY.md): threat model and mitigations.
- Accessibility: skip link, landmarks, visible focus, 44px targets, aria-live announcements, no colour-only status, reflow to 320px, and support for reduced-motion and high-contrast preferences.
- State persists in browser storage only, is validated on every read and write, syncs across tabs, and is cleared by "Reset demo".
