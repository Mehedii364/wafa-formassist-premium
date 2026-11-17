import React, {useMemo, useState} from 'react';
import {AlertTriangle, Pencil, Plus, Trash2} from 'lucide-react';
import {EMPLOYMENT_CATEGORIES} from '../../shared/constants/app-constants';
import {calculateServiceDuration} from '../../shared/field-mapping/date-converter';
import {EmploymentRecord} from '../../shared/schemas/types';
import {detectEmploymentDateConflicts} from '../../shared/validation/validator';
import {useApp} from '../context/AppContext';

export const EmploymentPage: React.FC = () => {
  const {
    t,
    settings,
    snapshot,
    activeProfile,
    setActiveProfileId,
    upsertEmployment,
    deleteEmployment,
    setPage,
    pushNotice,
  } = useApp();

  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [organization, setOrganization] = useState('');
  const [designation, setDesignation] = useState('');
  const [employmentCategory, setEmploymentCategory] = useState('Private Sector');
  const [address, setAddress] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentlyWorking, setCurrentlyWorking] = useState(false);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const records = useMemo(() => {
    if (!activeProfile) return [];
    return snapshot.employments
      .filter((e) => e.profileId === activeProfile.id)
      .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  }, [snapshot.employments, activeProfile]);

  const conflicts = useMemo(() => detectEmploymentDateConflicts(records), [records]);

  const previewDuration = useMemo(() => {
    if (!startDate) return null;
    return calculateServiceDuration(startDate, currentlyWorking ? null : endDate);
  }, [startDate, endDate, currentlyWorking]);

  const startNew = () => {
    setEditingId('new');
    setOrganization('');
    setDesignation('');
    setEmploymentCategory('Private Sector');
    setAddress('');
    setStartDate('');
    setEndDate('');
    setCurrentlyWorking(false);
    setDescription('');
    setError('');
  };

  const startEdit = (emp: EmploymentRecord) => {
    setEditingId(emp.id);
    setOrganization(emp.organization);
    setDesignation(emp.designation);
    setEmploymentCategory(emp.employmentCategory || 'Private Sector');
    setAddress(emp.address);
    setStartDate(emp.startDate);
    setEndDate(emp.endDate);
    setCurrentlyWorking(emp.currentlyWorking);
    setDescription(emp.description);
    setError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile) return;
    setError('');
    if (!organization.trim() || !designation.trim() || !startDate) {
      setError('Organization, Designation, and Start Date are required.');
      return;
    }
    if (!currentlyWorking && endDate && endDate < startDate) {
      setError('End Date cannot be earlier than Start Date.');
      return;
    }
    await upsertEmployment({
      id: editingId === 'new' ? undefined : editingId || undefined,
      profileId: activeProfile.id,
      organization: organization.trim(),
      designation: designation.trim(),
      employmentCategory,
      address: address.trim(),
      startDate,
      endDate: currentlyWorking ? '' : endDate,
      currentlyWorking,
      description: description.trim(),
    });
    setEditingId(null);
    pushNotice('success', `Saved employment at ${organization.trim()}.`);
  };

  const inputCls =
    'mt-1 w-full rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-[#F6F8F7] dark:bg-[#18231E] px-3 py-2 text-sm text-[#0F1714] dark:text-[#F4F7F5] disabled:opacity-50';
  const lblCls = 'block text-xs font-medium text-[#4F635A] dark:text-[#9CAAA2]';

  if (!activeProfile) {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.employment.title}</h1>
          <p className="mt-1 text-sm text-[#4F635A] dark:text-[#9CAAA2]">{t.employment.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
          <button
            type="button"
            onClick={startNew}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            {t.employment.addEmployment}
          </button>
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <div className="font-semibold">{t.employment.overlapWarning}</div>
            <ul className="mt-1 text-xs space-y-0.5">
              {conflicts.map((c, i) => (
                <li key={i}>
                  "{c.firstOrg}" overlaps with "{c.secondOrg}" — review start/end dates.
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {editingId && (
        <section className="rounded-xl border border-emerald-500/40 bg-white dark:bg-[#121A17] p-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label htmlFor="emp-org" className={lblCls}>{t.employment.organization} *</label>
                <input id="emp-org" type="text" required value={organization} onChange={(e) => setOrganization(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="emp-desig" className={lblCls}>{t.employment.designation} *</label>
                <input id="emp-desig" type="text" required value={designation} onChange={(e) => setDesignation(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="emp-cat" className={lblCls}>{t.employment.category}</label>
                <select id="emp-cat" value={employmentCategory} onChange={(e) => setEmploymentCategory(e.target.value)} className={inputCls}>
                  {EMPLOYMENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="emp-start" className={lblCls}>{t.employment.startDate} *</label>
                <input id="emp-start" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${inputCls} font-mono`} />
              </div>
              <div>
                <label htmlFor="emp-end" className={lblCls}>{t.employment.endDate}</label>
                <input
                  id="emp-end"
                  type="date"
                  disabled={currentlyWorking}
                  value={currentlyWorking ? '' : endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentlyWorking}
                    onChange={(e) => setCurrentlyWorking(e.target.checked)}
                    className="rounded border-[#26362F]"
                  />
                  {t.employment.currentlyWorking}
                </label>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label htmlFor="emp-addr" className={lblCls}>{t.employment.address}</label>
                <input id="emp-addr" type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label htmlFor="emp-desc" className={lblCls}>{t.employment.description}</label>
                <textarea id="emp-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
              </div>
            </div>

            {previewDuration && (
              <div className="text-xs font-mono text-emerald-700 dark:text-emerald-400">
                {t.employment.serviceDuration}:{' '}
                {settings.language === 'bn' ? previewDuration.formattedBn : previewDuration.formattedEn}
              </div>
            )}

            {error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded-lg border border-[#D7E2DC] dark:border-[#26362F] px-4 py-2 text-sm font-medium"
              >
                {t.common.cancel}
              </button>
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                {t.common.save}
              </button>
            </div>
          </form>
        </section>
      )}

      {records.length === 0 ? (
        <div className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-8 text-center text-sm text-[#4F635A] dark:text-[#9CAAA2]">
          {t.employment.noEmployment}
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((emp) => {
            const dur = calculateServiceDuration(emp.startDate, emp.currentlyWorking ? null : emp.endDate);
            return (
              <article
                key={emp.id}
                className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">{emp.designation}</h3>
                    <span className="text-sm text-[#4F635A] dark:text-[#9CAAA2]">at {emp.organization}</span>
                  </div>
                  <div className="text-xs font-mono text-[#4F635A] dark:text-[#9CAAA2]">
                    {emp.startDate} → {emp.currentlyWorking ? 'Present' : emp.endDate || '—'}
                    {dur ? ` · ${settings.language === 'bn' ? dur.formattedBn : dur.formattedEn}` : ''}
                    {emp.employmentCategory ? ` · ${emp.employmentCategory}` : ''}
                  </div>
                  {emp.address && <div className="text-xs text-[#4F635A] dark:text-[#9CAAA2]">{emp.address}</div>}
                  {emp.description && (
                    <p className="text-sm text-[#0F1714] dark:text-[#F4F7F5] leading-relaxed">
                      {emp.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEdit(emp)}
                    aria-label={`Edit ${emp.organization}`}
                    className="rounded-lg border border-[#D7E2DC] dark:border-[#26362F] p-2 text-[#4F635A] dark:text-[#9CAAA2] hover:text-[#0F1714] dark:hover:text-white"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteEmployment(emp.id);
                      pushNotice('info', `Deleted employment at ${emp.organization}.`);
                    }}
                    aria-label={`Delete ${emp.organization}`}
                    className="rounded-lg border border-[#D7E2DC] dark:border-[#26362F] p-2 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="text-xs text-[#4F635A] dark:text-[#9CAAA2]">{t.employment.unverifiedNote}</p>
    </div>
  );
};
