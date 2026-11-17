import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertIsoDateToTarget,
  detectExpectedDateFormat,
  isValidCalendarDate,
} from '../../shared/field-mapping/date-converter';
import {matchDropdownOption} from '../../shared/field-mapping/dropdown-matcher';
import {mapDetectedFields, type ProfileBundle} from '../../shared/field-mapping/mapper';
import {mapExtensionFields} from '../../extension/shared/field-mapper.js';
import {DetectedFormField, SCHEMA_VERSION} from '../../shared/schemas/types';

function makeBundle(): ProfileBundle {
  const now = '2026-11-17T00:00:00.000Z';
  return {
    profile: {
      id: 'p1',
      schemaVersion: SCHEMA_VERSION,
      profileName: 'Mapper Test',
      isDefault: true,
      version: 1,
      createdAt: now,
      updatedAt: now,
      customFields: [
        {
          id: 'cf-1',
          key: 'employee_id',
          label: 'Employee ID',
          value: 'EMP-2026-088',
          verified: true,
        },
      ],
      personalInformation: {
        applicantName: 'Nadia Islam',
        applicantNameBn: 'নাদিয়া ইসলাম',
        fatherName: 'Rafiqul Islam',
        fatherNameBn: 'রফিকুল ইসলাম',
        motherName: 'Nasrin Akter',
        motherNameBn: 'নাসরিন আক্তার',
        dateOfBirth: '2000-02-29',
        nationality: 'Bangladeshi',
        religion: 'Islam',
        gender: 'Female',
        nationalId: '9876543210',
        birthRegistration: '',
        passportId: '',
        maritalStatus: 'Single',
        mobileNumber: '01812345678',
        confirmMobileNumber: '01812345678',
        email: 'nadia@example.com',
        quota: 'Non Quota',
        departmentalStatus: 'None',
      },
    },
    presentAddress: {
      id: 'a1',
      schemaVersion: SCHEMA_VERSION,
      profileId: 'p1',
      label: 'Present',
      addressType: 'present',
      sameAsPresent: false,
      careOf: 'Rafiqul Islam',
      village: 'Dhanmondi',
      road: 'Road 7A',
      house: 'House 21',
      district: 'Chattogram',
      upazila: 'Kotwali',
      postOffice: 'GPO',
      postCode: '4000',
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
    educations: [
      {
        id: 'e1',
        schemaVersion: SCHEMA_VERSION,
        profileId: 'p1',
        levelCategory: 'ssc',
        examination: 'SSC',
        rollNumber: '223344',
        registrationNumber: '1122334455',
        group: 'Science',
        board: 'Chattogram',
        institution: 'Govt Girls High School',
        resultType: 'GPA_5',
        result: '5.00',
        passingYear: '2016',
        degree: '',
        duration: '',
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
    ],
    employments: [],
  };
}

test('date converter validates leap years and converts YYYY-MM-DD / DD/MM/YYYY / MM/DD/YYYY', () => {
  assert.equal(isValidCalendarDate(2024, 2, 29), true);
  assert.equal(isValidCalendarDate(2023, 2, 29), false);

  const ddmm = convertIsoDateToTarget('2000-02-29', 'DD/MM/YYYY');
  assert.equal(ddmm.ok, true);
  if (ddmm.ok) assert.equal(ddmm.formatted, '29/02/2000');

  const mmdd = convertIsoDateToTarget('2000-02-29', 'MM/DD/YYYY');
  assert.equal(mmdd.ok, true);
  if (mmdd.ok) assert.equal(mmdd.formatted, '02/29/2000');

  const bad = convertIsoDateToTarget('2023-02-29', 'DD/MM/YYYY');
  assert.equal(bad.ok, false);

  assert.equal(detectExpectedDateFormat({inputType: 'date'}), 'YYYY-MM-DD');
  assert.equal(detectExpectedDateFormat({inputType: 'text', placeholder: 'DD/MM/YYYY'}), 'DD/MM/YYYY');
  assert.equal(detectExpectedDateFormat({inputType: 'text', placeholder: 'MM/DD/YYYY'}), 'MM/DD/YYYY');
});

test('dropdown matcher handles bilingual equivalents, refuses ambiguous matches, and never auto-selects fuzzy partial matches', () => {
  const religionRes = matchDropdownOption('Islam', [
    {value: '', text: '--Select--'},
    {value: '1', text: 'ইসলাম'},
    {value: '2', text: 'হিন্দু ধর্ম'},
  ]);
  assert.equal(religionRes.matched, true);
  assert.equal(religionRes.selectedValue, '1');
  assert.equal(religionRes.strategy, 'bilingual_equivalent');

  // Spelling variant Chattogram -> Chittagong
  const distRes = matchDropdownOption('Chattogram', [
    {value: 'dhk', text: 'Dhaka'},
    {value: 'ctg', text: 'Chittagong'},
  ]);
  assert.equal(distRes.matched, true);
  assert.equal(distRes.selectedValue, 'ctg');

  // Ambiguous candidates must NEVER auto-select
  const ambigRes = matchDropdownOption('Dhaka', [
    {value: '1', text: 'Dhaka North City'},
    {value: '2', text: 'Dhaka South City'},
  ]);
  assert.equal(ambigRes.matched, false);
  assert.equal(ambigRes.ambiguous, true);
  assert.equal(ambigRes.selectedValue, null);

  // Partial/fuzzy match must NEVER auto-select — returns suggested_fuzzy only
  const fuzzyRes = matchDropdownOption('Science', [
    {value: 'sci_ext', text: 'General Science & Technology Track'},
  ]);
  assert.equal(fuzzyRes.matched, false);
  assert.equal(fuzzyRes.strategy, 'suggested_fuzzy');
  assert.equal(fuzzyRes.selectedValue, null);
  assert.equal(fuzzyRes.suggestedCandidate?.value, 'sci_ext');
});

test('mapDetectedFields enforces 6-tier matching, customFields, overwrite approval, sensitive blocking, and extension parity', () => {
  const fields: DetectedFormField[] = [
    // Tier 1: Exact ID
    {
      elementKey: 'k1',
      tagName: 'input',
      inputType: 'text',
      name: 'applicant_name',
      id: 'applicant_name',
      label: "Applicant's Name",
      placeholder: '',
      ariaLabel: '',
      description: '',
      sectionHint: 'basic',
      required: true,
    },
    // Tier 4: Bangla equivalent label
    {
      elementKey: 'k2',
      tagName: 'input',
      inputType: 'text',
      name: 'custom_bn_field',
      id: 'custom_bn_field',
      label: 'আবেদনকারীর নাম (বাংলায়)',
      placeholder: '',
      ariaLabel: '',
      description: '',
      sectionHint: 'basic',
      required: true,
    },
    // Protected CAPTCHA
    {
      elementKey: 'k3',
      tagName: 'input',
      inputType: 'text',
      name: 'captcha_code',
      id: 'captcha_code',
      label: 'Validation Code / Captcha',
      placeholder: '',
      ariaLabel: '',
      description: '',
      sectionHint: 'security',
      required: true,
    },
    // Protected File Upload
    {
      elementKey: 'k4',
      tagName: 'input',
      inputType: 'file',
      name: 'photo_upload',
      id: 'photo_upload',
      label: 'Applicant Photo',
      placeholder: '',
      ariaLabel: '',
      description: '',
      sectionHint: 'uploads',
      required: true,
    },
    // Tier 6: Weak contextual description -> LOW -> NEVER auto-selected
    {
      elementKey: 'k5',
      tagName: 'input',
      inputType: 'text',
      name: 'mystery_x',
      id: 'mystery_x',
      label: 'Internal Code',
      placeholder: '',
      ariaLabel: '',
      description: 'Reference for email receipt only',
      sectionHint: 'basic',
      required: false,
    },
    // Tier 3: Custom Profile Field match
    {
      elementKey: 'k6',
      tagName: 'input',
      inputType: 'text',
      name: 'employee_id',
      id: 'employee_id',
      label: 'Employee ID',
      placeholder: '',
      ariaLabel: '',
      description: '',
      sectionHint: 'basic',
      required: false,
    },
    // Existing user-entered value must require explicit overwrite approval
    {
      elementKey: 'k7',
      tagName: 'input',
      inputType: 'text',
      name: 'father_name',
      id: 'father_name',
      label: "Father's Name",
      placeholder: '',
      ariaLabel: '',
      description: '',
      sectionHint: 'basic',
      required: true,
      hasExistingValue: true,
      currentValue: 'Manually Typed Father Name',
    },
    // Protected OTP
    {
      elementKey: 'k8',
      tagName: 'input',
      inputType: 'text',
      autocomplete: 'one-time-code',
      name: 'otp_code',
      id: 'otp_code',
      label: 'OTP Verification Code',
      placeholder: '',
      ariaLabel: '',
      description: '',
      sectionHint: 'security',
      required: true,
    },
  ];

  const bundle = makeBundle();
  const mapped = mapDetectedFields(fields, bundle);
  const byKey = new Map(mapped.map((m) => [m.elementKey, m]));

  assert.equal(byKey.get('k1')?.matchTier, 1);
  assert.equal(byKey.get('k1')?.confidence, 'HIGH');
  assert.equal(byKey.get('k1')?.selectedForFill, true);
  assert.equal(byKey.get('k1')?.transformedValue, 'Nadia Islam');

  assert.equal(byKey.get('k2')?.matchTier, 4);
  assert.equal(byKey.get('k2')?.confidence, 'HIGH');
  assert.equal(byKey.get('k2')?.transformedValue, 'নাদিয়া ইসলাম');

  // Protected fields strictly UNSUPPORTED & never selected
  assert.equal(byKey.get('k3')?.status, 'UNSUPPORTED');
  assert.equal(byKey.get('k3')?.selectedForFill, false);
  assert.equal(byKey.get('k4')?.status, 'UNSUPPORTED');
  assert.equal(byKey.get('k4')?.selectedForFill, false);
  assert.equal(byKey.get('k8')?.status, 'UNSUPPORTED');
  assert.equal(byKey.get('k8')?.selectedForFill, false);

  // Weak description hint -> Tier 6 LOW confidence -> NEVER selected for autofill
  assert.equal(byKey.get('k5')?.matchTier, 6);
  assert.equal(byKey.get('k5')?.confidence, 'LOW');
  assert.equal(byKey.get('k5')?.selectedForFill, false);

  // Custom field matched at Tier 3
  assert.equal(byKey.get('k6')?.matchTier, 3);
  assert.equal(byKey.get('k6')?.sourceProperty, 'custom.employee_id');
  assert.equal(byKey.get('k6')?.transformedValue, 'EMP-2026-088');
  assert.equal(byKey.get('k6')?.selectedForFill, true);

  // Existing user value flagged for explicit overwrite approval and NOT auto-selected
  assert.equal(byKey.get('k7')?.requiresOverwriteApproval, true);
  assert.equal(byKey.get('k7')?.selectedForFill, false);
  assert.equal(byKey.get('k7')?.status, 'REVIEW');

  // Verify extension field-mapper parity
  const extMapped = mapExtensionFields(fields, bundle);
  const extByKey = new Map(extMapped.map((m: {elementKey: string}) => [m.elementKey, m]));
  assert.equal((extByKey.get('k6') as {transformedValue: string})?.transformedValue, 'EMP-2026-088');
  assert.equal((extByKey.get('k7') as {requiresOverwriteApproval: boolean; selectedForFill: boolean})?.requiresOverwriteApproval, true);
  assert.equal((extByKey.get('k7') as {selectedForFill: boolean})?.selectedForFill, false);
  assert.equal((extByKey.get('k8') as {status: string})?.status, 'UNSUPPORTED');
});
