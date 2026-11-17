# Security Engineering Reference — WAFA FormAssist Premium

## 1. Encryption Specification
- **Algorithm**: `AES-GCM` with 256-bit derived key and 96-bit (12-byte) random IV per encryption call.
- **Key Derivation**: `PBKDF2` with `SHA-256`, 128-bit (16-byte) random salt, `310,000` iterations.
- **Envelope Integrity**: `SHA-256` hex digest over `${schemaVersion}|AES-GCM|${iterations}|${salt}|${iv}|${ciphertext}`, verified prior to attempting AES-GCM decryption.
- **Key Lifecycle**: Derived `CryptoKey` objects exist strictly in volatile JS memory (`extractable: false`) and are discarded on manual lock, auto-lock timeout, or page unload.

## 2. Backend Enforcement (`/backend/src/routes.ts`)
- Every `/api/v1/sync/push` and `/api/v1/backups` request passes `isValidEncryptedEnvelope()`, which verifies `algorithm === 'AES-GCM'`, `keyDerivation === 'PBKDF2-SHA256'`, `iterations >= 100000`, valid base64 salt/iv/ciphertext, 64-char SHA-256 `integrityHash`, and explicitly blocks any plaintext properties (`profiles`, `nationalId`, `personalInformation`).
- Passwords use `crypto.scryptSync` (64-byte key, 16-byte random salt) verified with `crypto.timingSafeEqual`.
- Rate limiting protects auth (`30 req/min`) and sync (`60 req/min`) endpoints.
- Production PostgreSQL schema is provided in `/backend/migrations/001_initial_schema.sql`.

## 3. Extension Isolation (`/extension`)
- Validated message router (`extension/background/message-router.js`) checks message schema and allowed action allowlist before processing.
- Content scripts only inject on `https://dgbpo.teletalk.com.bd/*` and never submit forms or read/write password/file/CAPTCHA/OTP controls.
