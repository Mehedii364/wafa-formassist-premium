import React, {useState} from 'react';
import {
  AlertTriangle,
  Cloud,
  CloudOff,
  Download,
  KeyRound,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import {ConfirmDialog} from '../components/ConfirmDialog';
import {CloudBackupSummary, useApp} from '../context/AppContext';

export const SyncCenterPage: React.FC = () => {
  const {
    settings,
    t,
    connectivity,
    connectivityBadgeState,
    checkConnectivity,
    syncQueue,
    syncConflicts,
    isSyncing,
    cloudAccount,
    cloudBackups,
    pendingDownloadCount,
    updateSettings,
    cloudAuthLogin,
    cloudAuthRegister,
    cloudAuthLogout,
    cloudDeleteAccount,
    refreshCloudState,
    runEncryptedSyncNow,
    uploadEncryptedCloudBackup,
    restoreCloudBackup,
    deleteCloudBackup,
    resolveSyncConflict,
    pushNotice,
  } = useApp();

  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryHint, setRecoveryHint] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const [cloudPassphrase, setCloudPassphrase] = useState('');
  const [backupLabel, setBackupLabel] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [backupToDelete, setBackupToDelete] = useState<CloudBackupSummary | null>(null);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    try {
      if (authMode === 'register') {
        await cloudAuthRegister(email.trim(), password, recoveryHint.trim() || undefined);
        pushNotice('success', 'Optional cloud account created and signed in.');
      } else {
        await cloudAuthLogin(email.trim(), password);
        pushNotice('success', 'Signed in to optional cloud sync account.');
      }
      setPassword('');
    } catch (err) {
      pushNotice('error', err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSyncNow = async () => {
    setActionBusy(true);
    try {
      await runEncryptedSyncNow(cloudPassphrase);
      pushNotice('success', 'Vault encrypted client-side (AES-GCM) and synchronized with cloud.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed.';
      if (msg === 'SYNC_CONFLICT') {
        pushNotice('warning', 'Sync conflict detected! Both local and cloud versions were preserved for your decision.');
      } else {
        pushNotice('error', msg);
      }
    } finally {
      setActionBusy(false);
    }
  };

  const handleUploadCloudBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloudPassphrase || cloudPassphrase.length < 6) {
      pushNotice('error', 'Enter a client-side encryption passphrase (min 6 chars) first.');
      return;
    }
    setActionBusy(true);
    try {
      const label = backupLabel.trim() || `Vault Snapshot ${new Date().toISOString().slice(0, 10)}`;
      await uploadEncryptedCloudBackup(label, cloudPassphrase);
      setBackupLabel('');
      pushNotice('success', 'Encrypted cloud backup uploaded.');
    } catch (err) {
      pushNotice('error', err instanceof Error ? err.message : 'Cloud backup failed.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleRestoreCloudBackup = async (backup: CloudBackupSummary) => {
    if (!cloudPassphrase) {
      pushNotice('error', 'Enter the cloud encryption passphrase used to encrypt this backup.');
      return;
    }
    setActionBusy(true);
    try {
      await restoreCloudBackup(backup, cloudPassphrase);
      pushNotice('success', `Decrypted and merged "${backup.label}" into your local vault.`);
    } catch {
      pushNotice('error', 'Decryption failed. Check that the encryption passphrase matches this backup.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleResolveConflict = async (
    conflictId: string,
    choice: 'keep_local' | 'keep_remote' | 'merge_both',
  ) => {
    if (!cloudPassphrase || cloudPassphrase.length < 6) {
      pushNotice('error', 'Enter your cloud encryption passphrase to decrypt/re-encrypt conflict resolution.');
      return;
    }
    setActionBusy(true);
    try {
      await resolveSyncConflict(conflictId, choice, cloudPassphrase);
      pushNotice('success', 'Sync conflict resolved safely.');
    } catch (err) {
      pushNotice('error', err instanceof Error ? err.message : 'Failed to resolve conflict.');
    } finally {
      setActionBusy(false);
    }
  };

  const qualityText =
    connectivity.quality === 'good'
      ? t.connectivity.qualityGood
      : connectivity.quality === 'slow'
        ? t.connectivity.qualitySlow
        : t.connectivity.qualityNone;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#0F1714] dark:text-[#F4F7F5]">
            {t.sync.title}
          </h1>
          <p className="mt-1 text-sm text-[#4F635A] dark:text-[#9CAAA2]">{t.sync.subtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => void checkConnectivity()}
          className="inline-flex items-center gap-2 rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] px-3.5 py-2 text-sm font-medium text-[#0F1714] dark:text-[#F4F7F5] hover:bg-[#EEF3F0] dark:hover:bg-[#18231E] whitespace-nowrap shrink-0"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          <span>{t.common.retry}</span>
        </button>
      </div>

      {/* Live Connectivity & Sync Metrics */}
      <section
        aria-label="Connectivity status"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-4">
          <div className="text-xs text-[#4F635A] dark:text-[#9CAAA2]">Network &amp; API</div>
          <div className="mt-1.5 flex items-center gap-2 text-base font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
            {connectivity.apiReachable ? (
              <Cloud className="h-4 w-4 text-emerald-500 shrink-0" aria-hidden="true" />
            ) : (
              <CloudOff className="h-4 w-4 text-amber-500 shrink-0" aria-hidden="true" />
            )}
            <span>
              {connectivity.apiReachable ? t.connectivity.apiReachable : t.connectivity.apiUnreachable}
            </span>
          </div>
          <div className="mt-1 text-xs tabular-nums text-[#4F635A] dark:text-[#9CAAA2]">
            {qualityText}
            {connectivity.latencyMs !== null ? ` · ${connectivity.latencyMs}ms` : ''} · {connectivityBadgeState}
          </div>
        </div>

        <div className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-4">
          <div className="text-xs text-[#4F635A] dark:text-[#9CAAA2]">{t.connectivity.lastSync}</div>
          <div className="mt-1.5 text-base font-semibold tabular-nums text-[#0F1714] dark:text-[#F4F7F5]">
            {settings.lastSyncedAt ? new Date(settings.lastSyncedAt).toLocaleString() : t.connectivity.neverSynced}
          </div>
          <div className="mt-1 text-xs font-mono tabular-nums text-[#4F635A] dark:text-[#9CAAA2]">
            Local v{settings.localSyncVersion} · Cloud v{cloudAccount?.remoteVersion ?? 0}
          </div>
        </div>

        <div className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-4">
          <div className="text-xs text-[#4F635A] dark:text-[#9CAAA2]">{t.connectivity.pendingUploads}</div>
          <div className="mt-1.5 text-2xl font-display font-bold tabular-nums text-[#0F1714] dark:text-[#F4F7F5]">
            {syncQueue.length}
          </div>
          <div className="mt-1 text-xs text-[#4F635A] dark:text-[#9CAAA2]">
            Queued locally in IndexedDB
          </div>
        </div>

        <div className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-4">
          <div className="text-xs text-[#4F635A] dark:text-[#9CAAA2]">{t.connectivity.pendingDownloads}</div>
          <div className="mt-1.5 text-2xl font-display font-bold tabular-nums text-[#0F1714] dark:text-[#F4F7F5]">
            {pendingDownloadCount}
          </div>
          <div className="mt-1 text-xs text-[#4F635A] dark:text-[#9CAAA2]">
            Conflicts: <span className="font-mono tabular-nums">{syncConflicts.length}</span>
          </div>
        </div>
      </section>

      {/* Master Cloud Sync Toggle & Zero-Knowledge Notice */}
      <section className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
              {t.sync.cloudSyncToggle}
            </h2>
            <p className="mt-0.5 text-xs text-[#4F635A] dark:text-[#9CAAA2]">{t.sync.disableNotice}</p>
          </div>
          <div className="flex items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-[#0F1714] dark:text-[#F4F7F5] cursor-pointer">
              <input
                type="checkbox"
                checked={settings.cloudSyncEnabled}
                onChange={(e) => void updateSettings({cloudSyncEnabled: e.target.checked})}
                className="h-4 w-4 accent-emerald-600 rounded"
              />
              <span>{settings.cloudSyncEnabled ? 'Enabled' : 'Disabled (Offline Only)'}</span>
            </label>

            {settings.cloudSyncEnabled && (
              <label className="inline-flex items-center gap-2 text-sm text-[#0F1714] dark:text-[#F4F7F5] cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoSyncWhenOnline}
                  onChange={(e) => void updateSettings({autoSyncWhenOnline: e.target.checked})}
                  className="h-4 w-4 accent-emerald-600 rounded"
                />
                <span>{t.sync.autoSyncToggle}</span>
              </label>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-lg bg-[#F6F8F7] dark:bg-[#18231E] p-3.5 text-xs text-[#4F635A] dark:text-[#9CAAA2]">
          <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{t.sync.zeroKnowledgeNote}</span>
        </div>
      </section>

      {/* Sync Conflicts Resolution UI (if any) */}
      {syncConflicts.length > 0 && (
        <section
          aria-label="Sync conflicts"
          className="rounded-xl border border-amber-500/50 bg-white dark:bg-[#121A17] p-6 space-y-4"
        >
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            <h2 className="text-base font-semibold">{t.sync.conflictsTitle}</h2>
          </div>

          {syncConflicts.map((conflict) => (
            <div
              key={conflict.id}
              className="rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-[#F6F8F7] dark:bg-[#18231E] p-4 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
                    Local Device (v{conflict.localVersion})
                  </div>
                  <div className="mt-1 tabular-nums text-[#4F635A] dark:text-[#9CAAA2]">
                    Updated {new Date(conflict.localUpdatedAt).toLocaleString()} ·{' '}
                    {conflict.localSummary.profiles} profiles · {conflict.localSummary.educations} edu ·{' '}
                    {conflict.localSummary.employments} emp
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
                    Cloud Version (v{conflict.remoteVersion})
                  </div>
                  <div className="mt-1 tabular-nums text-[#4F635A] dark:text-[#9CAAA2]">
                    Updated {new Date(conflict.remoteUpdatedAt).toLocaleString()} · Encrypted AES-GCM envelope
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => void handleResolveConflict(conflict.id, 'keep_local')}
                  className="rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] px-3 py-1.5 text-xs font-medium text-[#0F1714] dark:text-[#F4F7F5] hover:bg-[#EEF3F0] dark:hover:bg-[#1E2B25]"
                >
                  {t.sync.keepLocal}
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => void handleResolveConflict(conflict.id, 'keep_remote')}
                  className="rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] px-3 py-1.5 text-xs font-medium text-[#0F1714] dark:text-[#F4F7F5] hover:bg-[#EEF3F0] dark:hover:bg-[#1E2B25]"
                >
                  {t.sync.keepRemote}
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => void handleResolveConflict(conflict.id, 'merge_both')}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  {t.sync.mergeBoth}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Optional Account + Encrypted Sync Workspace */}
      {settings.cloudSyncEnabled && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Account Panel */}
          <section className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-6 space-y-4">
            <h2 className="text-base font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
              {t.sync.accountSection}
            </h2>

            {cloudAccount ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-[#F6F8F7] dark:bg-[#18231E] p-4 space-y-1">
                  <div className="text-xs text-[#4F635A] dark:text-[#9CAAA2]">Signed in as</div>
                  <div className="font-mono text-sm font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
                    {cloudAccount.email}
                  </div>
                  <div className="text-xs tabular-nums text-[#4F635A] dark:text-[#9CAAA2]">
                    Remote vault version: v{cloudAccount.remoteVersion}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void refreshCloudState()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#D7E2DC] dark:border-[#26362F] px-3.5 py-2 text-xs font-medium text-[#0F1714] dark:text-[#F4F7F5] hover:bg-[#EEF3F0] dark:hover:bg-[#18231E]"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t.sync.pullLatest}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void cloudAuthLogout()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#D7E2DC] dark:border-[#26362F] px-3.5 py-2 text-xs font-medium text-[#0F1714] dark:text-[#F4F7F5] hover:bg-[#EEF3F0] dark:hover:bg-[#18231E]"
                  >
                    <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t.sync.logout}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteAccount(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 px-3.5 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t.sync.deleteAccount}</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAuthSubmit} className="space-y-4">
                <div className="flex items-center gap-2 border-b border-[#D7E2DC] dark:border-[#26362F] pb-3">
                  <button
                    type="button"
                    onClick={() => setAuthMode('register')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      authMode === 'register'
                        ? 'bg-emerald-600 text-white'
                        : 'text-[#4F635A] dark:text-[#9CAAA2] hover:bg-[#EEF3F0] dark:hover:bg-[#18231E]'
                    }`}
                  >
                    {t.sync.register}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      authMode === 'login'
                        ? 'bg-emerald-600 text-white'
                        : 'text-[#4F635A] dark:text-[#9CAAA2] hover:bg-[#EEF3F0] dark:hover:bg-[#18231E]'
                    }`}
                  >
                    {t.sync.login}
                  </button>
                </div>

                <div>
                  <label htmlFor="cloud-email" className="block text-xs font-medium text-[#0F1714] dark:text-[#F4F7F5]">
                    {t.sync.email}
                  </label>
                  <input
                    id="cloud-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="applicant@example.com"
                    className="mt-1 w-full rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-[#F6F8F7] dark:bg-[#18231E] px-3 py-2 text-sm text-[#0F1714] dark:text-[#F4F7F5]"
                  />
                </div>

                <div>
                  <label htmlFor="cloud-password" className="block text-xs font-medium text-[#0F1714] dark:text-[#F4F7F5]">
                    {t.sync.password} (min 8 chars)
                  </label>
                  <input
                    id="cloud-password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-[#F6F8F7] dark:bg-[#18231E] px-3 py-2 text-sm text-[#0F1714] dark:text-[#F4F7F5]"
                  />
                </div>

                {authMode === 'register' && (
                  <div>
                    <label htmlFor="cloud-hint" className="block text-xs font-medium text-[#0F1714] dark:text-[#F4F7F5]">
                      Optional Recovery Hint (Never enter passphrase)
                    </label>
                    <input
                      id="cloud-hint"
                      type="text"
                      value={recoveryHint}
                      onChange={(e) => setRecoveryHint(e.target.value)}
                      placeholder="e.g., Stored in offline notebook"
                      className="mt-1 w-full rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-[#F6F8F7] dark:bg-[#18231E] px-3 py-2 text-sm text-[#0F1714] dark:text-[#F4F7F5]"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authBusy}
                  className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {authBusy
                    ? 'Connecting...'
                    : authMode === 'register'
                      ? t.sync.register
                      : t.sync.login}
                </button>
              </form>
            )}
          </section>

          {/* Encrypted Sync & Cloud Backup Actions */}
          <section className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
                Client-Side Encrypted Sync &amp; Cloud Backup
              </h2>
              <p className="mt-1 text-xs text-[#4F635A] dark:text-[#9CAAA2]">
                {t.sync.vaultPassphraseRequired}
              </p>
            </div>

            <div>
              <label
                htmlFor="cloud-enc-passphrase"
                className="flex items-center gap-1.5 text-xs font-medium text-[#0F1714] dark:text-[#F4F7F5]"
              >
                <KeyRound className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                <span>{t.sync.cloudEncryptionPassphrase}</span>
              </label>
              <input
                id="cloud-enc-passphrase"
                type="password"
                value={cloudPassphrase}
                onChange={(e) => setCloudPassphrase(e.target.value)}
                placeholder="Min 6 chars — stays strictly in your browser"
                className="mt-1.5 w-full rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-[#F6F8F7] dark:bg-[#18231E] px-3 py-2 text-sm text-[#0F1714] dark:text-[#F4F7F5]"
              />
            </div>

            <button
              type="button"
              disabled={!cloudAccount || isSyncing || actionBusy}
              onClick={() => void handleSyncNow()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>{t.sync.syncNow}</span>
            </button>

            <form onSubmit={handleUploadCloudBackup} className="pt-4 border-t border-[#D7E2DC] dark:border-[#26362F] space-y-3">
              <label htmlFor="cloud-backup-label" className="block text-xs font-medium text-[#0F1714] dark:text-[#F4F7F5]">
                Named Encrypted Cloud Backup Label
              </label>
              <div className="flex gap-2">
                <input
                  id="cloud-backup-label"
                  type="text"
                  value={backupLabel}
                  onChange={(e) => setBackupLabel(e.target.value)}
                  placeholder="e.g., Pre-DGBPO-2026 Snapshot"
                  className="flex-1 min-w-0 rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-[#F6F8F7] dark:bg-[#18231E] px-3 py-2 text-sm text-[#0F1714] dark:text-[#F4F7F5]"
                />
                <button
                  type="submit"
                  disabled={!cloudAccount || actionBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#D7E2DC] dark:border-[#26362F] px-3.5 py-2 text-xs font-semibold text-[#0F1714] dark:text-[#F4F7F5] hover:bg-[#EEF3F0] dark:hover:bg-[#18231E] disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t.sync.createCloudBackup}</span>
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Encrypted Cloud Backups Table */}
      {settings.cloudSyncEnabled && cloudAccount && (
        <section className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-6 space-y-4">
          <h2 className="text-base font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
            {t.sync.cloudBackupsTitle}
          </h2>
          {cloudBackups.length === 0 ? (
            <p className="text-sm text-[#4F635A] dark:text-[#9CAAA2]">
              No encrypted cloud backups uploaded yet.
            </p>
          ) : (
            <div className="divide-y divide-[#D7E2DC] dark:divide-[#26362F]">
              {cloudBackups.map((b) => (
                <div key={b.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[#0F1714] dark:text-[#F4F7F5]">{b.label}</div>
                    <div className="text-xs font-mono tabular-nums text-[#4F635A] dark:text-[#9CAAA2]">
                      {new Date(b.createdAt).toLocaleString()} · {(b.byteSize / 1024).toFixed(1)} KB · AES-GCM v
                      {b.schemaVersion}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => void handleRestoreCloudBackup(b)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t.sync.restoreCloudBackup}</span>
                    </button>
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => setBackupToDelete(b)}
                      aria-label={`Delete backup ${b.label}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <ConfirmDialog
        open={confirmDeleteAccount}
        title={t.sync.deleteAccount}
        body="This permanently deletes your optional cloud account, active sessions, encrypted cloud vault, and encrypted cloud backups from the server. Your local IndexedDB vault remains untouched."
        confirmLabel={t.common.delete}
        cancelLabel={t.common.cancel}
        danger
        onConfirm={() => {
          setConfirmDeleteAccount(false);
          void cloudDeleteAccount()
            .then(() => pushNotice('info', 'Cloud account and all cloud data deleted.'))
            .catch((e) => pushNotice('error', e instanceof Error ? e.message : 'Delete failed.'));
        }}
        onCancel={() => setConfirmDeleteAccount(false)}
      />

      <ConfirmDialog
        open={Boolean(backupToDelete)}
        title={t.sync.deleteCloudBackup}
        body={`Delete encrypted cloud backup "${backupToDelete?.label ?? ''}" permanently from cloud storage?`}
        confirmLabel={t.common.delete}
        cancelLabel={t.common.cancel}
        danger
        onConfirm={() => {
          if (!backupToDelete) return;
          const id = backupToDelete.id;
          setBackupToDelete(null);
          void deleteCloudBackup(id)
            .then(() => pushNotice('info', 'Cloud backup deleted.'))
            .catch((e) => pushNotice('error', e instanceof Error ? e.message : 'Delete failed.'));
        }}
        onCancel={() => setBackupToDelete(null)}
      />
    </div>
  );
};
