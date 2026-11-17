import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifySensitiveField,
  isSensitiveField,
} from '../../shared/security/sensitive-fields';
import {
  classifySensitiveField as extClassifySensitiveField,
  isSensitiveField as extIsSensitiveField,
} from '../../extension/shared/sensitive-fields.js';

test('independent sensitive-field classifier blocks passwords, OTP/2FA, CAPTCHA, payment, tokens, recovery, and file uploads', () => {
  const sensitiveCases: Array<{
    desc: string;
    field: Record<string, string>;
    expectedCategory: string;
  }> = [
    {desc: 'type=password', field: {inputType: 'password', name: 'login_pass'}, expectedCategory: 'password'},
    {desc: 'autocomplete=current-password', field: {inputType: 'text', autocomplete: 'current-password', name: 'f1'}, expectedCategory: 'password'},
    {desc: 'Bangla password label', field: {inputType: 'text', label: 'পাসওয়ার্ড দিন'}, expectedCategory: 'password'},
    {desc: 'bKash PIN', field: {inputType: 'text', label: 'bKash PIN'}, expectedCategory: 'password'},
    {desc: 'autocomplete=one-time-code', field: {inputType: 'text', autocomplete: 'one-time-code', name: 'code'}, expectedCategory: 'otp'},
    {desc: 'OTP code', field: {inputType: 'text', name: 'otp_code', label: 'OTP Verification Code'}, expectedCategory: 'otp'},
    {desc: '2FA TOTP', field: {inputType: 'text', label: 'Enter 2FA TOTP Code'}, expectedCategory: 'otp'},
    {desc: 'Bangla OTP', field: {inputType: 'text', label: 'ওটিপি কোড'}, expectedCategory: 'otp'},
    {desc: 'CAPTCHA input', field: {inputType: 'text', name: 'captcha_code', label: 'Validation Code'}, expectedCategory: 'captcha'},
    {desc: 'Turnstile/reCAPTCHA', field: {inputType: 'text', name: 'cf_turnstile_response', id: 'recaptcha'}, expectedCategory: 'captcha'},
    {desc: 'Bangla CAPTCHA', field: {inputType: 'text', label: 'নিরাপত্তা কোড (ক্যাপচা)'}, expectedCategory: 'captcha'},
    {desc: 'Credit card autocomplete', field: {inputType: 'text', autocomplete: 'cc-number', name: 'card'}, expectedCategory: 'payment'},
    {desc: 'CVV input', field: {inputType: 'text', name: 'card_cvv', label: 'CVV'}, expectedCategory: 'payment'},
    {desc: 'Nagad Trx ID', field: {inputType: 'text', label: 'Nagad Transaction ID'}, expectedCategory: 'payment'},
    {desc: 'CSRF token', field: {inputType: 'text', name: 'csrf_token'}, expectedCategory: 'token'},
    {desc: 'API key', field: {inputType: 'text', label: 'API Key'}, expectedCategory: 'token'},
    {desc: 'Recovery backup code', field: {inputType: 'text', label: 'Backup Code'}, expectedCategory: 'recovery'},
    {desc: 'File upload', field: {inputType: 'file', name: 'photo_upload', label: 'Applicant Photo'}, expectedCategory: 'file'},
  ];

  for (const tc of sensitiveCases) {
    const sharedRes = classifySensitiveField(tc.field);
    const extRes = extClassifySensitiveField(tc.field);
    assert.equal(sharedRes.sensitive, true, `Shared classifier must block ${tc.desc}`);
    assert.equal(sharedRes.category, tc.expectedCategory, `Shared category mismatch for ${tc.desc}`);
    assert.equal(extRes.sensitive, true, `Extension classifier must block ${tc.desc}`);
    assert.equal(extRes.category, tc.expectedCategory, `Extension category mismatch for ${tc.desc}`);
  }
});

test('sensitive-field classifier has zero false positives on legitimate recruitment fields', () => {
  const safeCases = [
    {inputType: 'text', id: 'national_id', name: 'national_id', label: 'National ID'},
    {inputType: 'text', id: 'birth_registration', name: 'birth_registration', label: 'Birth Registration'},
    {inputType: 'text', id: 'passport_id', name: 'passport_id', label: 'Passport ID'},
    {inputType: 'text', id: 'present_postcode', name: 'present_postcode', label: 'Post Code'},
    {inputType: 'text', id: 'ssc_roll', name: 'ssc_roll', label: 'SSC Roll Number'},
    {inputType: 'tel', id: 'mobile_number', name: 'mobile_number', label: 'Mobile Number'},
    {inputType: 'tel', id: 'confirm_mobile_number', name: 'confirm_mobile_number', label: 'Confirm Mobile Number'},
    {inputType: 'email', id: 'email', name: 'email', label: 'Email Address'},
    {inputType: 'text', id: 'applicant_name', name: 'applicant_name', label: "Applicant's Name"},
    {inputType: 'text', id: 'dob', name: 'dob', label: 'Date of Birth (DD/MM/YYYY)'},
  ];

  for (const field of safeCases) {
    assert.equal(isSensitiveField(field), false, `Shared false positive on ${field.name}`);
    assert.equal(extIsSensitiveField(field), false, `Extension false positive on ${field.name}`);
  }
});
