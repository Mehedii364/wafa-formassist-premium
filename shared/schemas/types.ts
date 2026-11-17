export const SCHEMA_VERSION = '1.0.0';
export const DB_VERSION = 1;

export type LanguageCode = 'en' | 'bn';
export type ThemeMode = 'dark' | 'light' | 'system';

export interface PersonalInformation {
  applicantName: string;
  applicantNameBn: string;
  fatherName: string;
  fatherNameBn: string;
  motherName: string;
  motherNameBn: string;
  dateOfBirth: string; // ISO YYYY-MM-DD canonical storage
  nationality: string;
  religion: string;
  gender: string;
  nationalId: string;
  birthRegistration: string;
  passportId: string;
  maritalStatus: string;
  mobileNumber: string;
  confirmMobileNumber: string;
  email: string;
  quota: string;
  departmentalStatus: string;
}

export interface ProfileRecord {
  id: string;
  schemaVersion: string;
  profileName: string;
  personalInformation: PersonalInformation;
  isDefault: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type AddressType = 'present' | 'permanent';

export interface AddressRecord {
  id: string;
  schemaVersion: string;
  profileId: string;
  label: string;
  addressType: AddressType;
  sameAsPresent: boolean;
  careOf: string;
  village: string;
  road: string;
  house: string;
  district: string;
  upazila: string;
  postOffice: string;
  postCode: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type EducationLevel =
  | 'SSC'
  | 'Dakhil'
  | 'SSC Vocational'
  | 'HSC'
  | 'Alim'
  | 'HSC Vocational'
  | 'Diploma'
  | 'Graduation'
  | 'Masters'
  | 'Equivalent';

export interface EducationRecord {
  id: string;
  schemaVersion: string;
  profileId: string;
  levelCategory: 'ssc' | 'hsc' | 'graduation' | 'masters' | 'other';
  examination: EducationLevel | string;
  rollNumber: string;
  registrationNumber: string;
  group: string;
  board: string;
  institution: string;
  resultType: 'GPA_5' | 'CGPA_4' | 'DIVISION' | 'GRADE' | 'OTHER';
  result: string;
  passingYear: string;
  degree: string;
  duration: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmploymentRecord {
  id: string;
  schemaVersion: string;
  profileId: string;
  organization: string;
  designation: string;
  description: string;
  address: string;
  employmentCategory: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD or '' if currentlyWorking
  currentlyWorking: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type SessionStatus =
  | 'SCANNED'
  | 'REVIEWED'
  | 'AUTOFILLED'
  | 'PARTIALLY_COMPLETED'
  | 'VALIDATION_REQUIRED'
  | 'CANCELLED';

export interface AutofillSessionRecord {
  id: string;
  schemaVersion: string;
  websiteId: string;
  websiteDomain: string;
  applicationRoute: string;
  profileId: string;
  profileName: string;
  timestamp: string;
  scannedCount: number;
  filledCount: number;
  skippedCount: number;
  unresolvedCount: number;
  failedCount: number;
  validationSummary: {
    valid: number;
    warnings: number;
    missing: number;
    invalid: number;
  };
  status: SessionStatus;
  verifiedAfterFill: boolean;
  // Intentionally NEVER stores raw sensitive field values.
}

export type CompatibilityStatus =
  | 'SIMULATED_VERIFIED'
  | 'LIVE_UNVERIFIED'
  | 'LIVE_VERIFIED'
  | 'BETA'
  | 'DEPRECATED';

export interface WebsiteAdapterSpec {
  id: string;
  name: string;
  nameBn: string;
  organization: string;
  recruitmentCycle: string;
  initialPost: string;
  domain: string;
  routes: string[];
  version: string;
  compatibilityStatus: CompatibilityStatus;
  lastVerifiedDate: string;
  supportedFieldCount: number;
  enabled: boolean;
  capabilities: string[];
  knownLimitations: string[];
  source: 'builtin' | 'remote-update';
}

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNMATCHED';

export interface DetectedFormField {
  elementKey: string;
  tagName: 'input' | 'select' | 'textarea';
  inputType: string;
  name: string;
  id: string;
  label: string;
  placeholder: string;
  ariaLabel: string;
  description: string;
  sectionHint: string;
  required: boolean;
  options?: Array<{value: string; text: string}>;
  currentValue?: string;
}

export interface FieldMappingResult {
  elementKey: string;
  fieldLabel: string;
  detectedSelectorHint: string;
  tagName: 'input' | 'select' | 'textarea';
  inputType: string;
  sourceProperty: string | null;
  sourceDisplayLabel: string;
  profileValue: string;
  transformedValue: string;
  confidence: ConfidenceLevel;
  matchReason: string;
  status: 'READY' | 'REVIEW' | 'MANUAL' | 'UNRESOLVED_DROPDOWN' | 'MISSING_VALUE' | 'UNSUPPORTED';
  selectedForFill: boolean;
  dropdownNote?: string;
  dateFormatUsed?: string;
}

export type ValidationStatus =
  | 'VALID'
  | 'WARNING'
  | 'MISSING'
  | 'INVALID'
  | 'NEEDS_REVIEW'
  | 'UNSUPPORTED';

export interface ValidationIssue {
  id: string;
  category: 'personal' | 'address' | 'education' | 'employment' | 'form';
  field: string;
  status: ValidationStatus;
  whatIsWrong: {en: string; bn: string};
  whyItMatters: {en: string; bn: string};
  howToFix: {en: string; bn: string};
  recordId?: string;
}

export interface ValidationReport {
  profileId: string;
  generatedAt: string;
  overallStatus: ValidationStatus;
  completionPercent: number;
  counts: Record<ValidationStatus, number>;
  issues: ValidationIssue[];
}

export interface EncryptedEnvelope {
  algorithm: 'AES-GCM';
  keyDerivation: 'PBKDF2-SHA256';
  iterations: number;
  salt: string; // base64
  iv: string; // base64
  ciphertext: string; // base64
  integrityHash: string; // SHA-256 hex of ciphertext + metadata
  schemaVersion: string;
  createdAt: string;
}

export interface BackupPackage {
  format: 'WAFA_FORMASSIST_BACKUP';
  schemaVersion: string;
  exportedAt: string;
  encrypted: boolean;
  checksum: string;
  payload?: VaultDataSnapshot;
  envelope?: EncryptedEnvelope;
}

export interface VaultDataSnapshot {
  profiles: ProfileRecord[];
  addresses: AddressRecord[];
  educations: EducationRecord[];
  employments: EmploymentRecord[];
  sessions: AutofillSessionRecord[];
}

export type ConnectivityState =
  | 'offline'
  | 'online'
  | 'syncing'
  | 'sync_required'
  | 'sync_failed';

export interface SyncQueueItem {
  id: string;
  idempotencyKey: string;
  entityType: 'vault_snapshot';
  operation: 'UPSERT';
  baseVersion: number;
  localVersion: number;
  createdAt: string;
  retryCount: number;
  nextRetryAt: string | null;
  lastError: string | null;
}

export interface SyncConflictRecord {
  id: string;
  detectedAt: string;
  localVersion: number;
  remoteVersion: number;
  localUpdatedAt: string;
  remoteUpdatedAt: string;
  localSummary: {profiles: number; addresses: number; educations: number; employments: number};
  remoteEnvelope: EncryptedEnvelope;
  resolved: boolean;
}

export interface AppSettings {
  language: LanguageCode;
  theme: ThemeMode;
  defaultProfileId: string | null;
  requireAutofillConfirmation: boolean;
  allowMediumConfidenceProposal: boolean;
  autoLockMinutes: number;
  saveSessionHistory: boolean;
  maskSensitiveFields: boolean;
  cloudSyncEnabled: boolean;
  autoSyncWhenOnline: boolean;
  permittedDomains: string[];
  encryptionEnabled: boolean;
  vaultSalt: string | null;
  vaultVerifier: EncryptedEnvelope | null;
  localSyncVersion: number;
  lastSyncedAt: string | null;
}
