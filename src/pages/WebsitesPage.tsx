import React, {useState} from 'react';
import {AlertTriangle, CheckCircle2, Globe, RefreshCw, ShieldCheck, ShieldOff} from 'lucide-react';
import {useApp} from '../context/AppContext';
import {CompatibilityStatus} from '../../shared/schemas/types';

function compatibilityLabel(status: CompatibilityStatus, lang: 'en' | 'bn'): {text: string; cls: string} {
  switch (status) {
    case 'SIMULATED_VERIFIED':
      return {
        text: lang === 'bn' ? 'সিমুলেটেড ভেরিফায়েড (লাইভ আনভেরিফায়েড)' : 'Simulated Verified · Live Unverified',
        cls: 'text-amber-600 dark:text-amber-400',
      };
    case 'LIVE_VERIFIED':
      return {
        text: lang === 'bn' ? 'লাইভ ভেরিফায়েড' : 'Live Verified',
        cls: 'text-emerald-600 dark:text-emerald-400',
      };
    case 'LIVE_UNVERIFIED':
      return {
        text: lang === 'bn' ? 'লাইভ আনভেরিফায়েড' : 'Live Unverified',
        cls: 'text-amber-600 dark:text-amber-400',
      };
    case 'BETA':
      return {
        text: 'Beta',
        cls: 'text-sky-600 dark:text-sky-400',
      };
    case 'DEPRECATED':
      return {
        text: lang === 'bn' ? 'অবচিত' : 'Deprecated',
        cls: 'text-red-600 dark:text-red-400',
      };
  }
}

export const WebsitesPage: React.FC = () => {
  const {adapters, settings, t, toggleAdapterEnabled, checkRemoteAdapterUpdates, pushNotice, setPage} = useApp();
  const [checking, setChecking] = useState(false);
  const [lastCheckMsg, setLastCheckMsg] = useState<string | null>(null);

  const handleCheckUpdates = async () => {
    setChecking(true);
    const result = await checkRemoteAdapterUpdates();
    setChecking(false);
    setLastCheckMsg(result.message);
    pushNotice(result.checked ? 'success' : 'warning', result.message);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#0F1714] dark:text-[#F4F7F5]">
            {t.websites.title}
          </h1>
          <p className="mt-1 text-sm text-[#4F635A] dark:text-[#9CAAA2]">{t.websites.subtitle}</p>
        </div>

        <button
          type="button"
          onClick={handleCheckUpdates}
          disabled={checking}
          className="inline-flex items-center gap-2 rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] px-4 py-2 text-sm font-medium text-[#0F1714] dark:text-[#F4F7F5] hover:bg-[#EEF3F0] dark:hover:bg-[#18231E] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>{t.websites.checkUpdates}</span>
        </button>
      </div>

      {lastCheckMsg && (
        <div
          role="status"
          className="rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] px-4 py-3 text-sm text-[#4F635A] dark:text-[#9CAAA2]"
        >
          {lastCheckMsg}
        </div>
      )}

      <div className="space-y-4">
        {adapters.map((adapter) => {
          const compat = compatibilityLabel(adapter.compatibilityStatus, settings.language);
          return (
            <section
              key={adapter.id}
              aria-label={adapter.name}
              className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-6 space-y-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <Globe className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                    <h2 className="font-display text-lg font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
                      {settings.language === 'bn' ? adapter.nameBn : adapter.name}
                    </h2>
                  </div>
                  <p className="text-sm text-[#4F635A] dark:text-[#9CAAA2]">
                    {adapter.organization} · {adapter.recruitmentCycle} · {adapter.initialPost}
                  </p>
                  <p className={`text-xs font-medium ${compat.cls}`}>{compat.text}</p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={adapter.enabled}
                    aria-label={`${adapter.name} permission toggle`}
                    onClick={() => void toggleAdapterEnabled(adapter.id, !adapter.enabled)}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      adapter.enabled
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'border-[#D7E2DC] dark:border-[#26362F] bg-[#F6F8F7] dark:bg-[#18231E] text-[#4F635A] dark:text-[#9CAAA2]'
                    }`}
                  >
                    {adapter.enabled ? (
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ShieldOff className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>{adapter.enabled ? t.websites.permissionEnabled : t.websites.permissionDisabled}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPage('autofill')}
                    className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
                  >
                    {t.nav.autofill}
                  </button>
                </div>
              </div>

              <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-b border-[#D7E2DC] dark:border-[#26362F] py-4 text-sm">
                <div>
                  <dt className="text-xs text-[#4F635A] dark:text-[#9CAAA2]">{t.websites.domain}</dt>
                  <dd className="mt-1 font-mono text-xs text-[#0F1714] dark:text-[#F4F7F5] break-all">
                    {adapter.domain}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[#4F635A] dark:text-[#9CAAA2]">{t.websites.routes}</dt>
                  <dd className="mt-1 font-mono text-xs text-[#0F1714] dark:text-[#F4F7F5] break-all">
                    {adapter.routes.join(', ')}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[#4F635A] dark:text-[#9CAAA2]">{t.websites.adapterVersion}</dt>
                  <dd className="mt-1 font-mono text-xs tabular-nums text-[#0F1714] dark:text-[#F4F7F5]">
                    v{adapter.version} · {adapter.lastVerifiedDate}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[#4F635A] dark:text-[#9CAAA2]">{t.websites.fieldCount}</dt>
                  <dd className="mt-1 font-mono text-xs tabular-nums text-[#0F1714] dark:text-[#F4F7F5]">
                    {adapter.supportedFieldCount} fields ({adapter.source})
                  </dd>
                </div>
              </dl>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#4F635A] dark:text-[#9CAAA2] mb-2.5">
                    {t.websites.capabilities}
                  </h3>
                  <ul className="space-y-2 text-sm text-[#0F1714] dark:text-[#F4F7F5]">
                    {adapter.capabilities.map((cap) => (
                      <li key={cap} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" aria-hidden="true" />
                        <span>{cap}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#4F635A] dark:text-[#9CAAA2] mb-2.5">
                    {t.websites.limitations}
                  </h3>
                  <ul className="space-y-2 text-sm text-[#4F635A] dark:text-[#9CAAA2]">
                    {adapter.knownLimitations.map((lim) => (
                      <li key={lim} className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" aria-hidden="true" />
                        <span>{lim}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
