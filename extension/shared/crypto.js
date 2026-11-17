// WAFA FormAssist Extension — Hardened Web Crypto AES-GCM-256 + PBKDF2-SHA256 Module
// OWASP 600k iterations for new encryptions; backward-compatible decryption for >=100k envelopes.

export const PBKDF2_ITERATIONS = 600000;
export const MIN_PBKDF2_ITERATIONS = 100000;
export const MAX_PBKDF2_ITERATIONS = 2000000;
export const MIN_PASSPHRASE_LENGTH = 8;
export const LEGACY_MIN_PASSPHRASE_LENGTH = 6;
export const SCHEMA_VERSION = '1.0.0';

const SALT_BYTES = 16;
const IV_BYTES = 12;
const HEX_64_RE = /^[a-f0-9]{64}$/i;

const FORBIDDEN_PLAINTEXT_KEYS = new Set([
  'profiles',
  'addresses',
  'educations',
  'employments',
  'personalInformation',
  'nationalId',
  'applicantName',
  'mobileNumber',
  'birthRegistration',
  'passportId',
  'password',
  'email',
]);

function timingSafeStringEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function generateRandomBytes(length) {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return arr;
}

export function bytesToBase64(bytes) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(b64) {
  if (typeof b64 !== 'string' || !b64.trim()) {
    throw new Error('ENVELOPE_INVALID');
  }
  const normalized = b64.trim();
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
    throw new Error('ENVELOPE_INVALID');
  }
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(normalized, 'base64'));
  }
  const binary = atob(normalized);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export async function sha256Hex(input) {
  const data = new TextEncoder().encode(String(input));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function validateEncryptedEnvelope(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;

  for (const forbidden of FORBIDDEN_PLAINTEXT_KEYS) {
    if (forbidden in obj) return false;
  }

  if (
    obj.algorithm !== 'AES-GCM' ||
    obj.keyDerivation !== 'PBKDF2-SHA256' ||
    typeof obj.iterations !== 'number' ||
    !Number.isInteger(obj.iterations) ||
    obj.iterations < MIN_PBKDF2_ITERATIONS ||
    obj.iterations > MAX_PBKDF2_ITERATIONS ||
    typeof obj.salt !== 'string' ||
    typeof obj.iv !== 'string' ||
    typeof obj.ciphertext !== 'string' ||
    typeof obj.integrityHash !== 'string' ||
    !HEX_64_RE.test(obj.integrityHash) ||
    typeof obj.schemaVersion !== 'string' ||
    obj.schemaVersion.length === 0 ||
    obj.schemaVersion.length > 32
  ) {
    return false;
  }

  try {
    const saltBytes = base64ToBytes(obj.salt);
    const ivBytes = base64ToBytes(obj.iv);
    const ctBytes = base64ToBytes(obj.ciphertext);
    if (saltBytes.byteLength < SALT_BYTES) return false;
    if (ivBytes.byteLength !== IV_BYTES) return false;
    if (ctBytes.byteLength < 17) return false;
    return true;
  } catch {
    return false;
  }
}

export async function deriveAesKey(passphrase, salt, iterations = PBKDF2_ITERATIONS, options = {}) {
  const minLen = options.allowLegacyMinLength ? LEGACY_MIN_PASSPHRASE_LENGTH : MIN_PASSPHRASE_LENGTH;
  if (typeof passphrase !== 'string' || passphrase.length < minLen) {
    throw new Error('PASSPHRASE_TOO_SHORT');
  }
  if (!Number.isInteger(iterations) || iterations < MIN_PBKDF2_ITERATIONS || iterations > MAX_PBKDF2_ITERATIONS) {
    throw new Error('ENVELOPE_INVALID');
  }
  if (!(salt instanceof Uint8Array) || salt.byteLength < SALT_BYTES) {
    throw new Error('ENVELOPE_INVALID');
  }
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    {name: 'PBKDF2'},
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {name: 'PBKDF2', salt, iterations, hash: 'SHA-256'},
    material,
    {name: 'AES-GCM', length: 256},
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function verifyEnvelopeIntegrity(envelope) {
  if (!validateEncryptedEnvelope(envelope)) {
    return false;
  }
  const expected = await sha256Hex(
    `${envelope.schemaVersion}|AES-GCM|${envelope.iterations}|${envelope.salt}|${envelope.iv}|${envelope.ciphertext}`,
  );
  return timingSafeStringEqual(expected, envelope.integrityHash.toLowerCase());
}

export async function encryptWithKey(data, key, salt, iterations = PBKDF2_ITERATIONS) {
  const iv = generateRandomBytes(IV_BYTES);
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const buf = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, encoded);
  const ciphertext = bytesToBase64(new Uint8Array(buf));
  const saltB64 = bytesToBase64(salt);
  const ivB64 = bytesToBase64(iv);
  const integrityHash = await sha256Hex(
    `${SCHEMA_VERSION}|AES-GCM|${iterations}|${saltB64}|${ivB64}|${ciphertext}`,
  );
  return {
    algorithm: 'AES-GCM',
    keyDerivation: 'PBKDF2-SHA256',
    iterations,
    salt: saltB64,
    iv: ivB64,
    ciphertext,
    integrityHash,
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
  };
}

export async function decryptWithKey(envelope, key) {
  if (!validateEncryptedEnvelope(envelope)) {
    throw new Error('ENVELOPE_INVALID');
  }
  const valid = await verifyEnvelopeIntegrity(envelope);
  if (!valid) {
    throw new Error('ENVELOPE_INTEGRITY_FAILED');
  }
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  try {
    const plainBuf = await crypto.subtle.decrypt({name: 'AES-GCM', iv}, key, ciphertext);
    return JSON.parse(new TextDecoder().decode(plainBuf));
  } catch {
    throw new Error('DECRYPTION_FAILED');
  }
}

export async function encryptEnvelope(data, passphrase) {
  const salt = generateRandomBytes(SALT_BYTES);
  const key = await deriveAesKey(passphrase, salt, PBKDF2_ITERATIONS);
  return encryptWithKey(data, key, salt, PBKDF2_ITERATIONS);
}

export async function decryptEnvelope(envelope, passphrase) {
  if (!validateEncryptedEnvelope(envelope)) {
    throw new Error('ENVELOPE_INVALID');
  }
  const valid = await verifyEnvelopeIntegrity(envelope);
  if (!valid) {
    throw new Error('ENVELOPE_INTEGRITY_FAILED');
  }
  const salt = base64ToBytes(envelope.salt);
  const key = await deriveAesKey(passphrase, salt, envelope.iterations, {
    allowLegacyMinLength: true,
  });
  return decryptWithKey(envelope, key);
}
