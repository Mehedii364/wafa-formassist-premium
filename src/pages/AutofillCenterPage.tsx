import React, {useMemo, useRef, useState} from 'react';
import {
  CheckSquare,
  ExternalLink,
  RotateCcw,
  ScanSearch,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import {DGBPO_2026_ADAPTER} from '../../shared/adapters/dgbpo-2026';
import {
  getAvailableSourceProperties,
  mapDetectedFields,
  ProfileBundle,
  resolveProfileValue,
} from '../../shared/field-mapping/mapper';
import {DetectedFormField, FieldMappingResult} from '../../shared/schemas/types';
import {validateProfileSuite} from '../../shared/validation/validator';
import {SimulatedDgbpoForm, SimulatedFormHandle} from '../components/SimulatedDgbpoForm';
import {useApp} from '../context/AppContext';

export const AutofillCenterPage: React.FC = () => {
  const {
    t,
    settings,
    snapshot,
    activeProfile,
    setActiveProfileId,
    recordSession,
    setPage,
    pushNotice,
  } = useApp();

  const simRef = useRef<SimulatedFormHandle>(null);
  const [scannedFields, setScannedFields] = useState<DetectedFormField[]>([]);
  const [protectedSkippedCount, setProtectedSkippedCount] = useState<number>(0);
  const [mappings, setMappings] = useState<FieldMappingResult[]>([]);
  const [postReport, setPostReport] = useState<{
    filledCount: number;
    skippedCount: number;
    unresolvedCount: number;
    failedCount: number;
    protectedSkippedCount: number;
    verified: boolean;
  } | null>(null);

  const sourceOptions = useMemo(() => {
    const base = getAvailableSourceProperties();
    const custom = (activeProfile?.customFields || [])
      .filter((cf) => cf.key && cf.label)
      .map((cf) => ({value: `custom.${cf.key}`, label: `Custom: ${cf.label}`}));
    return [...base, ...custom];
  }, [activeProfile]);

  const activeBundle: ProfileBundle | null = useMemo(() => {
    if (!activeProfile) return null;
    return {
      profile: activeProfile,
      presentAddress: snapshot.addresses.find(
        (a) => a.profileId === activeProfile.id && a.addressType === 'present',
      ),
      permanentAddress: snapshot.addresses.find(
        (a) => a.profileId === activeProfile.id && a.addressType === 'permanent',
      ),
      educations: snapshot.educations.filter((e) => e.profileId === activeProfile.id),
      employments: snapshot.employments.filter((e) => e.profileId === activeProfile.id),
    };
  }, [activeProfile, snapshot]);

  const handleScanForm = async () => {
    if (!activeBundle || !simRef.current) return;
    const scanResult = simRef.current.scanDomFields();
    setScannedFields(scanResult.fields);
    setProtectedSkippedCount(scanResult.protectedSkippedCount);
    const mapped = mapDetectedFields(scanResult.fields, activeBundle, {
      allowMediumConfidenceProposal: settings.allowMediumConfidenceProposal,
    });
    setMappings(mapped);
    setPostReport(null);

    const val = validateProfileSuite({
      profile: activeBundle.profile,
      addresses: snapshot.addresses,
      educations: snapshot.educations,
      employments: snapshot.employments,
      formMappings: mapped,
    });

    await recordSession({
      websiteId: DGBPO_2026_ADAPTER.id,
      websiteDomain: DGBPO_2026_ADAPTER.domain,
      applicationRoute: DGBPO_2026_ADAPTER.routes[0],
      profileId: activeBundle.profile.id,
      profileName: activeBundle.profile.profileName,
      timestamp: new Date().toISOString(),
      scannedCount: scanResult.fields.length,
      filledCount: 0,
      skippedCount: 0,
      unresolvedCount: mapped.filter((m) => m.status === 'MANUAL' || m.status === 'UNRESOLVED_DROPDOWN').length,
      failedCount: 0,
      protectedSkippedCount: scanResult.protectedSkippedCount,
      validationSummary: {
        valid: val.counts.VALID,
        warnings: val.counts.WARNING,
        missing: val.counts.MISSING,
        invalid: val.counts.INVALID,
      },
      status: 'SCANNED',
      verifiedAfterFill: false,
    });

    pushNotice(
      'info',
      `Scanned ${scanResult.fields.length} live DOM fields (${scanResult.protectedSkippedCount} protected controls excluded). Review before filling.`,
    );
  };

  const toggleRowSelection = (elementKey: string) => {
    setMappings((prev) =>
      prev.map((m) => {
        if (m.elementKey !== elementKey || m.status === 'UNSUPPORTED' || !m.transformedValue) {
          return m;
        }
        const nextSelected = !m.selectedForFill;
        return {
          ...m,
          selectedForFill: nextSelected,
          allowOverwrite: m.requiresOverwriteApproval ? nextSelected : m.allowOverwrite,
        };
      }),
    );
  };

  const handleOverrideSource = (elementKey: string, newSourceProp: string) => {
    if (!activeBundle) return;
    setMappings((prev) =>
      prev.map((m) => {
        if (m.elementKey !== elementKey) return m;
        if (!newSourceProp) {
          return {
            ...m,
            sourceProperty: null,
            sourceDisplayLabel: 'Unmatched',
            profileValue: '',
            transformedValue: '',
            status: 'MANUAL',
            selectedForFill: false,
            allowOverwrite: false,
          };
        }
        const val = resolveProfileValue(activeBundle, newSourceProp);
        const optLabel = sourceOptions.find((o) => o.value === newSourceProp)?.label || newSourceProp;
        const needsOverwrite = Boolean(m.hasExistingValue);
        return {
          ...m,
          sourceProperty: newSourceProp,
          sourceDisplayLabel: optLabel,
          profileValue: val,
          transformedValue: val,
          confidence: 'MEDIUM',
          matchReason: needsOverwrite
            ? 'User manual mapping override · Existing value detected (approve overwrite explicitly)'
            : 'User manual mapping override',
          status: val ? 'REVIEW' : 'MISSING_VALUE',
          requiresOverwriteApproval: needsOverwrite,
          selectedForFill: Boolean(val) && !needsOverwrite,
          allowOverwrite: false,
        };
      }),
    );
  };

  const selectAllSafe = () => {
    setMappings((prev) =>
      prev.map((m) => ({
        ...m,
        selectedForFill:
          !m.requiresOverwriteApproval &&
          m.confidence === 'HIGH' &&
          m.status === 'READY' &&
          Boolean(m.transformedValue),
        allowOverwrite: false,
      })),
    );
  };

  const clearSelection = () => {
    setMappings((prev) => prev.map((m) => ({...m, selectedForFill: false, allowOverwrite: false})));
  };

  const handleApplyAutofill = async () => {
    if (!simRef.current || !activeBundle) return;
    const approved = mappings.filter((m) => m.selectedForFill && m.transformedValue);
    const unresolvedCount = mappings.filter(
      (m) => m.status === 'MANUAL' || m.status === 'UNRESOLVED_DROPDOWN' || m.status === 'UNSUPPORTED',
    ).length;
    const uncheckedCount = Math.max(0, mappings.length - approved.length - unresolvedCount);

    const result = simRef.current.applyApprovedMappings(approved);
    const totalSkipped = uncheckedCount + result.skippedCount;
    const verified = result.failedCount === 0 && result.filledCount + result.skippedCount === approved.length;

    setPostReport({
      filledCount: result.filledCount,
      skippedCount: totalSkipped,
      unresolvedCount,
      failedCount: result.failedCount,
      protectedSkippedCount,
      verified,
    });

    const val = validateProfileSuite({
      profile: activeBundle.profile,
      addresses: snapshot.addresses,
      educations: snapshot.educations,
      employments: snapshot.employments,
      formMappings: mappings,
    });

    await recordSession({
      websiteId: DGBPO_2026_ADAPTER.id,
      websiteDomain: DGBPO_2026_ADAPTER.domain,
      applicationRoute: DGBPO_2026_ADAPTER.routes[0],
      profileId: activeBundle.profile.id,
      profileName: activeBundle.profile.profileName,
      timestamp: new Date().toISOString(),
      scannedCount: scannedFields.length,
      filledCount: result.filledCount,
      skippedCount: totalSkipped,
      unresolvedCount,
      failedCount: result.failedCount,
      protectedSkippedCount,
      validationSummary: {
        valid: val.counts.VALID,
        warnings: val.counts.WARNING,
        missing: val.counts.MISSING,
        invalid: val.counts.INVALID,
      },
      status: result.failedCount > 0 ? 'PARTIALLY_COMPLETED' : 'AUTOFILLED',
      verifiedAfterFill: verified,
    });

    pushNotice(
      verified ? 'success' : 'warning',
      `Autofill verified: ${result.filledCount} filled, ${totalSkipped} skipped/preserved, ${result.failedCount} failed.`,
    );
  };

  const handleReset = () => {
    simRef.current?.resetForm();
    setMappings([]);
    setScannedFields([]);
    setProtectedSkippedCount(0);
    setPostReport(null);
  };

  const approvedCount = mappings.filter((m) => m.selectedForFill).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.autofill.title}</h1>
          <p className="mt-1 text-sm text-[#4F635A] dark:text-[#9CAAA2]">{t.autofill.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {snapshot.profiles.length > 0 && (
            <select
              aria-label={t.common.selectProfile}
              value={activeProfile?.id || ''}
              onChange={(e) => setActiveProfileId(e.target.value)}
              className="rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] px-3 py-2 text-sm"
            >
              {snapshot.profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.profileName}</option>
              ))}
            </select>
          )}
          <a
            href="/fixtures/dgbpo2026-simulated.html"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D7E2DC] dark:border-[#26362F] px-3 py-2 text-xs font-medium hover:bg-[#EEF3F0] dark:hover:bg-[#18231E] whitespace-nowrap"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            {t.autofill.openFixtureNewTab}
          </a>
        </div>
      </div>

      {/* Guardrail Disclosure */}
      <div className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] px-4 py-3 text-xs text-[#4F635A] dark:text-[#9CAAA2] flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-emerald-500 shrink-0" aria-hidden="true" />
          <span>{t.autofill.neverAutoSubmit}</span>
        </span>
        <span className="font-mono text-[#0F1714] dark:text-[#F4F7F5]">
          {DGBPO_2026_ADAPTER.domain}{DGBPO_2026_ADAPTER.routes[0]} · {DGBPO_2026_ADAPTER.recruitmentCycle}
        </span>
      </div>

      {!activeProfile && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Create or select a personal profile before scanning and autofilling the form.
          </p>
          <button
            type="button"
            onClick={() => setPage('profiles')}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700"
          >
            {t.common.createFirstProfile}
          </button>
        </div>
      )}

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          disabled={!activeProfile}
          onClick={() => void handleScanForm()}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-45 transition-colors whitespace-nowrap ${
            mappings.length > 0
              ? 'border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] text-[#0F1714] dark:text-[#F4F7F5] hover:bg-[#EEF3F0] dark:hover:bg-[#18231E]'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          <ScanSearch className="h-4 w-4" aria-hidden="true" />
          {t.autofill.scanForm}
        </button>

        {mappings.length > 0 && (
          <>
            <button
              type="button"
              onClick={selectAllSafe}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] px-3.5 py-2 text-xs font-medium hover:bg-[#EEF3F0] dark:hover:bg-[#18231E] whitespace-nowrap"
            >
              <CheckSquare className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
              {t.autofill.confirmAllSafe}
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] px-3.5 py-2 text-xs font-medium hover:bg-[#EEF3F0] dark:hover:bg-[#18231E] whitespace-nowrap"
            >
              {t.autofill.clearSelection}
            </button>
            <button
              type="button"
              disabled={approvedCount === 0}
              onClick={() => void handleApplyAutofill()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0F1714] dark:bg-emerald-500 px-4 py-2 text-sm font-semibold text-white dark:text-[#062117] hover:opacity-90 disabled:opacity-45 whitespace-nowrap"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {t.autofill.applyAutofill} ({approvedCount})
            </button>
          </>
        )}

        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#D7E2DC] dark:border-[#26362F] px-3 py-2 text-xs font-medium text-[#4F635A] dark:text-[#9CAAA2] hover:bg-[#EEF3F0] dark:hover:bg-[#18231E] whitespace-nowrap ml-auto"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          {t.autofill.resetForm}
        </button>
      </div>

      {/* Post-Fill Verification Report */}
      {postReport && (
        <section className="rounded-xl border border-emerald-500/40 bg-white dark:bg-[#121A17] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{t.autofill.reportTitle}</h2>
            <span className="font-mono text-xs text-emerald-700 dark:text-emerald-400">
              {postReport.verified ? 'DOM Verification Passed' : 'Partial Verification — Review Failed Fields'}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
            <div>
              <div className="text-[#4F635A] dark:text-[#9CAAA2]">{t.autofill.filledCount}</div>
              <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {postReport.filledCount}
              </div>
            </div>
            <div>
              <div className="text-[#4F635A] dark:text-[#9CAAA2]">{t.autofill.skippedCount}</div>
              <div className="mt-1 font-mono text-xl font-semibold tabular-nums">{postReport.skippedCount}</div>
            </div>
            <div>
              <div className="text-[#4F635A] dark:text-[#9CAAA2]">{t.autofill.unresolvedCount}</div>
              <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                {postReport.unresolvedCount}
              </div>
            </div>
            <div>
              <div className="text-[#4F635A] dark:text-[#9CAAA2]">Protected Excluded</div>
              <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                {postReport.protectedSkippedCount}
              </div>
            </div>
            <div>
              <div className="text-[#4F635A] dark:text-[#9CAAA2]">{t.autofill.failedCount}</div>
              <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-red-600 dark:text-red-400">
                {postReport.failedCount}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Structured Form Review Preview Table */}
      {mappings.length > 0 && (
        <section className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#D7E2DC] dark:border-[#26362F] flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              {t.autofill.reviewTableTitle} ({mappings.length} fields scanned)
            </h2>
            <span className="font-mono text-xs text-[#4F635A] dark:text-[#9CAAA2]">
              Approved: {approvedCount} · High Confidence: {mappings.filter((m) => m.confidence === 'HIGH').length}
              {protectedSkippedCount > 0 ? ` · Protected Excluded: ${protectedSkippedCount}` : ''}
            </span>
          </div>
          <div className="max-h-[400px] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#EEF3F0] dark:bg-[#18231E] text-[#4F635A] dark:text-[#9CAAA2]">
                <tr>
                  <th className="py-2.5 px-4 font-medium">{t.autofill.colApprove}</th>
                  <th className="py-2.5 px-3 font-medium">{t.autofill.colField}</th>
                  <th className="py-2.5 px-3 font-medium">{t.autofill.colProfileValue}</th>
                  <th className="py-2.5 px-3 font-medium">{t.autofill.colSelector}</th>
                  <th className="py-2.5 px-3 font-medium">{t.autofill.colConfidence}</th>
                  <th className="py-2.5 px-4 font-medium text-right">{t.autofill.colStatus}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D7E2DC] dark:divide-[#26362F]">
                {mappings.map((m) => (
                  <tr key={m.elementKey} className="hover:bg-[#F6F8F7] dark:hover:bg-[#18231E]/60">
                    <td className="py-2.5 px-4">
                      <input
                        type="checkbox"
                        aria-label={`Approve autofill for ${m.fieldLabel}`}
                        checked={m.selectedForFill}
                        disabled={m.status === 'UNSUPPORTED' || !m.transformedValue}
                        onChange={() => toggleRowSelection(m.elementKey)}
                        className="rounded border-[#26362F]"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-[#0F1714] dark:text-[#F4F7F5]">{m.fieldLabel}</div>
                      <div className="text-[11px] text-[#4F635A] dark:text-[#9CAAA2]">{m.matchReason}</div>
                      {m.requiresOverwriteApproval && (
                        <div className="mt-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                          Existing value detected — check to approve overwrite
                        </div>
                      )}
                      {m.dropdownNote && (
                        <div className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-400">
                          {m.dropdownNote}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#0F1714] dark:text-[#F4F7F5]">
                      {m.status === 'UNSUPPORTED' ? (
                        <span className="text-amber-600 dark:text-amber-400">Blocked</span>
                      ) : (
                        <div className="space-y-1">
                          <div>{m.transformedValue || '—'}</div>
                          <select
                            aria-label={`Override mapping source for ${m.fieldLabel}`}
                            value={m.sourceProperty || ''}
                            onChange={(e) => handleOverrideSource(m.elementKey, e.target.value)}
                            className="w-44 rounded border border-[#D7E2DC] dark:border-[#26362F] bg-[#F6F8F7] dark:bg-[#18231E] px-1.5 py-0.5 text-[11px] font-sans"
                          >
                            <option value="">(Manual / Unmapped)</option>
                            {sourceOptions.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#4F635A] dark:text-[#9CAAA2]">
                      {m.tagName} · {m.detectedSelectorHint}
                    </td>
                    <td className="py-2.5 px-3 font-mono">{m.confidence}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-medium">
                      <span
                        className={
                          m.status === 'READY'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : m.status === 'REVIEW'
                              ? 'text-amber-600 dark:text-amber-400'
                              : m.status === 'UNSUPPORTED'
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-[#4F635A] dark:text-[#9CAAA2]'
                        }
                      >
                        {m.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Embedded Deterministic Simulated DGBPO 2026 Form */}
      <section className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-5 border-b border-[#D7E2DC] dark:border-[#26362F]">
          <div>
            <h2 className="text-base font-semibold">{t.autofill.simulatedNotice}</h2>
            <p className="text-xs text-[#4F635A] dark:text-[#9CAAA2]">
              Bangladesh Post Office, Department of Posts · Deterministic local DOM inspection &amp; autofill target
            </p>
          </div>
          <span className="font-mono text-xs text-emerald-700 dark:text-emerald-400">
            Adapter v{DGBPO_2026_ADAPTER.version}
          </span>
        </div>
        <SimulatedDgbpoForm ref={simRef} />
      </section>
    </div>
  );
};
