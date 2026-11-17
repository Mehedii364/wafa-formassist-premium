import React, {useMemo, useState} from 'react';
import {AlertCircle, AlertTriangle, CheckCircle2, HelpCircle, ShieldCheck} from 'lucide-react';
import {ValidationStatus} from '../../shared/schemas/types';
import {validateProfileSuite} from '../../shared/validation/validator';
import {useApp} from '../context/AppContext';

export const ValidationCenterPage: React.FC = () => {
  const {t, settings, snapshot, activeProfile, setActiveProfileId, setPage} = useApp();
  const [statusFilter, setStatusFilter] = useState<'ALL' | ValidationStatus>('ALL');
  const lang = settings.language;

  const report = useMemo(() => {
    if (!activeProfile) return null;
    return validateProfileSuite({
      profile: activeProfile,
      addresses: snapshot.addresses,
      educations: snapshot.educations,
      employments: snapshot.employments,
    });
  }, [activeProfile, snapshot]);

  const filteredIssues = useMemo(() => {
    if (!report) return [];
    if (statusFilter === 'ALL') return report.issues;
    return report.issues.filter((i) => i.status === statusFilter);
  }, [report, statusFilter]);

  if (!activeProfile || !report) {
    return (
      <div className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-8 text-center space-y-3">
        <p className="text-sm text-[#4F635A] dark:text-[#9CAAA2]">{t.common.noProfileSelected}</p>
        <button
          type="button"
          onClick={() => setPage('profiles')}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          {t.common.createFirstProfile}
        </button>
      </div>
    );
  }

  const jumpToCategory = (cat: string) => {
    if (cat === 'personal') setPage('profiles');
    else if (cat === 'address') setPage('addresses');
    else if (cat === 'education') setPage('education');
    else if (cat === 'employment') setPage('employment');
    else setPage('autofill');
  };

  const statuses: Array<'ALL' | ValidationStatus> = [
    'ALL',
    'INVALID',
    'MISSING',
    'NEEDS_REVIEW',
    'WARNING',
    'VALID',
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.validation.title}</h1>
          <p className="mt-1 text-sm text-[#4F635A] dark:text-[#9CAAA2]">{t.validation.subtitle}</p>
        </div>
        <select
          aria-label={t.common.selectProfile}
          value={activeProfile.id}
          onChange={(e) => setActiveProfileId(e.target.value)}
          className="rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] px-3 py-2 text-sm"
        >
          {snapshot.profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.profileName}</option>
          ))}
        </select>
      </div>

      {/* Summary Strip */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {(
          [
            ['Overall', report.overallStatus],
            ['Completion', `${report.completionPercent}%`],
            ['INVALID', String(report.counts.INVALID)],
            ['MISSING', String(report.counts.MISSING)],
            ['NEEDS_REVIEW', String(report.counts.NEEDS_REVIEW)],
            ['WARNING', String(report.counts.WARNING)],
          ] as const
        ).map(([lbl, val]) => (
          <div
            key={lbl}
            className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-4"
          >
            <div className="text-xs text-[#4F635A] dark:text-[#9CAAA2]">{lbl}</div>
            <div className="mt-1 font-mono text-lg font-semibold tabular-nums">{val}</div>
          </div>
        ))}
      </section>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[#D7E2DC] dark:border-[#26362F] p-1 bg-white dark:bg-[#121A17] w-fit">
        {statuses.map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              statusFilter === st
                ? 'bg-emerald-600 text-white'
                : 'text-[#4F635A] dark:text-[#9CAAA2] hover:text-[#0F1714] dark:hover:text-[#F4F7F5]'
            }`}
          >
            {st === 'ALL' ? t.validation.allStatuses : st}
          </button>
        ))}
      </div>

      {/* Findings List */}
      <div className="space-y-3">
        {filteredIssues.map((issue) => {
          const Icon =
            issue.status === 'VALID'
              ? CheckCircle2
              : issue.status === 'INVALID'
                ? AlertCircle
                : issue.status === 'NEEDS_REVIEW'
                  ? HelpCircle
                  : AlertTriangle;
          const colorCls =
            issue.status === 'VALID'
              ? 'text-emerald-600 dark:text-emerald-400'
              : issue.status === 'INVALID'
                ? 'text-red-600 dark:text-red-400'
                : 'text-amber-600 dark:text-amber-400';

          return (
            <article
              key={issue.id}
              className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Icon className={`h-4 w-4 shrink-0 ${colorCls}`} aria-hidden="true" />
                  <h3 className="text-sm font-semibold">{issue.field}</h3>
                  <span className="text-xs text-[#4F635A] dark:text-[#9CAAA2]">· {issue.category}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-mono text-xs font-semibold ${colorCls}`}>{issue.status}</span>
                  {issue.status !== 'VALID' && (
                    <button
                      type="button"
                      onClick={() => jumpToCategory(issue.category)}
                      className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
                    >
                      Fix in {issue.category} →
                    </button>
                  )}
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-3 border-t border-[#D7E2DC] dark:border-[#26362F]">
                <div>
                  <dt className="font-medium text-[#4F635A] dark:text-[#9CAAA2]">{t.validation.whatWrong}</dt>
                  <dd className="mt-1 text-[#0F1714] dark:text-[#F4F7F5]">{issue.whatIsWrong[lang]}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[#4F635A] dark:text-[#9CAAA2]">{t.validation.whyMatters}</dt>
                  <dd className="mt-1 text-[#0F1714] dark:text-[#F4F7F5]">{issue.whyItMatters[lang]}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[#4F635A] dark:text-[#9CAAA2]">{t.validation.howFix}</dt>
                  <dd className="mt-1 text-[#0F1714] dark:text-[#F4F7F5]">{issue.howToFix[lang]}</dd>
                </div>
              </dl>
            </article>
          );
        })}

        {filteredIssues.length === 0 && (
          <div className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-8 text-center text-sm text-[#4F635A] dark:text-[#9CAAA2] flex flex-col items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-500" aria-hidden="true" />
            <span>No validation items in this status filter.</span>
          </div>
        )}
      </div>
    </div>
  );
};
