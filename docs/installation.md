# Installation & Packaging Guide — WAFA FormAssist Premium

## 1. Running the Management Dashboard

Inside Google AI Studio Build Mode, the Management Dashboard runs automatically on port 3000 via `npm run dev` (`tsx server.ts`), serving both the React + Vite PWA and the optional `/api/v1/*` backend routes.

To install as an offline Progressive Web App (PWA):
1. Click **Install App** in the dashboard top bar (or your browser's address-bar install prompt).
2. Workbox caches the app shell so the dashboard opens and edits your IndexedDB vault even without internet connectivity.

## 2. Installing the Chrome & Microsoft Edge Manifest V3 Extension

Because web preview iframes cannot load browser extensions directly, install the standalone `/extension` package in Chrome or Microsoft Edge:

1. **Obtain the Extension Package**:
   - Click **Download Chrome / Edge Extension (.zip)** inside the dashboard's **Help & Docs** page (`/api/v1/extension/download`), **OR**
   - Run `npm run build:extension` to produce `dist/wafa-formassist-extension-mv3-v1.0.0.zip`, **OR**
   - Use the exported `/extension` source folder directly.
2. **Extract the ZIP** (if downloaded as `.zip`) to a permanent local folder containing `manifest.json`.
3. **Open Extension Management**:
   - **Google Chrome**: Navigate to `chrome://extensions`
   - **Microsoft Edge**: Navigate to `edge://extensions`
4. **Enable Developer Mode**.
5. **Load Unpacked**: Click **Load unpacked** and choose the folder containing `manifest.json`.
6. **Import Your Encrypted Vault**:
   - In the Management Dashboard, open **Backup & Restore** and export an AES-GCM encrypted `.wafa.json` backup.
   - Click the WAFA FormAssist extension icon -> **Vault & Settings**, select the `.wafa.json` file, and enter your backup passphrase.
   - Your profiles are stored locally inside `chrome.storage.local` so the extension operates offline independently of the dashboard.

## 3. Verifying on Live DGBPO 2026 vs. Local Fixture

- **Local Deterministic Fixture**: Open `/fixtures/dgbpo2026-simulated.html` in Chrome/Edge or use the embedded sandbox in **Autofill Center** to test scanning, previewing, filling, and verification.
- **Live Portal Verification**: Navigate to `https://dgbpo.teletalk.com.bd/dgbpo2026/application.php`, click the WAFA FormAssist toolbar icon, click **Scan Form**, inspect every proposed field in the preview table, approve only verified rows, and manually complete photo/signature/CAPTCHA/submission steps.
