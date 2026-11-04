# HEALNEXIA prototype

**Care, connected. Nothing important overlooked.**

Interactive, zero-dependency prototype of the HEALNEXIA continuity-of-care platform (PRD v1.0, 4 Nov 2026).
All people, organisations, dates and clinical details are **fictional**. This is not a medical device, gives no medical advice and connects to no healthcare system.

## Run

```bash
python3 -m http.server 8080   # then open http://localhost:8080
```

Or open `index.html` directly. Deployable as-is to any static host (GitHub Pages, Netlify, Vercel).

## What it demonstrates (PRD section 16)

- **Patient view:** overview with priority action and rationale, care progress, counts, next appointment, care team, wellbeing check-in; care journey with type filters and episode grouping; action centre with acknowledge / booking handoff / booked elsewhere / complete / reopen and immutable status history; searchable records; medications with change history, source discrepancy and reminder toggles; contextual messaging with an urgent-language backstop; data coverage and stale-source warnings.
- **Provider view:** rule-ordered continuity worklist, patient summary drawer, simulated contextual reminders with duplicate warning, integration status and audit log.
- Patient-reported vs source-verified status is always distinguished.
- State persists in `localStorage` only; "Reset demo" clears it.
- Keyboard accessible, visible focus, 44px targets, no colour-only status, reflows to 320px, respects reduced motion and contrast preferences.
