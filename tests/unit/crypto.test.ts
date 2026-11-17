import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_PASSPHRASE_LENGTH,
  PBKDF2_ITERATIONS,
  decryptJsonWithPassphrase,
  deriveAesKey,
  encryptJsonWithKey,
  encryptJsonWithPassphrase,
  generateRandomBytes,
  maskSensitiveValue,
  validateEncryptedEnvelope,
  verifyEnvelopeIntegrity,
} from '../../shared/security/crypto';

test('AES-GCM-256 + PBKDF2-SHA256 (600,000 iterations) round-trip uses unique salt & IV per call', async () => {
  const payload = {applicantName: 'Rahim', nationalId: '1234567890', profiles: [1, 2]};
  const env1 = await encryptJsonWithPassphrase(payload, 'StrongPass!2026');
  const env2 = await encryptJsonWithPassphrase(payload, 'StrongPass!2026');

  assert.equal(env1.algorithm, 'AES-GCM');
  assert.equal(env1.keyDerivation, 'PBKDF2-SHA256');
  assert.equal(env1.iterations, PBKDF2_ITERATIONS);
  assert.equal(env1.iterations, 600000);
  assert.notEqual(env1.salt, env2.salt, 'Salt must be freshly randomized');
  assert.notEqual(env1.iv, env2.iv, 'IV must be freshly randomized');
  assert.notEqual(env1.ciphertext, env2.ciphertext);
  assert.equal(validateEncryptedEnvelope(env1), true);
  assert.equal(await verifyEnvelopeIntegrity(env1), true);

  const decrypted = await decryptJsonWithPassphrase<typeof payload>(env1, 'StrongPass!2026');
  assert.deepEqual(decrypted, payload);
});

test('new encryptions enforce minimum passphrase length while legacy 310k envelopes remain decryptable', async () => {
  assert.equal(MIN_PASSPHRASE_LENGTH, 8);
  await assert.rejects(
    () => encryptJsonWithPassphrase({secret: 'short'}, '1234567'),
    /PASSPHRASE_TOO_SHORT/,
  );

  // Backward-compatibility check: decrypt an envelope produced with legacy 310,000 iterations & 6-char passphrase
  const salt = generateRandomBytes(16);
  const iv = generateRandomBytes(12);
  const legacyKey = await deriveAesKey('abc123', salt, 310000, {allowLegacyMinLength: true});
  const legacyEnv = await encryptJsonWithKey({migrated: true}, legacyKey, salt, iv, 310000);
  assert.equal(legacyEnv.iterations, 310000);
  assert.equal(validateEncryptedEnvelope(legacyEnv), true);

  const decrypted = await decryptJsonWithPassphrase<{migrated: boolean}>(legacyEnv, 'abc123');
  assert.deepEqual(decrypted, {migrated: true});
});

test('wrong passphrase, tampered ciphertext, and invalid/plaintext envelopes are strictly rejected', async () => {
  const env = await encryptJsonWithPassphrase({secret: 'BD-NID-999'}, 'CorrectPass#1');

  await assert.rejects(
    () => decryptJsonWithPassphrase(env, 'WrongPass#999'),
    /DECRYPTION_FAILED/,
  );

  const tampered = {...env, ciphertext: env.ciphertext.slice(0, -2) + 'AA'};
  assert.equal(await verifyEnvelopeIntegrity(tampered), false);
  await assert.rejects(
    () => decryptJsonWithPassphrase(tampered, 'CorrectPass#1'),
    /ENVELOPE_INTEGRITY_FAILED/,
  );

  // Reject envelope containing accidental plaintext PII key
  assert.equal(validateEncryptedEnvelope({...env, nationalId: '1234567890'}), false);
  assert.equal(validateEncryptedEnvelope({...env, profiles: []}), false);
  // Reject malformed IV length / low iterations
  assert.equal(validateEncryptedEnvelope({...env, iv: 'AAAA'}), false);
  assert.equal(validateEncryptedEnvelope({...env, iterations: 50000}), false);
  assert.equal(validateEncryptedEnvelope({...env, integrityHash: 'not-a-sha256'}), false);
});

test('maskSensitiveValue hides prefixes while preserving trailing digits', () => {
  assert.equal(maskSensitiveValue('19982691234567890', 4), '••••••••••7890');
  assert.equal(maskSensitiveValue('1234', 4), '••••');
  assert.equal(maskSensitiveValue(''), '—');
});
