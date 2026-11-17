import {EncryptedEnvelope, SCHEMA_VERSION} from '../schemas/types';

// OWASP 2023+ recommended PBKDF2-HMAC-SHA256 work factor for new encryptions
export const PBKDF2_ITERATIONS = 600000;
export const MIN_PBKDF2_ITERATIONS = 100000;
export const MAX_PBKDF2_ITERATIONS = 2000000;
export const MIN_PASSPHRASE_LENGTH = 8;
export const LEGACY_MIN_PASSPHRASE_LENGTH = 6;
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

function getSubtle(): SubtleCrypto {
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error('WEB_CRYPTO_UNAVAILABLE');
  }
  return globalThis.crypto.subtle;
}

function timingSafeStringEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  if (typeof b64 !== 'string' || !b64.trim()) {
    throw new Error('ENVELOPE_INVALID');
  }
  if (typeof Buffer !== 'undefined') {
    const normalized = b64.trim();
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
      throw new Error('ENVELOPE_INVALID');
    }
    return new Uint8Array(Buffer.from(normalized, 'base64'));
  }
  const binary = atob(b64.trim());
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function generateRandomBytes(length: number): Uint8Array {
  const arr = new Uint8Array(length);
  globalThis.crypto.getRandomValues(arr);
  return arr;
}

export async function sha256Hex(input: string): Promise<string> {
  const subtle = getSubtle();
  const data = new TextEncoder().encode(input);
  const digest = await subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function validateEncryptedEnvelope(obj: unknown): obj is EncryptedEnvelope {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const e = obj as Record<string, unknown>;

  for (const forbidden of FORBIDDEN_PLAINTEXT_KEYS) {
    if (forbidden in e) return false;
  }

  if (
    e.algorithm !== 'AES-GCM' ||
    e.keyDerivation !== 'PBKDF2-SHA256' ||
    typeof e.iterations !== 'number' ||
    !Number.isInteger(e.iterations) ||
    e.iterations < MIN_PBKDF2_ITERATIONS ||
    e.iterations > MAX_PBKDF2_ITERATIONS ||
    typeof e.salt !== 'string' ||
    typeof e.iv !== 'string' ||
    typeof e.ciphertext !== 'string' ||
    typeof e.integrityHash !== 'string' ||
    !HEX_64_RE.test(e.integrityHash) ||
    typeof e.schemaVersion !== 'string' ||
    e.schemaVersion.length === 0 ||
    e.schemaVersion.length > 32
  ) {
    return false;
  }

  try {
    const saltBytes = base64ToBytes(e.salt);
    const ivBytes = base64ToBytes(e.iv);
    const ctBytes = base64ToBytes(e.ciphertext);
    // AES-GCM requires 12-byte IV, salt >= 16 bytes, ciphertext >= 16-byte auth tag + >= 1 byte
    if (saltBytes.byteLength < SALT_BYTES) return false;
    if (ivBytes.byteLength !== IV_BYTES) return false;
    if (ctBytes.byteLength < 17) return false;
    return true;
  } catch {
    return false;
  }
}

export async function deriveAesKey(
  passphrase: string,
  salt: Uint8Array,
  iterations = PBKDF2_ITERATIONS,
  options?: {allowLegacyMinLength?: boolean},
): Promise<CryptoKey> {
  const minLen = options?.allowLegacyMinLength ? LEGACY_MIN_PASSPHRASE_LENGTH : MIN_PASSPHRASE_LENGTH;
  if (typeof passphrase !== 'string' || passphrase.length < minLen) {
    throw new Error('PASSPHRASE_TOO_SHORT');
  }
  if (!Number.isInteger(iterations) || iterations < MIN_PBKDF2_ITERATIONS || iterations > MAX_PBKDF2_ITERATIONS) {
    throw new Error('ENVELOPE_INVALID');
  }
  if (!(salt instanceof Uint8Array) || salt.byteLength < SALT_BYTES) {
    throw new Error('ENVELOPE_INVALID');
  }
  const subtle = getSubtle();
  const keyMaterial = await subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    {name: 'PBKDF2'},
    false,
    ['deriveKey'],
  );
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    {name: 'AES-GCM', length: 256},
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptJsonWithPassphrase(
  data: unknown,
  passphrase: string,
  existingSalt?: Uint8Array,
): Promise<EncryptedEnvelope> {
  const salt = existingSalt ? new Uint8Array(existingSalt) : generateRandomBytes(SALT_BYTES);
  const iv = generateRandomBytes(IV_BYTES);
  const key = await deriveAesKey(passphrase, salt, PBKDF2_ITERATIONS);
  return encryptJsonWithKey(data, key, salt, iv, PBKDF2_ITERATIONS);
}

export async function encryptJsonWithKey(
  data: unknown,
  key: CryptoKey,
  salt: Uint8Array,
  iv: Uint8Array = generateRandomBytes(IV_BYTES),
  iterations = PBKDF2_ITERATIONS,
): Promise<EncryptedEnvelope> {
  const subtle = getSubtle();
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const encryptedBuffer = await subtle.encrypt(
    {name: 'AES-GCM', iv: iv as BufferSource},
    key,
    plaintext,
  );
  const ciphertext = bytesToBase64(new Uint8Array(encryptedBuffer));
  const saltB64 = bytesToBase64(salt);
  const ivB64 = bytesToBase64(iv);
  const createdAt = new Date().toISOString();
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
    createdAt,
  };
}

export async function verifyEnvelopeIntegrity(envelope: EncryptedEnvelope): Promise<boolean> {
  if (!validateEncryptedEnvelope(envelope)) {
    return false;
  }
  const expected = await sha256Hex(
    `${envelope.schemaVersion}|AES-GCM|${envelope.iterations}|${envelope.salt}|${envelope.iv}|${envelope.ciphertext}`,
  );
  return timingSafeStringEqual(expected, envelope.integrityHash.toLowerCase());
}

export async function decryptJsonWithKey<T>(
  envelope: EncryptedEnvelope,
  key: CryptoKey,
): Promise<T> {
  if (!validateEncryptedEnvelope(envelope)) {
    throw new Error('ENVELOPE_INVALID');
  }
  const validIntegrity = await verifyEnvelopeIntegrity(envelope);
  if (!validIntegrity) {
    throw new Error('ENVELOPE_INTEGRITY_FAILED');
  }
  const subtle = getSubtle();
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  try {
    const plainBuffer = await subtle.decrypt(
      {name: 'AES-GCM', iv: iv as BufferSource},
      key,
      ciphertext as BufferSource,
    );
    const jsonStr = new TextDecoder().decode(plainBuffer);
    return JSON.parse(jsonStr) as T;
  } catch {
    throw new Error('DECRYPTION_FAILED');
  }
}

export async function decryptJsonWithPassphrase<T>(
  envelope: EncryptedEnvelope,
  passphrase: string,
): Promise<T> {
  if (!validateEncryptedEnvelope(envelope)) {
    throw new Error('ENVELOPE_INVALID');
  }
  const validIntegrity = await verifyEnvelopeIntegrity(envelope);
  if (!validIntegrity) {
    throw new Error('ENVELOPE_INTEGRITY_FAILED');
  }
  const salt = base64ToBytes(envelope.salt);
  const key = await deriveAesKey(passphrase, salt, envelope.iterations, {
    allowLegacyMinLength: true,
  });
  return decryptJsonWithKey<T>(envelope, key);
}

/** Masks sensitive identifier values for safe UI display without altering stored values */
export function maskSensitiveValue(value: string, visibleTail = 4): string {
  if (!value) return '—';
  const trimmed = value.trim();
  if (trimmed.length <= visibleTail) return '•'.repeat(trimmed.length);
  return `${'•'.repeat(Math.min(10, trimmed.length - visibleTail))}${trimmed.slice(-visibleTail)}`;
}
