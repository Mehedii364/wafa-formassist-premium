# WAFA FormAssist Premium — System Architecture

## 1. Hybrid Offline-First Topology

WAFA FormAssist Premium separates local authoritative applicant storage from optional cloud enhancements so that offline operation never degrades:

```
┌──────────────────────────────────────────────────────────────────────┐
│                   Management Dashboard (PWA / React)                 │
│  IndexedDB (wafa_formassist_db) + Web Crypto AES-GCM-256 + Workbox   │
│  Shared Core: Validator · 7-Layer Mapper · Safe Dropdown · Sync      │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ Optional HTTPS /api/v1/* (Ciphertext Only)
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                Optional Cloud Backend (Express / TS)                 │
│  Session Auth (scrypt) · Sync Engine (409 Conflict) · Cloud Backups  │
│  Adapter Registry · BD 64-District Feed · Extension ZIP Builder      │
│  PostgreSQL DDL Schema: /backend/migrations/001_initial_schema.sql   │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│          Standalone Manifest V3 Extension (Chrome & Edge)            │
│  Popup · Options (.wafa.json Import) · Service Worker · Content DOM  │
│  Host Scope: https://dgbpo.teletalk.com.bd/*  (Runs 100% Offline)    │
└──────────────────────────────────────────────────────────────────────┘
```

## 2. Shared Domain Modules (`/shared`)

- `shared/schemas/types.ts` — Canonical versioned TypeScript interfaces (`SCHEMA_VERSION = '1.0.0'`).
- `shared/security/crypto.ts` — Web Crypto API `AES-GCM-256` + `PBKDF2-SHA256` (310,000 iterations) + `SHA-256` envelope checksums + display masking.
- `shared/field-mapping/mapper.ts` — 7-layer priority matching (exact name -> exact ID -> exact EN label -> BN label -> partial EN label -> placeholder -> weak context) with section scoping, confidence scoring, and strict security exclusions (CAPTCHA, OTP, password, file).
- `shared/field-mapping/dropdown-matcher.ts` — Exact, normalized, and bilingual (`EN ↔ BN`) `<select>` matcher that refuses ambiguous multi-candidate auto-selection.
- `shared/field-mapping/date-converter.ts` — Calendar/leap-year validated converter between ISO `YYYY-MM-DD`, `DD/MM/YYYY`, and `MM/DD/YYYY` plus exact service duration math.
- `shared/validation/validator.ts` — Offline audit across Personal, Address, Education, Employment, and Form mappings with structured bilingual diagnostics (`whatIsWrong`, `whyItMatters`, `howToFix`).
- `shared/sync/sync-engine.ts` — Idempotent local change queue coalescing, bounded exponential backoff, version conflict detection, and non-destructive timestamp merge.

## 3. Data Lifecycle & Sync Conflict Safety

1. Every local mutation increments `localSyncVersion` and commits atomically to IndexedDB.
2. When `cloudSyncEnabled` is ON, edits coalesce into a single idempotent `SyncQueueItem` preserving the earliest `baseVersion`.
3. Pushing to `/api/v1/sync/push` encrypts the entire `VaultDataSnapshot` client-side into an `EncryptedEnvelope`.
4. If the cloud version advanced beyond `baseVersion`, the server responds `409 SYNC_CONFLICT` with `remoteEnvelope` intact; the dashboard stores a `SyncConflictRecord` and presents three explicit choices (**Keep Local**, **Accept Cloud**, **Merge Non-Destructively**).
