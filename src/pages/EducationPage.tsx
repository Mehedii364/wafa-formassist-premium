import React, {useMemo, useState} from 'react';
import {Pencil, Plus, Trash2} from 'lucide-react';
import {
  COURSE_DURATIONS,
  EDUCATION_BOARDS,
  EDUCATION_EXAMINATIONS,
  SSC_HSC_GROUPS,
} from '../../shared/constants/app-constants';
import {EducationRecord} from '../../shared/schemas/types';
import {useApp} from '../context/AppContext';

export const EducationPage: React.FC = () => {
  const {
    t,
    snapshot,
    activeProfile,
    setActiveProfileId,
    upsertEducation,
    deleteEducation,
    setPage,
    pushNotice,
  } = useApp();

  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [examination, setExamination] = useState('SSC');
  const [levelCategory, setLevelCategory] = useState<EducationRecord['levelCategory']>('ssc');
  const [rollNumber, setRollNumber] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [group, setGroup] = useState('Science');
  const [board, setBoard] = useState('Dhaka');
  const [institution, setInstitution] = useState('');
  const [resultType, setResultType] = useState<EducationRecord['resultType']>('GPA_5');
  const [result, setResult] = useState('');
  const [passingYear, setPassingYear] = useState('');
  const [degree, setDegree] = useState('');
  const [duration, setDuration] = useState('');
  const [error, setError] = useState('');

  const records = useMemo(() => {
    if (!activeProfile) return [];
    return snapshot.educations
      .filter((e) => e.profileId === activeProfile.id)
      .sort((a, b) => (a.passingYear || '').localeCompare(b.passingYear || ''));
  }, [snapshot.educations, activeProfile]);

  const startNew = () => {
    setEditingId('new');
    setExamination('SSC');
    setLevelCategory('ssc');
    setRollNumber('');
    setRegistrationNumber('');
    setGroup('Science');
    setBoard('Dhaka');
    setInstitution('');
    setResultType('GPA_5');
    setResult('');
    setPassingYear('');
    setDegree('');
    setDuration('');
    setError('');
  };

  const startEdit = (e: EducationRecord) => {
    setEditingId(e.id);
    setExamination(e.examination);
    setLevelCategory(e.levelCategory);
    setRollNumber(e.rollNumber);
    setRegistrationNumber(e.registrationNumber);
    setGroup(e.group);
    setBoard(e.board);
    setInstitution(e.institution);
    setResultType(e.resultType);
    setResult(e.result);
    setPassingYear(e.passingYear);
    setDegree(e.degree);
    setDuration(e.duration);
    setError('');
  };

  const handleExamChange = (val: string) => {
    setExamination(val);
    const meta = EDUCATION_EXAMINATIONS.find((x) => x.value === val);
    if (meta) {
      setLevelCategory(meta.category as EducationRecord['levelCategory']);
      if (meta.category === 'graduation' || meta.category === 'masters') {
        setResultType('CGPA_4');
      } else {
        setResultType('GPA_5');
      }
    }
  };

  const handleSave = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!activeProfile) return;
    setError('');
    const yr = Number(passingYear);
    if (!/^\d{4}$/.test(passingYear.trim()) || yr < 1960 || yr > new Date().getFullYear()) {
      setError(`Passing year must be a valid 4-digit year (1960–${new Date().getFullYear()}).`);
      return;
    }
    const numRes = Number(result);
    if (resultType === 'GPA_5' && (Number.isNaN(numRes) || numRes < 1 || numRes > 5)) {
      setError('GPA (Out of 5.00) must be between 1.00 and 5.00.');
      return;
    }
    if (resultType === 'CGPA_4' && (Number.isNaN(numRes) || numRes < 1 || numRes > 4)) {
      setError('CGPA (Out of 4.00) must be between 1.00 and 4.00.');
      return;
    }

    await upsertEducation({
      id: editingId === 'new' ? undefined : editingId || undefined,
      profileId: activeProfile.id,
      levelCategory,
      examination: examination.trim(),
      rollNumber: rollNumber.trim(),
      registrationNumber: registrationNumber.trim(),
      group: group.trim(),
      board: board.trim(),
      institution: institution.trim(),
      resultType,
      result: result.trim(),
      passingYear: passingYear.trim(),
      degree: degree.trim(),
      duration: duration.trim(),
    });
    setEditingId(null);
    pushNotice('success', `Saved ${examination} qualification.`);
  };

  const inputCls =
    'mt-1 w-full rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-[#F6F8F7] dark:bg-[#18231E] px-3 py-2 text-sm text-[#0F1714] dark:text-[#F4F7F5]';
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

  const isHigherEd = levelCategory === 'graduation' || levelCategory === 'masters';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.education.title}</h1>
          <p className="mt-1 text-sm text-[#4F635A] dark:text-[#9CAAA2]">{t.education.subtitle}</p>
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
            {t.education.addEducation}
          </button>
        </div>
      </div>

      {editingId && (
        <section className="rounded-xl border border-emerald-500/40 bg-white dark:bg-[#121A17] p-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label htmlFor="edu-exam" className={lblCls}>{t.education.examination} *</label>
                <select
                  id="edu-exam"
                  value={examination}
                  onChange={(e) => handleExamChange(e.target.value)}
                  className={inputCls}
                >
                  {EDUCATION_EXAMINATIONS.map((x) => (
                    <option key={x.value} value={x.value}>{x.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="edu-year" className={lblCls}>{t.education.passingYear} *</label>
                <input
                  id="edu-year"
                  type="text"
                  required
                  value={passingYear}
                  onChange={(e) => setPassingYear(e.target.value)}
                  placeholder="e.g. 2018"
                  className={`${inputCls} font-mono`}
                />
              </div>

              <div>
                <label htmlFor="edu-res-type" className={lblCls}>{t.education.resultType}</label>
                <select
                  id="edu-res-type"
                  value={resultType}
                  onChange={(e) => setResultType(e.target.value as EducationRecord['resultType'])}
                  className={inputCls}
                >
                  <option value="GPA_5">GPA (Out of 5.00)</option>
                  <option value="CGPA_4">CGPA (Out of 4.00)</option>
                  <option value="DIVISION">Division / Class</option>
                  <option value="GRADE">Grade / Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="edu-res" className={lblCls}>{t.education.result} *</label>
                <input
                  id="edu-res"
                  type="text"
                  required
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  placeholder={resultType === 'GPA_5' ? 'e.g. 5.00' : resultType === 'CGPA_4' ? 'e.g. 3.75' : 'First Class'}
                  className={`${inputCls} font-mono`}
                />
              </div>

              {!isHigherEd ? (
                <>
                  <div>
                    <label htmlFor="edu-roll" className={lblCls}>{t.education.rollNumber} *</label>
                    <input id="edu-roll" type="text" required value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} className={`${inputCls} font-mono`} />
                  </div>
                  <div>
                    <label htmlFor="edu-reg" className={lblCls}>{t.education.registrationNumber}</label>
                    <input id="edu-reg" type="text" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} className={`${inputCls} font-mono`} />
                  </div>
                  <div>
                    <label htmlFor="edu-board" className={lblCls}>{t.education.board} *</label>
                    <select id="edu-board" value={board} onChange={(e) => setBoard(e.target.value)} className={inputCls}>
                      {EDUCATION_BOARDS.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="edu-group" className={lblCls}>{t.education.group}</label>
                    <select id="edu-group" value={group} onChange={(e) => setGroup(e.target.value)} className={inputCls}>
                      {SSC_HSC_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label htmlFor="edu-inst" className={lblCls}>{t.education.institution} *</label>
                    <input id="edu-inst" type="text" required value={institution} onChange={(e) => setInstitution(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label htmlFor="edu-deg" className={lblCls}>{t.education.degree} *</label>
                    <input id="edu-deg" type="text" required value={degree} onChange={(e) => setDegree(e.target.value)} placeholder="e.g. B.Sc. in Computer Science" className={inputCls} />
                  </div>
                  <div>
                    <label htmlFor="edu-dur" className={lblCls}>{t.education.duration}</label>
                    <select id="edu-dur" value={duration} onChange={(e) => setDuration(e.target.value)} className={inputCls}>
                      <option value="">-- Select --</option>
                      {COURSE_DURATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>

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

      {/* Qualification Timeline */}
      {records.length === 0 ? (
        <div className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-8 text-center text-sm text-[#4F635A] dark:text-[#9CAAA2]">
          {t.education.noEducation}
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((edu) => (
            <article
              key={edu.id}
              className="rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    {edu.passingYear}
                  </span>
                  <span aria-hidden="true" className="text-[#4F635A] dark:text-[#9CAAA2]">·</span>
                  <h3 className="text-base font-semibold">{edu.examination}</h3>
                  {edu.degree && <span className="text-sm text-[#4F635A] dark:text-[#9CAAA2]">— {edu.degree}</span>}
                </div>
                <div className="text-xs font-mono text-[#4F635A] dark:text-[#9CAAA2] flex flex-wrap gap-x-3 gap-y-1">
                  <span>Result: {edu.result}</span>
                  {edu.board && <span>· Board: {edu.board}</span>}
                  {edu.group && <span>· Group: {edu.group}</span>}
                  {edu.rollNumber && <span>· Roll: {edu.rollNumber}</span>}
                  {edu.institution && <span>· {edu.institution}</span>}
                  {edu.duration && <span>· {edu.duration}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => startEdit(edu)}
                  aria-label={`Edit ${edu.examination}`}
                  className="rounded-lg border border-[#D7E2DC] dark:border-[#26362F] p-2 text-[#4F635A] dark:text-[#9CAAA2] hover:text-[#0F1714] dark:hover:text-white"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await deleteEducation(edu.id);
                    pushNotice('info', `Deleted ${edu.examination} record.`);
                  }}
                  aria-label={`Delete ${edu.examination}`}
                  className="rounded-lg border border-[#D7E2DC] dark:border-[#26362F] p-2 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
