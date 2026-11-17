import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decryptJsonWithPassphrase,
  encryptJsonWithPassphrase,
  maskSensitiveValue,
  verifyEnvelopeIntegrity,
} from '../../shared/security/crypto';

test('AES-GCM-256 + PBKDF2 encrypt/decrypt round-trip succeeds with unique salt & IV per call', async () => {
  const payload = {applicantName: 'Rahim', nationalId: '1234567890', profiles: [1, 2]};
  const env1 = await encryptJsonWithPassphrase(payload, 'StrongPass!2026');
  const env2 = await encryptJsonWithPassphrase(payload, 'StrongPass!2026');

  assert.equal(env1.algorithm, 'AES-GCM');
  assert.equal(env1.keyDerivation, 'PBKDF2-SHA256');
  assert.notEqual(env1.salt, env2.salt, 'Salt must be freshly randomized');
  assert.notEqual(env1.iv, env2.iv, 'IV must be freshly randomized');
  assert.notEqual(env1.ciphertext, env2.ciphertext);
  assert.equal(await verifyEnvelopeIntegrity(env1), true);

  const decrypted = await decryptJsonWithPassphrase<typeof payload>(env1, 'StrongPass!2026');
  assert.deepEqual(decrypted, payload);
});

test('wrong passphrase and tampered ciphertext/integrity hash are rejected cleanly', async () => {
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
});

test('maskSensitiveValue hides prefixes while preserving trailing digits', () => {
  assert.equal(maskSensitiveValue('19982691234567890', 4), '••••••••••7890');
  assert.equal(maskSensitiveValue('1234', 4), '••••');
  assert.equal(maskSensitiveValue(''), '—');
});
