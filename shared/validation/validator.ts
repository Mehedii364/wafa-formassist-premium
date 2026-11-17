import {findDistrictEntry, isKnownUpazilaForDistrict} from '../constants/bd-locations';
import {
  AddressRecord,
  EducationRecord,
  EmploymentRecord,
  FieldMappingResult,
  ProfileRecord,
  ValidationIssue,
  ValidationReport,
  ValidationStatus,
} from '../schemas/types';
import {parseIsoDate} from '../field-mapping/date-converter';

const BD_MOBILE_REGEX = /^01[3-9]\d{8}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NID_REGEX = /^(\d{10}|\d{13}|\d{17})$/;
const BIRTH_REG_REGEX = /^\d{17}$/;
const PASSPORT_REGEX = /^[A-Z]{1,2}\d{7,8}$/i;
const POST_CODE_REGEX = /^\d{4}$/;

export function calculateProfileCompletion(
  profile: ProfileRecord,
  addresses: AddressRecord[],
  educations: EducationRecord[],
): number {
  const p = profile.personalInformation;
  const personalChecks = [
    p.applicantName,
    p.applicantNameBn,
    p.fatherName,
    p.fatherNameBn,
    p.motherName,
    p.motherNameBn,
    p.dateOfBirth,
    p.nationality,
    p.religion,
    p.gender,
    p.maritalStatus,
    p.mobileNumber,
    p.confirmMobileNumber,
    p.email,
    p.quota,
    p.nationalId || p.birthRegistration || p.passportId,
  ];
  const present = addresses.find((a) => a.profileId === profile.id && a.addressType === 'present');
  const permanent = addresses.find((a) => a.profileId === profile.id && a.addressType === 'permanent');
  const profileEdus = educations.filter((e) => e.profileId === profile.id);

  const addressChecks = [
    present?.careOf,
    present?.village || present?.road || present?.house,
    present?.district,
    present?.upazila,
    present?.postOffice,
    present?.postCode,
    permanent ? (permanent.sameAsPresent ? 'same' : permanent.district) : '',
  ];
  const eduChecks = [
    profileEdus.some((e) => e.levelCategory === 'ssc') ? 'ssc' : '',
    profileEdus.some((e) => e.levelCategory === 'hsc') ? 'hsc' : '',
  ];

  const all = [...personalChecks, ...addressChecks, ...eduChecks];
  const filled = all.filter((v) => Boolean(v && String(v).trim().length > 0)).length;
  return Math.round((filled / all.length) * 100);
}

export function detectEmploymentDateConflicts(
  employments: EmploymentRecord[],
): Array<{firstId: string; secondId: string; firstOrg: string; secondOrg: string}> {
  const conflicts: Array<{firstId: string; secondId: string; firstOrg: string; secondOrg: string}> = [];
  const today = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < employments.length; i++) {
    for (let j = i + 1; j < employments.length; j++) {
      const a = employments[i];
      const b = employments[j];
      if (!parseIsoDate(a.startDate) || !parseIsoDate(b.startDate)) continue;
      const aEnd = a.currentlyWorking ? today : a.endDate;
      const bEnd = b.currentlyWorking ? today : b.endDate;
      if (!parseIsoDate(aEnd) || !parseIsoDate(bEnd)) continue;

      if (a.startDate <= bEnd && b.startDate <= aEnd) {
        conflicts.push({
          firstId: a.id,
          secondId: b.id,
          firstOrg: a.organization || 'Untitled Job #1',
          secondOrg: b.organization || 'Untitled Job #2',
        });
      }
    }
  }
  return conflicts;
}

export function validateProfileSuite(params: {
  profile: ProfileRecord;
  addresses: AddressRecord[];
  educations: EducationRecord[];
  employments: EmploymentRecord[];
  formMappings?: FieldMappingResult[];
}): ValidationReport {
  const {profile, addresses, educations, employments, formMappings} = params;
  const p = profile.personalInformation;
  const issues: ValidationIssue[] = [];
  let issueIdx = 1;

  const pushIssue = (
    category: ValidationIssue['category'],
    field: string,
    status: ValidationStatus,
    whatIsWrong: {en: string; bn: string},
    whyItMatters: {en: string; bn: string},
    howToFix: {en: string; bn: string},
    recordId?: string,
  ) => {
    issues.push({
      id: `val-${issueIdx++}`,
      category,
      field,
      status,
      whatIsWrong,
      whyItMatters,
      howToFix,
      recordId,
    });
  };

  // --- 1. PERSONAL INFORMATION ---
  const requiredPersonal: Array<{key: keyof typeof p; labelEn: string; labelBn: string}> = [
    {key: 'applicantName', labelEn: "Applicant's Name (English)", labelBn: 'আবেদনকারীর নাম (ইংরেজি)'},
    {key: 'applicantNameBn', labelEn: "Applicant's Name (Bengali)", labelBn: 'আবেদনকারীর নাম (বাংলা)'},
    {key: 'fatherName', labelEn: "Father's Name", labelBn: 'পিতার নাম'},
    {key: 'motherName', labelEn: "Mother's Name", labelBn: 'মাতার নাম'},
    {key: 'dateOfBirth', labelEn: 'Date of Birth', labelBn: 'জন্ম তারিখ'},
    {key: 'nationality', labelEn: 'Nationality', labelBn: 'জাতীয়তা'},
    {key: 'religion', labelEn: 'Religion', labelBn: 'ধর্ম'},
    {key: 'gender', labelEn: 'Gender', labelBn: 'লিঙ্গ'},
    {key: 'maritalStatus', labelEn: 'Marital Status', labelBn: 'বৈবাহিক অবস্থা'},
    {key: 'mobileNumber', labelEn: 'Mobile Number', labelBn: 'মোবাইল নম্বর'},
  ];

  for (const req of requiredPersonal) {
    if (!p[req.key] || !String(p[req.key]).trim()) {
      pushIssue(
        'personal',
        req.labelEn,
        'MISSING',
        {en: `${req.labelEn} is empty.`, bn: `${req.labelBn} পূরণ করা হয়নি।`},
        {
          en: 'Government Teletalk portals reject applications with missing mandatory personal identity fields.',
          bn: 'সরকারি টেলিটক পোর্টালে বাধ্যতামূলক ব্যক্তিগত তথ্য ছাড়া আবেদন গ্রহণ করা হয় না।',
        },
        {
          en: `Open Personal Profiles and enter your verified ${req.labelEn}.`,
          bn: `পার্সোনাল প্রোফাইলে গিয়ে আপনার সঠিক ${req.labelBn} লিখুন।`,
        },
        profile.id,
      );
    }
  }

  // Name consistency check (check digits or stray punctuation)
  if (p.applicantName && /\d/.test(p.applicantName)) {
    pushIssue(
      'personal',
      "Applicant's Name",
      'INVALID',
      {en: "Applicant's English name contains numeric digits.", bn: 'ইংরেজি নামে সংখ্যা রয়েছে।'},
      {en: 'Applicant name must match SSC/NID certificates exactly.', bn: 'আবেদনকারীর নাম এসএসসি ও এনআইডি সনদের সাথে হুবহু মিলতে হবে।'},
      {en: 'Remove digits from Applicant Name in Personal Profiles.', bn: 'পার্সোনাল প্রোফাইল থেকে নামের সংখ্যা মুছে ফেলুন।'},
      profile.id,
    );
  }
  if (p.applicantNameBn && !/[\u0980-\u09FF]/.test(p.applicantNameBn)) {
    pushIssue(
      'personal',
      "Applicant's Name (Bengali)",
      'WARNING',
      {en: 'Bengali Name field does not contain Bengali Unicode characters.', bn: 'বাংলা নামের ঘরে বাংলা অক্ষর নেই।'},
      {en: 'DGBPO 2026 requires the Bengali name in Unicode Bangla script.', bn: 'DGBPO 2026 ফর্মে বাংলা নাম ইউনিকোড বাংলায় লেখা প্রয়োজন।'},
      {en: 'Type your official name in Bengali script.', bn: 'আপনার অফিসিয়াল নাম বাংলায় লিখুন।'},
      profile.id,
    );
  }

  // Date of birth validity
  if (p.dateOfBirth) {
    const parsedDob = parseIsoDate(p.dateOfBirth);
    if (!parsedDob) {
      pushIssue(
        'personal',
        'Date of Birth',
        'INVALID',
        {en: 'Date of Birth is not a valid calendar date.', bn: 'জন্ম তারিখটি সঠিক ক্যালেন্ডার তারিখ নয়।'},
        {en: 'Invalid dates fail age eligibility checks and cause date conversion errors.', bn: 'ভুল তারিখ বয়স যাচাইয়ে ব্যর্থ হয়।'},
        {en: 'Pick a valid Date of Birth in YYYY-MM-DD format.', bn: 'সঠিক জন্ম তারিখ নির্বাচন করুন।'},
        profile.id,
      );
    } else {
      const currentYear = new Date().getFullYear();
      const approxAge = currentYear - parsedDob.year;
      if (approxAge < 18 || approxAge > 60) {
        pushIssue(
          'personal',
          'Date of Birth',
          'WARNING',
          {en: `Computed age (${approxAge} yrs) is outside typical 18–60 public recruitment bounds.`, bn: `হিসাবকৃত বয়স (${approxAge} বছর) সাধারণ সরকারি চাকরির সীমার বাইরে।`},
          {en: 'Verify eligibility criteria in the official recruitment circular before applying.', bn: 'আবেদনের পূর্বে নিয়োগ বিজ্ঞপ্তির বয়সসীমা যাচাই করুন।'},
          {en: 'Confirm your Date of Birth matches your SSC certificate.', bn: 'আপনার এসএসসি সনদের সাথে জন্ম তারিখ মিলিয়ে দেখুন।'},
          profile.id,
        );
      }
    }
  }

  // Mobile number & confirmation
  if (p.mobileNumber && !BD_MOBILE_REGEX.test(p.mobileNumber.trim())) {
    pushIssue(
      'personal',
      'Mobile Number',
      'INVALID',
      {en: 'Mobile number does not match Bangladesh 11-digit format (01[3-9]XXXXXXXX).', bn: 'মোবাইল নম্বরটি বাংলাদেশের ১১ ডিজিটের সঠিক বিন্যাসে নেই।'},
      {en: 'Teletalk sends User ID, admit card alerts, and OTP/SMS to this number.', bn: 'টেলিটক এই নম্বরে ইউজার আইডি ও প্রবেশপত্রের এসএমএস পাঠায়।'},
      {en: 'Enter an 11-digit active Bangladesh mobile number starting with 01.', bn: '01 দিয়ে শুরু ১১ ডিজিটের সচল মোবাইল নম্বর দিন।'},
      profile.id,
    );
  }
  if (p.mobileNumber && p.confirmMobileNumber && p.mobileNumber.trim() !== p.confirmMobileNumber.trim()) {
    pushIssue(
      'personal',
      'Confirm Mobile Number',
      'INVALID',
      {en: 'Confirm Mobile Number does not match Mobile Number.', bn: 'নিশ্চিতকরণ মোবাইল নম্বরটি মূল নম্বরের সাথে মেলেনি।'},
      {en: 'Mismatched phone numbers block submission on Teletalk forms.', bn: 'নম্বর না মিললে টেলিটক ফর্ম জমা নেওয়া হয় না।'},
      {en: 'Re-enter Confirm Mobile Number identically to Mobile Number.', bn: 'মূল মোবাইল নম্বরটি পুনরায় হুবহু লিখুন।'},
      profile.id,
    );
  }

  // Email format
  if (p.email && !EMAIL_REGEX.test(p.email.trim())) {
    pushIssue(
      'personal',
      'Email',
      'INVALID',
      {en: 'Email address format appears invalid.', bn: 'ইমেইল ঠিকানার বিন্যাস সঠিক নয়।'},
      {en: 'Invalid email strings fail HTML5 and server validation.', bn: 'ভুল ইমেইল ফর্ম ভ্যালিডেশনে ব্যর্থ হয়।'},
      {en: 'Correct the email format (e.g., name@domain.com).', bn: 'সঠিক ইমেইল ঠিকানা লিখুন।'},
      profile.id,
    );
  }

  // Identification numbers (at least one recommended, validate format if provided)
  if (!p.nationalId && !p.birthRegistration && !p.passportId) {
    pushIssue(
      'personal',
      'National ID / Birth Registration / Passport',
      'MISSING',
      {en: 'No government identity document number is recorded.', bn: 'কোনো সরকারি পরিচয়পত্র নম্বর সংরক্ষিত নেই।'},
      {en: 'At least one verified identity number (NID, Birth Registration, or Passport) is required on DGBPO forms.', bn: 'DGBPO ফর্মে অন্তত একটি পরিচয়পত্র নম্বর প্রয়োজন।'},
      {en: 'Add your verified National ID (10/13/17 digits), 17-digit Birth Registration, or Passport ID.', bn: 'আপনার সঠিক এনআইডি, জন্ম নিবন্ধন বা পাসপোর্ট নম্বর যুক্ত করুন।'},
      profile.id,
    );
  }
  if (p.nationalId && !NID_REGEX.test(p.nationalId.trim())) {
    pushIssue(
      'personal',
      'National ID',
      'INVALID',
      {en: 'National ID must be 10, 13, or 17 digits.', bn: 'জাতীয় পরিচয়পত্র নম্বর ১০, ১৩ অথবা ১৭ ডিজিটের হতে হবে।'},
      {en: 'Incorrect NID length fails automated NID verification.', bn: 'ভুল দৈর্ঘ্যের এনআইডি যাচাইয়ে ব্যর্থ হয়।'},
      {en: 'Check your Smart Card (10 digits) or legacy NID (13 or 17 digits).', bn: 'আপনার স্মার্ট কার্ড (১০) বা পুরোনো এনআইডি (১৩/১৭) যাচাই করুন।'},
      profile.id,
    );
  }
  if (p.birthRegistration && !BIRTH_REG_REGEX.test(p.birthRegistration.trim())) {
    pushIssue(
      'personal',
      'Birth Registration',
      'INVALID',
      {en: 'Birth Registration number must be exactly 17 digits.', bn: 'জন্ম নিবন্ধন নম্বর অবশ্যই ১৭ ডিজিটের হতে হবে।'},
      {en: 'Bangladesh BDRIS birth certificates use a standardized 17-digit numeric format.', bn: 'বাংলাদেশের অনলাইন জন্ম নিবন্ধন নম্বর ১৭ ডিজিটের হয়।'},
      {en: 'Enter the full 17-digit online birth registration number.', bn: 'সম্পূর্ণ ১৭ ডিজিটের অনলাইন জন্ম নিবন্ধন নম্বর লিখুন।'},
      profile.id,
    );
  }
  if (p.passportId && !PASSPORT_REGEX.test(p.passportId.trim())) {
    pushIssue(
      'personal',
      'Passport ID',
      'WARNING',
      {en: 'Passport ID format differs from standard Bangladesh passport pattern (1–2 letters + 7–8 digits).', bn: 'পাসপোর্ট নম্বরের বিন্যাস সাধারণ বাংলাদেশি পাসপোর্টের সাথে মিলছে না।'},
      {en: 'Verify characters carefully against your passport bio page.', bn: 'পাসপোর্টের তথ্য পাতার সাথে মিলিয়ে দেখুন।'},
      {en: 'Confirm the passport number without spaces.', bn: 'স্পেস ছাড়া সঠিক পাসপোর্ট নম্বর লিখুন।'},
      profile.id,
    );
  }

  // --- 2. ADDRESSES ---
  const profileAddresses = addresses.filter((a) => a.profileId === profile.id);
  const present = profileAddresses.find((a) => a.addressType === 'present');
  const permanent = profileAddresses.find((a) => a.addressType === 'permanent');

  if (!present) {
    pushIssue(
      'address',
      'Present Address',
      'MISSING',
      {en: 'No Present Address is linked to this profile.', bn: 'এই প্রোফাইলে কোনো বর্তমান ঠিকানা যুক্ত নেই।'},
      {en: 'Present Address is mandatory for correspondence and Teletalk forms.', bn: 'যোগাযোগ ও ফর্ম পূরণের জন্য বর্তমান ঠিকানা বাধ্যতামূলক।'},
      {en: 'Go to Address Manager and create a Present Address.', bn: 'অ্যাড্রেস ম্যানেজারে গিয়ে বর্তমান ঠিকানা যুক্ত করুন।'},
    );
  }
  if (!permanent) {
    pushIssue(
      'address',
      'Permanent Address',
      'MISSING',
      {en: 'No Permanent Address is linked to this profile.', bn: 'এই প্রোফাইলে কোনো স্থায়ী ঠিকানা যুক্ত নেই।'},
      {en: 'District quota and verification depend on your Permanent Address.', bn: 'জেলা কোটা ও পুলিশ ভেরিফিকেশনের জন্য স্থায়ী ঠিকানা আবশ্যক।'},
      {en: 'Go to Address Manager and add Permanent Address (or enable Same as Present).', bn: 'অ্যাড্রেস ম্যানেজারে গিয়ে স্থায়ী ঠিকানা যুক্ত করুন।'},
    );
  }

  for (const addr of profileAddresses) {
    if (addr.addressType === 'permanent' && addr.sameAsPresent) continue;
    const prefix = addr.addressType === 'present' ? 'Present' : 'Permanent';

    if (!addr.careOf || !addr.district || !addr.upazila || !addr.postOffice || !addr.postCode) {
      pushIssue(
        'address',
        `${prefix} Address`,
        'MISSING',
        {en: `${prefix} Address has incomplete mandatory fields (Care Of, District, Upazila, Post Office, or Post Code).`, bn: `${prefix === 'Present' ? 'বর্তমান' : 'স্থায়ী'} ঠিকানার কিছু প্রয়োজনীয় ঘর খালি রয়েছে।`},
        {en: 'Incomplete address fields prevent autofill from completing the address block.', bn: 'অসম্পূর্ণ ঠিকানা অটোফিল প্রক্রিয়া বাধাগ্রস্ত করে।'},
        {en: `Edit ${prefix} Address in Address Manager to fill all required fields.`, bn: 'অ্যাড্রেস ম্যানেজার থেকে খালি ঘরগুলো পূরণ করুন।'},
        addr.id,
      );
    }

    if (addr.postCode && !POST_CODE_REGEX.test(addr.postCode.trim())) {
      pushIssue(
        'address',
        `${prefix} Post Code`,
        'INVALID',
        {en: `${prefix} Post Code must be a 4-digit Bangladesh postal code.`, bn: 'পোস্ট কোড অবশ্যই ৪ ডিজিটের হতে হবে।'},
        {en: 'Bangladesh Post Office uses 4-digit numeric postal codes.', bn: 'বাংলাদেশ ডাক বিভাগ ৪ ডিজিটের পোস্ট কোড ব্যবহার করে।'},
        {en: 'Enter the official 4-digit post code for your post office.', bn: 'আপনার ডাকঘরের সঠিক ৪ ডিজিটের পোস্ট কোড লিখুন।'},
        addr.id,
      );
    }

    if (addr.district && addr.upazila) {
      const distEntry = findDistrictEntry(addr.district);
      const upazilaValid = isKnownUpazilaForDistrict(addr.district, addr.upazila);
      if (distEntry && upazilaValid === false) {
        pushIssue(
          'address',
          `${prefix} District / Upazila`,
          'NEEDS_REVIEW',
          {
            en: `"${addr.upazila}" is not in the bundled Upazila dataset for ${distEntry.district}.`,
            bn: `"${addr.upazila}" সংরক্ষিত তালিকায় ${distEntry.districtBn} জেলার অধীনে নেই।`,
          },
          {
            en: 'Dependent Upazila dropdowns on Teletalk require an exact Upazila/Thana under the chosen District.',
            bn: 'টেলিটকের উপজেলা ড্রপডাউনে জেলার সাথে সঠিক উপজেলা মিলতে হয়।',
          },
          {
            en: 'Verify spelling or confirm if this is a newer Police Station / Thana entered manually.',
            bn: 'বানান যাচাই করুন অথবা নতুন থানা হলে ম্যানুয়ালি নিশ্চিত করুন।',
          },
          addr.id,
        );
      }
    }
  }

  // --- 3. EDUCATION ---
  const profileEdus = educations.filter((e) => e.profileId === profile.id);
  if (profileEdus.length === 0) {
    pushIssue(
      'education',
      'Education Records',
      'MISSING',
      {en: 'No educational qualifications recorded for this profile.', bn: 'এই প্রোফাইলে কোনো শিক্ষাগত যোগ্যতা যুক্ত নেই।'},
      {en: 'DGBPO 2026 Checker requires verified SSC/HSC or equivalent education records.', bn: 'DGBPO 2026 পদের জন্য শিক্ষাগত যোগ্যতার তথ্য আবশ্যক।'},
      {en: 'Add SSC, HSC, and higher qualifications in Education Manager.', bn: 'এডুকেশন ম্যানেজারে এসএসসি, এইচএসসি ও উচ্চতর ডিগ্রি যুক্ত করুন।'},
    );
  }

  const seenExamKeys = new Set<string>();
  const currentYear = new Date().getFullYear();

  for (const edu of profileEdus) {
    const dupKey = `${edu.examination.toLowerCase()}|${edu.passingYear}|${edu.rollNumber}`;
    if (seenExamKeys.has(dupKey)) {
      pushIssue(
        'education',
        `${edu.examination} (${edu.passingYear})`,
        'WARNING',
        {en: `Duplicate education entry detected for ${edu.examination}.`, bn: `${edu.examination} পরীক্ষার ডুপ্লিকেট এন্ট্রি পাওয়া গেছে।`},
        {en: 'Duplicate records can cause ambiguous selection during form mapping.', bn: 'ডুপ্লিকেট তথ্য অটোফিল ম্যাপিংয়ে বিভ্রান্তি সৃষ্টি করে।'},
        {en: 'Remove the duplicate qualification in Education Manager.', bn: 'এডুকেশন ম্যানেজার থেকে ডুপ্লিকেট এন্ট্রি মুছুন।'},
        edu.id,
      );
    }
    seenExamKeys.add(dupKey);

    if (!edu.examination || !edu.result || !edu.passingYear) {
      pushIssue(
        'education',
        edu.examination || 'Education Record',
        'MISSING',
        {en: 'Examination, Result, or Passing Year is missing.', bn: 'পরীক্ষার নাম, ফলাফল অথবা পাশের সন অনুপস্থিত।'},
        {en: 'These fields are mandatory on every education section of Teletalk forms.', bn: 'টেলিটক ফর্মের প্রতিটি শিক্ষা অংশে এই তথ্যগুলো বাধ্যতামূলক।'},
        {en: 'Update the record in Education Manager.', bn: 'এডুকেশন ম্যানেজারে গিয়ে তথ্য সম্পূর্ণ করুন।'},
        edu.id,
      );
    }

    if ((edu.levelCategory === 'ssc' || edu.levelCategory === 'hsc') && (!edu.rollNumber || !edu.board)) {
      pushIssue(
        'education',
        `${edu.examination} Roll / Board`,
        'MISSING',
        {en: `${edu.examination} requires both Roll Number and Education Board.`, bn: `${edu.examination} এর জন্য রোল নম্বর ও বোর্ড উভয়ই প্রয়োজন।`},
        {en: 'SSC/HSC sections on DGBPO 2026 validate Roll Number and Board.', bn: 'DGBPO ফর্মে এসএসসি/এইচএসসি রোল ও বোর্ড বাধ্যতামূলক।'},
        {en: 'Enter your official Roll Number and Board in Education Manager.', bn: 'এডুকেশন ম্যানেজারে রোল নম্বর ও বোর্ড লিখুন।'},
        edu.id,
      );
    }

    if (edu.passingYear) {
      const yr = Number(edu.passingYear);
      if (!/^\d{4}$/.test(edu.passingYear) || yr < 1960 || yr > currentYear) {
        pushIssue(
          'education',
          `${edu.examination} Passing Year`,
          'INVALID',
          {en: `Passing Year "${edu.passingYear}" is outside valid range (1960–${currentYear}).`, bn: `পাশের সন "${edu.passingYear}" সঠিক সীমার বাইরে।`},
          {en: 'Invalid passing years are rejected by recruitment forms.', bn: 'অকার্যকর পাশের সন আবেদন ফর্মে গৃহীত হয় না।'},
          {en: 'Enter the 4-digit passing year from your certificate.', bn: 'সনদ অনুযায়ী ৪ ডিজিটের পাশের সন দিন।'},
          edu.id,
        );
      }
    }

    if (edu.result) {
      const num = Number(edu.result);
      if (edu.resultType === 'GPA_5' && (Number.isNaN(num) || num < 1 || num > 5)) {
        pushIssue(
          'education',
          `${edu.examination} Result`,
          'INVALID',
          {en: `GPA "${edu.result}" must be between 1.00 and 5.00.`, bn: `জিপিএ "${edu.result}" ১.০০ থেকে ৫.০০ এর মধ্যে হতে হবে।`},
          {en: 'GPA values outside the 5.00 scale fail form validation.', bn: '৫.০০ স্কেলের বাইরের জিপিএ ফর্মে গ্রহণযোগ্য নয়।'},
          {en: 'Correct the GPA value or switch Result Type.', bn: 'সঠিক জিপিএ লিখুন অথবা ফলাফলের ধরন পরিবর্তন করুন।'},
          edu.id,
        );
      }
      if (edu.resultType === 'CGPA_4' && (Number.isNaN(num) || num < 1 || num > 4)) {
        pushIssue(
          'education',
          `${edu.examination} Result`,
          'INVALID',
          {en: `CGPA "${edu.result}" must be between 1.00 and 4.00.`, bn: `সিজিপিএ "${edu.result}" ১.০০ থেকে ৪.০০ এর মধ্যে হতে হবে।`},
          {en: 'CGPA values outside the 4.00 scale fail form validation.', bn: '৪.০০ স্কেলের বাইরের সিজিপিএ ফর্মে গ্রহণযোগ্য নয়।'},
          {en: 'Correct the CGPA value or switch Result Type.', bn: 'সঠিক সিজিপিএ লিখুন অথবা ফলাফলের ধরন পরিবর্তন করুন।'},
          edu.id,
        );
      }
    }
  }

  // Chronological check SSC <= HSC
  const sscRec = profileEdus.find((e) => e.levelCategory === 'ssc');
  const hscRec = profileEdus.find((e) => e.levelCategory === 'hsc');
  if (sscRec?.passingYear && hscRec?.passingYear && Number(hscRec.passingYear) < Number(sscRec.passingYear)) {
    pushIssue(
      'education',
      'Education Timeline',
      'INVALID',
      {en: `HSC passing year (${hscRec.passingYear}) is earlier than SSC passing year (${sscRec.passingYear}).`, bn: `এইচএসসি পাশের সন (${hscRec.passingYear}) এসএসসি সনের (${sscRec.passingYear}) চেয়ে আগে।`},
      {en: 'Chronologically inconsistent qualification years cause immediate disqualification.', bn: 'অসামঞ্জস্যপূর্ণ পাশের সন আবেদন বাতিলের কারণ হতে পারে।'},
      {en: 'Review and correct SSC and HSC passing years.', bn: 'এসএসসি ও এইচএসসি পাশের সন যাচাই করে ঠিক করুন।'},
    );
  }

  // --- 4. EMPLOYMENT ---
  const profileEmps = employments.filter((e) => e.profileId === profile.id);
  for (const emp of profileEmps) {
    if (!emp.organization || !emp.designation || !emp.startDate) {
      pushIssue(
        'employment',
        emp.organization || 'Employment Entry',
        'MISSING',
        {en: 'Organization, Designation, or Start Date is missing.', bn: 'প্রতিষ্ঠান, পদবি অথবা যোগদানের তারিখ অনুপস্থিত।'},
        {en: 'Complete employment metadata is needed to populate Job Experience sections.', bn: 'অভিজ্ঞতা অংশ পূরণ করতে এই তথ্যগুলো প্রয়োজন।'},
        {en: 'Edit the job entry in Employment Manager.', bn: 'এমপ্লয়মেন্ট ম্যানেজারে গিয়ে তথ্য সম্পূর্ণ করুন।'},
        emp.id,
      );
    }
    if (!emp.currentlyWorking && emp.startDate && emp.endDate && emp.endDate < emp.startDate) {
      pushIssue(
        'employment',
        `${emp.organization} Dates`,
        'INVALID',
        {en: 'Employment End Date is earlier than Start Date.', bn: 'চাকরি শেষের তারিখ শুরুর তারিখের চেয়ে আগে।'},
        {en: 'Invalid date order makes service duration calculation impossible.', bn: 'ভুল তারিখের ক্রমে চাকরির মেয়াদ হিসাব করা যায় না।'},
        {en: 'Correct Start Date or End Date in Employment Manager.', bn: 'এমপ্লয়মেন্ট ম্যানেজারে তারিখ ঠিক করুন।'},
        emp.id,
      );
    }
  }

  const empConflicts = detectEmploymentDateConflicts(profileEmps);
  for (const c of empConflicts) {
    pushIssue(
      'employment',
      'Employment Date Overlap',
      'NEEDS_REVIEW',
      {
        en: `Overlapping employment dates between "${c.firstOrg}" and "${c.secondOrg}".`,
        bn: `"${c.firstOrg}" এবং "${c.secondOrg}" এর চাকরির সময়কাল একে অপরের সাথে মিলে গেছে।`,
      },
      {
        en: 'Concurrent employment periods often require explanation during verification.',
        bn: 'একই সময়ে দুটি চাকরির তথ্য যাচাইয়ের সময় প্রশ্নের সৃষ্টি করতে পারে।',
      },
      {
        en: 'Confirm whether these roles overlapped intentionally or adjust the end/start dates.',
        bn: 'সময়কাল সঠিক কিনা যাচাই করুন অথবা তারিখ সংশোধন করুন।',
      },
      c.firstId,
    );
  }

  // --- 5. FORM MAPPINGS (when inspecting a form) ---
  if (formMappings && formMappings.length > 0) {
    for (const m of formMappings) {
      if (m.status === 'UNSUPPORTED') {
        pushIssue(
          'form',
          m.fieldLabel,
          'UNSUPPORTED',
          {en: `Field "${m.fieldLabel}" is intentionally blocked from autofill (security / upload control).`, bn: `"${m.fieldLabel}" ফিল্ডটি নিরাপত্তার কারণে অটোফিল করা হয় না।`},
          {en: 'CAPTCHA, OTP, passwords, and file uploads must always be completed directly by the user.', bn: 'ক্যাপচা, ওটিপি, পাসওয়ার্ড ও ফাইল আপলোড সর্বদা ব্যবহারকারীকে নিজে সম্পন্ন করতে হয়।'},
          {en: 'Complete this field manually on the application page.', bn: 'আবেদন পাতায় গিয়ে এই ফিল্ডটি নিজে পূরণ করুন।'},
        );
      } else if (m.status === 'UNRESOLVED_DROPDOWN') {
        pushIssue(
          'form',
          m.fieldLabel,
          'NEEDS_REVIEW',
          {en: m.dropdownNote || `Dropdown "${m.fieldLabel}" could not be matched uniquely.`, bn: `"${m.fieldLabel}" ড্রপডাউন অপশন নির্দিষ্টভাবে মেলানো যায়নি।`},
          {en: 'Wafa FormAssist never guesses ambiguous dropdown options.', bn: 'WAFA FormAssist কখনোই অস্পষ্ট ড্রপডাউন অনুমান করে না।'},
          {en: 'Select the exact dropdown option manually on the target form.', bn: 'ফর্মে গিয়ে নিজে সঠিক অপশন নির্বাচন করুন।'},
        );
      } else if (m.status === 'MANUAL') {
        pushIssue(
          'form',
          m.fieldLabel,
          'NEEDS_REVIEW',
          {en: `Field "${m.fieldLabel}" is unmatched or low-confidence.`, bn: `"${m.fieldLabel}" ফিল্ডটি ম্যাপ করা যায়নি বা নির্ভরযোগ্যতা কম।`},
          {en: 'Low-confidence mappings are never automatically filled to protect application accuracy.', bn: 'তথ্যের নির্ভুলতা রক্ষায় কম নির্ভরযোগ্য ফিল্ড স্বয়ংক্রিয়ভাবে পূরণ করা হয় না।'},
          {en: 'Assign a mapping manually in Form Review Center or fill directly on the website.', bn: 'ফর্ম রিভিউ সেন্টারে ম্যানুয়াল ম্যাপিং দিন অথবা সরাসরি ওয়েবসাইটে লিখুন।'},
        );
      }
    }
  }

  const counts: Record<ValidationStatus, number> = {
    VALID: 0,
    WARNING: 0,
    MISSING: 0,
    INVALID: 0,
    NEEDS_REVIEW: 0,
    UNSUPPORTED: 0,
  };
  for (const issue of issues) {
    counts[issue.status] += 1;
  }

  if (issues.length === 0) {
    counts.VALID = 1;
    pushIssue(
      'personal',
      'Complete Profile Suite',
      'VALID',
      {en: 'All checked personal, address, education, and employment fields pass local validation.', bn: 'যাচাইকৃত সকল ব্যক্তিগত, ঠিকানা, শিক্ষা ও চাকরির তথ্য সঠিক রয়েছে।'},
      {en: 'Your profile is ready for Form Review Center preview before filling.', bn: 'আপনার প্রোফাইল ফর্ম রিভিউ সেন্টারে প্রিভিউ করার জন্য প্রস্তুত।'},
      {en: 'Always independently verify every field on the official portal before submitting.', bn: 'জমা দেওয়ার আগে অফিসিয়াল পোর্টালে প্রতিটি তথ্য নিজে যাচাই করুন।'},
    );
  }

  let overallStatus: ValidationStatus = 'VALID';
  if (counts.INVALID > 0) overallStatus = 'INVALID';
  else if (counts.MISSING > 0) overallStatus = 'MISSING';
  else if (counts.NEEDS_REVIEW > 0) overallStatus = 'NEEDS_REVIEW';
  else if (counts.WARNING > 0) overallStatus = 'WARNING';

  return {
    profileId: profile.id,
    generatedAt: new Date().toISOString(),
    overallStatus,
    completionPercent: calculateProfileCompletion(profile, addresses, educations),
    counts,
    issues,
  };
}
