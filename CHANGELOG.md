# Changelog

## [1.0.0] — 2026-11-17

### Added
- **Offline-First Management Dashboard**: 14 complete bilingual (English & বাংলা) screens with Dark/Light/System themes, IndexedDB local persistence, Web Crypto AES-GCM-256 local vault encryption, auto-lock, and PWA offline asset caching.
- **Applicant Record Managers**: Personal Profiles (with search, completion filters, duplicate, default, JSON import/export), Address Manager (64 Bangladesh districts + Upazilas + Same-as-Present sync + manual Upazila fallback), Education Manager (SSC/HSC/Diploma/Graduation/Masters timeline + GPA/CGPA validation), and Employment Manager (service duration calculation + overlapping date conflict detection).
- **Smart Autofill & Validation Engine**: 7-layer bilingual field mapper, confidence scoring (`HIGH`/`MEDIUM`/`LOW`/`UNMATCHED`), safe dropdown matcher with ambiguity guard, safe date format converter (`YYYY-MM-DD`/`DD/MM/YYYY`/`MM/DD/YYYY`), deterministic Simulated DGBPO 2026 Checker (`[চেকার]`) sandbox, Form Review Preview, and post-fill verification reports.
- **Standalone Chrome & Edge Manifest V3 Extension (`/extension`)**: Independent popup, options encrypted backup importer, background service worker with message validation, content scripts (`form-scanner`, `autofill-runner`, `MutationObserver`), DGBPO 2026 adapter, icons, and reproducible ZIP packager.
- **Optional Zero-Knowledge Cloud Backend (`/backend` + `/server.ts`)**: Versioned `/api/v1/*` API enforcing client-side AES-GCM envelopes, idempotent sync, `409 Conflict` preservation, encrypted cloud backups, account deletion, adapter/dataset/update feeds, extension ZIP download, and PostgreSQL schema migration (`001_initial_schema.sql`).
- **Automated Verification Suite**: `node:test` unit and integration suites covering validation, field mapping, cryptography, sync engine, extension manifest/syntax, and backend API security invariants.
