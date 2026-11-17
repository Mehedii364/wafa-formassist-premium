import {
  AddressRecord,
  ConfidenceLevel,
  DetectedFormField,
  EducationRecord,
  EmploymentRecord,
  FieldMappingResult,
  ProfileRecord,
} from '../schemas/types';
import {classifySensitiveField} from '../security/sensitive-fields';
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
  exactIds: string[];
  exactNames: string[];
  autocompleteTokens?: string[];
  labelKeywordsEn: string[];
  labelKeywordsBn: string[];
  domainHints?: string[];
  sectionContext?: string;
  isDate?: boolean;
  isCheckbox?: boolean;
}

const FIELD_RULES: FieldRule[] = [
  // Basic Information
  {
    sourceProperty: 'personal.applicantName',
    displayLabel: "Applicant's Name",
    exactIds: ['name', 'applicant_name', 'applicantName', 'sim_applicant_name'],
    exactNames: ['name', 'applicant_name', 'applicantName'],
    autocompleteTokens: ['name'],
    labelKeywordsEn: ["applicant's name", 'applicant name', 'full name'],
    labelKeywordsBn: ['আবেদনকারীর নাম (ইংরেজি)', 'আবেদনকারীর নাম'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.applicantNameBn',
    displayLabel: "Applicant's Name (Bengali)",
    exactIds: ['name_bn', 'applicant_name_bn', 'b_name', 'sim_applicant_name_bn'],
    exactNames: ['name_bn', 'applicant_name_bn', 'b_name'],
    labelKeywordsEn: ['applicant name in bengali', 'applicant name (bangla)', 'name in bengali', 'bengali name'],
    labelKeywordsBn: ['আবেদনকারীর নাম (বাংলায়)', 'আবেদনকারীর নাম বাংলা', 'প্রার্থীর নাম (বাংলা)'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.fatherName',
    displayLabel: "Father's Name",
    exactIds: ['father', 'father_name', 'fatherName', 'sim_father_name'],
    exactNames: ['father', 'father_name', 'fatherName'],
    labelKeywordsEn: ["father's name", 'father name'],
    labelKeywordsBn: ['পিতার নাম (ইংরেজি)', 'পিতার নাম'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.fatherNameBn',
    displayLabel: "Father's Name (Bengali)",
    exactIds: ['father_bn', 'father_name_bn', 'b_father', 'sim_father_name_bn'],
    exactNames: ['father_bn', 'father_name_bn', 'b_father'],
    labelKeywordsEn: ["father's name in bengali", 'father name bengali', 'father name bangla'],
    labelKeywordsBn: ['পিতার নাম (বাংলায়)', 'পিতার নাম বাংলা'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.motherName',
    displayLabel: "Mother's Name",
    exactIds: ['mother', 'mother_name', 'motherName', 'sim_mother_name'],
    exactNames: ['mother', 'mother_name', 'motherName'],
    labelKeywordsEn: ["mother's name", 'mother name'],
    labelKeywordsBn: ['মাতার নাম (ইংরেজি)', 'মাতার নাম'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.motherNameBn',
    displayLabel: "Mother's Name (Bengali)",
    exactIds: ['mother_bn', 'mother_name_bn', 'b_mother', 'sim_mother_name_bn'],
    exactNames: ['mother_bn', 'mother_name_bn', 'b_mother'],
    labelKeywordsEn: ["mother's name in bengali", 'mother name bengali', 'mother name bangla'],
    labelKeywordsBn: ['মাতার নাম (বাংলায়)', 'মাতার নাম বাংলা'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.dateOfBirth',
    displayLabel: 'Date of Birth',
    exactIds: ['dob', 'date_of_birth', 'birth_date', 'sim_dob'],
    exactNames: ['dob', 'date_of_birth', 'birth_date', 'dateOfBirth'],
    autocompleteTokens: ['bday'],
    labelKeywordsEn: ['date of birth', 'birth date', 'dob'],
    labelKeywordsBn: ['জন্ম তারিখ'],
    sectionContext: 'basic',
    isDate: true,
  },
  {
    sourceProperty: 'personal.nationality',
    displayLabel: 'Nationality',
    exactIds: ['nationality', 'sim_nationality'],
    exactNames: ['nationality'],
    labelKeywordsEn: ['nationality'],
    labelKeywordsBn: ['জাতীয়তা'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.religion',
    displayLabel: 'Religion',
    exactIds: ['religion', 'sim_religion'],
    exactNames: ['religion'],
    labelKeywordsEn: ['religion'],
    labelKeywordsBn: ['ধর্ম'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.gender',
    displayLabel: 'Gender',
    exactIds: ['gender', 'sex', 'sim_gender'],
    exactNames: ['gender', 'sex'],
    autocompleteTokens: ['sex'],
    labelKeywordsEn: ['gender', 'sex'],
    labelKeywordsBn: ['লিঙ্গ'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.nationalId',
    displayLabel: 'National ID',
    exactIds: ['nid', 'national_id', 'nid_no', 'sim_nid'],
    exactNames: ['nid', 'national_id', 'nid_no', 'nationalId'],
    labelKeywordsEn: ['national id', 'nid number', 'nid'],
    labelKeywordsBn: ['জাতীয় পরিচয়পত্র', 'জাতীয় পরিচয়পত্র নম্বর', 'এনআইডি'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.birthRegistration',
    displayLabel: 'Birth Registration',
    exactIds: ['breg', 'birth_reg', 'birth_registration', 'breg_no', 'sim_breg'],
    exactNames: ['breg', 'birth_reg', 'birth_registration', 'breg_no'],
    labelKeywordsEn: ['birth registration', 'birth reg'],
    labelKeywordsBn: ['জন্ম নিবন্ধন', 'জন্ম নিবন্ধন নম্বর'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.passportId',
    displayLabel: 'Passport ID',
    exactIds: ['passport', 'passport_id', 'passport_no', 'sim_passport'],
    exactNames: ['passport', 'passport_id', 'passport_no'],
    labelKeywordsEn: ['passport id', 'passport number', 'passport'],
    labelKeywordsBn: ['পাসপোর্ট নম্বর', 'পাসপোর্ট'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.maritalStatus',
    displayLabel: 'Marital Status',
    exactIds: ['marital_status', 'mstatus', 'sim_marital'],
    exactNames: ['marital_status', 'mstatus', 'maritalStatus'],
    labelKeywordsEn: ['marital status'],
    labelKeywordsBn: ['বৈবাহিক অবস্থা'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.mobileNumber',
    displayLabel: 'Mobile Number',
    exactIds: ['mobile', 'mobile_number', 'phone', 'sim_mobile'],
    exactNames: ['mobile', 'mobile_number', 'phone', 'contact_mobile'],
    autocompleteTokens: ['tel', 'tel-national'],
    labelKeywordsEn: ['mobile number', 'mobile no', 'contact number'],
    labelKeywordsBn: ['মোবাইল নম্বর', 'ফোন নম্বর'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.confirmMobileNumber',
    displayLabel: 'Confirm Mobile Number',
    exactIds: ['confirm_mobile', 'confirm_mobile_number', 'sim_confirm_mobile'],
    exactNames: ['confirm_mobile', 'confirm_mobile_number', 'retype_mobile'],
    labelKeywordsEn: ['confirm mobile', 're-type mobile', 'confirm mobile number'],
    labelKeywordsBn: ['মোবাইল নম্বর নিশ্চিত', 'পুনরায় মোবাইল নম্বর'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.email',
    displayLabel: 'Email',
    exactIds: ['email', 'email_address', 'sim_email'],
    exactNames: ['email', 'email_address'],
    autocompleteTokens: ['email'],
    labelKeywordsEn: ['email', 'e-mail'],
    labelKeywordsBn: ['ইমেইল', 'ই-মেইল'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.quota',
    displayLabel: 'Quota',
    exactIds: ['quota', 'ffq', 'sim_quota'],
    exactNames: ['quota', 'ffq'],
    labelKeywordsEn: ['quota'],
    labelKeywordsBn: ['কোটা'],
    domainHints: ['freedom fighter quota', 'teletalk quota'],
    sectionContext: 'basic',
  },
  {
    sourceProperty: 'personal.departmentalStatus',
    displayLabel: 'Departmental Status',
    exactIds: ['dep_status', 'departmental_status', 'sim_dep_status'],
    exactNames: ['dep_status', 'departmental_status', 'dept_status'],
    labelKeywordsEn: ['departmental status'],
    labelKeywordsBn: ['বিভাগীয় অবস্থা', 'বিভাগীয় প্রার্থী'],
    domainHints: ['departmental candidate'],
    sectionContext: 'basic',
  },

  // Present Address
  {
    sourceProperty: 'presentAddress.careOf',
    displayLabel: 'Present Care Of',
    exactIds: ['present_careof', 'present_co', 'sim_present_co'],
    exactNames: ['present_careof', 'present_co', 'pre_careof'],
    labelKeywordsEn: ['care of'],
    labelKeywordsBn: ['যত্নে'],
    sectionContext: 'present_address',
  },
  {
    sourceProperty: 'presentAddress.addressLine',
    displayLabel: 'Present Village / Road / House',
    exactIds: ['present_village', 'present_address', 'sim_present_village'],
    exactNames: ['present_village', 'present_address', 'pre_village'],
    labelKeywordsEn: ['village', 'road', 'house', 'flat', 'village / road / house / flat'],
    labelKeywordsBn: ['গ্রাম', 'রাস্তা', 'বাড়ি'],
    sectionContext: 'present_address',
  },
  {
    sourceProperty: 'presentAddress.district',
    displayLabel: 'Present District',
    exactIds: ['present_district', 'pre_dist', 'sim_present_district'],
    exactNames: ['present_district', 'pre_dist', 'menu_one'],
    labelKeywordsEn: ['district'],
    labelKeywordsBn: ['জেলা'],
    sectionContext: 'present_address',
  },
  {
    sourceProperty: 'presentAddress.upazila',
    displayLabel: 'Present Upazila / P.S.',
    exactIds: ['present_upazila', 'present_ps', 'sim_present_upazila'],
    exactNames: ['present_upazila', 'present_ps', 'pre_upazila'],
    labelKeywordsEn: ['upazila', 'p.s.', 'police station', 'thana', 'upazila / p.s.'],
    labelKeywordsBn: ['উপজেলা', 'থানা'],
    sectionContext: 'present_address',
  },
  {
    sourceProperty: 'presentAddress.postOffice',
    displayLabel: 'Present Post Office',
    exactIds: ['present_post', 'present_po', 'sim_present_post'],
    exactNames: ['present_post', 'present_po', 'pre_post'],
    labelKeywordsEn: ['post office'],
    labelKeywordsBn: ['ডাকঘর', 'পোস্ট অফিস'],
    sectionContext: 'present_address',
  },
  {
    sourceProperty: 'presentAddress.postCode',
    displayLabel: 'Present Post Code',
    exactIds: ['present_postcode', 'present_pcode', 'sim_present_postcode'],
    exactNames: ['present_postcode', 'present_pcode', 'pre_postcode'],
    autocompleteTokens: ['postal-code'],
    labelKeywordsEn: ['post code', 'postal code'],
    labelKeywordsBn: ['পোস্ট কোড'],
    sectionContext: 'present_address',
  },

  // Permanent Address
  {
    sourceProperty: 'permanentAddress.sameAsPresent',
    displayLabel: 'Same as Present Address',
    exactIds: ['same_as_present', 'copy_address', 'sim_same_as_present'],
    exactNames: ['same_as_present', 'copy_address'],
    labelKeywordsEn: ['same as present', 'same as present address'],
    labelKeywordsBn: ['বর্তমান ঠিকানার অনুরূপ'],
    sectionContext: 'permanent_address',
    isCheckbox: true,
  },
  {
    sourceProperty: 'permanentAddress.careOf',
    displayLabel: 'Permanent Care Of',
    exactIds: ['permanent_careof', 'permanent_co', 'sim_perm_co'],
    exactNames: ['permanent_careof', 'permanent_co', 'per_careof'],
    labelKeywordsEn: ['care of'],
    labelKeywordsBn: ['যত্নে'],
    sectionContext: 'permanent_address',
  },
  {
    sourceProperty: 'permanentAddress.addressLine',
    displayLabel: 'Permanent Village / Road / House',
    exactIds: ['permanent_village', 'permanent_address', 'sim_perm_village'],
    exactNames: ['permanent_village', 'permanent_address', 'per_village'],
    labelKeywordsEn: ['village', 'road', 'house', 'flat', 'village / road / house / flat'],
    labelKeywordsBn: ['গ্রাম', 'রাস্তা', 'বাড়ি'],
    sectionContext: 'permanent_address',
  },
  {
    sourceProperty: 'permanentAddress.district',
    displayLabel: 'Permanent District',
    exactIds: ['permanent_district', 'per_dist', 'sim_permanent_district'],
    exactNames: ['permanent_district', 'per_dist'],
    labelKeywordsEn: ['district'],
    labelKeywordsBn: ['জেলা'],
    sectionContext: 'permanent_address',
  },
  {
    sourceProperty: 'permanentAddress.upazila',
    displayLabel: 'Permanent Upazila / P.S.',
    exactIds: ['permanent_upazila', 'permanent_ps', 'sim_perm_upazila'],
    exactNames: ['permanent_upazila', 'permanent_ps', 'per_upazila'],
    labelKeywordsEn: ['upazila', 'p.s.', 'police station', 'thana', 'upazila / p.s.'],
    labelKeywordsBn: ['উপজেলা', 'থানা'],
    sectionContext: 'permanent_address',
  },
  {
    sourceProperty: 'permanentAddress.postOffice',
    displayLabel: 'Permanent Post Office',
    exactIds: ['permanent_post', 'permanent_po', 'sim_perm_post'],
    exactNames: ['permanent_post', 'permanent_po', 'per_post'],
    labelKeywordsEn: ['post office'],
    labelKeywordsBn: ['ডাকঘর', 'পোস্ট অফিস'],
    sectionContext: 'permanent_address',
  },
  {
    sourceProperty: 'permanentAddress.postCode',
    displayLabel: 'Permanent Post Code',
    exactIds: ['permanent_postcode', 'permanent_pcode', 'sim_perm_postcode'],
    exactNames: ['permanent_postcode', 'permanent_pcode', 'per_postcode'],
    labelKeywordsEn: ['post code', 'postal code'],
    labelKeywordsBn: ['পোস্ট কোড'],
    sectionContext: 'permanent_address',
  },

  // SSC
  {sourceProperty: 'ssc.examination', displayLabel: 'SSC Examination', exactIds: ['exam1', 'ssc_exam', 'sim_ssc_exam'], exactNames: ['exam1', 'ssc_exam'], labelKeywordsEn: ['examination'], labelKeywordsBn: ['পরীক্ষা'], sectionContext: 'ssc'},
  {sourceProperty: 'ssc.rollNumber', displayLabel: 'SSC Roll Number', exactIds: ['roll1', 'ssc_roll', 'sim_ssc_roll'], exactNames: ['roll1', 'ssc_roll'], labelKeywordsEn: ['roll no', 'roll number'], labelKeywordsBn: ['রোল নম্বর'], sectionContext: 'ssc'},
  {sourceProperty: 'ssc.group', displayLabel: 'SSC Group / Subject', exactIds: ['subject1', 'ssc_group', 'sim_ssc_group'], exactNames: ['subject1', 'ssc_group'], labelKeywordsEn: ['group', 'subject', 'group / subject'], labelKeywordsBn: ['গ্রুপ', 'বিভাগ'], sectionContext: 'ssc'},
  {sourceProperty: 'ssc.board', displayLabel: 'SSC Board', exactIds: ['institute1', 'ssc_board', 'sim_ssc_board'], exactNames: ['institute1', 'ssc_board'], labelKeywordsEn: ['board'], labelKeywordsBn: ['বোর্ড'], sectionContext: 'ssc'},
  {sourceProperty: 'ssc.result', displayLabel: 'SSC Result', exactIds: ['result1', 'ssc_result', 'sim_ssc_result'], exactNames: ['result1', 'ssc_result'], labelKeywordsEn: ['result', 'gpa'], labelKeywordsBn: ['ফলাফল'], sectionContext: 'ssc'},
  {sourceProperty: 'ssc.passingYear', displayLabel: 'SSC Passing Year', exactIds: ['year1', 'ssc_year', 'sim_ssc_year'], exactNames: ['year1', 'ssc_year'], labelKeywordsEn: ['passing year'], labelKeywordsBn: ['পাশের সন'], sectionContext: 'ssc'},

  // HSC
  {sourceProperty: 'hsc.examination', displayLabel: 'HSC Examination', exactIds: ['exam2', 'hsc_exam', 'sim_hsc_exam'], exactNames: ['exam2', 'hsc_exam'], labelKeywordsEn: ['examination'], labelKeywordsBn: ['পরীক্ষা'], sectionContext: 'hsc'},
  {sourceProperty: 'hsc.rollNumber', displayLabel: 'HSC Roll Number', exactIds: ['roll2', 'hsc_roll', 'sim_hsc_roll'], exactNames: ['roll2', 'hsc_roll'], labelKeywordsEn: ['roll no', 'roll number'], labelKeywordsBn: ['রোল নম্বর'], sectionContext: 'hsc'},
  {sourceProperty: 'hsc.group', displayLabel: 'HSC Group / Subject', exactIds: ['subject2', 'hsc_group', 'sim_hsc_group'], exactNames: ['subject2', 'hsc_group'], labelKeywordsEn: ['group', 'subject', 'group / subject'], labelKeywordsBn: ['গ্রুপ', 'বিভাগ'], sectionContext: 'hsc'},
  {sourceProperty: 'hsc.board', displayLabel: 'HSC Board', exactIds: ['institute2', 'hsc_board', 'sim_hsc_board'], exactNames: ['institute2', 'hsc_board'], labelKeywordsEn: ['board'], labelKeywordsBn: ['বোর্ড'], sectionContext: 'hsc'},
  {sourceProperty: 'hsc.result', displayLabel: 'HSC Result', exactIds: ['result2', 'hsc_result', 'sim_hsc_result'], exactNames: ['result2', 'hsc_result'], labelKeywordsEn: ['result', 'gpa'], labelKeywordsBn: ['ফলাফল'], sectionContext: 'hsc'},
  {sourceProperty: 'hsc.passingYear', displayLabel: 'HSC Passing Year', exactIds: ['year2', 'hsc_year', 'sim_hsc_year'], exactNames: ['year2', 'hsc_year'], labelKeywordsEn: ['passing year'], labelKeywordsBn: ['পাশের সন'], sectionContext: 'hsc'},

  // Graduation
  {sourceProperty: 'graduation.examination', displayLabel: 'Graduation Examination', exactIds: ['exam3', 'grad_exam', 'sim_grad_exam'], exactNames: ['exam3', 'grad_exam'], labelKeywordsEn: ['examination'], labelKeywordsBn: ['পরীক্ষা'], sectionContext: 'graduation'},
  {sourceProperty: 'graduation.institution', displayLabel: 'Graduation University / Institution', exactIds: ['institute3', 'grad_university', 'sim_grad_univ'], exactNames: ['institute3', 'grad_university'], labelKeywordsEn: ['university', 'institution', 'university / institution'], labelKeywordsBn: ['বিশ্ববিদ্যালয়', 'প্রতিষ্ঠান'], sectionContext: 'graduation'},
  {sourceProperty: 'graduation.passingYear', displayLabel: 'Graduation Passing Year', exactIds: ['year3', 'grad_year', 'sim_grad_year'], exactNames: ['year3', 'grad_year'], labelKeywordsEn: ['passing year'], labelKeywordsBn: ['পাশের সন'], sectionContext: 'graduation'},
  {sourceProperty: 'graduation.degree', displayLabel: 'Graduation Subject / Degree', exactIds: ['subject3', 'grad_subject', 'sim_grad_subj'], exactNames: ['subject3', 'grad_subject'], labelKeywordsEn: ['subject', 'degree', 'subject / degree'], labelKeywordsBn: ['বিষয়', 'ডিগ্রি'], sectionContext: 'graduation'},
  {sourceProperty: 'graduation.result', displayLabel: 'Graduation Result', exactIds: ['result3', 'grad_result', 'sim_grad_res'], exactNames: ['result3', 'grad_result'], labelKeywordsEn: ['result', 'cgpa'], labelKeywordsBn: ['ফলাফল'], sectionContext: 'graduation'},
  {sourceProperty: 'graduation.duration', displayLabel: 'Graduation Course Duration', exactIds: ['duration3', 'grad_duration', 'sim_grad_dur'], exactNames: ['duration3', 'grad_duration'], labelKeywordsEn: ['course duration', 'duration'], labelKeywordsBn: ['কোর্সের মেয়াদ'], sectionContext: 'graduation'},

  // Masters
  {sourceProperty: 'masters.examination', displayLabel: 'Masters Examination', exactIds: ['exam4', 'masters_exam'], exactNames: ['exam4', 'masters_exam'], labelKeywordsEn: ['examination'], labelKeywordsBn: ['পরীক্ষা'], sectionContext: 'masters'},
  {sourceProperty: 'masters.institution', displayLabel: 'Masters University / Institution', exactIds: ['institute4', 'masters_university'], exactNames: ['institute4', 'masters_university'], labelKeywordsEn: ['university', 'institution', 'university / institution'], labelKeywordsBn: ['বিশ্ববিদ্যালয়', 'প্রতিষ্ঠান'], sectionContext: 'masters'},
  {sourceProperty: 'masters.passingYear', displayLabel: 'Masters Passing Year', exactIds: ['year4', 'masters_year'], exactNames: ['year4', 'masters_year'], labelKeywordsEn: ['passing year'], labelKeywordsBn: ['পাশের সন'], sectionContext: 'masters'},
  {sourceProperty: 'masters.degree', displayLabel: 'Masters Subject / Degree', exactIds: ['subject4', 'masters_subject'], exactNames: ['subject4', 'masters_subject'], labelKeywordsEn: ['subject', 'degree', 'subject / degree'], labelKeywordsBn: ['বিষয়', 'ডিগ্রি'], sectionContext: 'masters'},
  {sourceProperty: 'masters.result', displayLabel: 'Masters Result', exactIds: ['result4', 'masters_result'], exactNames: ['result4', 'masters_result'], labelKeywordsEn: ['result', 'cgpa'], labelKeywordsBn: ['ফলাফল'], sectionContext: 'masters'},
  {sourceProperty: 'masters.duration', displayLabel: 'Masters Course Duration', exactIds: ['duration4', 'masters_duration'], exactNames: ['duration4', 'masters_duration'], labelKeywordsEn: ['course duration', 'duration'], labelKeywordsBn: ['কোর্সের মেয়াদ'], sectionContext: 'masters'},

  // Job Experience (Primary / Most Recent)
  {sourceProperty: 'employment.designation', displayLabel: 'Designation / Post', exactIds: ['job_designation', 'designation', 'sim_job_desig'], exactNames: ['job_designation', 'designation', 'exp_post'], labelKeywordsEn: ['designation', 'post', 'designation / post'], labelKeywordsBn: ['পদবি'], sectionContext: 'employment'},
  {sourceProperty: 'employment.organization', displayLabel: 'Organization', exactIds: ['job_organization', 'organization', 'sim_job_org'], exactNames: ['job_organization', 'organization', 'exp_org'], labelKeywordsEn: ['organization', 'employer'], labelKeywordsBn: ['প্রতিষ্ঠান'], sectionContext: 'employment'},
  {sourceProperty: 'employment.address', displayLabel: 'Organization Address', exactIds: ['job_address', 'org_address', 'sim_job_addr'], exactNames: ['job_address', 'org_address'], labelKeywordsEn: ['organization address', 'office address', 'address'], labelKeywordsBn: ['প্রতিষ্ঠানের ঠিকানা'], sectionContext: 'employment'},
  {sourceProperty: 'employment.startDate', displayLabel: 'Employment Start Date', exactIds: ['job_start_date', 'exp_start_date', 'sim_job_start'], exactNames: ['job_start_date', 'exp_start_date', 'employment_date'], labelKeywordsEn: ['start date', 'employment date', 'from date'], labelKeywordsBn: ['যোগদানের তারিখ', 'শুরুর তারিখ'], sectionContext: 'employment', isDate: true},
  {sourceProperty: 'employment.endDate', displayLabel: 'Employment End Date', exactIds: ['job_end_date', 'exp_end_date', 'sim_job_end'], exactNames: ['job_end_date', 'exp_end_date'], labelKeywordsEn: ['end date', 'to date'], labelKeywordsBn: ['শেষের তারিখ'], sectionContext: 'employment', isDate: true},
  {sourceProperty: 'employment.currentlyWorking', displayLabel: 'Currently Working', exactIds: ['job_currently_working', 'currently_working'], exactNames: ['job_currently_working', 'currently_working'], labelKeywordsEn: ['currently working'], labelKeywordsBn: ['বর্তমানে কর্মরত'], sectionContext: 'employment', isCheckbox: true},
  {sourceProperty: 'employment.lengthOfService', displayLabel: 'Length of Service', exactIds: ['job_length_service', 'length_of_service', 'sim_job_len'], exactNames: ['job_length_service', 'length_of_service'], labelKeywordsEn: ['length of service', 'service duration'], labelKeywordsBn: ['চাকরির মেয়াদ'], sectionContext: 'employment'},
  {sourceProperty: 'employment.description', displayLabel: 'Job Description', exactIds: ['job_description', 'responsibilities'], exactNames: ['job_description', 'responsibilities'], labelKeywordsEn: ['job description', 'responsibilities'], labelKeywordsBn: ['কাজের বিবরণ'], sectionContext: 'employment'},
];

export function normalizeLabel(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[*:\[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAttrKey(text: string): string {
  return (text || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function formatAddressLine(addr?: AddressRecord): string {
  if (!addr) return '';
  return [addr.house, addr.road, addr.village].filter((p) => p && p.trim()).join(', ');
}

export function resolveProfileValue(bundle: ProfileBundle, sourceProperty: string): string {
  const {profile, presentAddress, permanentAddress, educations, employments} = bundle;
  const p = profile.personalInformation;
  const [group, ...rest] = sourceProperty.split('.');
  const key = rest.join('.');

  if (group === 'custom') {
    const cf = (profile.customFields || []).find(
      (f) => normalizeAttrKey(f.key) === normalizeAttrKey(key) || f.id === key,
    );
    return cf ? String(cf.value || '') : '';
  }
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

function fieldAlreadyHasDifferentValue(field: DetectedFormField, transformedValue: string): boolean {
  if (field.hasExistingValue) {
    if (typeof field.currentValue === 'string') {
      const curr = field.currentValue.trim();
      if (!curr) return false;
      if (field.inputType === 'checkbox') {
        return curr === 'true' && transformedValue !== 'true';
      }
      return curr !== transformedValue.trim();
    }
    return true;
  }
  if (typeof field.currentValue === 'string') {
    const curr = field.currentValue.trim();
    if (!curr) return false;
    if (field.inputType === 'checkbox') {
      return curr === 'true' && transformedValue !== 'true';
    }
    return curr !== transformedValue.trim();
  }
  return false;
}

/**
 * 6-Tier Bilingual Field Mapping Engine:
 * Tier 1: Exact ID match (HIGH)
 * Tier 2: Exact normalized name match (HIGH)
 * Tier 3: Exact associated label / HTML autocomplete / custom profile field match (HIGH)
 * Tier 4: Verified Bangla <-> English equivalent label match (HIGH)
 * Tier 5: Verified domain-specific / normalized label or placeholder match (MEDIUM)
 * Tier 6: Suggested contextual / fuzzy match (LOW — NEVER auto-selected, requires explicit user confirmation)
 *
 * Also independently blocks all sensitive fields (password, OTP, CAPTCHA, payment, token, recovery, file)
 * and marks pre-filled user controls as requiring explicit overwrite approval.
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

    // Independent sensitive-field exclusion boundary
    const sensitiveCheck = classifySensitiveField(field);
    if (sensitiveCheck.sensitive) {
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
        matchReason: `Security boundary (${sensitiveCheck.category}): ${sensitiveCheck.reason}`,
        status: 'UNSUPPORTED',
        selectedForFill: false,
      };
    }

    const idNorm = (field.id || '').trim().toLowerCase();
    const idNormKey = normalizeAttrKey(field.id || '');
    const nameNorm = (field.name || '').trim().toLowerCase();
    const nameNormKey = normalizeAttrKey(field.name || '');
    const autoNorm = (field.autocomplete || '').trim().toLowerCase();
    const labelNorm = normalizeLabel(field.label || field.ariaLabel);
    const placeholderNorm = normalizeLabel(field.placeholder);
    const descNorm = normalizeLabel(`${field.description || ''} ${field.describedBy || ''}`);
    const sectionNorm = (field.sectionHint || '').trim().toLowerCase();

    let bestRule: FieldRule | null = null;
    let bestScore = 0;
    let bestTier: 1 | 2 | 3 | 4 | 5 | 6 | undefined;
    let bestReason = 'No confident field mapping found';
    let bestConfidence: ConfidenceLevel = 'UNMATCHED';

    for (const rule of FIELD_RULES) {
      const sectionMatches = !rule.sectionContext || !sectionNorm || sectionNorm === rule.sectionContext;

      // Tier 1: Exact field ID
      if (
        idNorm &&
        rule.exactIds.some((id) => id.toLowerCase() === idNorm || normalizeAttrKey(id) === idNormKey)
      ) {
        const score = sectionMatches ? 100 : 94;
        if (score > bestScore) {
          bestRule = rule;
          bestScore = score;
          bestTier = 1;
          bestConfidence = 'HIGH';
          bestReason = `Tier 1 · Exact field ID match ("#${field.id}")`;
        }
        continue;
      }

      // Tier 2: Exact normalized field name
      if (
        nameNorm &&
        rule.exactNames.some((n) => n.toLowerCase() === nameNorm || normalizeAttrKey(n) === nameNormKey)
      ) {
        const score = sectionMatches ? 98 : 90;
        if (score > bestScore) {
          bestRule = rule;
          bestScore = score;
          bestTier = 2;
          bestConfidence = 'HIGH';
          bestReason = `Tier 2 · Exact normalized field name match ("${field.name}")`;
        }
        continue;
      }

      // Prevent cross-section leaks for shared labels like "District", "Board", "Result"
      if (rule.sectionContext && sectionNorm && rule.sectionContext !== sectionNorm) {
        continue;
      }

      // Tier 3: Exact associated label OR standard autocomplete token
      const exactEnLabel = rule.labelKeywordsEn.find((kw) => labelNorm === normalizeLabel(kw));
      if (exactEnLabel) {
        const score = 93;
        if (score > bestScore) {
          bestRule = rule;
          bestScore = score;
          bestTier = 3;
          bestConfidence = 'HIGH';
          bestReason = `Tier 3 · Exact label match ("${exactEnLabel}")`;
        }
        continue;
      }
      if (autoNorm && rule.autocompleteTokens?.includes(autoNorm)) {
        const score = 91;
        if (score > bestScore) {
          bestRule = rule;
          bestScore = score;
          bestTier = 3;
          bestConfidence = 'HIGH';
          bestReason = `Tier 3 · HTML autocomplete match ("${autoNorm}")`;
        }
        continue;
      }

      // Tier 4: Verified Bangla <-> English equivalent label match
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
          const score = 88 + Math.min(4, Math.floor(bnHit.norm.length / 8));
          if (score > bestScore) {
            bestRule = rule;
            bestScore = score;
            bestTier = 4;
            bestConfidence = 'HIGH';
            bestReason = `Tier 4 · Verified Bangla equivalent match ("${bnHit.raw}")`;
          }
          continue;
        }
      }

      // Tier 5: Verified domain-specific / normalized label or placeholder match
      const domainHit = rule.domainHints?.find((kw) => labelNorm.includes(kw) || descNorm.includes(kw));
      if (domainHit) {
        const score = 78;
        if (score > bestScore) {
          bestRule = rule;
          bestScore = score;
          bestTier = 5;
          bestConfidence = 'MEDIUM';
          bestReason = `Tier 5 · Domain-specific mapping ("${domainHit}")`;
        }
        continue;
      }

      const partialEnLabel = rule.labelKeywordsEn.find((kw) => kw.length >= 4 && labelNorm.includes(normalizeLabel(kw)));
      if (partialEnLabel) {
        const isBnRule = rule.sourceProperty.endsWith('Bn');
        if (isBnRule !== labelMentionsBn && rule.sourceProperty.startsWith('personal.')) {
          continue;
        }
        const score = 75;
        if (score > bestScore) {
          bestRule = rule;
          bestScore = score;
          bestTier = 5;
          bestConfidence = 'MEDIUM';
          bestReason = `Tier 5 · Normalized label match ("${partialEnLabel}")`;
        }
        continue;
      }

      const placeholderHit = rule.labelKeywordsEn.find((kw) => kw.length >= 4 && placeholderNorm.includes(normalizeLabel(kw)));
      if (placeholderHit) {
        const score = 68;
        if (score > bestScore) {
          bestRule = rule;
          bestScore = score;
          bestTier = 5;
          bestConfidence = 'MEDIUM';
          bestReason = `Tier 5 · Placeholder hint match ("${placeholderHit}")`;
        }
        continue;
      }

      // Tier 6: Suggested fuzzy / context match (LOW confidence -> NEVER auto-selected!)
      const descHit = rule.labelKeywordsEn.find((kw) => kw.length >= 5 && descNorm.includes(normalizeLabel(kw)));
      if (descHit) {
        const score = 40;
        if (score > bestScore) {
          bestRule = rule;
          bestScore = score;
          bestTier = 6;
          bestConfidence = 'LOW';
          bestReason = `Tier 6 · Suggested contextual match ("${descHit}") — requires explicit user confirmation`;
        }
      }
    }

    // Check profile customFields at Tier 3 if no built-in rule matched with HIGH confidence
    if ((!bestRule || bestScore < 85) && (bundle.profile.customFields?.length || 0) > 0) {
      for (const cf of bundle.profile.customFields || []) {
        const cfKeyNorm = normalizeAttrKey(cf.key);
        const cfLabelNorm = normalizeLabel(cf.label);
        if (
          (cfKeyNorm && (idNormKey === cfKeyNorm || nameNormKey === cfKeyNorm)) ||
          (cfLabelNorm && labelNorm === cfLabelNorm)
        ) {
          bestRule = {
            sourceProperty: `custom.${cf.key}`,
            displayLabel: `Custom: ${cf.label}`,
            exactIds: [cf.key],
            exactNames: [cf.key],
            labelKeywordsEn: [cf.label],
            labelKeywordsBn: [],
          };
          bestScore = 92;
          bestTier = 3;
          bestConfidence = 'HIGH';
          bestReason = `Tier 3 · Custom profile field match ("${cf.label}")`;
          break;
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
        matchTier: bestTier,
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
          matchTier: bestTier,
          matchReason: `${bestReason} · Date conversion blocked: ${converted.reason}`,
          status: 'MANUAL',
          selectedForFill: false,
        };
      }
      transformedValue = converted.formatted;
      dateFormatUsed = converted.format;
    }

    // Handle Safe Dropdown Matching (never auto-selects fuzzy/partial or ambiguous options)
    let dropdownNote: string | undefined;
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
          transformedValue: dm.suggestedCandidate ? dm.suggestedCandidate.value : '',
          confidence: dm.strategy === 'suggested_fuzzy' ? 'LOW' : bestConfidence,
          matchTier: dm.strategy === 'suggested_fuzzy' ? 6 : bestTier,
          matchReason: bestReason,
          status: 'UNRESOLVED_DROPDOWN',
          selectedForFill: false,
          suggestedOption: dm.suggestedCandidate || undefined,
          dropdownNote:
            dm.strategy === 'suggested_fuzzy' && dm.suggestedCandidate
              ? `Fuzzy suggestion "${dm.suggestedCandidate.text}" requires explicit manual confirmation`
              : dm.ambiguous
                ? `Ambiguous dropdown candidates (${dm.candidates.map((c) => c.text).join(', ')}) — select manually`
                : `No matching dropdown option for "${rawValue}"`,
        };
      }
      transformedValue = dm.selectedValue;
      dropdownNote = dm.selectedText ? `Matched option: ${dm.selectedText}` : undefined;
    }

    const requiresOverwriteApproval = fieldAlreadyHasDifferentValue(field, transformedValue);
    const status = requiresOverwriteApproval
      ? 'REVIEW'
      : bestConfidence === 'HIGH'
        ? 'READY'
        : bestConfidence === 'MEDIUM'
          ? 'REVIEW'
          : 'MANUAL';

    // Strict safety rules:
    // 1. Low-confidence (Tier 6) mappings are NEVER auto-selected.
    // 2. Fields with existing user-entered values are NEVER auto-selected for overwrite.
    const defaultSelected =
      !requiresOverwriteApproval &&
      (bestConfidence === 'HIGH' || (bestConfidence === 'MEDIUM' && allowMedium));

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
      matchTier: bestTier,
      matchReason: requiresOverwriteApproval
        ? `${bestReason} · Existing value detected (approve overwrite explicitly)`
        : dateFormatUsed
          ? `${bestReason} · Format ${dateFormatUsed}`
          : bestReason,
      status,
      selectedForFill: defaultSelected,
      hasExistingValue: Boolean(field.hasExistingValue || (field.currentValue && field.currentValue.trim())),
      requiresOverwriteApproval,
      allowOverwrite: false,
      dropdownNote,
      dateFormatUsed,
    };
  });
}

export function getAvailableSourceProperties(): Array<{value: string; label: string}> {
  return FIELD_RULES.map((r) => ({value: r.sourceProperty, label: r.displayLabel}));
}
