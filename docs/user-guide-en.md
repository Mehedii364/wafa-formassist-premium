# WAFA FormAssist Premium — User Guide (English)

## 1. Creating Your Applicant Vault (Offline)
1. Open **Personal Profiles** and click **New Profile**.
2. Enter your verified name (English & Bengali), parents' names, Date of Birth, mobile number + confirmation, NID / Birth Registration / Passport, religion, gender, marital status, quota, and departmental status.
3. Open **Address Manager** to save your Present Address and Permanent Address (enable **Same as Present Address** to keep them synchronized automatically).
4. Open **Education Manager** to enter SSC, HSC, Diploma, Graduation, and Masters records.
5. Open **Employment Manager** to add work experience; WAFA FormAssist calculates exact service duration and warns about overlapping dates.

## 2. Auditing Accuracy with Validation Center
Open **Validation Center** to inspect missing mandatory fields, mobile mismatches, NID/Birth Registration/Post Code lengths, GPA/CGPA bounds, SSC-to-HSC passing-year chronology, and employment overlaps. Every finding explains **What is flagged**, **Why it matters**, and **How to fix** in English and Bengali.

## 3. Reviewing & Applying Smart Autofill
1. Open **Autofill Center** (or the Chrome/Edge extension popup on a supported tab).
2. Click **Scan Form** to detect fields and score mapping confidence (`HIGH`, `MEDIUM`, `LOW`, `UNMATCHED`).
3. Review every row in **Form Review Preview**:
   - `HIGH` matches can be approved with one click.
   - `LOW`, ambiguous dropdowns, and protected fields (CAPTCHA, OTP, password, file upload) are never selected automatically.
4. Click **Apply Approved Autofill** and inspect the **Post-Fill Verification Report**.
5. Always verify every field manually on the recruitment portal before submitting yourself.

## 4. Security, Local Backup & Optional Cloud Sync
- **Security Center**: Enable **AES-GCM-256 Local Vault Encryption** with a strong passphrase (min 8 chars) and configure an auto-lock inactivity timeout. Remember your passphrase—zero-knowledge encryption cannot recover forgotten passphrases.
- **Backup & Restore**: Export an AES-GCM encrypted `.wafa.json` backup with SHA-256 verification and use **Inspect & Decrypt Backup** to preview record counts before restoring.
- **Sync Center (Optional)**: Enable optional cloud sync only if you want encrypted multi-device synchronization. Your vault is encrypted in your browser before leaving your device.
