# Privacy Policy — WAFA FormAssist Premium

## Local-First Privacy by Default

- **No Mandatory Account**: Every core feature—personal profiles, addresses, education, employment, local validation, form preview, autofill, encrypted local backup/restore, bilingual UI, and theming—works 100% offline inside your browser's local IndexedDB vault with zero external network calls.
- **Zero Plaintext Transmission**: Sensitive identifiers (National ID, Birth Registration, Passport ID, mobile numbers, addresses, academic records) are never sent to any remote server in plaintext.
- **Zero-PII Session Logs**: Application History records only domain, route, timestamp, profile label, and field counts (scanned/filled/skipped/unresolved/failed). Raw field values are never logged.
- **No Analytics or Trackers**: WAFA FormAssist contains no third-party advertising SDKs, behavioral trackers, or hidden telemetry.

## Optional Cloud Sync & Deletion Rights

If you explicitly opt in to **Sync Center** and create an optional cloud account:
- The server stores only your account email, salted scrypt password hash, opaque session hashes, audit metadata (action + salted IP hash), and **client-side AES-GCM ciphertext envelopes**.
- You can disable cloud sync at any time without losing offline access.
- You can permanently erase all server-side account and encrypted cloud records using **Delete Cloud Account & Cloud Data** (`DELETE /api/v1/account`), and erase all local device data anytime from **Security Center**.
