import React, {useState} from 'react';
import {AlertTriangle, CheckCircle2, Download, FileUp, Lock, ShieldCheck} from 'lucide-react';
import {ConfirmDialog} from '../components/ConfirmDialog';
import {useApp} from '../context/AppContext';
import {localVaultRepo} from '../db/indexeddb';
import {BackupPackage, VaultDataSnapshot} from '../../shared/schemas/types';

function downloadJsonFile(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const BackupRestorePage: React.FC = () => {
  const {snapshot, t, restoreSnapshot, pushNotice} = useApp();

  // Export state
  const [exportPass, setExportPass] = useState('');
  const [exportPassConfirm, setExportPassConfirm] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const [confirmPlaintextOpen, setConfirmPlaintextOpen] = useState(false);

  // Import & preview state
  const [rawFileContent, setRawFileContent] = useState<string>('');
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [importPass, setImportPass] = useState('');
  const [strategy, setStrategy] = useState<'skip' | 'merge' | 'replace'>('merge');
  const [inspectBusy, setInspectBusy] = useState(false);
  const [inspectError, setInspectError] = useState('');
  const [preview, setPreview] = useState<{packageMeta: BackupPackage; snapshot: VaultDataSnapshot} | null>(null);
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false);

  const handleEncryptedExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (exportPass.length < 8) {
      pushNotice('error', 'Backup passphrase must be at least 8 characters.');
      return;
    }
    if (exportPass !== exportPassConfirm) {
      pushNotice('error', 'Passphrase confirmation does not match.');
      return;
    }
    setExportBusy(true);
    try {
      const pkg = await localVaultRepo.createBackupPackage(snapshot, {
        encrypted: true,
        passphrase: exportPass,
      });
      const dateStamp = new Date().toISOString().slice(0, 10);
      downloadJsonFile(`wafa-formassist-encrypted-${dateStamp}.wafa.json`, pkg);
      setExportPass('');
      setExportPassConfirm('');
      pushNotice('success', 'AES-GCM encrypted backup exported with SHA-256 integrity checksum.');
    } catch {
      pushNotice('error', 'Failed to create encrypted backup package.');
    } finally {
      setExportBusy(false);
    }
  };

  const handlePlaintextExport = async () => {
    setConfirmPlaintextOpen(false);
    setExportBusy(true);
    try {
      const pkg = await localVaultRepo.createBackupPackage(snapshot, {encrypted: false});
      const dateStamp = new Date().toISOString().slice(0, 10);
      downloadJsonFile(`wafa-formassist-UNENCRYPTED-${dateStamp}.json`, pkg);
      pushNotice('warning', 'Unencrypted JSON backup exported. Store securely and delete after transfer.');
    } finally {
      setExportBusy(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setPreview(null);
    setInspectError('');
    const file = e.target.files?.[0];
    if (!file) {
      setRawFileContent('');
      setSelectedFileName('');
      return;
    }
    setSelectedFileName(file.name);
    const text = await file.text();
    setRawFileContent(text);
  };

  const handleInspectBackup = async () => {
    if (!rawFileContent) {
      setInspectError('Select a .wafa.json or .json backup file first.');
      return;
    }
    setInspectBusy(true);
    setInspectError('');
    setPreview(null);
    try {
      const result = await localVaultRepo.inspectBackupPackage(
        rawFileContent,
        importPass || undefined,
      );
      setPreview(result);
    } catch (err) {
      const code = err instanceof Error ? err.message : 'BACKUP_CORRUPTION';
      if (code === 'PASSPHRASE_REQUIRED') {
        setInspectError('This backup is AES-GCM encrypted. Enter the backup passphrase to inspect and preview.');
      } else if (code === 'BACKUP_CORRUPTION') {
        setInspectError('Integrity check failed: file format is invalid or SHA-256 checksum does not match.');
      } else {
        setInspectError('Decryption failed: passphrase may be incorrect or ciphertext was modified.');
      }
    } finally {
      setInspectBusy(false);
    }
  };

  const executeRestore = async () => {
    if (!preview) return;
    setConfirmReplaceOpen(false);
    await restoreSnapshot(preview.snapshot, strategy);
    pushNotice('success', `Restored backup into local IndexedDB vault (${strategy} mode).`);
    setPreview(null);
    setImportPass('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#0F1714] dark:text-[#F4F7F5]">
          {t.backup.title}
        </h1>
        <p className="mt-1 text-sm text-[#4F635A] dark:text-[#9CAAA2]">{t.backup.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Local Export */}
        <section className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <Lock className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
            <h2 className="text-base font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
              {t.backup.exportEncrypted}
            </h2>
          </div>

          <div className="rounded-lg bg-[#F6F8F7] dark:bg-[#18231E] p-3.5 text-xs tabular-nums text-[#4F635A] dark:text-[#9CAAA2]">
            Current local vault: <strong className="text-[#0F1714] dark:text-[#F4F7F5]">{snapshot.profiles.length}</strong> profiles ·{' '}
            <strong className="text-[#0F1714] dark:text-[#F4F7F5]">{snapshot.addresses.length}</strong> addresses ·{' '}
            <strong className="text-[#0F1714] dark:text-[#F4F7F5]">{snapshot.educations.length}</strong> education ·{' '}
            <strong className="text-[#0F1714] dark:text-[#F4F7F5]">{snapshot.employments.length}</strong> employment
          </div>

          <form onSubmit={handleEncryptedExport} className="space-y-4">
            <div>
              <label htmlFor="export-pass" className="block text-xs font-medium text-[#0F1714] dark:text-[#F4F7F5]">
                {t.backup.passphraseLabel} (min 8 chars)
              </label>
              <input
                id="export-pass"
                type="password"
                required
                minLength={8}
                value={exportPass}
                onChange={(e) => setExportPass(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-[#F6F8F7] dark:bg-[#18231E] px-3 py-2 text-sm text-[#0F1714] dark:text-[#F4F7F5]"
              />
            </div>

            <div>
              <label htmlFor="export-pass-confirm" className="block text-xs font-medium text-[#0F1714] dark:text-[#F4F7F5]">
                {t.security.confirmPassphrase}
              </label>
              <input
                id="export-pass-confirm"
                type="password"
                required
                minLength={8}
                value={exportPassConfirm}
                onChange={(e) => setExportPassConfirm(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-[#F6F8F7] dark:bg-[#18231E] px-3 py-2 text-sm text-[#0F1714] dark:text-[#F4F7F5]"
              />
            </div>

            <button
              type="submit"
              disabled={exportBusy}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>{t.backup.exportEncrypted}</span>
            </button>
          </form>

          <div className="pt-4 border-t border-[#D7E2DC] dark:border-[#26362F] space-y-3">
            <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{t.backup.plaintextWarning}</span>
            </div>
            <button
              type="button"
              disabled={exportBusy}
              onClick={() => setConfirmPlaintextOpen(true)}
              className="w-full rounded-lg border border-amber-500/40 px-4 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 transition-colors"
            >
              {t.backup.exportPlaintext}
            </button>
          </div>
        </section>

        {/* Local Import & Restore Preview */}
        <section className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <FileUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
            <h2 className="text-base font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
              {t.backup.importTitle}
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="backup-file-input" className="block text-xs font-medium text-[#0F1714] dark:text-[#F4F7F5]">
                {t.backup.selectFile}
              </label>
              <input
                id="backup-file-input"
                type="file"
                accept=".json,.wafa.json,application/json"
                onChange={(e) => void handleFileChange(e)}
                className="mt-1.5 block w-full text-xs text-[#4F635A] dark:text-[#9CAAA2] file:mr-3 file:rounded-lg file:border file:border-[#D7E2DC] dark:file:border-[#26362F] file:bg-[#F6F8F7] dark:file:bg-[#18231E] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#0F1714] dark:file:text-[#F4F7F5]"
              />
              {selectedFileName && (
                <p className="mt-1 font-mono text-xs text-[#4F635A] dark:text-[#9CAAA2]">
                  Loaded: {selectedFileName}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="import-pass" className="block text-xs font-medium text-[#0F1714] dark:text-[#F4F7F5]">
                {t.backup.passphraseLabel} (required if encrypted)
              </label>
              <input
                id="import-pass"
                type="password"
                value={importPass}
                onChange={(e) => setImportPass(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-[#F6F8F7] dark:bg-[#18231E] px-3 py-2 text-sm text-[#0F1714] dark:text-[#F4F7F5]"
              />
            </div>

            <div>
              <label htmlFor="duplicate-strategy" className="block text-xs font-medium text-[#0F1714] dark:text-[#F4F7F5]">
                {t.backup.duplicateStrategy}
              </label>
              <select
                id="duplicate-strategy"
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as 'skip' | 'merge' | 'replace')}
                className="mt-1 w-full rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-[#F6F8F7] dark:bg-[#18231E] px-3 py-2 text-sm text-[#0F1714] dark:text-[#F4F7F5]"
              >
                <option value="skip">{t.backup.strategySkip}</option>
                <option value="merge">{t.backup.strategyMerge}</option>
                <option value="replace">{t.backup.strategyReplace}</option>
              </select>
            </div>

            {inspectError && (
              <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                {inspectError}
              </p>
            )}

            <button
              type="button"
              disabled={!rawFileContent || inspectBusy}
              onClick={() => void handleInspectBackup()}
              className="w-full rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-[#F6F8F7] dark:bg-[#18231E] px-4 py-2.5 text-sm font-semibold text-[#0F1714] dark:text-[#F4F7F5] hover:bg-[#EEF3F0] dark:hover:bg-[#1F2C26] disabled:opacity-50 transition-colors"
            >
              {inspectBusy ? 'Verifying Checksum & Decrypting...' : t.backup.previewRestore}
            </button>
          </div>

          {preview && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  SHA-256 Verified · Schema v{preview.packageMeta.schemaVersion} ·{' '}
                  {preview.packageMeta.encrypted ? 'AES-GCM Encrypted' : 'Plaintext JSON'}
                </span>
              </div>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs tabular-nums">
                <div>
                  <dt className="text-[#4F635A] dark:text-[#9CAAA2]">Profiles</dt>
                  <dd className="font-mono font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
                    {preview.snapshot.profiles.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#4F635A] dark:text-[#9CAAA2]">Addresses</dt>
                  <dd className="font-mono font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
                    {preview.snapshot.addresses.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#4F635A] dark:text-[#9CAAA2]">Education</dt>
                  <dd className="font-mono font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
                    {preview.snapshot.educations.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#4F635A] dark:text-[#9CAAA2]">Employment</dt>
                  <dd className="font-mono font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
                    {preview.snapshot.employments.length}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => {
                  if (strategy === 'replace') {
                    setConfirmReplaceOpen(true);
                  } else {
                    void executeRestore();
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                <span>{t.backup.confirmRestore}</span>
              </button>
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirmPlaintextOpen}
        title={t.backup.exportPlaintext}
        body={t.backup.plaintextWarning}
        confirmLabel={t.common.export}
        cancelLabel={t.common.cancel}
        danger
        onConfirm={() => void handlePlaintextExport()}
        onCancel={() => setConfirmPlaintextOpen(false)}
      />

      <ConfirmDialog
        open={confirmReplaceOpen}
        title="Replace Entire Local Vault?"
        body="Replace mode overwrites all current local profiles, addresses, education, employment, and session records with the contents of this backup."
        confirmLabel={t.backup.confirmRestore}
        cancelLabel={t.common.cancel}
        danger
        onConfirm={() => void executeRestore()}
        onCancel={() => setConfirmReplaceOpen(false)}
      />
    </div>
  );
};
