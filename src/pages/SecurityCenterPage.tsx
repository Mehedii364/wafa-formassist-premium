import React, {useState} from 'react';
import {AlertTriangle, KeyRound, Lock, Shield, ShieldCheck, Trash2} from 'lucide-react';
import {ConfirmDialog} from '../components/ConfirmDialog';
import {useApp} from '../context/AppContext';

export const SecurityCenterPage: React.FC = () => {
  const {
    settings,
    t,
    enableOrChangePassphrase,
    lockVaultNow,
    updateSettings,
    eraseAllLocalData,
    pushNotice,
  } = useApp();

  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [eraseConfirmOpen, setEraseConfirmOpen] = useState(false);

  const handleSavePassphrase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass.length < 8) {
      pushNotice('error', 'Vault passphrase must be at least 8 characters long.');
      return;
    }
    if (newPass !== confirmPass) {
      pushNotice('error', 'Passphrase confirmation does not match.');
      return;
    }
    setBusy(true);
    try {
      await enableOrChangePassphrase(newPass);
      setNewPass('');
      setConfirmPass('');
      pushNotice('success', 'Local IndexedDB vault is now encrypted with AES-GCM-256 (PBKDF2-SHA256).');
    } catch {
      pushNotice('error', 'Failed to encrypt local vault.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#0F1714] dark:text-[#F4F7F5]">
            {t.security.title}
          </h1>
          <p className="mt-1 text-sm text-[#4F635A] dark:text-[#9CAAA2]">{t.security.subtitle}</p>
        </div>

        {settings.encryptionEnabled && (
          <button
            type="button"
            onClick={lockVaultNow}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Lock className="h-4 w-4" aria-hidden="true" />
            <span>{t.security.lockNow}</span>
          </button>
        )}
      </div>

      {/* Vault Encryption Status & Passphrase Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {settings.encryptionEnabled ? (
                <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" aria-hidden="true" />
              ) : (
                <Shield className="h-5 w-5 text-amber-500 shrink-0" aria-hidden="true" />
              )}
              <h2 className="text-base font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
                {t.security.vaultStatus}
              </h2>
            </div>
            <span
              className={`text-xs font-semibold ${
                settings.encryptionEnabled
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {settings.encryptionEnabled ? t.overview.encrypted : t.overview.unencrypted}
            </span>
          </div>

          <p className="text-xs leading-relaxed text-[#4F635A] dark:text-[#9CAAA2]">
            {settings.encryptionEnabled
              ? 'All profiles, addresses, education, employment, and session logs are encrypted into a single AES-GCM-256 envelope using PBKDF2-SHA256 (310,000 iterations) with plaintext IndexedDB stores cleared.'
              : 'Your local vault is currently stored in local IndexedDB without a passphrase lock. Set a vault passphrase below to encrypt all local records at rest.'}
          </p>

          <form onSubmit={handleSavePassphrase} className="space-y-4">
            <div>
              <label htmlFor="sec-new-pass" className="block text-xs font-medium text-[#0F1714] dark:text-[#F4F7F5]">
                {t.security.newPassphrase}
              </label>
              <input
                id="sec-new-pass"
                type="password"
                required
                minLength={8}
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-[#F6F8F7] dark:bg-[#18231E] px-3 py-2 text-sm text-[#0F1714] dark:text-[#F4F7F5]"
              />
            </div>

            <div>
              <label htmlFor="sec-confirm-pass" className="block text-xs font-medium text-[#0F1714] dark:text-[#F4F7F5]">
                {t.security.confirmPassphrase}
              </label>
              <input
                id="sec-confirm-pass"
                type="password"
                required
                minLength={8}
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-[#F6F8F7] dark:bg-[#18231E] px-3 py-2 text-sm text-[#0F1714] dark:text-[#F4F7F5]"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              <span>
                {busy
                  ? 'Deriving Key & Encrypting...'
                  : settings.encryptionEnabled
                    ? t.security.changePassphrase
                    : t.security.setPassphrase}
              </span>
            </button>
          </form>

          <div className="pt-4 border-t border-[#D7E2DC] dark:border-[#26362F]">
            <label htmlFor="auto-lock-select" className="block text-xs font-medium text-[#0F1714] dark:text-[#F4F7F5]">
              {t.security.sessionTimeout}
            </label>
            <select
              id="auto-lock-select"
              value={settings.autoLockMinutes}
              onChange={(e) => void updateSettings({autoLockMinutes: Number(e.target.value)})}
              className="mt-1.5 w-full rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-[#F6F8F7] dark:bg-[#18231E] px-3 py-2 text-sm text-[#0F1714] dark:text-[#F4F7F5]"
            >
              <option value={5}>5 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>60 minutes</option>
              <option value={0}>Disabled (manual lock only)</option>
            </select>
          </div>
        </section>

        {/* Honest Threat Model & Boundaries */}
        <section className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-6 space-y-5">
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{t.security.recoveryWarningTitle}</span>
            </div>
            <p className="text-xs leading-relaxed text-[#4F635A] dark:text-[#9CAAA2]">
              {t.security.recoveryWarningBody}
            </p>
          </div>

          <div className="space-y-2.5">
            <h2 className="text-sm font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
              {t.security.permissionsOverview}
            </h2>
            <ul className="space-y-2 text-xs leading-relaxed text-[#4F635A] dark:text-[#9CAAA2]">
              <li>· Strict domain scoping: browser extension host permissions are restricted to explicitly supported recruitment domains (dgbpo.teletalk.com.bd).</li>
              <li>· Never auto-submits applications and never reads or fills CAPTCHA, OTP, passwords, or file upload controls.</li>
              <li>· Session logs record counts and status only — never raw National ID, passport, mobile, or address values.</li>
              <li>· Optional cloud sync enforces client-side AES-GCM encryption; the backend rejects unencrypted sync payloads.</li>
            </ul>
          </div>

          <div className="pt-4 border-t border-[#D7E2DC] dark:border-[#26362F] space-y-2.5">
            <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">
              Danger Zone — Local Data Erasure
            </h3>
            <p className="text-xs text-[#4F635A] dark:text-[#9CAAA2]">
              {t.security.deleteAllConfirm}
            </p>
            <button
              type="button"
              onClick={() => setEraseConfirmOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-4 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span>{t.security.deleteAllData}</span>
            </button>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={eraseConfirmOpen}
        title={t.security.deleteAllData}
        body={t.security.deleteAllConfirm}
        confirmLabel={t.common.delete}
        cancelLabel={t.common.cancel}
        danger
        onConfirm={() => {
          setEraseConfirmOpen(false);
          void eraseAllLocalData().then(() =>
            pushNotice('info', 'All local IndexedDB personal data has been permanently erased.'),
          );
        }}
        onCancel={() => setEraseConfirmOpen(false)}
      />
    </div>
  );
};
