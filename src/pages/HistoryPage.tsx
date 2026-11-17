import React, {useMemo, useState} from 'react';
import {AlertCircle, CheckCircle2, History, Trash2} from 'lucide-react';
import {ConfirmDialog} from '../components/ConfirmDialog';
import {useApp} from '../context/AppContext';
import {SessionStatus} from '../../shared/schemas/types';

const STATUS_OPTIONS: Array<'ALL' | SessionStatus> = [
  'ALL',
  'AUTOFILLED',
  'PARTIALLY_COMPLETED',
  'VALIDATION_REQUIRED',
  'SCANNED',
  'REVIEWED',
  'CANCELLED',
];

function statusStyle(status: SessionStatus): string {
  switch (status) {
    case 'AUTOFILLED':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'PARTIALLY_COMPLETED':
    case 'VALIDATION_REQUIRED':
      return 'text-amber-600 dark:text-amber-400';
    case 'CANCELLED':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-[#4F635A] dark:text-[#9CAAA2]';
  }
}

export const HistoryPage: React.FC = () => {
  const {snapshot, t, clearSessions, pushNotice, setPage} = useApp();
  const [statusFilter, setStatusFilter] = useState<'ALL' | SessionStatus>('ALL');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const filtered = useMemo(() => {
    if (statusFilter === 'ALL') return snapshot.sessions;
    return snapshot.sessions.filter((s) => s.status === statusFilter);
  }, [snapshot.sessions, statusFilter]);

  const handleClear = async () => {
    await clearSessions();
    setConfirmOpen(false);
    pushNotice('info', 'Local autofill session history cleared.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#0F1714] dark:text-[#F4F7F5]">
            {t.history.title}
          </h1>
          <p className="mt-1 text-sm text-[#4F635A] dark:text-[#9CAAA2]">{t.history.subtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="history-status-filter" className="sr-only">
            {t.common.filter}
          </label>
          <select
            id="history-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | SessionStatus)}
            className="rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] px-3 py-2 text-sm text-[#0F1714] dark:text-[#F4F7F5]"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'ALL' ? t.common.all : opt.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          {snapshot.sessions.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-3.5 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors whitespace-nowrap shrink-0"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span>{t.history.clearHistory}</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] px-4 py-3 text-xs text-[#4F635A] dark:text-[#9CAAA2]">
        <AlertCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
        <span>{t.history.submissionDisclaimer}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-10 text-center space-y-3">
          <History className="h-8 w-8 mx-auto text-[#4F635A] dark:text-[#9CAAA2]" aria-hidden="true" />
          <p className="text-sm text-[#4F635A] dark:text-[#9CAAA2]">{t.history.noSessions}</p>
          <button
            type="button"
            onClick={() => setPage('autofill')}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
          >
            {t.nav.autofill}
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#D7E2DC] dark:border-[#26362F] bg-[#F6F8F7] dark:bg-[#18231E] text-xs font-medium text-[#4F635A] dark:text-[#9CAAA2]">
                <tr>
                  <th className="px-4 py-3">Timestamp &amp; Domain</th>
                  <th className="px-4 py-3">Profile</th>
                  <th className="px-4 py-3 text-right">Scanned</th>
                  <th className="px-4 py-3 text-right">Filled</th>
                  <th className="px-4 py-3 text-right">Skipped</th>
                  <th className="px-4 py-3 text-right">Manual / Failed</th>
                  <th className="px-4 py-3">{t.common.status}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D7E2DC] dark:divide-[#26362F]">
                {filtered.map((sess) => (
                  <tr key={sess.id} className="hover:bg-[#F6F8F7]/60 dark:hover:bg-[#18231E]/60">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-[#0F1714] dark:text-[#F4F7F5]">
                        {sess.websiteDomain}
                        {sess.applicationRoute}
                      </div>
                      <div className="mt-0.5 text-xs tabular-nums text-[#4F635A] dark:text-[#9CAAA2]">
                        {new Date(sess.timestamp).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-[#0F1714] dark:text-[#F4F7F5]">
                      {sess.profileName}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-[#0F1714] dark:text-[#F4F7F5]">
                      {sess.scannedCount}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                      {sess.filledCount}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-[#4F635A] dark:text-[#9CAAA2]">
                      {sess.skippedCount}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-amber-600 dark:text-amber-400">
                      {sess.unresolvedCount} / {sess.failedCount}
                    </td>
                    <td className="px-4 py-3">
                      <div className={`flex items-center gap-1.5 text-xs font-semibold ${statusStyle(sess.status)}`}>
                        {sess.verifiedAfterFill && (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        )}
                        <span>{sess.status.replace(/_/g, ' ')}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={t.history.clearHistory}
        body="This clears all local non-PII autofill session audit logs from IndexedDB. Your applicant profiles are unaffected."
        confirmLabel={t.common.delete}
        cancelLabel={t.common.cancel}
        danger
        onConfirm={() => void handleClear()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
};
