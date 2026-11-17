import React from 'react';
import {AlertTriangle, BookOpen, CheckCircle2, Download, ExternalLink, Shield, Wrench} from 'lucide-react';
import {APP_VERSION} from '../../shared/constants/app-constants';
import {useApp} from '../context/AppContext';

export const HelpDocsPage: React.FC = () => {
  const {settings, t, setPage} = useApp();
  const isBn = settings.language === 'bn';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#0F1714] dark:text-[#F4F7F5]">
            {t.help.title}
          </h1>
          <p className="mt-1 text-sm text-[#4F635A] dark:text-[#9CAAA2]">{t.help.subtitle}</p>
        </div>

        <a
          href="/api/v1/extension/download"
          download="wafa-formassist-extension-mv3-v1.0.0.zip"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          <span>{t.help.downloadExtensionZip}</span>
        </a>
      </div>

      {/* Honest AI Studio Preview vs Browser Extension Scope Disclosure */}
      <section className="rounded-xl border border-amber-500/40 bg-white dark:bg-[#121A17] p-5 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1 text-sm">
          <h2 className="font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
            {isBn
              ? 'ওয়েব ড্যাশবোর্ড বনাম আলাদা ব্রাউজার এক্সটেনশন'
              : 'Management Dashboard Preview vs. Separately Installed Browser Extension'}
          </h2>
          <p className="text-xs leading-relaxed text-[#4F635A] dark:text-[#9CAAA2]">
            {t.overview.extensionNotice}{' '}
            {isBn
              ? 'লাইভ dgbpo.teletalk.com.bd পোর্টালের রিয়েল DOM যাচাই করার জন্য Chrome বা Edge-এ এক্সটেনশনটি লোড করে ফর্ম প্রিভিউ টেবিল পর্যালোচনা করুন।'
              : 'Live production DOM selectors on https://dgbpo.teletalk.com.bd/dgbpo2026/application.php are marked SIMULATED_VERIFIED / Live Unverified until inspected directly inside Chrome or Edge.'}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chrome & Edge Installation Guide */}
        <section className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <Wrench className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
            <h2 className="text-base font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
              {t.help.installStepsTitle}
            </h2>
          </div>

          <ol className="list-decimal list-inside space-y-2.5 text-sm text-[#4F635A] dark:text-[#9CAAA2]">
            <li>
              <strong className="text-[#0F1714] dark:text-[#F4F7F5]">Download &amp; Unzip:</strong> Click{' '}
              <em>{t.help.downloadExtensionZip}</em> above (or export the <code className="font-mono text-xs">/extension</code> folder from the project) and extract it locally.
            </li>
            <li>
              <strong className="text-[#0F1714] dark:text-[#F4F7F5]">Open Extension Manager:</strong> Visit{' '}
              <code className="font-mono text-xs">chrome://extensions</code> in Google Chrome or{' '}
              <code className="font-mono text-xs">edge://extensions</code> in Microsoft Edge.
            </li>
            <li>
              <strong className="text-[#0F1714] dark:text-[#F4F7F5]">Enable Developer Mode:</strong> Toggle{' '}
              <em>Developer mode</em> ON in the top-right (Chrome) or left panel (Edge).
            </li>
            <li>
              <strong className="text-[#0F1714] dark:text-[#F4F7F5]">Load Unpacked:</strong> Click{' '}
              <em>Load unpacked</em> and select the extracted directory containing{' '}
              <code className="font-mono text-xs">manifest.json</code>.
            </li>
            <li>
              <strong className="text-[#0F1714] dark:text-[#F4F7F5]">Import Your Encrypted Backup:</strong>{' '}
              Export an AES-GCM encrypted <code className="font-mono text-xs">.wafa.json</code> backup from{' '}
              <button
                type="button"
                onClick={() => setPage('backup')}
                className="underline text-emerald-600 dark:text-emerald-400 font-medium"
              >
                {t.nav.backup}
              </button>
              , then open the extension Options page to import it locally. The extension then runs 100% independently offline.
            </li>
          </ol>

          <div className="pt-3 border-t border-[#D7E2DC] dark:border-[#26362F] flex flex-wrap items-center gap-3 text-xs">
            <a
              href="/fixtures/dgbpo2026-simulated.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.autofill.openFixtureNewTab}</span>
            </a>
          </div>
        </section>

        {/* Hybrid Architecture & Guarantees */}
        <section className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
            <h2 className="text-base font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
              {t.help.architectureTitle}
            </h2>
          </div>

          <ul className="space-y-2.5 text-sm text-[#4F635A] dark:text-[#9CAAA2]">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                <strong className="text-[#0F1714] dark:text-[#F4F7F5]">Offline-First Foundation:</strong>{' '}
                All profiles, addresses, education, employment, validation, and autofill previews run locally via IndexedDB and Web Crypto API without requiring internet or accounts.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                <strong className="text-[#0F1714] dark:text-[#F4F7F5]">Optional Zero-Knowledge Cloud Sync:</strong>{' '}
                Cloud accounts are strictly optional. All sync pushes and cloud backups are encrypted client-side (AES-GCM-256) before transmission.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                <strong className="text-[#0F1714] dark:text-[#F4F7F5]">Strict Applicant Control:</strong>{' '}
                Never fabricates missing fields, never fills CAPTCHA/OTP/file inputs, and never auto-submits government applications.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                <strong className="text-[#0F1714] dark:text-[#F4F7F5]">Bilingual EN / বাংলা Support:</strong>{' '}
                Switch languages instantaneously from the top navigation bar or Settings without reloading or losing edits.
              </span>
            </li>
          </ul>
        </section>
      </div>

      {/* Quick Start Workflow */}
      <section className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
          <h2 className="text-base font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
            {isBn ? 'দ্রুত শুরু করার ধাপসমূহ' : 'Recommended Applicant Workflow'}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="rounded-lg bg-[#F6F8F7] dark:bg-[#18231E] p-4 space-y-1">
            <div className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">01 · Records</div>
            <div className="font-semibold text-[#0F1714] dark:text-[#F4F7F5]">Build Verified Profile</div>
            <p className="text-[#4F635A] dark:text-[#9CAAA2]">
              Add Personal Profile, Present/Permanent Addresses, SSC/HSC/Degree records, and Employment history.
            </p>
          </div>
          <div className="rounded-lg bg-[#F6F8F7] dark:bg-[#18231E] p-4 space-y-1">
            <div className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">02 · Audit</div>
            <div className="font-semibold text-[#0F1714] dark:text-[#F4F7F5]">Run Validation Center</div>
            <p className="text-[#4F635A] dark:text-[#9CAAA2]">
              Resolve missing NID/mobile digits, GPA bounds, SSC→HSC chronology, or overlapping work dates locally.
            </p>
          </div>
          <div className="rounded-lg bg-[#F6F8F7] dark:bg-[#18231E] p-4 space-y-1">
            <div className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">03 · Preview &amp; Fill</div>
            <div className="font-semibold text-[#0F1714] dark:text-[#F4F7F5]">Review Every Field</div>
            <p className="text-[#4F635A] dark:text-[#9CAAA2]">
              Scan the target DGBPO 2026 form, inspect High/Medium/Low confidence, approve fields, and verify fill results.
            </p>
          </div>
          <div className="rounded-lg bg-[#F6F8F7] dark:bg-[#18231E] p-4 space-y-1">
            <div className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">04 · Protect</div>
            <div className="font-semibold text-[#0F1714] dark:text-[#F4F7F5]">Encrypt &amp; Backup</div>
            <p className="text-[#4F635A] dark:text-[#9CAAA2]">
              Set a Vault Passphrase in Security Center and export an encrypted .wafa.json backup for Chrome/Edge extension use.
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-[#D7E2DC] dark:border-[#26362F] flex flex-wrap items-center justify-between gap-2 text-xs text-[#4F635A] dark:text-[#9CAAA2]">
          <span>
            {t.brand.name} v{APP_VERSION} · {t.brand.subtitle}
          </span>
          <span className="font-medium text-[#0F1714] dark:text-[#F4F7F5]">{t.brand.credit}</span>
        </div>
      </section>
    </div>
  );
};
