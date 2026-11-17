# WAFA FormAssist Premium

**Smart Application Management** — Offline-first, bilingual (English & বাংলা) government job application management workspace with an independent Chrome & Microsoft Edge Manifest V3 browser extension and optional zero-knowledge encrypted cloud sync.

> Developed by **Mehedi364 (Md. Mehedi Hasan)**

---

## Core Architecture

1. **Offline-First Management Dashboard (`/src`)**:
   - React + TypeScript + Tailwind CSS v4 + Vite + Workbox PWA Service Worker.
   - Local structured persistence via **IndexedDB** (`wafa_formassist_db`) with optional **AES-GCM-256 + PBKDF2-SHA256 (600,000 iterations, 8-character minimum passphrase, backward-compatible decryption for legacy 310,000-iteration envelopes)** at-rest encryption and auto-lock.
   - 14 complete screens: Overview, Personal Profiles (including Custom Profile Fields), Address Manager, Education Manager, Employment Manager, Autofill Center (with Form Review Preview, overwrite protection, independent sensitive-field exclusion, and deterministic Simulated DGBPO 2026 sandbox), Validation Center, Website Manager, Application History, Hybrid Sync Center, Backup & Restore (with automatic Pre-Restore Rollback Snapshot), Security Center, Settings, and Help & Docs.
   - Zero hardcoded personal demo records; all dashboard statistics are computed directly from your local vault.
2. **Independent Chrome & Microsoft Edge Manifest V3 Extension (`/extension`)**:
   - Standalone source tree with `manifest.json`, background service worker with `chrome.alarms` inactivity auto-lock, fail-closed sender/origin/schema-validated message router, independent sensitive-field exclusion (`content/sensitive-fields.js`), content script form scanner & autofill runner, popup UI, options/encrypted backup importer, and the DGBPO 2026 adapter.
   - **Zero-Plaintext Extension Vault**: Personal profile snapshots are encrypted with AES-GCM-256 before writing to extension IndexedDB (`DB_VERSION = 2`) and decrypted only into an ephemeral non-extractable in-memory `CryptoKey` while unlocked. Legacy plaintext `'snapshot'` keys are purged automatically on upgrade.
   - Strictly scoped to `https://dgbpo.teletalk.com.bd/*` (no `<all_urls>`).
   - Works 100% independently offline once your encrypted `.wafa.json` backup is imported into the extension Options page.
   - Exportable as reproducible Chrome & Edge ZIP packages via `npm run build:extension` or `/api/v1/extension/download`.
3. **Optional Modular Cloud Backend (`/backend` + `/server.ts`)**:
   - Mounted on `/api/v1/*` with **PostgreSQL (Cloud SQL + Drizzle ORM)** persistent storage, `HttpOnly; SameSite=Lax` session cookies, double-submit `X-CSRF-Token` verification, persistent rate limiting, scrypt password hashing + anti-enumeration timing guard, optional Firebase Google Sign-In session exchange, and strict CORS allowlist + security headers.
   - Supports client-side encrypted vault sync, atomic row-locked optimistic version conflict detection (`409 Conflict`), encrypted cloud backups (retaining the 10 most recent versions), adapter registry updates, Bangladesh 64-district reference datasets, and software update checks.
   - Strictly rejects unencrypted sync/backup payloads (`400 CLIENT_ENCRYPTION_REQUIRED`).
   - Includes PostgreSQL migration DDL in `/backend/migrations/001_initial_schema.sql` and `/backend/migrations/002_security_hardening.sql`.

---

## Honest Scope & Verification Boundaries

- **AI Studio Preview vs. Live Browser Extension**: The AI Studio preview runs the web Management Dashboard and the local Simulated DGBPO 2026 sandbox (`/public/fixtures/dgbpo2026-simulated.html`). Chrome/Edge Manifest V3 extensions cannot load inside a web iframe; install the `/extension` folder (or unpack the generated ZIP) via `chrome://extensions` or `edge://extensions` to use on live external tabs.
- **DGBPO 2026 Live Portal DOM**: Live selectors on `https://dgbpo.teletalk.com.bd/dgbpo2026/application.php` are marked `SIMULATED_VERIFIED` / *Live Unverified* until directly inspected on the live recruitment portal inside Chrome/Edge.
- **Strict Safety Guarantees**: WAFA FormAssist **never** auto-submits applications, **never** fills passwords, OTP/2FA, CAPTCHA, payment/bKash/Nagad/card/CVV, authentication tokens, recovery codes, or file uploads, **never** silently overwrites existing user-entered form values without explicit approval, and **never** fabricates missing personal/education/employment information.

---

## Scripts

```bash
npm run dev              # Start Express API + Vite dev server on port 3000
npm test                 # Run unit & integration tests (node:test via tsx)
npm run build            # Build production dashboard + package Chrome & Edge MV3 extension ZIPs
npm run build:extension  # Package /extension into Chrome, Edge, and standard MV3 ZIP artifacts in dist/
npm run lint             # Run TypeScript type check (tsc --noEmit)
```

---

## Documentation

- [Architecture Overview](docs/architecture.md)
- [Extension & Dashboard Installation Guide](docs/installation.md)
- [User Guide (English)](docs/user-guide-en.md)
- [ব্যবহার নির্দেশিকা (বাংলা)](docs/user-guide-bn.md)
- [Security Policy](SECURITY.md) & [Detailed Security Architecture](docs/security.md)
- [Privacy Policy](PRIVACY.md) & [Detailed Privacy Boundaries](docs/privacy.md)
- [Changelog](CHANGELOG.md)
