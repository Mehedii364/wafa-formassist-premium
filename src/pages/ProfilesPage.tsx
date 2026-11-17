import React, {useMemo, useRef, useState} from 'react';
import {
  Copy,
  Download,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  DEPARTMENTAL_STATUSES,
  GENDERS,
  MARITAL_STATUSES,
  QUOTA_OPTIONS,
  RELIGIONS,
} from '../../shared/constants/app-constants';
import {CustomProfileField, PersonalInformation, ProfileRecord} from '../../shared/schemas/types';
import {maskSensitiveValue} from '../../shared/security/crypto';
import {calculateProfileCompletion} from '../../shared/validation/validator';
import {ConfirmDialog} from '../components/ConfirmDialog';
import {useApp} from '../context/AppContext';

const EMPTY_PERSONAL: PersonalInformation = {
  applicantName: '',
  applicantNameBn: '',
  fatherName: '',
  fatherNameBn: '',
  motherName: '',
  motherNameBn: '',
  dateOfBirth: '',
  nationality: 'Bangladeshi',
  religion: '',
  gender: '',
  nationalId: '',
  birthRegistration: '',
  passportId: '',
  maritalStatus: '',
  mobileNumber: '',
  confirmMobileNumber: '',
  email: '',
  quota: 'Non Quota',
  departmentalStatus: 'None',
};

export const ProfilesPage: React.FC = () => {
  const {
    t,
    settings,
    snapshot,
    activeProfileId,
    setActiveProfileId,
    upsertProfile,
    duplicateProfile,
    deleteProfile,
    setDefaultProfile,
    pushNotice,
  } = useApp();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'complete' | 'incomplete'>('all');
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [profileName, setProfileName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [form, setForm] = useState<PersonalInformation>(EMPTY_PERSONAL);
  const [customFields, setCustomFields] = useState<CustomProfileField[]>([]);
  const [formError, setFormError] = useState('');
  const [revealSensitive, setRevealSensitive] = useState(!settings.maskSensitiveFields);
  const [deleteTarget, setDeleteTarget] = useState<ProfileRecord | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return snapshot.profiles.filter((p) => {
      const comp = calculateProfileCompletion(p, snapshot.addresses, snapshot.educations);
      if (filter === 'complete' && comp < 80) return false;
      if (filter === 'incomplete' && comp >= 80) return false;
      if (!q) return true;
      return (
        p.profileName.toLowerCase().includes(q) ||
        p.personalInformation.applicantName.toLowerCase().includes(q) ||
        p.personalInformation.applicantNameBn.includes(q) ||
        p.personalInformation.mobileNumber.includes(q)
      );
    });
  }, [snapshot, search, filter]);

  const startCreate = () => {
    setEditingId('new');
    setProfileName('');
    setIsDefault(snapshot.profiles.length === 0);
    setForm({...EMPTY_PERSONAL});
    setCustomFields([]);
    setFormError('');
  };

  const startEdit = (profile: ProfileRecord) => {
    setEditingId(profile.id);
    setProfileName(profile.profileName);
    setIsDefault(profile.isDefault);
    setForm({...EMPTY_PERSONAL, ...profile.personalInformation});
    setCustomFields(profile.customFields ? structuredClone(profile.customFields) : []);
    setFormError('');
  };

  const addCustomFieldRow = () => {
    setCustomFields((prev) => [
      ...prev,
      {
        id: `cf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        key: '',
        label: '',
        value: '',
        verified: false,
      },
    ]);
  };

  const updateCustomFieldRow = (id: string, patch: Partial<CustomProfileField>) => {
    setCustomFields((prev) => prev.map((f) => (f.id === id ? {...f, ...patch} : f)));
  };

  const removeCustomFieldRow = (id: string) => {
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!profileName.trim()) {
      setFormError('Profile Name is required.');
      return;
    }
    if (!form.applicantName.trim()) {
      setFormError("Applicant's Full Name (English) is required.");
      return;
    }
    if (
      form.mobileNumber.trim() &&
      form.confirmMobileNumber.trim() &&
      form.mobileNumber.trim() !== form.confirmMobileNumber.trim()
    ) {
      setFormError('Confirm Mobile Number must match Mobile Number.');
      return;
    }

    const sanitizedCustomFields = customFields
      .map((cf) => ({
        ...cf,
        key: cf.key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_'),
        label: cf.label.trim(),
        value: cf.value.trim(),
      }))
      .filter((cf) => cf.key && cf.label);

    await upsertProfile({
      id: editingId === 'new' ? undefined : editingId || undefined,
      profileName: profileName.trim(),
      personalInformation: form,
      customFields: sanitizedCustomFields,
      isDefault,
    });
    setEditingId(null);
    pushNotice('success', `Saved profile "${profileName.trim()}" locally.`);
  };

  const handleExportSingle = (p: ProfileRecord) => {
    const payload = {
      format: 'WAFA_SINGLE_PROFILE_EXPORT',
      schemaVersion: p.schemaVersion,
      exportedAt: new Date().toISOString(),
      profile: p,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wafa-profile-${p.profileName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushNotice('info', 'Exported single profile JSON (store securely — unencrypted).');
  };

  const handleImportProfile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const incoming = parsed.profile || parsed;
      if (!incoming?.profileName || !incoming?.personalInformation) {
        throw new Error('Invalid profile JSON structure');
      }
      await upsertProfile({
        profileName: `${incoming.profileName} (Imported)`,
        personalInformation: {...EMPTY_PERSONAL, ...incoming.personalInformation},
        customFields: Array.isArray(incoming.customFields) ? incoming.customFields : [],
        isDefault: snapshot.profiles.length === 0,
      });
      pushNotice('success', `Imported profile "${incoming.profileName}".`);
    } catch {
      pushNotice('error', 'Could not import profile JSON. Check file format.');
    } finally {
      e.target.value = '';
    }
  };

  const inputCls =
    'mt-1 w-full rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-[#F6F8F7] dark:bg-[#18231E] px-3 py-2 text-sm text-[#0F1714] dark:text-[#F4F7F5]';
  const lblCls = 'block text-xs font-medium text-[#4F635A] dark:text-[#9CAAA2]';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.profiles.title}</h1>
          <p className="mt-1 text-sm text-[#4F635A] dark:text-[#9CAAA2]">{t.profiles.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <input
            ref={importInputRef}
            type="file"
            accept=".json"
            onChange={handleImportProfile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D7E2DC] dark:border-[#26362F] px-3.5 py-2 text-xs font-medium hover:bg-[#EEF3F0] dark:hover:bg-[#18231E] whitespace-nowrap"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            {t.profiles.importProfile}
          </button>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t.profiles.newProfile}
          </button>
        </div>
      </div>

      {/* Create / Edit Profile Form */}
      {editingId && (
        <section className="rounded-xl border border-emerald-500/40 bg-white dark:bg-[#121A17] p-6">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#D7E2DC] dark:border-[#26362F]">
            <h2 className="text-base font-semibold">
              {editingId === 'new' ? t.profiles.newProfile : t.profiles.editProfile}
            </h2>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="text-xs font-medium text-[#4F635A] dark:text-[#9CAAA2] hover:underline"
            >
              {t.common.cancel}
            </button>
          </div>

          <form onSubmit={handleSave} className="mt-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="prof-name" className={lblCls}>{t.profiles.profileName} *</label>
                <input
                  id="prof-name"
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="e.g., Primary Government Job Profile"
                  className={inputCls}
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="rounded border-[#26362F]"
                  />
                  {t.common.setDefault}
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label htmlFor="p-app-en" className={lblCls}>{t.profiles.applicantName} *</label>
                <input
                  id="p-app-en"
                  type="text"
                  required
                  value={form.applicantName}
                  onChange={(e) => setForm({...form, applicantName: e.target.value})}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="p-app-bn" className={lblCls}>{t.profiles.applicantNameBn}</label>
                <input
                  id="p-app-bn"
                  type="text"
                  value={form.applicantNameBn}
                  onChange={(e) => setForm({...form, applicantNameBn: e.target.value})}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="p-dob" className={lblCls}>{t.profiles.dateOfBirth}</label>
                <input
                  id="p-dob"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => setForm({...form, dateOfBirth: e.target.value})}
                  className={`${inputCls} font-mono`}
                />
              </div>

              <div>
                <label htmlFor="p-father-en" className={lblCls}>{t.profiles.fatherName}</label>
                <input
                  id="p-father-en"
                  type="text"
                  value={form.fatherName}
                  onChange={(e) => setForm({...form, fatherName: e.target.value})}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="p-father-bn" className={lblCls}>{t.profiles.fatherNameBn}</label>
                <input
                  id="p-father-bn"
                  type="text"
                  value={form.fatherNameBn}
                  onChange={(e) => setForm({...form, fatherNameBn: e.target.value})}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="p-nationality" className={lblCls}>{t.profiles.nationality}</label>
                <input
                  id="p-nationality"
                  type="text"
                  value={form.nationality}
                  onChange={(e) => setForm({...form, nationality: e.target.value})}
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="p-mother-en" className={lblCls}>{t.profiles.motherName}</label>
                <input
                  id="p-mother-en"
                  type="text"
                  value={form.motherName}
                  onChange={(e) => setForm({...form, motherName: e.target.value})}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="p-mother-bn" className={lblCls}>{t.profiles.motherNameBn}</label>
                <input
                  id="p-mother-bn"
                  type="text"
                  value={form.motherNameBn}
                  onChange={(e) => setForm({...form, motherNameBn: e.target.value})}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="p-religion" className={lblCls}>{t.profiles.religion}</label>
                <select
                  id="p-religion"
                  value={form.religion}
                  onChange={(e) => setForm({...form, religion: e.target.value})}
                  className={inputCls}
                >
                  <option value="">-- Select --</option>
                  {RELIGIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {settings.language === 'bn' ? r.bn : r.en}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="p-gender" className={lblCls}>{t.profiles.gender}</label>
                <select
                  id="p-gender"
                  value={form.gender}
                  onChange={(e) => setForm({...form, gender: e.target.value})}
                  className={inputCls}
                >
                  <option value="">-- Select --</option>
                  {GENDERS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {settings.language === 'bn' ? g.bn : g.en}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="p-marital" className={lblCls}>{t.profiles.maritalStatus}</label>
                <select
                  id="p-marital"
                  value={form.maritalStatus}
                  onChange={(e) => setForm({...form, maritalStatus: e.target.value})}
                  className={inputCls}
                >
                  <option value="">-- Select --</option>
                  {MARITAL_STATUSES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {settings.language === 'bn' ? m.bn : m.en}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="p-quota" className={lblCls}>{t.profiles.quota}</label>
                <select
                  id="p-quota"
                  value={form.quota}
                  onChange={(e) => setForm({...form, quota: e.target.value})}
                  className={inputCls}
                >
                  {QUOTA_OPTIONS.map((q) => (
                    <option key={q.value} value={q.value}>
                      {settings.language === 'bn' ? q.bn : q.en}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="p-nid" className={lblCls}>{t.profiles.nationalId}</label>
                <input
                  id="p-nid"
                  type="text"
                  value={form.nationalId}
                  onChange={(e) => setForm({...form, nationalId: e.target.value})}
                  placeholder="10, 13, or 17 digits"
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label htmlFor="p-breg" className={lblCls}>{t.profiles.birthRegistration}</label>
                <input
                  id="p-breg"
                  type="text"
                  value={form.birthRegistration}
                  onChange={(e) => setForm({...form, birthRegistration: e.target.value})}
                  placeholder="17 digits"
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label htmlFor="p-passport" className={lblCls}>{t.profiles.passportId}</label>
                <input
                  id="p-passport"
                  type="text"
                  value={form.passportId}
                  onChange={(e) => setForm({...form, passportId: e.target.value})}
                  className={`${inputCls} font-mono`}
                />
              </div>

              <div>
                <label htmlFor="p-mobile" className={lblCls}>{t.profiles.mobileNumber}</label>
                <input
                  id="p-mobile"
                  type="tel"
                  value={form.mobileNumber}
                  onChange={(e) => setForm({...form, mobileNumber: e.target.value})}
                  placeholder="01XXXXXXXXX"
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label htmlFor="p-mobile-confirm" className={lblCls}>{t.profiles.confirmMobileNumber}</label>
                <input
                  id="p-mobile-confirm"
                  type="tel"
                  value={form.confirmMobileNumber}
                  onChange={(e) => setForm({...form, confirmMobileNumber: e.target.value})}
                  placeholder="01XXXXXXXXX"
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label htmlFor="p-email" className={lblCls}>{t.profiles.email}</label>
                <input
                  id="p-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({...form, email: e.target.value})}
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="p-dept" className={lblCls}>{t.profiles.departmentalStatus}</label>
                <select
                  id="p-dept"
                  value={form.departmentalStatus}
                  onChange={(e) => setForm({...form, departmentalStatus: e.target.value})}
                  className={inputCls}
                >
                  {DEPARTMENTAL_STATUSES.map((d) => (
                    <option key={d.value} value={d.value}>
                      {settings.language === 'bn' ? d.bn : d.en}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom Profile Fields (Tier 3 exact key/label autofill mapping) */}
            <div className="pt-4 border-t border-[#D7E2DC] dark:border-[#26362F] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
                    Custom Profile Fields
                  </h3>
                  <p className="text-xs text-[#4F635A] dark:text-[#9CAAA2]">
                    Add portal-specific fields (e.g., driving license, employee ID, freedom fighter cert) for exact autofill matching.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addCustomFieldRow}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#D7E2DC] dark:border-[#26362F] px-3 py-1.5 text-xs font-medium hover:bg-[#EEF3F0] dark:hover:bg-[#18231E]"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Add Custom Field
                </button>
              </div>

              {customFields.length > 0 && (
                <div className="space-y-2.5">
                  {customFields.map((cf, index) => (
                    <div
                      key={cf.id}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-[#F6F8F7]/60 dark:bg-[#18231E]/50 p-3"
                    >
                      <div className="sm:col-span-3">
                        <label htmlFor={`cf-key-${cf.id}`} className={lblCls}>
                          Field Key #{index + 1}
                        </label>
                        <input
                          id={`cf-key-${cf.id}`}
                          type="text"
                          value={cf.key}
                          onChange={(e) => updateCustomFieldRow(cf.id, {key: e.target.value})}
                          placeholder="e.g., employee_id"
                          className={`${inputCls} font-mono`}
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label htmlFor={`cf-label-${cf.id}`} className={lblCls}>
                          Display Label #{index + 1}
                        </label>
                        <input
                          id={`cf-label-${cf.id}`}
                          type="text"
                          value={cf.label}
                          onChange={(e) => updateCustomFieldRow(cf.id, {label: e.target.value})}
                          placeholder="e.g., Employee ID"
                          className={inputCls}
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <label htmlFor={`cf-val-${cf.id}`} className={lblCls}>
                          Value #{index + 1}
                        </label>
                        <input
                          id={`cf-val-${cf.id}`}
                          type="text"
                          value={cf.value}
                          onChange={(e) => updateCustomFieldRow(cf.id, {value: e.target.value})}
                          placeholder="Field value"
                          className={inputCls}
                        />
                      </div>
                      <div className="sm:col-span-2 flex items-center justify-between gap-2 pb-1">
                        <label className="inline-flex items-center gap-1.5 text-xs text-[#4F635A] dark:text-[#9CAAA2] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(cf.verified)}
                            onChange={(e) => updateCustomFieldRow(cf.id, {verified: e.target.checked})}
                            className="rounded border-[#26362F]"
                          />
                          Verified
                        </label>
                        <button
                          type="button"
                          onClick={() => removeCustomFieldRow(cf.id)}
                          aria-label={`Remove custom field ${cf.label || index + 1}`}
                          className="rounded-md p-1.5 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {formError && (
              <p className="text-sm font-medium text-red-600 dark:text-red-400" role="alert">
                {formError}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded-lg border border-[#D7E2DC] dark:border-[#26362F] px-4 py-2 text-sm font-medium hover:bg-[#EEF3F0] dark:hover:bg-[#18231E]"
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

      {/* Search, Filter & Sensitive Field Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 text-[#4F635A] dark:text-[#9CAAA2] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.profiles.searchPlaceholder}
            aria-label={t.common.search}
            className="w-full rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] pl-9 pr-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-[#D7E2DC] dark:border-[#26362F] p-0.5 bg-white dark:bg-[#121A17]">
            {(['all', 'complete', 'incomplete'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  filter === key
                    ? 'bg-emerald-600 text-white'
                    : 'text-[#4F635A] dark:text-[#9CAAA2] hover:text-[#0F1714] dark:hover:text-[#F4F7F5]'
                }`}
              >
                {key === 'all'
                  ? t.profiles.filterAll
                  : key === 'complete'
                    ? t.profiles.filterComplete
                    : t.profiles.filterIncomplete}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setRevealSensitive((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] px-3 py-1.5 text-xs font-medium hover:bg-[#EEF3F0] dark:hover:bg-[#18231E] whitespace-nowrap"
          >
            {revealSensitive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {revealSensitive ? t.common.hide : t.common.reveal} NID
          </button>
        </div>
      </div>

      {/* Profiles List */}
      {filteredProfiles.length === 0 ? (
        <div className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-8 text-center">
          <p className="text-sm text-[#4F635A] dark:text-[#9CAAA2]">
            {snapshot.profiles.length === 0
              ? t.overview.emptyBody
              : 'No profiles match your search or filter criteria.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProfiles.map((p) => {
            const comp = calculateProfileCompletion(p, snapshot.addresses, snapshot.educations);
            const isActive = p.id === activeProfileId;
            return (
              <article
                key={p.id}
                className={`rounded-xl border bg-white dark:bg-[#121A17] p-5 transition-colors ${
                  isActive
                    ? 'border-emerald-500/60'
                    : 'border-[#D7E2DC] dark:border-[#26362F]'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveProfileId(p.id)}
                        className="text-base font-semibold text-[#0F1714] dark:text-[#F4F7F5] hover:text-emerald-600 dark:hover:text-emerald-400 text-left"
                      >
                        {p.profileName}
                      </button>
                      <span className="text-xs text-[#4F635A] dark:text-[#9CAAA2]">
                        {p.isDefault ? `· ${t.common.default}` : ''}
                        {isActive ? ` · ${t.common.active}` : ''}
                      </span>
                    </div>
                    <div className="text-sm text-[#0F1714] dark:text-[#F4F7F5]">
                      {p.personalInformation.applicantName}
                      {p.personalInformation.applicantNameBn ? ` · ${p.personalInformation.applicantNameBn}` : ''}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-[#4F635A] dark:text-[#9CAAA2]">
                      <span>DOB: {p.personalInformation.dateOfBirth || '—'}</span>
                      <span>·</span>
                      <span>
                        NID:{' '}
                        {revealSensitive
                          ? p.personalInformation.nationalId || '—'
                          : maskSensitiveValue(p.personalInformation.nationalId)}
                      </span>
                      <span>·</span>
                      <span>Mobile: {p.personalInformation.mobileNumber || '—'}</span>
                      <span>·</span>
                      <span className="text-emerald-700 dark:text-emerald-400">{comp}% complete</span>
                      {(() => {
                        const coreRequired = [
                          p.personalInformation.applicantName,
                          p.personalInformation.fatherName,
                          p.personalInformation.motherName,
                          p.personalInformation.dateOfBirth,
                          p.personalInformation.mobileNumber,
                          p.personalInformation.nationalId || p.personalInformation.birthRegistration,
                        ];
                        const missingCore = coreRequired.filter((v) => !v || !v.trim()).length;
                        const customCount = p.customFields?.length || 0;
                        const unverifiedCustom = (p.customFields || []).filter((cf) => !cf.verified).length;
                        return (
                          <>
                            {missingCore > 0 && (
                              <>
                                <span>·</span>
                                <span className="text-amber-600 dark:text-amber-400">
                                  {missingCore} core field{missingCore > 1 ? 's' : ''} missing
                                </span>
                              </>
                            )}
                            {customCount > 0 && (
                              <>
                                <span>·</span>
                                <span>
                                  {customCount} custom field{customCount > 1 ? 's' : ''}
                                  {unverifiedCustom > 0 ? ` (${unverifiedCustom} unverified)` : ''}
                                </span>
                              </>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {!p.isDefault && (
                      <button
                        type="button"
                        onClick={() => void setDefaultProfile(p.id)}
                        aria-label={`Set ${p.profileName} as default`}
                        title={t.common.setDefault}
                        className="rounded-lg border border-[#D7E2DC] dark:border-[#26362F] p-2 text-[#4F635A] dark:text-[#9CAAA2] hover:text-emerald-600 dark:hover:text-emerald-400"
                      >
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      aria-label={`Edit ${p.profileName}`}
                      title={t.common.edit}
                      className="rounded-lg border border-[#D7E2DC] dark:border-[#26362F] p-2 text-[#4F635A] dark:text-[#9CAAA2] hover:text-[#0F1714] dark:hover:text-white"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void duplicateProfile(p.id)}
                      aria-label={`Duplicate ${p.profileName}`}
                      title={t.common.duplicate}
                      className="rounded-lg border border-[#D7E2DC] dark:border-[#26362F] p-2 text-[#4F635A] dark:text-[#9CAAA2] hover:text-[#0F1714] dark:hover:text-white"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportSingle(p)}
                      aria-label={`Export ${p.profileName}`}
                      title={t.profiles.exportProfile}
                      className="rounded-lg border border-[#D7E2DC] dark:border-[#26362F] p-2 text-[#4F635A] dark:text-[#9CAAA2] hover:text-[#0F1714] dark:hover:text-white"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(p)}
                      aria-label={`Delete ${p.profileName}`}
                      title={t.common.delete}
                      className="rounded-lg border border-[#D7E2DC] dark:border-[#26362F] p-2 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t.profiles.deleteConfirmTitle}
        body={t.profiles.deleteConfirmBody}
        confirmLabel={t.common.delete}
        cancelLabel={t.common.cancel}
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteProfile(deleteTarget.id);
            pushNotice('info', `Deleted profile "${deleteTarget.profileName}".`);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
};
