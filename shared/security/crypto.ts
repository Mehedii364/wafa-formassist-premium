import {EncryptedEnvelope, SCHEMA_VERSION} from '../schemas/types';

export const PBKDF2_ITERATIONS = 310000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function getSubtle(): SubtleCrypto {
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error('WEB_CRYPTO_UNAVAILABLE');
  }
  return globalThis.crypto.subtle;
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
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const binary = atob(b64);
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

export async function deriveAesKey(
  passphrase: string,
  salt: Uint8Array,
  iterations = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  if (!passphrase || passphrase.length < 6) {
    throw new Error('PASSPHRASE_TOO_SHORT');
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
  if (
    !envelope ||
    envelope.algorithm !== 'AES-GCM' ||
    envelope.keyDerivation !== 'PBKDF2-SHA256' ||
    !envelope.salt ||
    !envelope.iv ||
    !envelope.ciphertext ||
    !envelope.integrityHash
  ) {
    return false;
  }
  const expected = await sha256Hex(
    `${envelope.schemaVersion}|AES-GCM|${envelope.iterations}|${envelope.salt}|${envelope.iv}|${envelope.ciphertext}`,
  );
  return expected === envelope.integrityHash;
}

export async function decryptJsonWithKey<T>(
  envelope: EncryptedEnvelope,
  key: CryptoKey,
): Promise<T> {
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
  const validIntegrity = await verifyEnvelopeIntegrity(envelope);
  if (!validIntegrity) {
    throw new Error('ENVELOPE_INTEGRITY_FAILED');
  }
  const salt = base64ToBytes(envelope.salt);
  const key = await deriveAesKey(passphrase, salt, envelope.iterations || PBKDF2_ITERATIONS);
  return decryptJsonWithKey<T>(envelope, key);
}

/** Masks sensitive identifier values for safe UI display without altering stored values */
export function maskSensitiveValue(value: string, visibleTail = 4): string {
  if (!value) return '—';
  const trimmed = value.trim();
  if (trimmed.length <= visibleTail) return '•'.repeat(trimmed.length);
  return `${'•'.repeat(Math.min(10, trimmed.length - visibleTail))}${trimmed.slice(-visibleTail)}`;
}
