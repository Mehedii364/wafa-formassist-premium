export type SensitiveFieldCategory =
  | 'password'
  | 'otp'
  | 'captcha'
  | 'payment'
  | 'token'
  | 'recovery'
  | 'file';

export interface SensitiveFieldCandidate {
  tagName?: string;
  inputType?: string;
  autocomplete?: string;
  name?: string;
  id?: string;
  label?: string;
  placeholder?: string;
  ariaLabel?: string;
  describedBy?: string;
}

export interface SensitiveFieldDecision {
  sensitive: boolean;
  category: SensitiveFieldCategory | null;
  reason: string;
}

// Explicit legitimate government recruitment identifiers that must never be false-positived
// as payment/token/pin/code controls unless their inputType or autocomplete says otherwise.
const SAFE_EXACT_IDENTIFIERS = new Set([
  'nid',
  'national_id',
  'nid_no',
  'nationalid',
  'breg',
  'birth_reg',
  'birth_registration',
  'breg_no',
  'passport',
  'passport_id',
  'passport_no',
  'post_code',
  'postcode',
  'postal_code',
  'present_postcode',
  'permanent_postcode',
  'present_pcode',
  'permanent_pcode',
  'roll',
  'roll1',
  'roll2',
  'ssc_roll',
  'hsc_roll',
  'registration_number',
  'reg_no',
  'mobile',
  'mobile_number',
  'confirm_mobile',
  'confirm_mobile_number',
  'email',
  'email_address',
]);

function normalizeToken(value?: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[_\-./:[\]()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAnyPattern(haystack: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(haystack));
}

const PASSWORD_PATTERNS = [
  /\bpassword\b/,
  /\bpasswd\b/,
  /\bpwd\b/,
  /\bpassphrase\b/,
  /\bpasscode\b/,
  /\bsecret\s*pin\b/,
  /\baccount\s*pin\b/,
  /\bwallet\s*pin\b/,
  /\bmobile\s*pin\b/,
  /\bbkash\s*pin\b/,
  /\bnagad\s*pin\b/,
  /\brocket\s*pin\b/,
  /\bmpin\b/,
  /\btpin\b/,
  /\bpin\s*code\b/,
  /\bpin\s*number\b/,
  /পাসওয়ার্ড/,
  /পিন\s*নম্বর/,
];

const OTP_PATTERNS = [
  /\botp\b/,
  /\bone\s*time\s*(?:pass|password|code|pin)\b/,
  /\b2fa\b/,
  /\bmfa\b/,
  /\btotp\b/,
  /\bauth(?:entication)?\s*code\b/,
  /\bverification\s*code\b/,
  /\bsms\s*code\b/,
  /\bverify\s*code\b/,
  /\bconfirm(?:ation)?\s*code\b/,
  /ওটিপি/,
  /ভেরিফিকেশন\s*কোড/,
  /যাচাইকরণ\s*কোড/,
];

const CAPTCHA_PATTERNS = [
  /\bcaptcha\b/,
  /\brecaptcha\b/,
  /\bhcaptcha\b/,
  /\bturnstile\b/,
  /\bsecurity\s*code\b/,
  /\bvalidation\s*code\b/,
  /\bimage\s*code\b/,
  /\bhuman\s*verification\b/,
  /ক্যাপচা/,
  /নিরাপত্তা\s*কোড/,
];

const PAYMENT_PATTERNS = [
  /\bcredit\s*card\b/,
  /\bdebit\s*card\b/,
  /\bcard\s*number\b/,
  /\bcard\s*no\b/,
  /\bcardholder\b/,
  /\bcvv\b/,
  /\bcvv2\b/,
  /\bcvc\b/,
  /\bcvc2\b/,
  /\bcard\s*security\b/,
  /\bcard\s*exp(?:iry|iration)?\b/,
  /\bexp(?:iry|iration)?\s*(?:date|month|year)\b/,
  /\bcc\s*(?:num|number|exp|cvc|cvv|csc|name)\b/,
  /\bpan\s*number\b/,
  /\biban\b/,
  /\bbank\s*account\b/,
  /\brouting\s*number\b/,
  /\bbkash\s*(?:number|account|trx|transaction)\b/,
  /\bnagad\s*(?:number|account|trx|transaction)\b/,
  /\brocket\s*(?:number|account|trx|transaction)\b/,
  /\bpayment\s*(?:method|card|pin|ref|trx|token)\b/,
  /\btrx\s*id\b/,
  /\btransaction\s*id\b/,
  /কার্ড\s*নম্বর/,
  /পেমেন্ট/,
];

const TOKEN_PATTERNS = [
  /\bcsrf\b/,
  /\bxsrf\b/,
  /\bjwt\b/,
  /\bbearer\b/,
  /\baccess\s*token\b/,
  /\brefresh\s*token\b/,
  /\bid\s*token\b/,
  /\bsession\s*token\b/,
  /\bauth\s*token\b/,
  /\bapi\s*key\b/,
  /\bapikey\b/,
  /\bclient\s*secret\b/,
  /\bprivate\s*key\b/,
  /\bsecret\s*key\b/,
  /\boauth\s*token\b/,
  /\bwebhook\s*secret\b/,
];

const RECOVERY_PATTERNS = [
  /\brecovery\s*(?:code|key|phrase|token)\b/,
  /\bbackup\s*code\b/,
  /\bseed\s*phrase\b/,
  /\bmnemonic\b/,
  /\bsecurity\s*(?:question|answer)\b/,
  /\bsecret\s*(?:question|answer)\b/,
];

/**
 * Independent classifier enforced in form scanning, field mapping, AND autofill execution.
 * Any field classified as sensitive is never captured, stored, mapped, or filled.
 */
export function classifySensitiveField(field: SensitiveFieldCandidate): SensitiveFieldDecision {
  const inputType = String(field.inputType || '').trim().toLowerCase();
  const autocomplete = String(field.autocomplete || '').trim().toLowerCase();
  const rawName = String(field.name || '').trim().toLowerCase();
  const rawId = String(field.id || '').trim().toLowerCase();

  // 1. Unconditional control-type boundaries
  if (inputType === 'password') {
    return {sensitive: true, category: 'password', reason: 'Password input is strictly excluded.'};
  }
  if (inputType === 'file') {
    return {sensitive: true, category: 'file', reason: 'File upload input is strictly excluded.'};
  }

  // 2. Unconditional HTML autocomplete boundaries
  if (autocomplete.includes('password') || autocomplete === 'new-password' || autocomplete === 'current-password') {
    return {sensitive: true, category: 'password', reason: 'Password autocomplete control is strictly excluded.'};
  }
  if (autocomplete === 'one-time-code') {
    return {sensitive: true, category: 'otp', reason: 'One-time code (OTP/2FA) control is strictly excluded.'};
  }
  if (autocomplete.split(/\s+/).some((tok) => tok.startsWith('cc-'))) {
    return {sensitive: true, category: 'payment', reason: 'Payment card control is strictly excluded.'};
  }

  // 3. Explicit safe-identifier check when no sensitive inputType/autocomplete was set
  const idOnlyNorm = rawId.replace(/^sim_/, '');
  const nameOnlyNorm = rawName.replace(/^sim_/, '');
  const combinedText = normalizeToken(
    `${field.name || ''} ${field.id || ''} ${field.label || ''} ${field.placeholder || ''} ${field.ariaLabel || ''} ${field.describedBy || ''}`,
  );

  // Even for safe identifiers, still reject if label/placeholder explicitly declares captcha/otp/password/card/cvv
  if (hasAnyPattern(combinedText, CAPTCHA_PATTERNS)) {
    return {sensitive: true, category: 'captcha', reason: 'CAPTCHA / security validation code is strictly excluded.'};
  }
  if (hasAnyPattern(combinedText, OTP_PATTERNS)) {
    return {sensitive: true, category: 'otp', reason: 'OTP / 2FA verification control is strictly excluded.'};
  }
  if (hasAnyPattern(combinedText, PASSWORD_PATTERNS)) {
    return {sensitive: true, category: 'password', reason: 'Password / secret PIN control is strictly excluded.'};
  }
  if (hasAnyPattern(combinedText, PAYMENT_PATTERNS)) {
    return {sensitive: true, category: 'payment', reason: 'Payment / banking card control is strictly excluded.'};
  }
  if (hasAnyPattern(combinedText, TOKEN_PATTERNS)) {
    return {sensitive: true, category: 'token', reason: 'Authentication / API token control is strictly excluded.'};
  }
  if (hasAnyPattern(combinedText, RECOVERY_PATTERNS)) {
    return {sensitive: true, category: 'recovery', reason: 'Account recovery / backup code control is strictly excluded.'};
  }

  // Standalone "pin" check (guarding against safe IDs)
  if (!SAFE_EXACT_IDENTIFIERS.has(nameOnlyNorm) && !SAFE_EXACT_IDENTIFIERS.has(idOnlyNorm)) {
    if (/^(?:pin|user\s*pin|login\s*pin)$/.test(normalizeToken(field.name || field.id || field.label))) {
      return {sensitive: true, category: 'password', reason: 'PIN control is strictly excluded.'};
    }
  }

  return {sensitive: false, category: null, reason: ''};
}

export function isSensitiveField(field: SensitiveFieldCandidate): boolean {
  return classifySensitiveField(field).sensitive;
}
