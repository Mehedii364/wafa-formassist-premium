# Detailed Privacy Specification — WAFA FormAssist Premium

## Data Minimization Matrix

| Data Category | Local IndexedDB | Extension Storage | Optional Cloud Backend | Session Logs |
|---|---|---|---|---|
| Personal Identity (NID, Passport, DOB, Mobile) | Stored locally (AES-GCM encrypted when locked) | Stored locally after explicit user import | **AES-GCM Ciphertext Only** (Plaintext rejected with HTTP 400) | **Never Stored** |
| Present & Permanent Addresses | Stored locally | Stored locally | **AES-GCM Ciphertext Only** | **Never Stored** |
| Education & Employment Records | Stored locally | Stored locally | **AES-GCM Ciphertext Only** | **Never Stored** |
| Autofill Session Counts & Domain | Stored locally | Stored locally | Included only inside encrypted vault snapshot | Stored (Zero PII) |
| Cloud Account Email & Auth Hash | Not needed offline | Not used | Stored only if user creates optional cloud account | Not stored |

## Explicit User Controls
- **Offline-Only Operation**: Leave Cloud Sync disabled in **Sync Center** for zero remote API calls.
- **Masking**: Toggle NID / Birth Registration / Passport masking in **Settings**.
- **Domain Scoping**: Enable or block each supported recruitment website explicitly in **Website Manager**.
- **Complete Erasure**: Wipe local IndexedDB via **Security Center** and/or wipe all remote cloud data via `DELETE /api/v1/account`.
