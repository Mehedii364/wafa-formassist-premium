// WAFA FormAssist Extension — 7-Layer Bilingual Field Mapper, Safe Dropdown Matcher & Date Converter

const BILINGUAL_OPTION_EQUIVS = {
  islam: ['ইসলাম', 'muslim'],
  hinduism: ['হিন্দু', 'হিন্দু ধর্ম', 'hindu'],
  christianity: ['খ্রিস্টান', 'christian'],
  buddhism: ['বৌদ্ধ', 'buddhist'],
  male: ['পুরুষ', 'm'],
  female: ['মহিলা', 'f'],
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
  {prop: 'personal.applicantName', label: "Applicant's Name", names: ['name', 'applicant_name'], ids: ['name', 'applicant_name'], en: ["applicant's name", 'applicant name'], bn: ['আবেদনকারীর নাম'], sec: 'basic'},
  {prop: 'personal.applicantNameBn', label: "Applicant's Name (Bengali)", names: ['name_bn', 'applicant_name_bn', 'b_name'], ids: ['name_bn', 'applicant_name_bn'], en: ['name in bengali', 'bengali name'], bn: ['আবেদনকারীর নাম (বাংলায়)'], sec: 'basic'},
  {prop: 'personal.fatherName', label: "Father's Name", names: ['father', 'father_name'], ids: ['father', 'father_name'], en: ["father's name", 'father name'], bn: ['পিতার নাম'], sec: 'basic'},
  {prop: 'personal.fatherNameBn', label: "Father's Name (Bengali)", names: ['father_bn', 'father_name_bn'], ids: ['father_bn', 'father_name_bn'], en: ["father's name in bengali"], bn: ['পিতার নাম (বাংলায়)'], sec: 'basic'},
  {prop: 'personal.motherName', label: "Mother's Name", names: ['mother', 'mother_name'], ids: ['mother', 'mother_name'], en: ["mother's name", 'mother name'], bn: ['মাতার নাম'], sec: 'basic'},
  {prop: 'personal.motherNameBn', label: "Mother's Name (Bengali)", names: ['mother_bn', 'mother_name_bn'], ids: ['mother_bn', 'mother_name_bn'], en: ["mother's name in bengali"], bn: ['মাতার নাম (বাংলায়)'], sec: 'basic'},
  {prop: 'personal.dateOfBirth', label: 'Date of Birth', names: ['dob', 'date_of_birth'], ids: ['dob', 'date_of_birth'], en: ['date of birth', 'dob'], bn: ['জন্ম তারিখ'], sec: 'basic', isDate: true},
  {prop: 'personal.nationality', label: 'Nationality', names: ['nationality'], ids: ['nationality'], en: ['nationality'], bn: ['জাতীয়তা'], sec: 'basic'},
  {prop: 'personal.religion', label: 'Religion', names: ['religion'], ids: ['religion'], en: ['religion'], bn: ['ধর্ম'], sec: 'basic'},
  {prop: 'personal.gender', label: 'Gender', names: ['gender', 'sex'], ids: ['gender', 'sex'], en: ['gender'], bn: ['লিঙ্গ'], sec: 'basic'},
  {prop: 'personal.nationalId', label: 'National ID', names: ['nid', 'national_id'], ids: ['nid', 'national_id'], en: ['national id', 'nid'], bn: ['জাতীয় পরিচয়পত্র'], sec: 'basic'},
  {prop: 'personal.birthRegistration', label: 'Birth Registration', names: ['breg', 'birth_registration'], ids: ['breg', 'birth_registration'], en: ['birth registration'], bn: ['জন্ম নিবন্ধন'], sec: 'basic'},
  {prop: 'personal.passportId', label: 'Passport ID', names: ['passport', 'passport_id'], ids: ['passport', 'passport_id'], en: ['passport'], bn: ['পাসপোর্ট'], sec: 'basic'},
  {prop: 'personal.maritalStatus', label: 'Marital Status', names: ['marital_status', 'mstatus'], ids: ['marital_status', 'mstatus'], en: ['marital status'], bn: ['বৈবাহিক অবস্থা'], sec: 'basic'},
  {prop: 'personal.mobileNumber', label: 'Mobile Number', names: ['mobile', 'mobile_number'], ids: ['mobile', 'mobile_number'], en: ['mobile number'], bn: ['মোবাইল নম্বর'], sec: 'basic'},
  {prop: 'personal.confirmMobileNumber', label: 'Confirm Mobile Number', names: ['confirm_mobile', 'confirm_mobile_number'], ids: ['confirm_mobile', 'confirm_mobile_number'], en: ['confirm mobile'], bn: ['মোবাইল নম্বর নিশ্চিত'], sec: 'basic'},
  {prop: 'personal.email', label: 'Email', names: ['email'], ids: ['email'], en: ['email'], bn: ['ইমেইল'], sec: 'basic'},
  {prop: 'personal.quota', label: 'Quota', names: ['quota', 'ffq'], ids: ['quota', 'ffq'], en: ['quota'], bn: ['কোটা'], sec: 'basic'},
  {prop: 'personal.departmentalStatus', label: 'Departmental Status', names: ['dep_status', 'departmental_status'], ids: ['dep_status', 'departmental_status'], en: ['departmental status'], bn: ['বিভাগীয় অবস্থা'], sec: 'basic'},
  {prop: 'presentAddress.careOf', label: 'Present Care Of', names: ['present_careof'], ids: ['present_careof'], en: ['care of'], bn: ['যত্নে'], sec: 'present_address'},
  {prop: 'presentAddress.addressLine', label: 'Present Village / Road / House', names: ['present_village', 'present_address'], ids: ['present_village', 'present_address'], en: ['village', 'road', 'house'], bn: ['গ্রাম'], sec: 'present_address'},
  {prop: 'presentAddress.district', label: 'Present District', names: ['present_district'], ids: ['present_district'], en: ['district'], bn: ['জেলা'], sec: 'present_address'},
  {prop: 'presentAddress.upazila', label: 'Present Upazila / P.S.', names: ['present_upazila', 'present_ps'], ids: ['present_upazila', 'present_ps'], en: ['upazila', 'police station'], bn: ['উপজেলা'], sec: 'present_address'},
  {prop: 'presentAddress.postOffice', label: 'Present Post Office', names: ['present_post'], ids: ['present_post'], en: ['post office'], bn: ['ডাকঘর'], sec: 'present_address'},
  {prop: 'presentAddress.postCode', label: 'Present Post Code', names: ['present_postcode'], ids: ['present_postcode'], en: ['post code'], bn: ['পোস্ট কোড'], sec: 'present_address'},
  {prop: 'permanentAddress.sameAsPresent', label: 'Same as Present', names: ['same_as_present'], ids: ['same_as_present'], en: ['same as present'], bn: ['বর্তমান ঠিকানার অনুরূপ'], sec: 'permanent_address'},
  {prop: 'permanentAddress.careOf', label: 'Permanent Care Of', names: ['permanent_careof'], ids: ['permanent_careof'], en: ['care of'], bn: ['যত্নে'], sec: 'permanent_address'},
  {prop: 'permanentAddress.addressLine', label: 'Permanent Village / Road / House', names: ['permanent_village', 'permanent_address'], ids: ['permanent_village', 'permanent_address'], en: ['village', 'road', 'house'], bn: ['গ্রাম'], sec: 'permanent_address'},
  {prop: 'permanentAddress.district', label: 'Permanent District', names: ['permanent_district'], ids: ['permanent_district'], en: ['district'], bn: ['জেলা'], sec: 'permanent_address'},
  {prop: 'permanentAddress.upazila', label: 'Permanent Upazila / P.S.', names: ['permanent_upazila', 'permanent_ps'], ids: ['permanent_upazila', 'permanent_ps'], en: ['upazila', 'police station'], bn: ['উপজেলা'], sec: 'permanent_address'},
  {prop: 'permanentAddress.postOffice', label: 'Permanent Post Office', names: ['permanent_post'], ids: ['permanent_post'], en: ['post office'], bn: ['ডাকঘর'], sec: 'permanent_address'},
  {prop: 'permanentAddress.postCode', label: 'Permanent Post Code', names: ['permanent_postcode'], ids: ['permanent_postcode'], en: ['post code'], bn: ['পোস্ট কোড'], sec: 'permanent_address'},
  {prop: 'ssc.examination', label: 'SSC Examination', names: ['exam1', 'ssc_exam'], ids: ['exam1', 'ssc_exam'], en: ['examination'], bn: ['পরীক্ষা'], sec: 'ssc'},
  {prop: 'ssc.rollNumber', label: 'SSC Roll', names: ['roll1', 'ssc_roll'], ids: ['roll1', 'ssc_roll'], en: ['roll'], bn: ['রোল'], sec: 'ssc'},
  {prop: 'ssc.group', label: 'SSC Group', names: ['subject1', 'ssc_group'], ids: ['subject1', 'ssc_group'], en: ['group', 'subject'], bn: ['গ্রুপ'], sec: 'ssc'},
  {prop: 'ssc.board', label: 'SSC Board', names: ['institute1', 'ssc_board'], ids: ['institute1', 'ssc_board'], en: ['board'], bn: ['বোর্ড'], sec: 'ssc'},
  {prop: 'ssc.result', label: 'SSC Result', names: ['result1', 'ssc_result'], ids: ['result1', 'ssc_result'], en: ['result'], bn: ['ফলাফল'], sec: 'ssc'},
  {prop: 'ssc.passingYear', label: 'SSC Passing Year', names: ['year1', 'ssc_year'], ids: ['year1', 'ssc_year'], en: ['passing year'], bn: ['পাশের সন'], sec: 'ssc'},
  {prop: 'hsc.examination', label: 'HSC Examination', names: ['exam2', 'hsc_exam'], ids: ['exam2', 'hsc_exam'], en: ['examination'], bn: ['পরীক্ষা'], sec: 'hsc'},
  {prop: 'hsc.rollNumber', label: 'HSC Roll', names: ['roll2', 'hsc_roll'], ids: ['roll2', 'hsc_roll'], en: ['roll'], bn: ['রোল'], sec: 'hsc'},
  {prop: 'hsc.group', label: 'HSC Group', names: ['subject2', 'hsc_group'], ids: ['subject2', 'hsc_group'], en: ['group', 'subject'], bn: ['গ্রুপ'], sec: 'hsc'},
  {prop: 'hsc.board', label: 'HSC Board', names: ['institute2', 'hsc_board'], ids: ['institute2', 'hsc_board'], en: ['board'], bn: ['বোর্ড'], sec: 'hsc'},
  {prop: 'hsc.result', label: 'HSC Result', names: ['result2', 'hsc_result'], ids: ['result2', 'hsc_result'], en: ['result'], bn: ['ফলাফল'], sec: 'hsc'},
  {prop: 'hsc.passingYear', label: 'HSC Passing Year', names: ['year2', 'hsc_year'], ids: ['year2', 'hsc_year'], en: ['passing year'], bn: ['পাশের সন'], sec: 'hsc'},
  {prop: 'graduation.examination', label: 'Graduation Exam', names: ['exam3', 'grad_exam'], ids: ['exam3', 'grad_exam'], en: ['examination'], bn: ['পরীক্ষা'], sec: 'graduation'},
  {prop: 'graduation.institution', label: 'Graduation University', names: ['institute3', 'grad_university'], ids: ['institute3', 'grad_university'], en: ['university'], bn: ['বিশ্ববিদ্যালয়'], sec: 'graduation'},
  {prop: 'graduation.passingYear', label: 'Graduation Year', names: ['year3', 'grad_year'], ids: ['year3', 'grad_year'], en: ['passing year'], bn: ['পাশের সন'], sec: 'graduation'},
  {prop: 'graduation.degree', label: 'Graduation Degree', names: ['subject3', 'grad_subject'], ids: ['subject3', 'grad_subject'], en: ['subject', 'degree'], bn: ['ডিগ্রি'], sec: 'graduation'},
  {prop: 'graduation.result', label: 'Graduation Result', names: ['result3', 'grad_result'], ids: ['result3', 'grad_result'], en: ['result'], bn: ['ফলাফল'], sec: 'graduation'},
  {prop: 'graduation.duration', label: 'Graduation Duration', names: ['duration3', 'grad_duration'], ids: ['duration3', 'grad_duration'], en: ['duration'], bn: ['মেয়াদ'], sec: 'graduation'},
  {prop: 'masters.examination', label: 'Masters Exam', names: ['exam4', 'masters_exam'], ids: ['exam4', 'masters_exam'], en: ['examination'], bn: ['পরীক্ষা'], sec: 'masters'},
  {prop: 'masters.institution', label: 'Masters University', names: ['institute4', 'masters_university'], ids: ['institute4', 'masters_university'], en: ['university'], bn: ['বিশ্ববিদ্যালয়'], sec: 'masters'},
  {prop: 'masters.passingYear', label: 'Masters Year', names: ['year4', 'masters_year'], ids: ['year4', 'masters_year'], en: ['passing year'], bn: ['পাশের সন'], sec: 'masters'},
  {prop: 'masters.degree', label: 'Masters Degree', names: ['subject4', 'masters_subject'], ids: ['subject4', 'masters_subject'], en: ['subject', 'degree'], bn: ['ডিগ্রি'], sec: 'masters'},
  {prop: 'masters.result', label: 'Masters Result', names: ['result4', 'masters_result'], ids: ['result4', 'masters_result'], en: ['result'], bn: ['ফলাফল'], sec: 'masters'},
  {prop: 'masters.duration', label: 'Masters Duration', names: ['duration4', 'masters_duration'], ids: ['duration4', 'masters_duration'], en: ['duration'], bn: ['মেয়াদ'], sec: 'masters'},
  {prop: 'employment.designation', label: 'Designation', names: ['job_designation', 'designation'], ids: ['job_designation', 'designation'], en: ['designation'], bn: ['পদবি'], sec: 'employment'},
  {prop: 'employment.organization', label: 'Organization', names: ['job_organization', 'organization'], ids: ['job_organization', 'organization'], en: ['organization'], bn: ['প্রতিষ্ঠান'], sec: 'employment'},
  {prop: 'employment.address', label: 'Organization Address', names: ['job_address'], ids: ['job_address'], en: ['address'], bn: ['ঠিকানা'], sec: 'employment'},
  {prop: 'employment.startDate', label: 'Start Date', names: ['job_start_date'], ids: ['job_start_date'], en: ['start date'], bn: ['যোগদানের তারিখ'], sec: 'employment', isDate: true},
  {prop: 'employment.endDate', label: 'End Date', names: ['job_end_date'], ids: ['job_end_date'], en: ['end date'], bn: ['শেষের তারিখ'], sec: 'employment', isDate: true},
  {prop: 'employment.currentlyWorking', label: 'Currently Working', names: ['job_currently_working'], ids: ['job_currently_working'], en: ['currently working'], bn: ['বর্তমানে কর্মরত'], sec: 'employment'},
  {prop: 'employment.description', label: 'Job Description', names: ['job_description'], ids: ['job_description'], en: ['job description'], bn: ['কাজের বিবরণ'], sec: 'employment'},
];

function norm(s) {
  return String(s || '').toLowerCase().replace(/[*:\[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
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

function matchDropdown(val, options) {
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
  return {matched: false, ambiguous: eqMatches.length > 1};
}

function resolveValue(bundle, prop) {
  const [group, key] = prop.split('.');
  if (group === 'personal') return bundle.profile?.personalInformation?.[key] || '';
  if (group === 'presentAddress') {
    const a = bundle.presentAddress;
    if (!a) return '';
    if (key === 'addressLine') return [a.house, a.road, a.village].filter(Boolean).join(', ');
    return String(a[key] ?? '');
  }
  if (group === 'permanentAddress') {
    const a = bundle.permanentAddress?.sameAsPresent && bundle.presentAddress
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
    const combined = norm(`${field.name} ${field.id} ${field.label} ${field.placeholder}`);
    if (
      field.inputType === 'password' ||
      field.inputType === 'file' ||
      combined.includes('captcha') ||
      combined.includes('otp') ||
      combined.includes('security code')
    ) {
      return {
        elementKey: field.elementKey,
        fieldLabel: field.label || field.name || 'Protected Field',
        sourceProperty: null,
        profileValue: '',
        transformedValue: '',
        confidence: 'UNMATCHED',
        status: 'UNSUPPORTED',
        selectedForFill: false,
        matchReason: 'Security boundary: CAPTCHA/OTP/file fields are excluded.',
      };
    }

    let best = null;
    let confidence = 'UNMATCHED';
    let matchReason = 'No match';
    const nameL = (field.name || '').toLowerCase();
    const idL = (field.id || '').toLowerCase();
    const lblL = norm(field.label || field.ariaLabel);
    const secL = (field.sectionHint || '').toLowerCase();

    for (const rule of RULES) {
      if (rule.names.includes(nameL) || rule.ids.includes(idL)) {
        best = rule;
        confidence = 'HIGH';
        matchReason = `Exact name/id match (${field.name || field.id})`;
        break;
      }
      if (rule.sec && secL && rule.sec !== secL) continue;
      const isEnNameRule =
        rule.prop === 'personal.applicantName' ||
        rule.prop === 'personal.fatherName' ||
        rule.prop === 'personal.motherName';
      const labelMentionsBn =
        lblL.includes('bengali') || lblL.includes('bangla') || lblL.includes('বাংলা');
      if (isEnNameRule && labelMentionsBn) continue;
      if (rule.en.some((k) => lblL === k) || rule.bn.some((k) => lblL.includes(norm(k)))) {
        best = rule;
        confidence = 'HIGH';
        matchReason = 'Exact/Bengali label match';
        break;
      }
      if (!best && rule.en.some((k) => k.length >= 4 && lblL.includes(k))) {
        best = rule;
        confidence = 'MEDIUM';
        matchReason = 'Normalized label match';
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
          transformedValue: '',
          confidence,
          status: 'UNRESOLVED_DROPDOWN',
          selectedForFill: false,
          matchReason: dm.ambiguous ? 'Ambiguous dropdown candidates' : 'No unique option match',
        };
      }
      transformed = dm.value;
    }

    return {
      elementKey: field.elementKey,
      fieldLabel: field.label || best.label,
      sourceProperty: best.prop,
      profileValue: raw,
      transformedValue: transformed,
      confidence,
      status: confidence === 'HIGH' ? 'READY' : 'REVIEW',
      selectedForFill: confidence === 'HIGH' || (confidence === 'MEDIUM' && allowMedium),
      matchReason,
    };
  });
}
