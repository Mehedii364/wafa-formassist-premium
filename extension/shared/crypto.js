// WAFA FormAssist Extension — Shared Web Crypto AES-GCM-256 + PBKDF2-SHA256 Module
// Matches Dashboard data contract (schemaVersion 1.0.0) without storing plaintext keys.

export const PBKDF2_ITERATIONS = 310000;
export const SCHEMA_VERSION = '1.0.0';

export function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(b64) {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function deriveAesKey(passphrase, salt, iterations = PBKDF2_ITERATIONS) {
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
  if (!envelope || envelope.algorithm !== 'AES-GCM' || envelope.keyDerivation !== 'PBKDF2-SHA256') {
    return false;
  }
  const expected = await sha256Hex(
    `${envelope.schemaVersion}|AES-GCM|${envelope.iterations}|${envelope.salt}|${envelope.iv}|${envelope.ciphertext}`,
  );
  return expected === envelope.integrityHash;
}

export async function decryptEnvelope(envelope, passphrase) {
  const valid = await verifyEnvelopeIntegrity(envelope);
  if (!valid) {
    throw new Error('BACKUP_INTEGRITY_FAILED');
  }
  const salt = base64ToBytes(envelope.salt);
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  const key = await deriveAesKey(passphrase, salt, envelope.iterations || PBKDF2_ITERATIONS);
  const plainBuf = await crypto.subtle.decrypt({name: 'AES-GCM', iv}, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plainBuf));
}

export async function encryptEnvelope(data, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt, PBKDF2_ITERATIONS);
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const buf = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, encoded);
  const ciphertext = bytesToBase64(new Uint8Array(buf));
  const saltB64 = bytesToBase64(salt);
  const ivB64 = bytesToBase64(iv);
  const integrityHash = await sha256Hex(
    `${SCHEMA_VERSION}|AES-GCM|${PBKDF2_ITERATIONS}|${saltB64}|${ivB64}|${ciphertext}`,
  );
  return {
    algorithm: 'AES-GCM',
    keyDerivation: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    salt: saltB64,
    iv: ivB64,
    ciphertext,
    integrityHash,
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
  };
}
