// WAFA FormAssist Extension — 6-Tier Bilingual Field Mapper, Safe Dropdown Matcher & Date Converter
// Enforces independent sensitive-field exclusion, non-auto-selected fuzzy options, and overwrite protection.

import {classifySensitiveField} from './sensitive-fields.js';

const BILINGUAL_OPTION_EQUIVS = {
  islam: ['ইসলাম', 'muslim', 'মুসলিম'],
  hinduism: ['হিন্দু', 'হিন্দু ধর্ম', 'hindu'],
  christianity: ['খ্রিস্টান', 'খ্রিস্ট ধর্ম', 'christian'],
  buddhism: ['বৌদ্ধ', 'বৌদ্ধ ধর্ম', 'buddhist'],
  male: ['পুরুষ', 'm'],
  female: ['মহিলা', 'নারী', 'f'],
  single: ['অবিবাহিত', 'unmarried'],
  married: ['বিবাহিত'],
  bangladeshi: ['বাংলাদেশী', 'বাংলাদেশি'],
  'non quota': ['কোটা নেই', 'none', 'general'],
  dhaka: ['ঢাকা'],
  chattogram: ['চট্টগ্রাম', 'chittagong'],
  cumilla: ['কুমিল্লা', 'comilla'],
  jashore: ['যশোর', 'jessore'],
  bogura: ['বগুড়া', 'bogra'],
  barishal: ['বরিশাল', 'barisal'],
  science: ['বিজ্ঞান'],
  'business studies': ['ব্যবসায় শিক্ষা', 'commerce'],
  humanities: ['মানবিক', 'arts'],
};

const RULES = [
  {prop: 'personal.applicantName', label: "Applicant's Name", ids: ['name', 'applicant_name'], names: ['name', 'applicant_name'], auto: ['name'], en: ["applicant's name", 'applicant name', 'full name'], bn: ['আবেদনকারীর নাম'], sec: 'basic'},
  {prop: 'personal.applicantNameBn', label: "Applicant's Name (Bengali)", ids: ['name_bn', 'applicant_name_bn', 'b_name'], names: ['name_bn', 'applicant_name_bn', 'b_name'], en: ['name in bengali', 'bengali name', 'applicant name in bengali'], bn: ['আবেদনকারীর নাম (বাংলায়)', 'আবেদনকারীর নাম বাংলা'], sec: 'basic'},
  {prop: 'personal.fatherName', label: "Father's Name", ids: ['father', 'father_name'], names: ['father', 'father_name'], en: ["father's name", 'father name'], bn: ['পিতার নাম'], sec: 'basic'},
  {prop: 'personal.fatherNameBn', label: "Father's Name (Bengali)", ids: ['father_bn', 'father_name_bn'], names: ['father_bn', 'father_name_bn'], en: ["father's name in bengali"], bn: ['পিতার নাম (বাংলায়)'], sec: 'basic'},
  {prop: 'personal.motherName', label: "Mother's Name", ids: ['mother', 'mother_name'], names: ['mother', 'mother_name'], en: ["mother's name", 'mother name'], bn: ['মাতার নাম'], sec: 'basic'},
  {prop: 'personal.motherNameBn', label: "Mother's Name (Bengali)", ids: ['mother_bn', 'mother_name_bn'], names: ['mother_bn', 'mother_name_bn'], en: ["mother's name in bengali"], bn: ['মাতার নাম (বাংলায়)'], sec: 'basic'},
  {prop: 'personal.dateOfBirth', label: 'Date of Birth', ids: ['dob', 'date_of_birth'], names: ['dob', 'date_of_birth'], auto: ['bday'], en: ['date of birth', 'dob'], bn: ['জন্ম তারিখ'], sec: 'basic', isDate: true},
  {prop: 'personal.nationality', label: 'Nationality', ids: ['nationality'], names: ['nationality'], en: ['nationality'], bn: ['জাতীয়তা'], sec: 'basic'},
  {prop: 'personal.religion', label: 'Religion', ids: ['religion'], names: ['religion'], en: ['religion'], bn: ['ধর্ম'], sec: 'basic'},
  {prop: 'personal.gender', label: 'Gender', ids: ['gender', 'sex'], names: ['gender', 'sex'], auto: ['sex'], en: ['gender'], bn: ['লিঙ্গ'], sec: 'basic'},
  {prop: 'personal.nationalId', label: 'National ID', ids: ['nid', 'national_id'], names: ['nid', 'national_id'], en: ['national id', 'nid'], bn: ['জাতীয় পরিচয়পত্র', 'এনআইডি'], sec: 'basic'},
  {prop: 'personal.birthRegistration', label: 'Birth Registration', ids: ['breg', 'birth_registration'], names: ['breg', 'birth_registration'], en: ['birth registration'], bn: ['জন্ম নিবন্ধন'], sec: 'basic'},
  {prop: 'personal.passportId', label: 'Passport ID', ids: ['passport', 'passport_id'], names: ['passport', 'passport_id'], en: ['passport'], bn: ['পাসপোর্ট'], sec: 'basic'},
  {prop: 'personal.maritalStatus', label: 'Marital Status', ids: ['marital_status', 'mstatus'], names: ['marital_status', 'mstatus'], en: ['marital status'], bn: ['বৈবাহিক অবস্থা'], sec: 'basic'},
  {prop: 'personal.mobileNumber', label: 'Mobile Number', ids: ['mobile', 'mobile_number'], names: ['mobile', 'mobile_number'], auto: ['tel', 'tel-national'], en: ['mobile number'], bn: ['মোবাইল নম্বর'], sec: 'basic'},
  {prop: 'personal.confirmMobileNumber', label: 'Confirm Mobile Number', ids: ['confirm_mobile', 'confirm_mobile_number'], names: ['confirm_mobile', 'confirm_mobile_number'], en: ['confirm mobile', 'confirm mobile number'], bn: ['মোবাইল নম্বর নিশ্চিত'], sec: 'basic'},
  {prop: 'personal.email', label: 'Email', ids: ['email', 'email_address'], names: ['email', 'email_address'], auto: ['email'], en: ['email'], bn: ['ইমেইল'], sec: 'basic'},
  {prop: 'personal.quota', label: 'Quota', ids: ['quota', 'ffq'], names: ['quota', 'ffq'], en: ['quota'], bn: ['কোটা'], sec: 'basic'},
  {prop: 'personal.departmentalStatus', label: 'Departmental Status', ids: ['dep_status', 'departmental_status'], names: ['dep_status', 'departmental_status'], en: ['departmental status'], bn: ['বিভাগীয় অবস্থা'], sec: 'basic'},
  {prop: 'presentAddress.careOf', label: 'Present Care Of', ids: ['present_careof'], names: ['present_careof'], en: ['care of'], bn: ['যত্নে'], sec: 'present_address'},
  {prop: 'presentAddress.addressLine', label: 'Present Village / Road / House', ids: ['present_village', 'present_address'], names: ['present_village', 'present_address'], en: ['village', 'road', 'house'], bn: ['গ্রাম'], sec: 'present_address'},
  {prop: 'presentAddress.district', label: 'Present District', ids: ['present_district'], names: ['present_district'], en: ['district'], bn: ['জেলা'], sec: 'present_address'},
  {prop: 'presentAddress.upazila', label: 'Present Upazila / P.S.', ids: ['present_upazila', 'present_ps'], names: ['present_upazila', 'present_ps'], en: ['upazila', 'police station'], bn: ['উপজেলা'], sec: 'present_address'},
  {prop: 'presentAddress.postOffice', label: 'Present Post Office', ids: ['present_post'], names: ['present_post'], en: ['post office'], bn: ['ডাকঘর'], sec: 'present_address'},
  {prop: 'presentAddress.postCode', label: 'Present Post Code', ids: ['present_postcode'], names: ['present_postcode'], auto: ['postal-code'], en: ['post code'], bn: ['পোস্ট কোড'], sec: 'present_address'},
  {prop: 'permanentAddress.sameAsPresent', label: 'Same as Present', ids: ['same_as_present'], names: ['same_as_present'], en: ['same as present'], bn: ['বর্তমান ঠিকানার অনুরূপ'], sec: 'permanent_address'},
  {prop: 'permanentAddress.careOf', label: 'Permanent Care Of', ids: ['permanent_careof'], names: ['permanent_careof'], en: ['care of'], bn: ['যত্নে'], sec: 'permanent_address'},
  {prop: 'permanentAddress.addressLine', label: 'Permanent Village / Road / House', ids: ['permanent_village', 'permanent_address'], names: ['permanent_village', 'permanent_address'], en: ['village', 'road', 'house'], bn: ['গ্রাম'], sec: 'permanent_address'},
  {prop: 'permanentAddress.district', label: 'Permanent District', ids: ['permanent_district'], names: ['permanent_district'], en: ['district'], bn: ['জেলা'], sec: 'permanent_address'},
  {prop: 'permanentAddress.upazila', label: 'Permanent Upazila / P.S.', ids: ['permanent_upazila', 'permanent_ps'], names: ['permanent_upazila', 'permanent_ps'], en: ['upazila', 'police station'], bn: ['উপজেলা'], sec: 'permanent_address'},
  {prop: 'permanentAddress.postOffice', label: 'Permanent Post Office', ids: ['permanent_post'], names: ['permanent_post'], en: ['post office'], bn: ['ডাকঘর'], sec: 'permanent_address'},
  {prop: 'permanentAddress.postCode', label: 'Permanent Post Code', ids: ['permanent_postcode'], names: ['permanent_postcode'], en: ['post code'], bn: ['পোস্ট কোড'], sec: 'permanent_address'},
  {prop: 'ssc.examination', label: 'SSC Examination', ids: ['exam1', 'ssc_exam'], names: ['exam1', 'ssc_exam'], en: ['examination'], bn: ['পরীক্ষা'], sec: 'ssc'},
  {prop: 'ssc.rollNumber', label: 'SSC Roll', ids: ['roll1', 'ssc_roll'], names: ['roll1', 'ssc_roll'], en: ['roll'], bn: ['রোল'], sec: 'ssc'},
  {prop: 'ssc.group', label: 'SSC Group', ids: ['subject1', 'ssc_group'], names: ['subject1', 'ssc_group'], en: ['group', 'subject'], bn: ['গ্রুপ'], sec: 'ssc'},
  {prop: 'ssc.board', label: 'SSC Board', ids: ['institute1', 'ssc_board'], names: ['institute1', 'ssc_board'], en: ['board'], bn: ['বোর্ড'], sec: 'ssc'},
  {prop: 'ssc.result', label: 'SSC Result', ids: ['result1', 'ssc_result'], names: ['result1', 'ssc_result'], en: ['result'], bn: ['ফলাফল'], sec: 'ssc'},
  {prop: 'ssc.passingYear', label: 'SSC Passing Year', ids: ['year1', 'ssc_year'], names: ['year1', 'ssc_year'], en: ['passing year'], bn: ['পাশের সন'], sec: 'ssc'},
  {prop: 'hsc.examination', label: 'HSC Examination', ids: ['exam2', 'hsc_exam'], names: ['exam2', 'hsc_exam'], en: ['examination'], bn: ['পরীক্ষা'], sec: 'hsc'},
  {prop: 'hsc.rollNumber', label: 'HSC Roll', ids: ['roll2', 'hsc_roll'], names: ['roll2', 'hsc_roll'], en: ['roll'], bn: ['রোল'], sec: 'hsc'},
  {prop: 'hsc.group', label: 'HSC Group', ids: ['subject2', 'hsc_group'], names: ['subject2', 'hsc_group'], en: ['group', 'subject'], bn: ['গ্রুপ'], sec: 'hsc'},
  {prop: 'hsc.board', label: 'HSC Board', ids: ['institute2', 'hsc_board'], names: ['institute2', 'hsc_board'], en: ['board'], bn: ['বোর্ড'], sec: 'hsc'},
  {prop: 'hsc.result', label: 'HSC Result', ids: ['result2', 'hsc_result'], names: ['result2', 'hsc_result'], en: ['result'], bn: ['ফলাফল'], sec: 'hsc'},
  {prop: 'hsc.passingYear', label: 'HSC Passing Year', ids: ['year2', 'hsc_year'], names: ['year2', 'hsc_year'], en: ['passing year'], bn: ['পাশের সন'], sec: 'hsc'},
  {prop: 'graduation.examination', label: 'Graduation Exam', ids: ['exam3', 'grad_exam'], names: ['exam3', 'grad_exam'], en: ['examination'], bn: ['পরীক্ষা'], sec: 'graduation'},
  {prop: 'graduation.institution', label: 'Graduation University', ids: ['institute3', 'grad_university'], names: ['institute3', 'grad_university'], en: ['university'], bn: ['বিশ্ববিদ্যালয়'], sec: 'graduation'},
  {prop: 'graduation.passingYear', label: 'Graduation Year', ids: ['year3', 'grad_year'], names: ['year3', 'grad_year'], en: ['passing year'], bn: ['পাশের সন'], sec: 'graduation'},
  {prop: 'graduation.degree', label: 'Graduation Degree', ids: ['subject3', 'grad_subject'], names: ['subject3', 'grad_subject'], en: ['subject', 'degree'], bn: ['ডিগ্রি'], sec: 'graduation'},
  {prop: 'graduation.result', label: 'Graduation Result', ids: ['result3', 'grad_result'], names: ['result3', 'grad_result'], en: ['result'], bn: ['ফলাফল'], sec: 'graduation'},
  {prop: 'graduation.duration', label: 'Graduation Duration', ids: ['duration3', 'grad_duration'], names: ['duration3', 'grad_duration'], en: ['duration'], bn: ['মেয়াদ'], sec: 'graduation'},
  {prop: 'masters.examination', label: 'Masters Exam', ids: ['exam4', 'masters_exam'], names: ['exam4', 'masters_exam'], en: ['examination'], bn: ['পরীক্ষা'], sec: 'masters'},
  {prop: 'masters.institution', label: 'Masters University', ids: ['institute4', 'masters_university'], names: ['institute4', 'masters_university'], en: ['university'], bn: ['বিশ্ববিদ্যালয়'], sec: 'masters'},
  {prop: 'masters.passingYear', label: 'Masters Year', ids: ['year4', 'masters_year'], names: ['year4', 'masters_year'], en: ['passing year'], bn: ['পাশের সন'], sec: 'masters'},
  {prop: 'masters.degree', label: 'Masters Degree', ids: ['subject4', 'masters_subject'], names: ['subject4', 'masters_subject'], en: ['subject', 'degree'], bn: ['ডিগ্রি'], sec: 'masters'},
  {prop: 'masters.result', label: 'Masters Result', ids: ['result4', 'masters_result'], names: ['result4', 'masters_result'], en: ['result'], bn: ['ফলাফল'], sec: 'masters'},
  {prop: 'masters.duration', label: 'Masters Duration', ids: ['duration4', 'masters_duration'], names: ['duration4', 'masters_duration'], en: ['duration'], bn: ['মেয়াদ'], sec: 'masters'},
  {prop: 'employment.designation', label: 'Designation', ids: ['job_designation', 'designation'], names: ['job_designation', 'designation'], en: ['designation'], bn: ['পদবি'], sec: 'employment'},
  {prop: 'employment.organization', label: 'Organization', ids: ['job_organization', 'organization'], names: ['job_organization', 'organization'], en: ['organization'], bn: ['প্রতিষ্ঠান'], sec: 'employment'},
  {prop: 'employment.address', label: 'Organization Address', ids: ['job_address'], names: ['job_address'], en: ['address'], bn: ['ঠিকানা'], sec: 'employment'},
  {prop: 'employment.startDate', label: 'Start Date', ids: ['job_start_date'], names: ['job_start_date'], en: ['start date'], bn: ['যোগদানের তারিখ'], sec: 'employment', isDate: true},
  {prop: 'employment.endDate', label: 'End Date', ids: ['job_end_date'], names: ['job_end_date'], en: ['end date'], bn: ['শেষের তারিখ'], sec: 'employment', isDate: true},
  {prop: 'employment.currentlyWorking', label: 'Currently Working', ids: ['job_currently_working'], names: ['job_currently_working'], en: ['currently working'], bn: ['বর্তমানে কর্মরত'], sec: 'employment'},
  {prop: 'employment.description', label: 'Job Description', ids: ['job_description'], names: ['job_description'], en: ['job description'], bn: ['কাজের বিবরণ'], sec: 'employment'},
];

function norm(s) {
  return String(s || '').toLowerCase().replace(/[*:\[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normKey(s) {
  return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function convertDateForField(iso, field) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  if (!m) return null;
  if (field.inputType === 'date') return `${m[1]}-${m[2]}-${m[3]}`;
  const hint = norm(`${field.placeholder} ${field.label}`);
  if (hint.includes('mm/dd/yyyy')) return `${m[2]}/${m[3]}/${m[1]}`;
  if (hint.includes('yyyy-mm-dd')) return `${m[1]}-${m[2]}-${m[3]}`;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function matchDropdown(val, options) {
  const target = norm(val);
  const valid = (options || []).filter((o) => o.value.trim() !== '');
  const exactV = valid.filter((o) => o.value.trim() === String(val).trim());
  if (exactV.length === 1) return {matched: true, value: exactV[0].value, text: exactV[0].text};
  const exactT = valid.filter((o) => norm(o.text) === target);
  if (exactT.length === 1) return {matched: true, value: exactT[0].value, text: exactT[0].text};
  const eqSet = new Set([target]);
  for (const [k, list] of Object.entries(BILINGUAL_OPTION_EQUIVS)) {
    const all = [k, ...list.map(norm)];
    if (all.includes(target)) all.forEach((x) => eqSet.add(x));
  }
  const eqMatches = valid.filter((o) => eqSet.has(norm(o.text)) || eqSet.has(norm(o.value)));
  if (eqMatches.length === 1) return {matched: true, value: eqMatches[0].value, text: eqMatches[0].text};
  if (eqMatches.length > 1) return {matched: false, ambiguous: true};

  // Partial/fuzzy containment is NEVER auto-selected — returned as suggestion only
  const fuzzy = valid.filter((o) => {
    const nt = norm(o.text);
    return (nt.length >= 3 && target.length >= 3 && nt.includes(target)) || (nt.length >= 3 && target.includes(nt));
  });
  if (fuzzy.length === 1) {
    return {matched: false, ambiguous: false, suggested: fuzzy[0]};
  }
  return {matched: false, ambiguous: fuzzy.length > 1};
}

function resolveValue(bundle, prop) {
  const [group, ...rest] = prop.split('.');
  const key = rest.join('.');
  if (group === 'custom') {
    const cf = (bundle.profile?.customFields || []).find((f) => normKey(f.key) === normKey(key));
    return cf ? String(cf.value || '') : '';
  }
  if (group === 'personal') return bundle.profile?.personalInformation?.[key] || '';
  if (group === 'presentAddress') {
    const a = bundle.presentAddress;
    if (!a) return '';
    if (key === 'addressLine') return [a.house, a.road, a.village].filter(Boolean).join(', ');
    return String(a[key] ?? '');
  }
  if (group === 'permanentAddress') {
    const a =
      bundle.permanentAddress?.sameAsPresent && bundle.presentAddress
        ? {...bundle.presentAddress, sameAsPresent: true}
        : bundle.permanentAddress;
    if (!a) return '';
    if (key === 'addressLine') return [a.house, a.road, a.village].filter(Boolean).join(', ');
    return String(a[key] ?? '');
  }
  if (['ssc', 'hsc', 'graduation', 'masters'].includes(group)) {
    const rec = (bundle.educations || []).find((e) => e.levelCategory === group);
    if (!rec) return '';
    return String(rec[key] || (key === 'degree' ? rec.group : '') || '');
  }
  if (group === 'employment') {
    const latest = [...(bundle.employments || [])].sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))[0];
    if (!latest) return '';
    return String(latest[key] ?? '');
  }
  return '';
}

export function mapExtensionFields(fields, bundle, allowMedium = false) {
  return fields.map((field) => {
    const sens = classifySensitiveField(field);
    if (sens.sensitive) {
      return {
        elementKey: field.elementKey,
        fieldLabel: field.label || field.name || 'Protected Field',
        sourceProperty: null,
        profileValue: '',
        transformedValue: '',
        confidence: 'UNMATCHED',
        status: 'UNSUPPORTED',
        selectedForFill: false,
        matchReason: `Security boundary (${sens.category}): ${sens.reason}`,
      };
    }

    let best = null;
    let bestScore = 0;
    let matchTier = null;
    let confidence = 'UNMATCHED';
    let matchReason = 'No match';

    const idL = (field.id || '').toLowerCase();
    const idK = normKey(field.id || '');
    const nameL = (field.name || '').toLowerCase();
    const nameK = normKey(field.name || '');
    const autoL = (field.autocomplete || '').toLowerCase();
    const lblL = norm(field.label || field.ariaLabel);
    const placeholderL = norm(field.placeholder);
    const descL = norm(`${field.description || ''} ${field.describedBy || ''}`);
    const secL = (field.sectionHint || '').toLowerCase();

    for (const rule of RULES) {
      const secMatch = !rule.sec || !secL || rule.sec === secL;
      // Tier 1: Exact ID
      if (idL && rule.ids.some((id) => id === idL || normKey(id) === idK)) {
        const s = secMatch ? 100 : 94;
        if (s > bestScore) {
          best = rule;
          bestScore = s;
          matchTier = 1;
          confidence = 'HIGH';
          matchReason = `Tier 1 · Exact ID (#${field.id})`;
        }
        continue;
      }
      // Tier 2: Exact normalized name
      if (nameL && rule.names.some((n) => n === nameL || normKey(n) === nameK)) {
        const s = secMatch ? 98 : 90;
        if (s > bestScore) {
          best = rule;
          bestScore = s;
          matchTier = 2;
          confidence = 'HIGH';
          matchReason = `Tier 2 · Exact name (${field.name})`;
        }
        continue;
      }
      if (rule.sec && secL && rule.sec !== secL) continue;

      // Tier 3: Exact label / autocomplete
      if (rule.en.some((k) => lblL === norm(k)) || (autoL && rule.auto?.includes(autoL))) {
        const s = 92;
        if (s > bestScore) {
          best = rule;
          bestScore = s;
          matchTier = 3;
          confidence = 'HIGH';
          matchReason = 'Tier 3 · Exact label / autocomplete match';
        }
        continue;
      }

      // Tier 4: Verified Bangla equivalent
      const isEnNameRule =
        rule.prop === 'personal.applicantName' ||
        rule.prop === 'personal.fatherName' ||
        rule.prop === 'personal.motherName';
      const labelMentionsBn =
        lblL.includes('bengali') || lblL.includes('bangla') || lblL.includes('বাংলা');
      if (!(isEnNameRule && labelMentionsBn) && rule.bn.some((k) => lblL.includes(norm(k)))) {
        const s = 89;
        if (s > bestScore) {
          best = rule;
          bestScore = s;
          matchTier = 4;
          confidence = 'HIGH';
          matchReason = 'Tier 4 · Verified Bangla equivalent match';
        }
        continue;
      }

      // Tier 5: Normalized domain label / placeholder
      if (rule.en.some((k) => k.length >= 4 && (lblL.includes(norm(k)) || placeholderL.includes(norm(k))))) {
        if (rule.prop.endsWith('Bn') !== labelMentionsBn && rule.prop.startsWith('personal.')) continue;
        const s = 74;
        if (s > bestScore) {
          best = rule;
          bestScore = s;
          matchTier = 5;
          confidence = 'MEDIUM';
          matchReason = 'Tier 5 · Normalized label/placeholder match';
        }
        continue;
      }

      // Tier 6: Weak contextual suggestion (LOW — never auto-selected)
      if (rule.en.some((k) => k.length >= 5 && descL.includes(norm(k)))) {
        const s = 40;
        if (s > bestScore) {
          best = rule;
          bestScore = s;
          matchTier = 6;
          confidence = 'LOW';
          matchReason = 'Tier 6 · Suggested fuzzy context (confirm manually)';
        }
      }
    }

    // Custom profile fields (Tier 3)
    if ((!best || bestScore < 85) && Array.isArray(bundle.profile?.customFields)) {
      for (const cf of bundle.profile.customFields) {
        if (normKey(cf.key) === idK || normKey(cf.key) === nameK || norm(cf.label) === lblL) {
          best = {prop: `custom.${cf.key}`, label: `Custom: ${cf.label}`};
          matchTier = 3;
          confidence = 'HIGH';
          matchReason = `Tier 3 · Custom field ("${cf.label}")`;
          break;
        }
      }
    }

    if (!best) {
      return {
        elementKey: field.elementKey,
        fieldLabel: field.label || field.name || 'Unmatched Field',
        sourceProperty: null,
        profileValue: '',
        transformedValue: '',
        confidence: 'UNMATCHED',
        status: 'MANUAL',
        selectedForFill: false,
        matchReason,
      };
    }

    const raw = resolveValue(bundle, best.prop);
    if (!raw) {
      return {
        elementKey: field.elementKey,
        fieldLabel: field.label || best.label,
        sourceProperty: best.prop,
        profileValue: '',
        transformedValue: '',
        confidence,
        matchTier,
        status: 'MISSING_VALUE',
        selectedForFill: false,
        matchReason: `${matchReason} · Missing in profile`,
      };
    }

    let transformed = raw;
    if (best.isDate) {
      const conv = convertDateForField(raw, field);
      if (!conv) {
        return {
          elementKey: field.elementKey,
          fieldLabel: field.label || best.label,
          sourceProperty: best.prop,
          profileValue: raw,
          transformedValue: '',
          confidence,
          matchTier,
          status: 'MANUAL',
          selectedForFill: false,
          matchReason: 'Date format conversion blocked for safety.',
        };
      }
      transformed = conv;
    }

    if (field.tagName === 'select') {
      const dm = matchDropdown(transformed, field.options);
      if (!dm.matched) {
        return {
          elementKey: field.elementKey,
          fieldLabel: field.label || best.label,
          sourceProperty: best.prop,
          profileValue: raw,
          transformedValue: dm.suggested ? dm.suggested.value : '',
          confidence: dm.suggested ? 'LOW' : confidence,
          matchTier: dm.suggested ? 6 : matchTier,
          status: 'UNRESOLVED_DROPDOWN',
          selectedForFill: false,
          suggestedOption: dm.suggested || null,
          matchReason: dm.suggested
            ? `Fuzzy suggestion "${dm.suggested.text}" requires manual confirmation`
            : dm.ambiguous
              ? 'Ambiguous dropdown candidates'
              : 'No unique option match',
        };
      }
      transformed = dm.value;
    }

    const requiresOverwriteApproval = Boolean(field.hasExistingValue);

    return {
      elementKey: field.elementKey,
      fieldLabel: field.label || best.label,
      sourceProperty: best.prop,
      profileValue: raw,
      transformedValue: transformed,
      confidence,
      matchTier,
      status: requiresOverwriteApproval ? 'REVIEW' : confidence === 'HIGH' ? 'READY' : confidence === 'MEDIUM' ? 'REVIEW' : 'MANUAL',
      selectedForFill: !requiresOverwriteApproval && (confidence === 'HIGH' || (confidence === 'MEDIUM' && allowMedium)),
      hasExistingValue: requiresOverwriteApproval,
      requiresOverwriteApproval,
      allowOverwrite: false,
      matchReason: requiresOverwriteApproval
        ? `${matchReason} · Existing value preserved unless you check to overwrite`
        : matchReason,
    };
  });
}
