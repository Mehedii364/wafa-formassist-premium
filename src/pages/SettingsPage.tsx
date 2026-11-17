import React, {useState} from 'react';
import {CheckCircle2, RefreshCw, RotateCcw} from 'lucide-react';
import {APP_VERSION} from '../../shared/constants/app-constants';
import {LanguageCode, ThemeMode} from '../../shared/schemas/types';
import {ConfirmDialog} from '../components/ConfirmDialog';
import {useApp} from '../context/AppContext';

export const SettingsPage: React.FC = () => {
  const {
    settings,
    snapshot,
    adapters,
    t,
    updateSettings,
    setDefaultProfile,
    toggleAdapterEnabled,
    resetPreferences,
    pushNotice,
  } = useApp();

  const [resetOpen, setResetOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<string | null>(null);
  const [checkingVersion, setCheckingVersion] = useState(false);

  const handleCheckSoftwareUpdate = async () => {
    setCheckingVersion(true);
    try {
      const res = await fetch('/api/v1/updates/check', {cache: 'no-store'});
      if (!res.ok) throw new Error('UNREACHABLE');
      const data = await res.json();
      setUpdateInfo(
        `Dashboard v${APP_VERSION} (Latest: v${data.latestDashboardVersion}) · Extension v${data.latestExtensionVersion} · Docs ${data.docsUpdatedAt}`,
      );
      pushNotice('success', 'Software and adapter version check completed.');
    } catch {
      setUpdateInfo(`Running offline on Dashboard v${APP_VERSION}. Version server unreachable.`);
      pushNotice('info', 'Offline mode — version check skipped gracefully.');
    } finally {
      setCheckingVersion(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#0F1714] dark:text-[#F4F7F5]">
            {t.settings.title}
          </h1>
          <p className="mt-1 text-sm text-[#4F635A] dark:text-[#9CAAA2]">{t.settings.subtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => setResetOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] px-3.5 py-2 text-sm font-medium text-[#0F1714] dark:text-[#F4F7F5] hover:bg-[#EEF3F0] dark:hover:bg-[#18231E] whitespace-nowrap shrink-0"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          <span>{t.settings.resetPreferences}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Localization, Theme & Default Profile */}
        <section className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-6 space-y-5">
          <h2 className="text-base font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
            Appearance &amp; Localization
          </h2>

          <div>
            <label htmlFor="pref-language" className="block text-xs font-medium text-[#0F1714] dark:text-[#F4F7F5]">
              {t.settings.language}
            </label>
            <select
              id="pref-language"
              value={settings.language}
              onChange={(e) => void updateSettings({language: e.target.value as LanguageCode})}
              className="mt-1.5 w-full rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-[#F6F8F7] dark:bg-[#18231E] px-3 py-2 text-sm text-[#0F1714] dark:text-[#F4F7F5]"
            >
              <option value="en">English (EN)</option>
              <option value="bn">বাংলা (Bengali)</option>
            </select>
          </div>

          <div>
            <label htmlFor="pref-theme" className="block text-xs font-medium text-[#0F1714] dark:text-[#F4F7F5]">
              {t.settings.theme}
            </label>
            <select
              id="pref-theme"
              value={settings.theme}
              onChange={(e) => void updateSettings({theme: e.target.value as ThemeMode})}
              className="mt-1.5 w-full rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-[#F6F8F7] dark:bg-[#18231E] px-3 py-2 text-sm text-[#0F1714] dark:text-[#F4F7F5]"
            >
              <option value="dark">{t.settings.themeDark}</option>
              <option value="light">{t.settings.themeLight}</option>
              <option value="system">{t.settings.themeSystem}</option>
            </select>
          </div>

          <div>
            <label htmlFor="pref-default-profile" className="block text-xs font-medium text-[#0F1714] dark:text-[#F4F7F5]">
              {t.settings.defaultProfile}
            </label>
            <select
              id="pref-default-profile"
              value={settings.defaultProfileId || ''}
              onChange={(e) => {
                if (e.target.value) void setDefaultProfile(e.target.value);
              }}
              disabled={snapshot.profiles.length === 0}
              className="mt-1.5 w-full rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-[#F6F8F7] dark:bg-[#18231E] px-3 py-2 text-sm text-[#0F1714] dark:text-[#F4F7F5] disabled:opacity-50"
            >
              {snapshot.profiles.length === 0 ? (
                <option value="">{t.common.noProfileSelected}</option>
              ) : (
                snapshot.profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.profileName} {p.isDefault ? `(${t.common.default})` : ''}
                  </option>
                ))
              )}
            </select>
          </div>
        </section>

        {/* Autofill Safety & Privacy Toggles */}
        <section className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-6 space-y-4">
          <h2 className="text-base font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
            Autofill Safeguards &amp; Privacy
          </h2>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.requireAutofillConfirmation}
              onChange={(e) => void updateSettings({requireAutofillConfirmation: e.target.checked})}
              className="mt-0.5 h-4 w-4 accent-emerald-600 rounded"
            />
            <span className="text-sm text-[#0F1714] dark:text-[#F4F7F5]">{t.settings.requireConfirm}</span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.allowMediumConfidenceProposal}
              onChange={(e) => void updateSettings({allowMediumConfidenceProposal: e.target.checked})}
              className="mt-0.5 h-4 w-4 accent-emerald-600 rounded"
            />
            <span className="text-sm text-[#0F1714] dark:text-[#F4F7F5]">{t.settings.allowMedium}</span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.saveSessionHistory}
              onChange={(e) => void updateSettings({saveSessionHistory: e.target.checked})}
              className="mt-0.5 h-4 w-4 accent-emerald-600 rounded"
            />
            <span className="text-sm text-[#0F1714] dark:text-[#F4F7F5]">{t.settings.saveHistory}</span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.maskSensitiveFields}
              onChange={(e) => void updateSettings({maskSensitiveFields: e.target.checked})}
              className="mt-0.5 h-4 w-4 accent-emerald-600 rounded"
            />
            <span className="text-sm text-[#0F1714] dark:text-[#F4F7F5]">{t.settings.maskSensitive}</span>
          </label>
        </section>
      </div>

      {/* Domain Permissions & Software Updates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-6 space-y-4">
          <h2 className="text-base font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
            Permitted Recruitment Domains
          </h2>
          <div className="divide-y divide-[#D7E2DC] dark:divide-[#26362F]">
            {adapters.map((adapter) => (
              <label key={adapter.id} className="py-3 flex items-center justify-between gap-3 cursor-pointer">
                <div>
                  <div className="font-mono text-xs font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
                    {adapter.domain}
                  </div>
                  <div className="text-xs text-[#4F635A] dark:text-[#9CAAA2]">{adapter.name}</div>
                </div>
                <input
                  type="checkbox"
                  checked={adapter.enabled}
                  onChange={(e) => void toggleAdapterEnabled(adapter.id, e.target.checked)}
                  className="h-4 w-4 accent-emerald-600 rounded"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-6 space-y-4">
          <h2 className="text-base font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
            Software &amp; Compatibility Updates
          </h2>
          <p className="text-xs text-[#4F635A] dark:text-[#9CAAA2]">
            Installed Dashboard version: <span className="font-mono tabular-nums font-semibold">v{APP_VERSION}</span>.
            Optional online checks never transmit applicant data.
          </p>
          <button
            type="button"
            disabled={checkingVersion}
            onClick={() => void handleCheckSoftwareUpdate()}
            className="inline-flex items-center gap-2 rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-[#F6F8F7] dark:bg-[#18231E] px-4 py-2 text-xs font-semibold text-[#0F1714] dark:text-[#F4F7F5] hover:bg-[#EEF3F0] dark:hover:bg-[#1F2C26] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${checkingVersion ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Check for Updates</span>
          </button>
          {updateInfo && (
            <div className="flex items-start gap-2 rounded-lg bg-[#F6F8F7] dark:bg-[#18231E] p-3 text-xs font-mono text-[#0F1714] dark:text-[#F4F7F5]">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{updateInfo}</span>
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={resetOpen}
        title={t.settings.resetPreferences}
        body="Reset interface preferences (theme, language, autofill confirmation toggles) to defaults? Your encrypted vault passphrase and stored applicant profiles remain untouched."
        confirmLabel={t.common.reset}
        cancelLabel={t.common.cancel}
        onConfirm={() => {
          setResetOpen(false);
          void resetPreferences().then(() => pushNotice('info', 'Preferences reset to defaults.'));
        }}
        onCancel={() => setResetOpen(false)}
      />
    </div>
  );
};
