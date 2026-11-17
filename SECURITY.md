# Security Policy — WAFA FormAssist Premium

## Cryptographic Design

- **Local Vault Encryption & Encrypted Backups**: Uses the browser's native Web Crypto API (`crypto.subtle`) with **AES-GCM (256-bit key)**, **PBKDF2-SHA256 (310,000 iterations)**, cryptographically random 16-byte salt, fresh 12-byte IV per encryption operation, and **SHA-256** envelope integrity verification.
- **Zero-Plaintext At-Rest Switch**: When local vault encryption is enabled in **Security Center**, all plaintext IndexedDB stores (`profiles`, `addresses`, `educations`, `employments`, `sessions`) are wiped immediately after the encrypted AES-GCM envelope is persisted.
- **Zero-Knowledge Optional Cloud Sync**: The backend API (`/api/v1/sync/push` and `/api/v1/backups`) strictly validates that payloads are `AES-GCM` / `PBKDF2-SHA256` envelopes and rejects any request containing plaintext personal attributes (`400 CLIENT_ENCRYPTION_REQUIRED`). Passphrases never leave the browser.
- **Authentication**: Optional cloud accounts hash passwords with Node.js `crypto.scrypt` + per-account random salt and constant-time `timingSafeEqual`, issuing opaque random session tokens stored as SHA-256 hashes.

## Strict Automation Safety Boundaries

1. **No Auto-Submit**: Neither the dashboard nor the browser extension ever clicks submit buttons or calls `form.submit()`.
2. **Protected Controls**: CAPTCHA, OTP/verification codes, password inputs, and `<input type="file">` photo/signature uploads are permanently excluded (`status: UNSUPPORTED`).
3. **Confidence Guard**: Low-confidence field matches and ambiguous dropdown candidates are never automatically selected or filled.
4. **Minimum-Privilege Extension**: `extension/manifest.json` requests only `storage`, `activeTab`, and `scripting`, with `host_permissions` explicitly restricted to `https://dgbpo.teletalk.com.bd/*`.

## Honest Threat Model & Recovery Limitations

- **Lost Passphrase**: Because WAFA FormAssist uses zero-knowledge client-side encryption, a forgotten vault or backup passphrase cannot be recovered by any server or administrator.
- **Compromised Device**: Browser-level encryption protects stored data at rest and in transit to cloud storage, but cannot protect unlocked data against a compromised operating system, keylogger, or malicious browser runtime.
