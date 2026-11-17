import React, {useMemo} from 'react';
import {
  ArrowRight,
  Database,
  Globe,
  Lock,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  Wand2,
} from 'lucide-react';
import {calculateProfileCompletion, validateProfileSuite} from '../../shared/validation/validator';
import {useApp} from '../context/AppContext';

export const OverviewPage: React.FC = () => {
  const {
    t,
    settings,
    snapshot,
    adapters,
    activeProfile,
    setPage,
    connectivity,
    syncQueue,
  } = useApp();

  const lang = settings.language;

  const activeValidation = useMemo(() => {
    if (!activeProfile) return null;
    return validateProfileSuite({
      profile: activeProfile,
      addresses: snapshot.addresses,
      educations: snapshot.educations,
      employments: snapshot.employments,
    });
  }, [activeProfile, snapshot]);

  const activeCompletion = useMemo(() => {
    if (!activeProfile) return 0;
    return calculateProfileCompletion(activeProfile, snapshot.addresses, snapshot.educations);
  }, [activeProfile, snapshot]);

  const activeEduCount = activeProfile
    ? snapshot.educations.filter((e) => e.profileId === activeProfile.id).length
    : snapshot.educations.length;
  const activeEmpCount = activeProfile
    ? snapshot.employments.filter((e) => e.profileId === activeProfile.id).length
    : snapshot.employments.length;

  const incompleteProfilesCount = useMemo(() => {
    return snapshot.profiles.filter(
      (p) => calculateProfileCompletion(p, snapshot.addresses, snapshot.educations) < 80,
    ).length;
  }, [snapshot]);

  return (
    <div className="space-y-8">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F1714] dark:text-[#F4F7F5]">
            {t.overview.title}
          </h1>
          <p className="mt-1 text-sm text-[#4F635A] dark:text-[#9CAAA2]">{t.overview.subtitle}</p>
        </div>
        {snapshot.profiles.length > 0 && (
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setPage('profiles')}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t.profiles.newProfile}
            </button>
          </div>
        )}
      </div>

      {/* Empty Vault Call-to-Action when 0 profiles exist */}
      {snapshot.profiles.length === 0 && (
        <section className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-6 sm:p-8">
          <div className="max-w-2xl">
            <h2 className="text-lg font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
              {t.overview.emptyTitle}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#4F635A] dark:text-[#9CAAA2]">
              {t.overview.emptyBody}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setPage('profiles')}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors whitespace-nowrap"
              >
                {t.common.createFirstProfile}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setPage('backup')}
                className="inline-flex items-center gap-2 rounded-lg border border-[#D7E2DC] dark:border-[#26362F] px-4 py-2 text-sm font-medium text-[#0F1714] dark:text-[#F4F7F5] hover:bg-[#EEF3F0] dark:hover:bg-[#18231E] transition-colors whitespace-nowrap"
              >
                {t.backup.importTitle}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Primary KPI Strip — Calculated Live from IndexedDB */}
      <section aria-label="Vault statistics" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-5">
          <div className="text-xs font-medium text-[#4F635A] dark:text-[#9CAAA2]">
            {t.overview.totalProfiles}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#0F1714] dark:text-[#F4F7F5]">
            {snapshot.profiles.length}
          </div>
          <div className="mt-1 text-xs text-[#4F635A] dark:text-[#9CAAA2] truncate">
            {activeProfile ? `${t.common.active}: ${activeProfile.profileName}` : t.common.noProfileSelected}
          </div>
        </div>

        <div className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-5">
          <div className="text-xs font-medium text-[#4F635A] dark:text-[#9CAAA2]">
            {t.overview.educationRecords} · {t.overview.employmentRecords}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#0F1714] dark:text-[#F4F7F5]">
            {activeEduCount} <span className="text-base text-[#4F635A] dark:text-[#9CAAA2]">/</span> {activeEmpCount}
          </div>
          <div className="mt-1 text-xs text-[#4F635A] dark:text-[#9CAAA2]">
            {snapshot.addresses.length} {lang === 'bn' ? 'সংরক্ষিত ঠিকানা' : 'saved address record(s)'}
          </div>
        </div>

        <div className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-5">
          <div className="text-xs font-medium text-[#4F635A] dark:text-[#9CAAA2]">
            {t.overview.supportedWebsites} · {t.overview.recentSessions}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#0F1714] dark:text-[#F4F7F5]">
            {adapters.filter((a) => a.enabled).length}{' '}
            <span className="text-base text-[#4F635A] dark:text-[#9CAAA2]">·</span> {snapshot.sessions.length}
          </div>
          <div className="mt-1 text-xs text-[#4F635A] dark:text-[#9CAAA2]">
            DGBPO 2026 Application Portal
          </div>
        </div>

        <div className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-5">
          <div className="text-xs font-medium text-[#4F635A] dark:text-[#9CAAA2]">
            {t.overview.encryptionStatus}
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm font-semibold">
            {settings.encryptionEnabled ? (
              <>
                <Lock className="h-4 w-4 text-emerald-500 shrink-0" aria-hidden="true" />
                <span className="text-emerald-700 dark:text-emerald-400">{t.overview.encrypted}</span>
              </>
            ) : (
              <>
                <Unlock className="h-4 w-4 text-amber-500 shrink-0" aria-hidden="true" />
                <span className="text-amber-700 dark:text-amber-400">{t.overview.unencrypted}</span>
              </>
            )}
          </div>
          <div className="mt-1.5 text-xs text-[#4F635A] dark:text-[#9CAAA2]">
            IndexedDB · {settings.cloudSyncEnabled ? `Sync queue: ${syncQueue.length}` : t.connectivity.cloudDisabled}
          </div>
        </div>
      </section>

      {/* Main 2-Column Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 columns: Completion + Validation Health + Recent Sessions */}
        <div className="lg:col-span-7 space-y-6">
          {/* Active Profile Completion & Validation Health */}
          <section className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
                {t.overview.profileCompletion}
              </h2>
              <span className="font-mono text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {activeCompletion}%
              </span>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-[#EEF3F0] dark:bg-[#18231E] overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-200"
                style={{width: `${activeCompletion}%`}}
              />
            </div>

            {activeValidation ? (
              <div className="mt-5 pt-4 border-t border-[#D7E2DC] dark:border-[#26362F] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#4F635A] dark:text-[#9CAAA2]">
                  <span className="font-medium text-[#0F1714] dark:text-[#F4F7F5]">
                    {t.overview.validationSnapshot}
                  </span>
                  <span className="font-mono tabular-nums">
                    Invalid: {activeValidation.counts.INVALID} · Missing: {activeValidation.counts.MISSING} · Review:{' '}
                    {activeValidation.counts.NEEDS_REVIEW} · Warnings: {activeValidation.counts.WARNING}
                  </span>
                </div>
                <ul className="divide-y divide-[#D7E2DC] dark:divide-[#26362F]">
                  {activeValidation.issues.slice(0, 4).map((issue) => (
                    <li key={issue.id} className="py-2.5 flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium text-[#0F1714] dark:text-[#F4F7F5]">
                          {issue.field}
                        </div>
                        <p className="text-xs text-[#4F635A] dark:text-[#9CAAA2] mt-0.5">
                          {issue.whatIsWrong[lang]}
                        </p>
                      </div>
                      <span
                        className={`font-mono text-xs font-medium shrink-0 ${
                          issue.status === 'VALID'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : issue.status === 'INVALID'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {issue.status}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setPage('validation')}
                  className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  {t.nav.validation} →
                </button>
              </div>
            ) : (
              <p className="mt-4 text-xs text-[#4F635A] dark:text-[#9CAAA2]">
                {lang === 'bn'
                  ? 'ভ্যালিডেশন রিপোর্ট দেখতে প্রথমে একটি প্রোফাইল তৈরি করুন।'
                  : 'Create a personal profile to calculate live completion and validation diagnostics.'}
              </p>
            )}
          </section>

          {/* Recent Autofill Sessions */}
          <section className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
                {t.overview.recentActivity}
              </h2>
              <button
                type="button"
                onClick={() => setPage('history')}
                className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
              >
                {t.nav.history}
              </button>
            </div>
            {snapshot.sessions.length === 0 ? (
              <p className="mt-4 text-sm text-[#4F635A] dark:text-[#9CAAA2]">{t.history.noSessions}</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#D7E2DC] dark:border-[#26362F] text-[#4F635A] dark:text-[#9CAAA2]">
                      <th className="pb-2 font-medium">Website</th>
                      <th className="pb-2 font-medium">Profile</th>
                      <th className="pb-2 font-medium text-right">Filled / Scanned</th>
                      <th className="pb-2 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D7E2DC] dark:divide-[#26362F]">
                    {snapshot.sessions.slice(0, 5).map((s) => (
                      <tr key={s.id}>
                        <td className="py-2.5 font-mono text-[#0F1714] dark:text-[#F4F7F5]">{s.websiteDomain}</td>
                        <td className="py-2.5 text-[#4F635A] dark:text-[#9CAAA2]">{s.profileName}</td>
                        <td className="py-2.5 text-right font-mono tabular-nums">
                          {s.filledCount} / {s.scannedCount}
                        </td>
                        <td className="py-2.5 text-right font-mono text-emerald-700 dark:text-emerald-400">
                          {s.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Right 5 columns: Quick Actions + System Health & Extension Bridge */}
        <div className="lg:col-span-5 space-y-6">
          <section className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-6">
            <h2 className="text-base font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
              {t.overview.quickActions}
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-2.5">
              <button
                type="button"
                onClick={() => setPage('autofill')}
                className="flex items-center justify-between rounded-lg border border-[#D7E2DC] dark:border-[#26362F] px-4 py-3 text-left text-sm font-medium hover:bg-[#EEF3F0] dark:hover:bg-[#18231E] transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Wand2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                  {t.nav.autofill}
                </span>
                <ArrowRight className="h-4 w-4 text-[#4F635A] dark:text-[#9CAAA2]" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setPage('security')}
                className="flex items-center justify-between rounded-lg border border-[#D7E2DC] dark:border-[#26362F] px-4 py-3 text-left text-sm font-medium hover:bg-[#EEF3F0] dark:hover:bg-[#18231E] transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                  {t.nav.security}
                </span>
                <ArrowRight className="h-4 w-4 text-[#4F635A] dark:text-[#9CAAA2]" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setPage('backup')}
                className="flex items-center justify-between rounded-lg border border-[#D7E2DC] dark:border-[#26362F] px-4 py-3 text-left text-sm font-medium hover:bg-[#EEF3F0] dark:hover:bg-[#18231E] transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Database className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                  {t.nav.backup}
                </span>
                <ArrowRight className="h-4 w-4 text-[#4F635A] dark:text-[#9CAAA2]" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setPage('help')}
                className="flex items-center justify-between rounded-lg border border-[#D7E2DC] dark:border-[#26362F] px-4 py-3 text-left text-sm font-medium hover:bg-[#EEF3F0] dark:hover:bg-[#18231E] transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Globe className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                  {t.help.downloadExtensionZip}
                </span>
                <ArrowRight className="h-4 w-4 text-[#4F635A] dark:text-[#9CAAA2]" aria-hidden="true" />
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-6 space-y-4">
            <h2 className="text-base font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
              {t.overview.systemHealth}
            </h2>
            <dl className="space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#D7E2DC] dark:border-[#26362F]">
                <dt className="text-[#4F635A] dark:text-[#9CAAA2]">{t.overview.storageStatus}</dt>
                <dd className="font-mono text-emerald-700 dark:text-emerald-400">IndexedDB v1 Ready</dd>
              </div>
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#D7E2DC] dark:border-[#26362F]">
                <dt className="text-[#4F635A] dark:text-[#9CAAA2]">Cloud API Reachability</dt>
                <dd className="font-mono text-[#0F1714] dark:text-[#F4F7F5]">
                  {connectivity.apiReachable
                    ? `Reachable (${connectivity.latencyMs ?? 0}ms)`
                    : 'Offline / Local-only'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#D7E2DC] dark:border-[#26362F]">
                <dt className="text-[#4F635A] dark:text-[#9CAAA2]">Incomplete Profiles</dt>
                <dd className="font-mono tabular-nums text-[#0F1714] dark:text-[#F4F7F5]">
                  {incompleteProfilesCount}
                </dd>
              </div>
            </dl>
            <div className="rounded-lg bg-[#EEF3F0] dark:bg-[#18231E] p-3.5 text-xs leading-relaxed text-[#4F635A] dark:text-[#9CAAA2] flex items-start gap-2.5">
              <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{t.overview.extensionNotice}</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
