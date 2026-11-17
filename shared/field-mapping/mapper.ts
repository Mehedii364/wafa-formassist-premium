import {
  AddressRecord,
  ConfidenceLevel,
  DetectedFormField,
  EducationRecord,
  EmploymentRecord,
  FieldMappingResult,
  ProfileRecord,
} from '../schemas/types';
import {
  calculateServiceDuration,
  convertIsoDateToTarget,
  detectExpectedDateFormat,
} from './date-converter';
import {matchDropdownOption} from './dropdown-matcher';

export interface ProfileBundle {
  profile: ProfileRecord;
  presentAddress?: AddressRecord;
  permanentAddress?: AddressRecord;
  educations: EducationRecord[];
  employments: EmploymentRecord[];
}

interface FieldRule {
  sourceProperty: string;
  displayLabel: string;
  exactNames: string[];
  exactIds: string[];
  labelKeywordsEn: string[];
  labelKeywordsBn: string[];
  sectionContext?: string;
  isDate?: boolean;
  isCheckbox?: boolean;
}

const FIELD_RULES: FieldRule[] = [
  // Basic Information
  {
    sourceProperty: 'personal.applicantName',
    displayLabel: "Applicant's Name",
    exactNames: ['name', 'applicant_name', 'applicantName'],
    exactIds: ['name', 'applicant_name', 'applicantName'],
    labelKeywordsEn: ["applicant's name", 'applicant name', 'full name'],
    labelKeywordsBn: ['আবেদনকারীর নাম (ইংরেজি)', 'আবেদনকারীর নাম'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.applicantNameBn',
    displayLabel: "Applicant's Name (Bengali)",
    exactNames: ['name_bn', 'applicant_name_bn', 'b_name'],
    exactIds: ['name_bn', 'applicant_name_bn', 'b_name'],
    labelKeywordsEn: ['applicant name in bengali', 'applicant name (bangla)', 'name in bengali', 'bengali name'],
    labelKeywordsBn: ['আবেদনকারীর নাম (বাংলায়)', 'আবেদনকারীর নাম বাংলা', 'প্রার্থীর নাম (বাংলা)'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.fatherName',
    displayLabel: "Father's Name",
    exactNames: ['father', 'father_name', 'fatherName'],
    exactIds: ['father', 'father_name', 'fatherName'],
    labelKeywordsEn: ["father's name", 'father name'],
    labelKeywordsBn: ['পিতার নাম (ইংরেজি)', 'পিতার নাম'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.fatherNameBn',
    displayLabel: "Father's Name (Bengali)",
    exactNames: ['father_bn', 'father_name_bn', 'b_father'],
    exactIds: ['father_bn', 'father_name_bn', 'b_father'],
    labelKeywordsEn: ["father's name in bengali", 'father name bengali', 'father name bangla'],
    labelKeywordsBn: ['পিতার নাম (বাংলায়)', 'পিতার নাম বাংলা'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.motherName',
    displayLabel: "Mother's Name",
    exactNames: ['mother', 'mother_name', 'motherName'],
    exactIds: ['mother', 'mother_name', 'motherName'],
    labelKeywordsEn: ["mother's name", 'mother name'],
    labelKeywordsBn: ['মাতার নাম (ইংরেজি)', 'মাতার নাম'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.motherNameBn',
    displayLabel: "Mother's Name (Bengali)",
    exactNames: ['mother_bn', 'mother_name_bn', 'b_mother'],
    exactIds: ['mother_bn', 'mother_name_bn', 'b_mother'],
    labelKeywordsEn: ["mother's name in bengali", 'mother name bengali', 'mother name bangla'],
    labelKeywordsBn: ['মাতার নাম (বাংলায়)', 'মাতার নাম বাংলা'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.dateOfBirth',
    displayLabel: 'Date of Birth',
    exactNames: ['dob', 'date_of_birth', 'birth_date', 'dateOfBirth'],
    exactIds: ['dob', 'date_of_birth', 'birth_date'],
    labelKeywordsEn: ['date of birth', 'birth date', 'dob'],
    labelKeywordsBn: ['জন্ম তারিখ'],
    sectionContext: 'basic',
    isDate: true,
  },
  {
    sourceProperty: 'personal.nationality',
    displayLabel: 'Nationality',
    exactNames: ['nationality'],
    exactIds: ['nationality'],
    labelKeywordsEn: ['nationality'],
    labelKeywordsBn: ['জাতীয়তা'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.religion',
    displayLabel: 'Religion',
    exactNames: ['religion'],
    exactIds: ['religion'],
    labelKeywordsEn: ['religion'],
    labelKeywordsBn: ['ধর্ম'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.gender',
    displayLabel: 'Gender',
    exactNames: ['gender', 'sex'],
    exactIds: ['gender', 'sex'],
    labelKeywordsEn: ['gender', 'sex'],
    labelKeywordsBn: ['লিঙ্গ'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.nationalId',
    displayLabel: 'National ID',
    exactNames: ['nid', 'national_id', 'nid_no', 'nationalId'],
    exactIds: ['nid', 'national_id', 'nid_no'],
    labelKeywordsEn: ['national id', 'nid number', 'nid'],
    labelKeywordsBn: ['জাতীয় পরিচয়পত্র', 'জাতীয় পরিচয়পত্র নম্বর', 'এনআইডি'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.birthRegistration',
    displayLabel: 'Birth Registration',
    exactNames: ['breg', 'birth_reg', 'birth_registration', 'breg_no'],
    exactIds: ['breg', 'birth_reg', 'birth_registration', 'breg_no'],
    labelKeywordsEn: ['birth registration', 'birth reg'],
    labelKeywordsBn: ['জন্ম নিবন্ধন', 'জন্ম নিবন্ধন নম্বর'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.passportId',
    displayLabel: 'Passport ID',
    exactNames: ['passport', 'passport_id', 'passport_no'],
    exactIds: ['passport', 'passport_id', 'passport_no'],
    labelKeywordsEn: ['passport id', 'passport number', 'passport'],
    labelKeywordsBn: ['পাসপোর্ট নম্বর', 'পাসপোর্ট'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.maritalStatus',
    displayLabel: 'Marital Status',
    exactNames: ['marital_status', 'mstatus', 'maritalStatus'],
    exactIds: ['marital_status', 'mstatus'],
    labelKeywordsEn: ['marital status'],
    labelKeywordsBn: ['বৈবাহিক অবস্থা'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.mobileNumber',
    displayLabel: 'Mobile Number',
    exactNames: ['mobile', 'mobile_number', 'phone', 'contact_mobile'],
    exactIds: ['mobile', 'mobile_number', 'phone'],
    labelKeywordsEn: ['mobile number', 'mobile no', 'contact number'],
    labelKeywordsBn: ['মোবাইল নম্বর', 'ফোন নম্বর'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.confirmMobileNumber',
    displayLabel: 'Confirm Mobile Number',
    exactNames: ['confirm_mobile', 'confirm_mobile_number', 'retype_mobile'],
    exactIds: ['confirm_mobile', 'confirm_mobile_number'],
    labelKeywordsEn: ['confirm mobile', 're-type mobile', 'confirm mobile number'],
    labelKeywordsBn: ['মোবাইল নম্বর নিশ্চিত', 'পুনরায় মোবাইল নম্বর'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.email',
    displayLabel: 'Email',
    exactNames: ['email', 'email_address'],
    exactIds: ['email', 'email_address'],
    labelKeywordsEn: ['email', 'e-mail'],
    labelKeywordsBn: ['ইমেইল', 'ই-মেইল'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.quota',
    displayLabel: 'Quota',
    exactNames: ['quota', 'ffq'],
    exactIds: ['quota', 'ffq'],
    labelKeywordsEn: ['quota'],
    labelKeywordsBn: ['কোটা'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.departmentalStatus',
    displayLabel: 'Departmental Status',
    exactNames: ['dep_status', 'departmental_status', 'dept_status'],
    exactIds: ['dep_status', 'departmental_status'],
    labelKeywordsEn: ['departmental status'],
    labelKeywordsBn: ['বিভাগীয় অবস্থা', 'বিভাগীয় প্রার্থী'],
    sectionContext: 'basic',
  },

  // Present Address
  {
    sourceProperty: 'presentAddress.careOf',
    displayLabel: 'Present Care Of',
    exactNames: ['present_careof', 'present_co', 'pre_careof'],
    exactIds: ['present_careof', 'present_co'],
    labelKeywordsEn: ['care of'],
    labelKeywordsBn: ['যত্নে'],
    sectionContext: 'present_address',
  },
  {
    sourceProperty: 'presentAddress.addressLine',
    displayLabel: 'Present Village / Road / House',
    exactNames: ['present_village', 'present_address', 'pre_village'],
    exactIds: ['present_village', 'present_address'],
    labelKeywordsEn: ['village', 'road', 'house', 'flat'],
    labelKeywordsBn: ['গ্রাম', 'রাস্তা', 'বাড়ি'],
    sectionContext: 'present_address',
  },
  {
    sourceProperty: 'presentAddress.district',
    displayLabel: 'Present District',
    exactNames: ['present_district', 'pre_dist', 'menu_one'],
    exactIds: ['present_district', 'pre_dist'],
    labelKeywordsEn: ['district'],
    labelKeywordsBn: ['জেলা'],
    sectionContext: 'present_address',
  },
  {
    sourceProperty: 'presentAddress.upazila',
    displayLabel: 'Present Upazila / P.S.',
    exactNames: ['present_upazila', 'present_ps', 'pre_upazila'],
    exactIds: ['present_upazila', 'present_ps'],
    labelKeywordsEn: ['upazila', 'p.s.', 'police station', 'thana'],
    labelKeywordsBn: ['উপজেলা', 'থানা'],
    sectionContext: 'present_address',
  },
  {
    sourceProperty: 'presentAddress.postOffice',
    displayLabel: 'Present Post Office',
    exactNames: ['present_post', 'present_po', 'pre_post'],
    exactIds: ['present_post', 'present_po'],
    labelKeywordsEn: ['post office'],
    labelKeywordsBn: ['ডাকঘর', 'পোস্ট অফিস'],
    sectionContext: 'present_address',
  },
  {
    sourceProperty: 'presentAddress.postCode',
    displayLabel: 'Present Post Code',
    exactNames: ['present_postcode', 'present_pcode', 'pre_postcode'],
    exactIds: ['present_postcode', 'present_pcode'],
    labelKeywordsEn: ['post code', 'postal code'],
    labelKeywordsBn: ['পোস্ট কোড'],
    sectionContext: 'present_address',
  },

  // Permanent Address
  {
    sourceProperty: 'permanentAddress.sameAsPresent',
    displayLabel: 'Same as Present Address',
    exactNames: ['same_as_present', 'copy_address'],
    exactIds: ['same_as_present', 'copy_address'],
    labelKeywordsEn: ['same as present'],
    labelKeywordsBn: ['বর্তমান ঠিকানার অনুরূপ'],
    sectionContext: 'permanent_address',
    isCheckbox: true,
  },
  {
    sourceProperty: 'permanentAddress.careOf',
    displayLabel: 'Permanent Care Of',
    exactNames: ['permanent_careof', 'permanent_co', 'per_careof'],
    exactIds: ['permanent_careof', 'permanent_co'],
    labelKeywordsEn: ['care of'],
    labelKeywordsBn: ['যত্নে'],
    sectionContext: 'permanent_address',
  },
  {
    sourceProperty: 'permanentAddress.addressLine',
    displayLabel: 'Permanent Village / Road / House',
    exactNames: ['permanent_village', 'permanent_address', 'per_village'],
    exactIds: ['permanent_village', 'permanent_address'],
    labelKeywordsEn: ['village', 'road', 'house', 'flat'],
    labelKeywordsBn: ['গ্রাম', 'রাস্তা', 'বাড়ি'],
    sectionContext: 'permanent_address',
  },
  {
    sourceProperty: 'permanentAddress.district',
    displayLabel: 'Permanent District',
    exactNames: ['permanent_district', 'per_dist'],
    exactIds: ['permanent_district', 'per_dist'],
    labelKeywordsEn: ['district'],
    labelKeywordsBn: ['জেলা'],
    sectionContext: 'permanent_address',
  },
  {
    sourceProperty: 'permanentAddress.upazila',
    displayLabel: 'Permanent Upazila / P.S.',
    exactNames: ['permanent_upazila', 'permanent_ps', 'per_upazila'],
    exactIds: ['permanent_upazila', 'permanent_ps'],
    labelKeywordsEn: ['upazila', 'p.s.', 'police station', 'thana'],
    labelKeywordsBn: ['উপজেলা', 'থানা'],
    sectionContext: 'permanent_address',
  },
  {
    sourceProperty: 'permanentAddress.postOffice',
    displayLabel: 'Permanent Post Office',
    exactNames: ['permanent_post', 'permanent_po', 'per_post'],
    exactIds: ['permanent_post', 'permanent_po'],
    labelKeywordsEn: ['post office'],
    labelKeywordsBn: ['ডাকঘর', 'পোস্ট অফিস'],
    sectionContext: 'permanent_address',
  },
  {
    sourceProperty: 'permanentAddress.postCode',
    displayLabel: 'Permanent Post Code',
    exactNames: ['permanent_postcode', 'permanent_pcode', 'per_postcode'],
    exactIds: ['permanent_postcode', 'permanent_pcode'],
    labelKeywordsEn: ['post code', 'postal code'],
    labelKeywordsBn: ['পোস্ট কোড'],
    sectionContext: 'permanent_address',
  },

  // SSC
  {sourceProperty: 'ssc.examination', displayLabel: 'SSC Examination', exactNames: ['exam1', 'ssc_exam'], exactIds: ['exam1', 'ssc_exam'], labelKeywordsEn: ['examination'], labelKeywordsBn: ['পরীক্ষা'], sectionContext: 'ssc'},
  {sourceProperty: 'ssc.rollNumber', displayLabel: 'SSC Roll Number', exactNames: ['roll1', 'ssc_roll'], exactIds: ['roll1', 'ssc_roll'], labelKeywordsEn: ['roll no', 'roll number'], labelKeywordsBn: ['রোল নম্বর'], sectionContext: 'ssc'},
  {sourceProperty: 'ssc.group', displayLabel: 'SSC Group / Subject', exactNames: ['subject1', 'ssc_group'], exactIds: ['subject1', 'ssc_group'], labelKeywordsEn: ['group', 'subject'], labelKeywordsBn: ['গ্রুপ', 'বিভাগ'], sectionContext: 'ssc'},
  {sourceProperty: 'ssc.board', displayLabel: 'SSC Board', exactNames: ['institute1', 'ssc_board'], exactIds: ['institute1', 'ssc_board'], labelKeywordsEn: ['board'], labelKeywordsBn: ['বোর্ড'], sectionContext: 'ssc'},
  {sourceProperty: 'ssc.result', displayLabel: 'SSC Result', exactNames: ['result1', 'ssc_result'], exactIds: ['result1', 'ssc_result'], labelKeywordsEn: ['result', 'gpa'], labelKeywordsBn: ['ফলাফল'], sectionContext: 'ssc'},
  {sourceProperty: 'ssc.passingYear', displayLabel: 'SSC Passing Year', exactNames: ['year1', 'ssc_year'], exactIds: ['year1', 'ssc_year'], labelKeywordsEn: ['passing year'], labelKeywordsBn: ['পাশের সন'], sectionContext: 'ssc'},

  // HSC
  {sourceProperty: 'hsc.examination', displayLabel: 'HSC Examination', exactNames: ['exam2', 'hsc_exam'], exactIds: ['exam2', 'hsc_exam'], labelKeywordsEn: ['examination'], labelKeywordsBn: ['পরীক্ষা'], sectionContext: 'hsc'},
  {sourceProperty: 'hsc.rollNumber', displayLabel: 'HSC Roll Number', exactNames: ['roll2', 'hsc_roll'], exactIds: ['roll2', 'hsc_roll'], labelKeywordsEn: ['roll no', 'roll number'], labelKeywordsBn: ['রোল নম্বর'], sectionContext: 'hsc'},
  {sourceProperty: 'hsc.group', displayLabel: 'HSC Group / Subject', exactNames: ['subject2', 'hsc_group'], exactIds: ['subject2', 'hsc_group'], labelKeywordsEn: ['group', 'subject'], labelKeywordsBn: ['গ্রুপ', 'বিভাগ'], sectionContext: 'hsc'},
  {sourceProperty: 'hsc.board', displayLabel: 'HSC Board', exactNames: ['institute2', 'hsc_board'], exactIds: ['institute2', 'hsc_board'], labelKeywordsEn: ['board'], labelKeywordsBn: ['বোর্ড'], sectionContext: 'hsc'},
  {sourceProperty: 'hsc.result', displayLabel: 'HSC Result', exactNames: ['result2', 'hsc_result'], exactIds: ['result2', 'hsc_result'], labelKeywordsEn: ['result', 'gpa'], labelKeywordsBn: ['ফলাফল'], sectionContext: 'hsc'},
  {sourceProperty: 'hsc.passingYear', displayLabel: 'HSC Passing Year', exactNames: ['year2', 'hsc_year'], exactIds: ['year2', 'hsc_year'], labelKeywordsEn: ['passing year'], labelKeywordsBn: ['পাশের সন'], sectionContext: 'hsc'},

  // Graduation
  {sourceProperty: 'graduation.examination', displayLabel: 'Graduation Examination', exactNames: ['exam3', 'grad_exam'], exactIds: ['exam3', 'grad_exam'], labelKeywordsEn: ['examination'], labelKeywordsBn: ['পরীক্ষা'], sectionContext: 'graduation'},
  {sourceProperty: 'graduation.institution', displayLabel: 'Graduation University / Institution', exactNames: ['institute3', 'grad_university'], exactIds: ['institute3', 'grad_university'], labelKeywordsEn: ['university', 'institution'], labelKeywordsBn: ['বিশ্ববিদ্যালয়', 'প্রতিষ্ঠান'], sectionContext: 'graduation'},
  {sourceProperty: 'graduation.passingYear', displayLabel: 'Graduation Passing Year', exactNames: ['year3', 'grad_year'], exactIds: ['year3', 'grad_year'], labelKeywordsEn: ['passing year'], labelKeywordsBn: ['পাশের সন'], sectionContext: 'graduation'},
  {sourceProperty: 'graduation.degree', displayLabel: 'Graduation Subject / Degree', exactNames: ['subject3', 'grad_subject'], exactIds: ['subject3', 'grad_subject'], labelKeywordsEn: ['subject', 'degree'], labelKeywordsBn: ['বিষয়', 'ডিগ্রি'], sectionContext: 'graduation'},
  {sourceProperty: 'graduation.result', displayLabel: 'Graduation Result', exactNames: ['result3', 'grad_result'], exactIds: ['result3', 'grad_result'], labelKeywordsEn: ['result', 'cgpa'], labelKeywordsBn: ['ফলাফল'], sectionContext: 'graduation'},
  {sourceProperty: 'graduation.duration', displayLabel: 'Graduation Course Duration', exactNames: ['duration3', 'grad_duration'], exactIds: ['duration3', 'grad_duration'], labelKeywordsEn: ['course duration', 'duration'], labelKeywordsBn: ['কোর্সের মেয়াদ'], sectionContext: 'graduation'},

  // Masters
  {sourceProperty: 'masters.examination', displayLabel: 'Masters Examination', exactNames: ['exam4', 'masters_exam'], exactIds: ['exam4', 'masters_exam'], labelKeywordsEn: ['examination'], labelKeywordsBn: ['পরীক্ষা'], sectionContext: 'masters'},
  {sourceProperty: 'masters.institution', displayLabel: 'Masters University / Institution', exactNames: ['institute4', 'masters_university'], exactIds: ['institute4', 'masters_university'], labelKeywordsEn: ['university', 'institution'], labelKeywordsBn: ['বিশ্ববিদ্যালয়', 'প্রতিষ্ঠান'], sectionContext: 'masters'},
  {sourceProperty: 'masters.passingYear', displayLabel: 'Masters Passing Year', exactNames: ['year4', 'masters_year'], exactIds: ['year4', 'masters_year'], labelKeywordsEn: ['passing year'], labelKeywordsBn: ['পাশের সন'], sectionContext: 'masters'},
  {sourceProperty: 'masters.degree', displayLabel: 'Masters Subject / Degree', exactNames: ['subject4', 'masters_subject'], exactIds: ['subject4', 'masters_subject'], labelKeywordsEn: ['subject', 'degree'], labelKeywordsBn: ['বিষয়', 'ডিগ্রি'], sectionContext: 'masters'},
  {sourceProperty: 'masters.result', displayLabel: 'Masters Result', exactNames: ['result4', 'masters_result'], exactIds: ['result4', 'masters_result'], labelKeywordsEn: ['result', 'cgpa'], labelKeywordsBn: ['ফলাফল'], sectionContext: 'masters'},
  {sourceProperty: 'masters.duration', displayLabel: 'Masters Course Duration', exactNames: ['duration4', 'masters_duration'], exactIds: ['duration4', 'masters_duration'], labelKeywordsEn: ['course duration', 'duration'], labelKeywordsBn: ['কোর্সের মেয়াদ'], sectionContext: 'masters'},

  // Job Experience (Primary / Most Recent)
  {sourceProperty: 'employment.designation', displayLabel: 'Designation / Post', exactNames: ['job_designation', 'designation', 'exp_post'], exactIds: ['job_designation', 'designation'], labelKeywordsEn: ['designation', 'post'], labelKeywordsBn: ['পদবি'], sectionContext: 'employment'},
  {sourceProperty: 'employment.organization', displayLabel: 'Organization', exactNames: ['job_organization', 'organization', 'exp_org'], exactIds: ['job_organization', 'organization'], labelKeywordsEn: ['organization', 'employer'], labelKeywordsBn: ['প্রতিষ্ঠান'], sectionContext: 'employment'},
  {sourceProperty: 'employment.address', displayLabel: 'Organization Address', exactNames: ['job_address', 'org_address'], exactIds: ['job_address', 'org_address'], labelKeywordsEn: ['organization address', 'office address', 'address'], labelKeywordsBn: ['প্রতিষ্ঠানের ঠিকানা'], sectionContext: 'employment'},
  {sourceProperty: 'employment.startDate', displayLabel: 'Employment Start Date', exactNames: ['job_start_date', 'exp_start_date', 'employment_date'], exactIds: ['job_start_date', 'exp_start_date'], labelKeywordsEn: ['start date', 'employment date', 'from date'], labelKeywordsBn: ['যোগদানের তারিখ', 'শুরুর তারিখ'], sectionContext: 'employment', isDate: true},
  {sourceProperty: 'employment.endDate', displayLabel: 'Employment End Date', exactNames: ['job_end_date', 'exp_end_date'], exactIds: ['job_end_date', 'exp_end_date'], labelKeywordsEn: ['end date', 'to date'], labelKeywordsBn: ['শেষের তারিখ'], sectionContext: 'employment', isDate: true},
  {sourceProperty: 'employment.currentlyWorking', displayLabel: 'Currently Working', exactNames: ['job_currently_working', 'currently_working'], exactIds: ['job_currently_working', 'currently_working'], labelKeywordsEn: ['currently working'], labelKeywordsBn: ['বর্তমানে কর্মরত'], sectionContext: 'employment', isCheckbox: true},
  {sourceProperty: 'employment.lengthOfService', displayLabel: 'Length of Service', exactNames: ['job_length_service', 'length_of_service'], exactIds: ['job_length_service', 'length_of_service'], labelKeywordsEn: ['length of service', 'service duration'], labelKeywordsBn: ['চাকরির মেয়াদ'], sectionContext: 'employment'},
  {sourceProperty: 'employment.description', displayLabel: 'Job Description', exactNames: ['job_description', 'responsibilities'], exactIds: ['job_description', 'responsibilities'], labelKeywordsEn: ['job description', 'responsibilities'], labelKeywordsBn: ['কাজের বিবরণ'], sectionContext: 'employment'},
];

export function normalizeLabel(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[*:\[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatAddressLine(addr?: AddressRecord): string {
  if (!addr) return '';
  return [addr.house, addr.road, addr.village].filter((p) => p && p.trim()).join(', ');
}

export function resolveProfileValue(bundle: ProfileBundle, sourceProperty: string): string {
  const {profile, presentAddress, permanentAddress, educations, employments} = bundle;
  const p = profile.personalInformation;
  const [group, key] = sourceProperty.split('.');

  if (group === 'personal') {
    return String((p as unknown as Record<string, string>)[key] || '');
  }
  if (group === 'presentAddress') {
    if (!presentAddress) return '';
    if (key === 'addressLine') return formatAddressLine(presentAddress);
    return String((presentAddress as unknown as Record<string, unknown>)[key] ?? '');
  }
  if (group === 'permanentAddress') {
    const effective =
      permanentAddress?.sameAsPresent && presentAddress
        ? {...presentAddress, sameAsPresent: true}
        : permanentAddress;
    if (!effective) return '';
    if (key === 'sameAsPresent') return effective.sameAsPresent ? 'true' : 'false';
    if (key === 'addressLine') return formatAddressLine(effective);
    return String((effective as unknown as Record<string, unknown>)[key] ?? '');
  }
  if (group === 'ssc' || group === 'hsc' || group === 'graduation' || group === 'masters') {
    const rec = educations.find((e) => e.levelCategory === group);
    if (!rec) return '';
    if (key === 'degree') return rec.degree || rec.group || '';
    return String((rec as unknown as Record<string, string>)[key] || '');
  }
  if (group === 'employment') {
    const latest = [...employments].sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))[0];
    if (!latest) return '';
    if (key === 'currentlyWorking') return latest.currentlyWorking ? 'true' : 'false';
    if (key === 'lengthOfService') {
      const dur = calculateServiceDuration(
        latest.startDate,
        latest.currentlyWorking ? null : latest.endDate,
      );
      return dur ? dur.formattedEn : '';
    }
    return String((latest as unknown as Record<string, unknown>)[key] ?? '');
  }
  return '';
}

function isProtectedSecurityField(field: DetectedFormField): boolean {
  const combined = normalizeLabel(`${field.name} ${field.id} ${field.label} ${field.placeholder}`);
  return (
    field.inputType === 'password' ||
    field.inputType === 'file' ||
    combined.includes('captcha') ||
    combined.includes('security code') ||
    combined.includes('otp') ||
    combined.includes('validation code') ||
    combined.includes('ভেরিফিকেশন')
  );
}

/**
 * Maps detected DOM fields against the selected profile using a 7-layer priority engine.
 * Never autofills CAPTCHA/password/OTP fields and never auto-selects low-confidence matches.
 */
export function mapDetectedFields(
  fields: DetectedFormField[],
  bundle: ProfileBundle,
  options?: {allowMediumConfidenceProposal?: boolean},
): FieldMappingResult[] {
  const allowMedium = options?.allowMediumConfidenceProposal ?? false;

  return fields.map((field) => {
    const selectorHint = field.id
      ? `#${field.id}`
      : field.name
        ? `[name="${field.name}"]`
        : field.elementKey;

    if (isProtectedSecurityField(field)) {
      return {
        elementKey: field.elementKey,
        fieldLabel: field.label || field.name || field.id || 'Protected Field',
        detectedSelectorHint: selectorHint,
        tagName: field.tagName,
        inputType: field.inputType,
        sourceProperty: null,
        sourceDisplayLabel: 'Protected / Never Autofilled',
        profileValue: '',
        transformedValue: '',
        confidence: 'UNMATCHED',
        matchReason: 'Security boundary: CAPTCHA, OTP, password, and file upload fields are never autofilled.',
        status: 'UNSUPPORTED',
        selectedForFill: false,
      };
    }

    const nameNorm = (field.name || '').trim().toLowerCase();
    const idNorm = (field.id || '').trim().toLowerCase();
    const labelNorm = normalizeLabel(field.label || field.ariaLabel);
    const placeholderNorm = normalizeLabel(field.placeholder);
    const sectionNorm = (field.sectionHint || '').trim().toLowerCase();

    let bestRule: FieldRule | null = null;
    let bestScore = 0;
    let bestReason = 'No confident field mapping found';
    let bestConfidence: ConfidenceLevel = 'UNMATCHED';

    for (const rule of FIELD_RULES) {
      const sectionMatches = !rule.sectionContext || !sectionNorm || sectionNorm === rule.sectionContext;

      // Layer 1: Exact field name
      if (nameNorm && rule.exactNames.map((n) => n.toLowerCase()).includes(nameNorm)) {
        const score = sectionMatches ? 100 : 88;
        if (score > bestScore) {
          bestRule = rule;
          bestScore = score;
          bestConfidence = 'HIGH';
          bestReason = `Exact field name match ("${field.name}")`;
        }
        continue;
      }

      // Layer 2: Exact field ID
      if (idNorm && rule.exactIds.map((n) => n.toLowerCase()).includes(idNorm)) {
        const score = sectionMatches ? 98 : 85;
        if (score > bestScore) {
          bestRule = rule;
          bestScore = score;
          bestConfidence = 'HIGH';
          bestReason = `Exact field ID match ("#${field.id}")`;
        }
        continue;
      }

      // Prevent cross-section leaks for shared labels like "District", "Board", "Result"
      if (rule.sectionContext && sectionNorm && rule.sectionContext !== sectionNorm) {
        continue;
      }

      // Layer 3 & 4: Associated / normalized English label match
      const exactEnLabel = rule.labelKeywordsEn.find((kw) => labelNorm === kw);
      if (exactEnLabel) {
        const score = 92;
        if (score > bestScore) {
          bestRule = rule;
          bestScore = score;
          bestConfidence = 'HIGH';
          bestReason = `Associated label exact match ("${exactEnLabel}")`;
        }
        continue;
      }

      // Layer 5: Bengali synonym match (normalize keywords & guard English vs Bengali name rules)
      const isBnNameRule =
        rule.sourceProperty === 'personal.applicantNameBn' ||
        rule.sourceProperty === 'personal.fatherNameBn' ||
        rule.sourceProperty === 'personal.motherNameBn';
      const isEnNameRule =
        rule.sourceProperty === 'personal.applicantName' ||
        rule.sourceProperty === 'personal.fatherName' ||
        rule.sourceProperty === 'personal.motherName';
      const labelMentionsBn =
        labelNorm.includes('bengali') || labelNorm.includes('bangla') || labelNorm.includes('বাংলা');

      if (!(isEnNameRule && labelMentionsBn) && !(isBnNameRule && !labelMentionsBn && labelNorm.includes('ইংরেজি'))) {
        const bnHit = rule.labelKeywordsBn
          .map((kw) => ({raw: kw, norm: normalizeLabel(kw)}))
          .filter((kw) => kw.norm && labelNorm.includes(kw.norm))
          .sort((a, b) => b.norm.length - a.norm.length)[0];
        if (bnHit) {
          const score = 90 + Math.min(5, Math.floor(bnHit.norm.length / 8));
          if (score > bestScore) {
            bestRule = rule;
            bestScore = score;
            bestConfidence = 'HIGH';
            bestReason = `Bengali label match ("${bnHit.raw}")`;
          }
          continue;
        }
      }

      // Layer 4b: Normalized label contains keyword
      const partialEnLabel = rule.labelKeywordsEn.find((kw) => kw.length >= 4 && labelNorm.includes(kw));
      if (partialEnLabel) {
        // Avoid matching Bengali-name rules when label says English or vice versa
        const isBnRule = rule.sourceProperty.endsWith('Bn');
        const labelMentionsBn = labelNorm.includes('bengali') || labelNorm.includes('bangla') || labelNorm.includes('বাংলা');
        if (isBnRule !== labelMentionsBn && rule.sourceProperty.startsWith('personal.')) {
          continue;
        }
        const score = 76;
        if (score > bestScore) {
          bestRule = rule;
          bestScore = score;
          bestConfidence = 'MEDIUM';
          bestReason = `Normalized label match ("${partialEnLabel}")`;
        }
        continue;
      }

      // Layer 6: Placeholder matching
      const placeholderHit = rule.labelKeywordsEn.find((kw) => kw.length >= 4 && placeholderNorm.includes(kw));
      if (placeholderHit) {
        const score = 62;
        if (score > bestScore) {
          bestRule = rule;
          bestScore = score;
          bestConfidence = 'MEDIUM';
          bestReason = `Placeholder match ("${placeholderHit}")`;
        }
        continue;
      }

      // Layer 7: Context-aware weak heuristic (LOW confidence -> never auto-selected!)
      const descNorm = normalizeLabel(field.description);
      const descHit = rule.labelKeywordsEn.find((kw) => kw.length >= 5 && descNorm.includes(kw));
      if (descHit) {
        const score = 40;
        if (score > bestScore) {
          bestRule = rule;
          bestScore = score;
          bestConfidence = 'LOW';
          bestReason = `Context hint only ("${descHit}") — requires manual entry`;
        }
      }
    }

    if (!bestRule || bestConfidence === 'UNMATCHED') {
      return {
        elementKey: field.elementKey,
        fieldLabel: field.label || field.name || field.id || 'Unknown Field',
        detectedSelectorHint: selectorHint,
        tagName: field.tagName,
        inputType: field.inputType,
        sourceProperty: null,
        sourceDisplayLabel: 'Unmatched',
        profileValue: '',
        transformedValue: '',
        confidence: 'UNMATCHED',
        matchReason: bestReason,
        status: 'MANUAL',
        selectedForFill: false,
      };
    }

    const rawValue = resolveProfileValue(bundle, bestRule.sourceProperty);
    if (!rawValue) {
      return {
        elementKey: field.elementKey,
        fieldLabel: field.label || bestRule.displayLabel,
        detectedSelectorHint: selectorHint,
        tagName: field.tagName,
        inputType: field.inputType,
        sourceProperty: bestRule.sourceProperty,
        sourceDisplayLabel: bestRule.displayLabel,
        profileValue: '',
        transformedValue: '',
        confidence: bestConfidence,
        matchReason: `${bestReason} · Value missing in active profile`,
        status: 'MISSING_VALUE',
        selectedForFill: false,
      };
    }

    // Handle Date Conversion safely
    let transformedValue = rawValue;
    let dateFormatUsed: string | undefined;
    if (bestRule.isDate) {
      const expectedFormat = detectExpectedDateFormat(field);
      const converted = convertIsoDateToTarget(rawValue, expectedFormat);
      if (!converted.ok) {
        return {
          elementKey: field.elementKey,
          fieldLabel: field.label || bestRule.displayLabel,
          detectedSelectorHint: selectorHint,
          tagName: field.tagName,
          inputType: field.inputType,
          sourceProperty: bestRule.sourceProperty,
          sourceDisplayLabel: bestRule.displayLabel,
          profileValue: rawValue,
          transformedValue: '',
          confidence: bestConfidence,
          matchReason: `${bestReason} · Date conversion blocked: ${converted.reason}`,
          status: 'MANUAL',
          selectedForFill: false,
        };
      }
      transformedValue = converted.formatted;
      dateFormatUsed = converted.format;
    }

    // Handle Safe Dropdown Matching
    if (field.tagName === 'select' && field.options) {
      const dm = matchDropdownOption(transformedValue, field.options);
      if (!dm.matched || !dm.selectedValue) {
        return {
          elementKey: field.elementKey,
          fieldLabel: field.label || bestRule.displayLabel,
          detectedSelectorHint: selectorHint,
          tagName: field.tagName,
          inputType: field.inputType,
          sourceProperty: bestRule.sourceProperty,
          sourceDisplayLabel: bestRule.displayLabel,
          profileValue: rawValue,
          transformedValue: '',
          confidence: bestConfidence,
          matchReason: bestReason,
          status: 'UNRESOLVED_DROPDOWN',
          selectedForFill: false,
          dropdownNote: dm.ambiguous
            ? `Ambiguous dropdown candidates (${dm.candidates.map((c) => c.text).join(', ')}) — select manually`
            : `No matching dropdown option for "${rawValue}"`,
        };
      }
      transformedValue = dm.selectedValue;
      const isReady = bestConfidence === 'HIGH';
      return {
        elementKey: field.elementKey,
        fieldLabel: field.label || bestRule.displayLabel,
        detectedSelectorHint: selectorHint,
        tagName: field.tagName,
        inputType: field.inputType,
        sourceProperty: bestRule.sourceProperty,
        sourceDisplayLabel: bestRule.displayLabel,
        profileValue: rawValue,
        transformedValue,
        confidence: bestConfidence,
        matchReason: `${bestReason} · Option "${dm.selectedText}" (${dm.strategy})`,
        status: isReady ? 'READY' : bestConfidence === 'MEDIUM' ? 'REVIEW' : 'MANUAL',
        selectedForFill: isReady || (bestConfidence === 'MEDIUM' && allowMedium),
        dropdownNote: dm.selectedText ? `Matched option: ${dm.selectedText}` : undefined,
      };
    }

    const status =
      bestConfidence === 'HIGH'
        ? 'READY'
        : bestConfidence === 'MEDIUM'
          ? 'REVIEW'
          : 'MANUAL';

    return {
      elementKey: field.elementKey,
      fieldLabel: field.label || bestRule.displayLabel,
      detectedSelectorHint: selectorHint,
      tagName: field.tagName,
      inputType: field.inputType,
      sourceProperty: bestRule.sourceProperty,
      sourceDisplayLabel: bestRule.displayLabel,
      profileValue: rawValue,
      transformedValue,
      confidence: bestConfidence,
      matchReason: dateFormatUsed ? `${bestReason} · Format ${dateFormatUsed}` : bestReason,
      status,
      // Strict safety rule: Low-confidence mappings are NEVER automatically selected.
      selectedForFill: bestConfidence === 'HIGH' || (bestConfidence === 'MEDIUM' && allowMedium),
      dateFormatUsed,
    };
  });
}

export function getAvailableSourceProperties(): Array<{value: string; label: string}> {
  return FIELD_RULES.map((r) => ({value: r.sourceProperty, label: r.displayLabel}));
}
