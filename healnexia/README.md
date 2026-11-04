# HEALNEXIA prototype

**Care, connected. Nothing important overlooked.**

Interactive prototype of the HEALNEXIA continuity-of-care platform (PRD v1.0). All people, organisations, dates and clinical details are **fictional**. This is not a medical device, gives no medical advice and connects to no healthcare system.

## Run

Requires Node 22 or later. No npm install is needed just to run it, because the built CSS is committed.

```bash
npm start            # http://127.0.0.1:8080 (served with production security headers)
```

HEALNEXIA is **one installable web app (PWA)**:
- `/` is the home page (`index.html`). It holds the story, the evidence plan and an interactive timeline, built with Tailwind CSS v4.
- `/app.html` is the app (patient and provider views). It shares the same design, navigation, manifest and service worker.
- It can be installed from the browser, and works offline after the first visit (`sw.js` precaches every file).

HEALNEXIA began as an app concept by Ayesha Afreen, Pharm.D, to connect people with pharmacists and other professionals. It won first prize at INNOVOTHON 2024. The site presents it as an evidence-first prototype: trust, pharmacist capacity, benefit and harm are evaluated before anyone relies on it. The app includes **Ask a pharmacist** (supplements and over-the-counter products) and **Report a suspected side effect**.

Both use ES modules, so they must be served over HTTP; opening the files from disk will not work. No Node? Run `python3 -m http.server 8080` in this folder. Any static host works (see [SECURITY.md](SECURITY.md#hosting) for headers).

## Develop the site styles

```bash
npm ci               # pinned Tailwind CLI + font package
npm run watch:css    # rebuild assets/site.css from site/styles.css on change
npm run build:css    # minified production build (commit the result; CI verifies it)
```

## Test

```bash
npm run check        # static security checks
npm test             # unit tests (node:test, no dependencies)
npm run test:e2e     # browser tests (needs the playwright package + Chromium)
```

CI checks the built CSS is current, then runs all three on Node 22 and 24 (`.github/workflows/healnexia.yml`).

## Marketing site

The marketing site follows a modern health-tech landing page flow:
- Sticky header with scrollspy and a popover mobile menu.
- Hero with a product mock-up and a scrolling strip of standards.
- A problem section with scrolling "pills" of common care gaps.
- Stacked, notched solution cards that recede as you scroll (CSS scroll-driven animations).
- An auto-scrolling "how it works" list with a data-flow diagram, plus a security principles carousel.
- An interactive timeline (WAI-ARIA tabs), persona tabs, impact cards, a five-step pilot plan, an FAQ and a call-to-action band.
- Validated "Join the pilot" and "Request a demo" dialogs. They are local only, and nothing is sent.

All motion respects `prefers-reduced-motion`.

## What the prototype demonstrates

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
