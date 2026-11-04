# Security notes

HEALNEXIA is a **prototype with fictional data**. It has no backend, no authentication and no real health information, and it must not be used with real patient data. Production requirements are in PRD §10.

## Threat model (prototype scope)

| Threat | Mitigation |
|---|---|
| XSS via user text (messages, notes, search) | Every interpolation is escaped by the `html` tagged template. `mount()` is the only DOM sink and accepts only `SafeHtml`. Strict CSP: `script-src 'self'`, no inline script or style, no `eval`. CI rejects new raw sinks. |
| XSS / logic abuse via tampered `localStorage` | Stored state is treated as untrusted. It is parsed defensively, schema-checked, enum-validated, length-limited and capped, unknown IDs and keys are dropped, and `__proto__` keys are ignored. Corrupt data resets with a visible notice. |
| Prototype pollution / registry abuse | Command, route and handler lookups use `Object.hasOwn` against frozen registries. Seed data is deep-frozen and state is frozen after every update. |
| Disallowed state changes | The domain state machine rejects unavailable commands and invalid transitions. Patients cannot act on provider-owned steps or reopen source-verified completions. |
| Free-text abuse of "approved" templates | Provider reminders are chosen by index from a frozen list. Free text is accepted only as a sanitised, length-limited note. |
| Unicode spoofing / control characters | `sanitizeText` strips C0/C1 controls and bidi overrides, normalises to NFC and enforces limits. |
| Clickjacking, MIME sniffing, referrer leakage | `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, COOP/CORP and a restrictive `Permissions-Policy` (dev server and `_headers`). |
| Data exfiltration | `connect-src 'none'`, `form-action 'none'`: the page cannot make network requests or submit forms anywhere. |
| Local dev server exposure | Binds to `127.0.0.1` by default, allows only GET/HEAD, serves only whitelisted directories and file types, and blocks traversal, encoded traversal, NUL bytes and dotfiles. |
| Unsafe urgent use | Persistent urgent-care warnings, plus a governed keyword backstop that requires explicit confirmation before sending. |

## Hosting

- Netlify / Cloudflare Pages: `_headers` applies the full header set.
- GitHub Pages cannot set headers. The `<meta>` CSP still applies, except `frame-ancestors`, which browsers ignore in meta tags.

## Reporting

This is a demonstration repository. Please report issues through the repository's issue tracker and do not include real personal or health data.
