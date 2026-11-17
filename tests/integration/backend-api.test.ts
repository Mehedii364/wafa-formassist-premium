import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {AddressInfo} from 'node:net';
import {createCloudApiRouter} from '../../backend/src/routes';
import {CloudStore} from '../../backend/src/store';
import {encryptJsonWithPassphrase} from '../../shared/security/crypto';

test('optional cloud backend enforces AES-GCM zero-knowledge sync, idempotency, 409 conflict preservation, extension zip download, and deletion', async () => {
  const tmpFile = path.join(os.tmpdir(), `wafa-test-cloud-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  const store = new CloudStore(tmpFile);
  const app = express();
  app.use('/api/v1', createCloudApiRouter(store));

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = (server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}/api/v1`;

  try {
    // 1. Health check
    const healthRes = await fetch(`${base}/health`);
    assert.equal(healthRes.status, 200);
    const health = await healthRes.json();
    assert.equal(health.status, 'ok');
    assert.equal(health.zeroKnowledgeEncryptionRequired, true);

    // 2. Register optional cloud account
    const regRes = await fetch(`${base}/auth/register`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: 'tester@wafa.local', password: 'Password#2026'}),
    });
    assert.equal(regRes.status, 201);
    const regData = await regRes.json();
    assert.ok(regData.sessionToken);
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${regData.sessionToken}`,
    };

    // 3. Reject plaintext / unencrypted sync payload strictly
    const badPushRes = await fetch(`${base}/sync/push`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        baseVersion: 0,
        idempotencyKey: 'key-bad-1',
        envelope: {profiles: [{nationalId: '1234567890'}]},
      }),
    });
    assert.equal(badPushRes.status, 400);
    const badPush = await badPushRes.json();
    assert.equal(badPush.error, 'CLIENT_ENCRYPTION_REQUIRED');

    // 4. Accept genuine client-side AES-GCM encrypted push
    const env1 = await encryptJsonWithPassphrase({profiles: [{id: 'p1'}]}, 'VaultPass!2026');
    const push1Res = await fetch(`${base}/sync/push`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        baseVersion: 0,
        idempotencyKey: 'idem-push-1',
        envelope: env1,
      }),
    });
    assert.equal(push1Res.status, 200);
    const push1 = await push1Res.json();
    assert.equal(push1.version, 1);

    // 5. Idempotent replay returns same version without incrementing
    const replayRes = await fetch(`${base}/sync/push`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        baseVersion: 0,
        idempotencyKey: 'idem-push-1',
        envelope: env1,
      }),
    });
    assert.equal(replayRes.status, 200);
    const replay = await replayRes.json();
    assert.equal(replay.idempotentReplay, true);
    assert.equal(replay.version, 1);

    // 6. Stale baseVersion triggers 409 SYNC_CONFLICT and returns remoteEnvelope without overwriting
    const env2 = await encryptJsonWithPassphrase({profiles: [{id: 'p2'}]}, 'VaultPass!2026');
    const conflictRes = await fetch(`${base}/sync/push`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        baseVersion: 0,
        idempotencyKey: 'idem-push-conflict',
        envelope: env2,
      }),
    });
    assert.equal(conflictRes.status, 409);
    const conflict = await conflictRes.json();
    assert.equal(conflict.error, 'SYNC_CONFLICT');
    assert.equal(conflict.remoteVersion, 1);
    assert.equal(conflict.remoteEnvelope.integrityHash, env1.integrityHash);

    // 7. Encrypted cloud backup create + list + delete
    const bCreate = await fetch(`${base}/backups`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({label: 'Test Cloud Backup', envelope: env1}),
    });
    assert.equal(bCreate.status, 201);
    const createdBackup = (await bCreate.json()).backup;

    const bList = await fetch(`${base}/backups`, {headers: authHeaders});
    assert.equal(bList.status, 200);
    assert.equal((await bList.json()).backups.length, 1);

    const bDel = await fetch(`${base}/backups/${createdBackup.id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    assert.equal(bDel.status, 200);

    // 8. Reproducible Chrome/Edge extension ZIP download returns valid PKZIP header
    const zipRes = await fetch(`${base}/extension/download`);
    assert.equal(zipRes.status, 200);
    assert.equal(zipRes.headers.get('content-type'), 'application/zip');
    const zipBytes = new Uint8Array(await zipRes.arrayBuffer());
    assert.equal(zipBytes[0], 0x50); // 'P'
    assert.equal(zipBytes[1], 0x4b); // 'K'

    // 9. Account & cloud data deletion removes account and invalidates session
    const delAcc = await fetch(`${base}/account`, {method: 'DELETE', headers: authHeaders});
    assert.equal(delAcc.status, 200);

    const afterDel = await fetch(`${base}/auth/me`, {headers: authHeaders});
    assert.equal(afterDel.status, 401);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
});
