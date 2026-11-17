// WAFA FormAssist Extension — Lightweight Offline Profile Validator

export function validateExtensionProfile(profile, addresses = [], educations = []) {
  if (!profile) {
    return {completionPercent: 0, issues: ['No profile loaded in extension vault.']};
  }
  const p = profile.personalInformation || {};
  const issues = [];
  if (!p.applicantName) issues.push('Missing Applicant Name (English)');
  if (!p.fatherName) issues.push("Missing Father's Name");
  if (!p.motherName) issues.push("Missing Mother's Name");
  if (!p.dateOfBirth) issues.push('Missing Date of Birth');
  if (!p.mobileNumber || !/^01[3-9]\d{8}$/.test(p.mobileNumber)) {
    issues.push('Invalid or missing 11-digit Bangladesh Mobile Number');
  }
  if (!p.nationalId && !p.birthRegistration && !p.passportId) {
    issues.push('Missing identity number (NID / Birth Reg / Passport)');
  }
  const present = addresses.find((a) => a.profileId === profile.id && a.addressType === 'present');
  if (!present || !present.district) issues.push('Missing Present Address');
  const edus = educations.filter((e) => e.profileId === profile.id);
  if (edus.length === 0) issues.push('No education qualification records');

  const checks = [
    p.applicantName, p.applicantNameBn, p.fatherName, p.motherName,
    p.dateOfBirth, p.religion, p.gender, p.mobileNumber, p.email,
    p.nationalId || p.birthRegistration || p.passportId,
    present?.district, edus.length > 0 ? 'ok' : '',
  ];
  const filled = checks.filter((c) => Boolean(c && String(c).trim())).length;
  return {
    completionPercent: Math.round((filled / checks.length) * 100),
    issues,
  };
}
