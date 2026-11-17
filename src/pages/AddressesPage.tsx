import React, {useEffect, useMemo, useState} from 'react';
import {Trash2} from 'lucide-react';
import {BD_DISTRICTS, findDistrictEntry} from '../../shared/constants/bd-locations';
import {AddressType} from '../../shared/schemas/types';
import {useApp} from '../context/AppContext';

export const AddressesPage: React.FC = () => {
  const {
    t,
    snapshot,
    activeProfile,
    setActiveProfileId,
    upsertAddress,
    deleteAddress,
    setPage,
    pushNotice,
  } = useApp();

  const [tab, setTab] = useState<AddressType>('present');
  const [label, setLabel] = useState('');
  const [sameAsPresent, setSameAsPresent] = useState(false);
  const [careOf, setCareOf] = useState('');
  const [village, setVillage] = useState('');
  const [road, setRoad] = useState('');
  const [house, setHouse] = useState('');
  const [district, setDistrict] = useState('');
  const [upazila, setUpazila] = useState('');
  const [postOffice, setPostOffice] = useState('');
  const [postCode, setPostCode] = useState('');
  const [error, setError] = useState('');

  const profileAddresses = useMemo(
    () => (activeProfile ? snapshot.addresses.filter((a) => a.profileId === activeProfile.id) : []),
    [snapshot.addresses, activeProfile],
  );
  const presentRecord = profileAddresses.find((a) => a.addressType === 'present');
  const permanentRecord = profileAddresses.find((a) => a.addressType === 'permanent');
  const currentRecord = tab === 'present' ? presentRecord : permanentRecord;

  useEffect(() => {
    if (currentRecord) {
      setLabel(currentRecord.label || '');
      setSameAsPresent(Boolean(currentRecord.sameAsPresent));
      setCareOf(currentRecord.careOf || '');
      setVillage(currentRecord.village || '');
      setRoad(currentRecord.road || '');
      setHouse(currentRecord.house || '');
      setDistrict(currentRecord.district || '');
      setUpazila(currentRecord.upazila || '');
      setPostOffice(currentRecord.postOffice || '');
      setPostCode(currentRecord.postCode || '');
    } else {
      setLabel(tab === 'present' ? 'Primary Present Address' : 'Permanent Address');
      setSameAsPresent(false);
      setCareOf('');
      setVillage('');
      setRoad('');
      setHouse('');
      setDistrict('');
      setUpazila('');
      setPostOffice('');
      setPostCode('');
    }
    setError('');
  }, [currentRecord, tab, activeProfile?.id]);

  const handleToggleSameAsPresent = (checked: boolean) => {
    setSameAsPresent(checked);
    if (checked && presentRecord) {
      setCareOf(presentRecord.careOf);
      setVillage(presentRecord.village);
      setRoad(presentRecord.road);
      setHouse(presentRecord.house);
      setDistrict(presentRecord.district);
      setUpazila(presentRecord.upazila);
      setPostOffice(presentRecord.postOffice);
      setPostCode(presentRecord.postCode);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile) return;
    setError('');
    if (postCode.trim() && !/^\d{4}$/.test(postCode.trim())) {
      setError('Bangladesh Post Code must be exactly 4 numeric digits.');
      return;
    }

    const usePresent = tab === 'permanent' && sameAsPresent && presentRecord;
    await upsertAddress({
      id: currentRecord?.id,
      profileId: activeProfile.id,
      addressType: tab,
      label: label.trim() || (tab === 'present' ? 'Present Address' : 'Permanent Address'),
      sameAsPresent: tab === 'permanent' ? sameAsPresent : false,
      careOf: usePresent ? presentRecord.careOf : careOf.trim(),
      village: usePresent ? presentRecord.village : village.trim(),
      road: usePresent ? presentRecord.road : road.trim(),
      house: usePresent ? presentRecord.house : house.trim(),
      district: usePresent ? presentRecord.district : district.trim(),
      upazila: usePresent ? presentRecord.upazila : upazila.trim(),
      postOffice: usePresent ? presentRecord.postOffice : postOffice.trim(),
      postCode: usePresent ? presentRecord.postCode : postCode.trim(),
    });
    pushNotice('success', `Saved ${tab === 'present' ? 'Present' : 'Permanent'} Address.`);
  };

  const suggestedUpazilas = findDistrictEntry(district)?.upazilas || [];
  const inputCls =
    'mt-1 w-full rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-[#F6F8F7] dark:bg-[#18231E] px-3 py-2 text-sm text-[#0F1714] dark:text-[#F4F7F5] disabled:opacity-60';
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
          <h1 className="text-2xl font-bold tracking-tight">{t.addresses.title}</h1>
          <p className="mt-1 text-sm text-[#4F635A] dark:text-[#9CAAA2]">{t.addresses.subtitle}</p>
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

      {/* Segmented Tabs */}
      <div className="inline-flex rounded-lg border border-[#D7E2DC] dark:border-[#26362F] p-0.5 bg-white dark:bg-[#121A17]">
        {(['present', 'permanent'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              tab === k
                ? 'bg-emerald-600 text-white'
                : 'text-[#4F635A] dark:text-[#9CAAA2] hover:text-[#0F1714] dark:hover:text-[#F4F7F5]'
            }`}
          >
            {k === 'present' ? t.addresses.presentAddress : t.addresses.permanentAddress}
          </button>
        ))}
      </div>

      <section className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'permanent' && (
            <label className="inline-flex items-center gap-2.5 text-sm font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={sameAsPresent}
                onChange={(e) => handleToggleSameAsPresent(e.target.checked)}
                className="rounded border-[#26362F]"
              />
              {t.addresses.sameAsPresent}
              {!presentRecord && (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  (Save Present Address first to mirror automatically)
                </span>
              )}
            </label>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="addr-label" className={lblCls}>{t.addresses.label}</label>
              <input id="addr-label" type="text" value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label htmlFor="addr-co" className={lblCls}>{t.addresses.careOf} *</label>
              <input
                id="addr-co"
                type="text"
                required={!sameAsPresent}
                disabled={tab === 'permanent' && sameAsPresent}
                value={careOf}
                onChange={(e) => setCareOf(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="addr-village" className={lblCls}>{t.addresses.village}</label>
              <input
                id="addr-village"
                type="text"
                disabled={tab === 'permanent' && sameAsPresent}
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="addr-road" className={lblCls}>{t.addresses.road}</label>
              <input
                id="addr-road"
                type="text"
                disabled={tab === 'permanent' && sameAsPresent}
                value={road}
                onChange={(e) => setRoad(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="addr-house" className={lblCls}>{t.addresses.house}</label>
              <input
                id="addr-house"
                type="text"
                disabled={tab === 'permanent' && sameAsPresent}
                value={house}
                onChange={(e) => setHouse(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="addr-district" className={lblCls}>{t.addresses.district} *</label>
              <select
                id="addr-district"
                required={!sameAsPresent}
                disabled={tab === 'permanent' && sameAsPresent}
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className={inputCls}
              >
                <option value="">-- Select District --</option>
                {BD_DISTRICTS.map((d) => (
                  <option key={d.district} value={d.district}>
                    {d.district} ({d.districtBn})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="addr-upazila" className={lblCls}>{t.addresses.upazila} *</label>
              <input
                id="addr-upazila"
                type="text"
                list="wafa-upazila-options"
                required={!sameAsPresent}
                disabled={tab === 'permanent' && sameAsPresent}
                value={upazila}
                onChange={(e) => setUpazila(e.target.value)}
                placeholder={t.addresses.manualEntryHint}
                className={inputCls}
              />
              <datalist id="wafa-upazila-options">
                {suggestedUpazilas.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor="addr-po" className={lblCls}>{t.addresses.postOffice} *</label>
              <input
                id="addr-po"
                type="text"
                required={!sameAsPresent}
                disabled={tab === 'permanent' && sameAsPresent}
                value={postOffice}
                onChange={(e) => setPostOffice(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="addr-postcode" className={lblCls}>{t.addresses.postCode} *</label>
              <input
                id="addr-postcode"
                type="text"
                required={!sameAsPresent}
                disabled={tab === 'permanent' && sameAsPresent}
                value={postCode}
                onChange={(e) => setPostCode(e.target.value)}
                placeholder="e.g. 1207"
                className={`${inputCls} font-mono`}
              />
            </div>
          </div>

          {error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex items-center justify-between pt-2">
            {currentRecord ? (
              <button
                type="button"
                onClick={async () => {
                  await deleteAddress(currentRecord.id);
                  pushNotice('info', 'Removed address record.');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t.common.delete}
              </button>
            ) : (
              <span />
            )}
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              {t.addresses.addAddress}
            </button>
          </div>
        </form>
      </section>

      {/* Saved Addresses Summary */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[presentRecord, permanentRecord].map((rec, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-5"
          >
            <div className="text-xs font-medium text-[#4F635A] dark:text-[#9CAAA2]">
              {idx === 0 ? t.addresses.presentAddress : t.addresses.permanentAddress}
            </div>
            {rec ? (
              <div className="mt-2 space-y-1 text-sm">
                <div className="font-semibold">
                  C/O: {rec.careOf || '—'} {rec.sameAsPresent ? '· Synced with Present' : ''}
                </div>
                <div className="text-[#4F635A] dark:text-[#9CAAA2]">
                  {[rec.house, rec.road, rec.village].filter(Boolean).join(', ') || '—'}
                </div>
                <div className="font-mono text-xs text-[#4F635A] dark:text-[#9CAAA2]">
                  {rec.upazila}, {rec.district} · PO: {rec.postOffice} ({rec.postCode})
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-[#4F635A] dark:text-[#9CAAA2]">{t.addresses.noAddresses}</p>
            )}
          </div>
        ))}
      </section>
    </div>
  );
};
