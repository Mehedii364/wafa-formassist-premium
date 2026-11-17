import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertIsoDateToTarget,
  detectExpectedDateFormat,
  isValidCalendarDate,
} from '../../shared/field-mapping/date-converter';
import {matchDropdownOption} from '../../shared/field-mapping/dropdown-matcher';
import {mapDetectedFields, type ProfileBundle} from '../../shared/field-mapping/mapper';
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

test('dropdown matcher handles bilingual equivalents and refuses ambiguous matches', () => {
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
});

test('mapDetectedFields enforces 7-layer matching, protects CAPTCHA/file/password, and never auto-selects LOW', () => {
  const fields: DetectedFormField[] = [
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
  ];

  const mapped = mapDetectedFields(fields, makeBundle());
  const byKey = new Map(mapped.map((m) => [m.elementKey, m]));

  assert.equal(byKey.get('k1')?.confidence, 'HIGH');
  assert.equal(byKey.get('k1')?.selectedForFill, true);
  assert.equal(byKey.get('k1')?.transformedValue, 'Nadia Islam');

  assert.equal(byKey.get('k2')?.confidence, 'HIGH');
  assert.equal(byKey.get('k2')?.transformedValue, 'নাদিয়া ইসলাম');

  // Protected fields strictly UNSUPPORTED & never selected
  assert.equal(byKey.get('k3')?.status, 'UNSUPPORTED');
  assert.equal(byKey.get('k3')?.selectedForFill, false);
  assert.equal(byKey.get('k4')?.status, 'UNSUPPORTED');
  assert.equal(byKey.get('k4')?.selectedForFill, false);

  // Weak description hint -> LOW confidence -> NEVER selected for autofill
  assert.equal(byKey.get('k5')?.confidence, 'LOW');
  assert.equal(byKey.get('k5')?.selectedForFill, false);
});
