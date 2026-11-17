import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeBackoffDelayMs,
  detectVersionConflict,
  enqueueLocalVaultChange,
  markQueueItemFailed,
  MAX_BACKOFF_MS,
  mergeVaultSnapshotsNonDestructively,
} from '../../shared/sync/sync-engine';
import {ProfileRecord, SCHEMA_VERSION, VaultDataSnapshot} from '../../shared/schemas/types';

function makeProfile(id: string, name: string, updatedAt: string, isDefault = false): ProfileRecord {
  return {
    id,
    schemaVersion: SCHEMA_VERSION,
    profileName: name,
    isDefault,
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt,
    personalInformation: {
      applicantName: name,
      applicantNameBn: '',
      fatherName: '',
      fatherNameBn: '',
      motherName: '',
      motherNameBn: '',
      dateOfBirth: '',
      nationality: 'Bangladeshi',
      religion: '',
      gender: '',
      nationalId: '',
      birthRegistration: '',
      passportId: '',
      maritalStatus: '',
      mobileNumber: '',
      confirmMobileNumber: '',
      email: '',
      quota: '',
      departmentalStatus: '',
    },
  };
}

test('enqueueLocalVaultChange coalesces offline edits while preserving earliest baseVersion', () => {
  const q1 = enqueueLocalVaultChange([], 2, 3);
  assert.equal(q1.length, 1);
  assert.equal(q1[0].baseVersion, 2);
  assert.equal(q1[0].localVersion, 3);

  const q2 = enqueueLocalVaultChange(q1, 2, 4);
  assert.equal(q2.length, 1);
  assert.equal(q2[0].baseVersion, 2);
  assert.equal(q2[0].localVersion, 4);
  assert.equal(q2[0].idempotencyKey, 'vault-v4-from-2');
});

test('computeBackoffDelayMs increases exponentially and stays capped at MAX_BACKOFF_MS', () => {
  const d0 = computeBackoffDelayMs(0);
  const d1 = computeBackoffDelayMs(1);
  const d2 = computeBackoffDelayMs(2);
  const dHigh = computeBackoffDelayMs(25);
  assert.ok(d1 > d0);
  assert.ok(d2 > d1);
  assert.equal(dHigh, MAX_BACKOFF_MS);

  const failed = markQueueItemFailed(enqueueLocalVaultChange([], 0, 1)[0], 'NETWORK_DOWN');
  assert.equal(failed.retryCount, 1);
  assert.equal(failed.lastError, 'NETWORK_DOWN');
  assert.ok(failed.nextRetryAt);
});

test('detectVersionConflict flags divergence when remote moved ahead of baseVersion', () => {
  assert.equal(detectVersionConflict({baseVersion: 2, localVersion: 3, remoteVersion: 2}), false);
  assert.equal(detectVersionConflict({baseVersion: 2, localVersion: 3, remoteVersion: 4}), true);
  assert.equal(detectVersionConflict({baseVersion: 2, localVersion: 2, remoteVersion: 4}), false);
});

test('mergeVaultSnapshotsNonDestructively merges distinct records and keeps newer timestamp per ID without duplicates', () => {
  const local: VaultDataSnapshot = {
    profiles: [
      makeProfile('p1', 'Local Newer', '2026-11-17T10:00:00.000Z', true),
      makeProfile('p2', 'Local Only', '2026-11-17T08:00:00.000Z', false),
    ],
    addresses: [],
    educations: [],
    employments: [],
    sessions: [],
  };
  const remote: VaultDataSnapshot = {
    profiles: [
      makeProfile('p1', 'Remote Older', '2026-11-17T09:00:00.000Z', true),
      makeProfile('p3', 'Remote Only', '2026-11-17T11:00:00.000Z', true),
    ],
    addresses: [],
    educations: [],
    employments: [],
    sessions: [],
  };

  const merged = mergeVaultSnapshotsNonDestructively(local, remote);
  assert.equal(merged.profiles.length, 3);
  assert.equal(merged.profiles.find((p) => p.id === 'p1')?.profileName, 'Local Newer');
  assert.ok(merged.profiles.some((p) => p.id === 'p2'));
  assert.ok(merged.profiles.some((p) => p.id === 'p3'));
  // Exactly one default profile enforced
  assert.equal(merged.profiles.filter((p) => p.isDefault).length, 1);
});
