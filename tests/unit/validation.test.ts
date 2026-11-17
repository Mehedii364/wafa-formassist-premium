import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateProfileCompletion,
  detectEmploymentDateConflicts,
  validateProfileSuite,
} from '../../shared/validation/validator';
import {calculateServiceDuration} from '../../shared/field-mapping/date-converter';
import {
  AddressRecord,
  EducationRecord,
  EmploymentRecord,
  ProfileRecord,
  SCHEMA_VERSION,
} from '../../shared/schemas/types';

function makeValidProfile(): ProfileRecord {
  const now = '2026-11-17T00:00:00.000Z';
  return {
    id: 'prof-test-1',
    schemaVersion: SCHEMA_VERSION,
    profileName: 'Unit Test Applicant',
    isDefault: true,
    version: 1,
    createdAt: now,
    updatedAt: now,
    personalInformation: {
      applicantName: 'Md. Karim Hossain',
      applicantNameBn: 'মোঃ করিম হোসেন',
      fatherName: 'Md. Rahim Hossain',
      fatherNameBn: 'মোঃ রহিম হোসেন',
      motherName: 'Mst. Salma Begum',
      motherNameBn: 'মোসাঃ সালমা বেগম',
      dateOfBirth: '1998-05-14',
      nationality: 'Bangladeshi',
      religion: 'Islam',
      gender: 'Male',
      nationalId: '1234567890',
      birthRegistration: '19982691234567890',
      passportId: 'A12345678',
      maritalStatus: 'Single',
      mobileNumber: '01712345678',
      confirmMobileNumber: '01712345678',
      email: 'karim@example.com',
      quota: 'Non Quota',
      departmentalStatus: 'None',
    },
  };
}

function makeValidAddresses(profileId: string): AddressRecord[] {
  const now = '2026-11-17T00:00:00.000Z';
  return [
    {
      id: 'addr-pre-1',
      schemaVersion: SCHEMA_VERSION,
      profileId,
      label: 'Present',
      addressType: 'present',
      sameAsPresent: false,
      careOf: 'Md. Rahim Hossain',
      village: 'Mirpur-10',
      road: 'Road 4',
      house: 'House 12',
      district: 'Dhaka',
      upazila: 'Mirpur',
      postOffice: 'Mirpur',
      postCode: '1216',
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'addr-per-1',
      schemaVersion: SCHEMA_VERSION,
      profileId,
      label: 'Permanent',
      addressType: 'permanent',
      sameAsPresent: true,
      careOf: 'Md. Rahim Hossain',
      village: 'Mirpur-10',
      road: 'Road 4',
      house: 'House 12',
      district: 'Dhaka',
      upazila: 'Mirpur',
      postOffice: 'Mirpur',
      postCode: '1216',
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function makeValidEducations(profileId: string): EducationRecord[] {
  const now = '2026-11-17T00:00:00.000Z';
  return [
    {
      id: 'edu-ssc-1',
      schemaVersion: SCHEMA_VERSION,
      profileId,
      levelCategory: 'ssc',
      examination: 'SSC',
      rollNumber: '112233',
      registrationNumber: '1234567890',
      group: 'Science',
      board: 'Dhaka',
      institution: 'Dhaka Model High School',
      resultType: 'GPA_5',
      result: '5.00',
      passingYear: '2014',
      degree: '',
      duration: '',
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'edu-hsc-1',
      schemaVersion: SCHEMA_VERSION,
      profileId,
      levelCategory: 'hsc',
      examination: 'HSC',
      rollNumber: '445566',
      registrationNumber: '1234567890',
      group: 'Science',
      board: 'Dhaka',
      institution: 'Dhaka College',
      resultType: 'GPA_5',
      result: '4.83',
      passingYear: '2016',
      degree: '',
      duration: '',
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

test('validateProfileSuite passes a fully valid applicant suite with 100% completion', () => {
  const profile = makeValidProfile();
  const addresses = makeValidAddresses(profile.id);
  const educations = makeValidEducations(profile.id);
  const report = validateProfileSuite({profile, addresses, educations, employments: []});

  assert.equal(report.overallStatus, 'VALID');
  assert.equal(report.completionPercent, 100);
  assert.equal(report.counts.INVALID, 0);
  assert.equal(report.counts.MISSING, 0);
});

test('validateProfileSuite flags invalid BD mobile, mobile mismatch, bad NID, and bad email', () => {
  const profile = makeValidProfile();
  profile.personalInformation.mobileNumber = '01200000000';
  profile.personalInformation.confirmMobileNumber = '01712345678';
  profile.personalInformation.nationalId = '12345'; // invalid length
  profile.personalInformation.email = 'not-an-email';

  const report = validateProfileSuite({
    profile,
    addresses: makeValidAddresses(profile.id),
    educations: makeValidEducations(profile.id),
    employments: [],
  });

  assert.equal(report.overallStatus, 'INVALID');
  assert.ok(report.issues.some((i) => i.field === 'Mobile Number' && i.status === 'INVALID'));
  assert.ok(report.issues.some((i) => i.field === 'Confirm Mobile Number' && i.status === 'INVALID'));
  assert.ok(report.issues.some((i) => i.field === 'National ID' && i.status === 'INVALID'));
  assert.ok(report.issues.some((i) => i.field === 'Email' && i.status === 'INVALID'));
  // Ensure bilingual actionable explanations exist
  for (const issue of report.issues) {
    assert.ok(issue.whatIsWrong.en.length > 0 && issue.whatIsWrong.bn.length > 0);
    assert.ok(issue.howToFix.en.length > 0 && issue.howToFix.bn.length > 0);
  }
});

test('validateProfileSuite detects out-of-range GPA/CGPA, SSC>HSC chronology, and invalid postcode', () => {
  const profile = makeValidProfile();
  const addresses = makeValidAddresses(profile.id);
  addresses[0].postCode = '12A'; // invalid 4-digit post code

  const educations = makeValidEducations(profile.id);
  educations[0].passingYear = '2018'; // SSC later than HSC (2016)
  educations[0].result = '5.50'; // exceeds GPA 5.00
  educations.push({
    ...educations[1],
    id: 'edu-grad-1',
    levelCategory: 'graduation',
    examination: 'Graduation',
    resultType: 'CGPA_4',
    result: '4.25', // exceeds CGPA 4.00
    passingYear: '2022',
  });

  const report = validateProfileSuite({profile, addresses, educations, employments: []});
  assert.equal(report.overallStatus, 'INVALID');
  assert.ok(report.issues.some((i) => i.field === 'Present Post Code' && i.status === 'INVALID'));
  assert.ok(report.issues.some((i) => i.field === 'Education Timeline' && i.status === 'INVALID'));
  assert.ok(report.issues.some((i) => i.field === 'SSC Result' && i.status === 'INVALID'));
  assert.ok(report.issues.some((i) => i.field === 'Graduation Result' && i.status === 'INVALID'));
});

test('detectEmploymentDateConflicts and calculateServiceDuration work accurately', () => {
  const now = '2026-11-17T00:00:00.000Z';
  const emps: EmploymentRecord[] = [
    {
      id: 'emp-1',
      schemaVersion: SCHEMA_VERSION,
      profileId: 'prof-test-1',
      organization: 'Org Alpha',
      designation: 'Assistant',
      description: '',
      address: 'Dhaka',
      employmentCategory: 'Private Sector',
      startDate: '2022-01-01',
      endDate: '2024-06-30',
      currentlyWorking: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'emp-2',
      schemaVersion: SCHEMA_VERSION,
      profileId: 'prof-test-1',
      organization: 'Org Beta',
      designation: 'Officer',
      description: '',
      address: 'Dhaka',
      employmentCategory: 'Private Sector',
      startDate: '2024-03-01', // overlaps with Org Alpha
      endDate: '2025-03-01',
      currentlyWorking: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const conflicts = detectEmploymentDateConflicts(emps);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].firstOrg, 'Org Alpha');
  assert.equal(conflicts[0].secondOrg, 'Org Beta');

  const duration = calculateServiceDuration('2022-01-01', '2024-03-16');
  assert.ok(duration);
  assert.equal(duration.years, 2);
  assert.equal(duration.months, 2);
  assert.equal(duration.days, 15);
  assert.equal(calculateProfileCompletion(makeValidProfile(), [], []) < 100, true);
});
