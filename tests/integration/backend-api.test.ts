import test from 'node:test';
import assert from 'node:assert/strict';
import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {AddressInfo} from 'node:net';
import {createCloudApiRouter} from '../../backend/src/routes';
import {CloudStore} from '../../backend/src/store';
import {PostgresCloudStore} from '../../backend/src/postgres-store';
import {isPostgresConfigured} from '../../src/db/index.ts';
import {encryptJsonWithPassphrase} from '../../shared/security/crypto';

function extractCookieJar(res: Response): {cookieHeader: string; sessionCookie: string; csrfCookie: string; rawSetCookies: string[]} {
  const rawSetCookies =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : [res.headers.get('set-cookie') || ''].filter(Boolean);

  let sessionCookie = '';
  let csrfCookie = '';
  for (const sc of rawSetCookies) {
    const pair = sc.split(';')[0] || '';
    if (pair.startsWith('wafa_session=')) sessionCookie = pair;
    if (pair.startsWith('wafa_csrf=')) csrfCookie = pair;
  }
  const cookieHeader = [sessionCookie, csrfCookie].filter(Boolean).join('; ');
  return {cookieHeader, sessionCookie, csrfCookie, rawSetCookies};
}

test('hardened cloud backend enforces HttpOnly cookies, CSRF protection, anti-enumeration, idle timeout, Firebase Auth exchange, zero-knowledge sync, and rate limiting', async () => {
  const tmpFile = path.join(os.tmpdir(), `wafa-test-cloud-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  const store = new CloudStore(tmpFile);
  const app = express();
  app.use(
    '/api/v1',
    createCloudApiRouter(store, {
      authRateLimitMax: 15,
      verifyFirebaseIdToken: async (token) => {
        if (token === 'valid-firebase-id-token-1234567890') {
          return {uid: 'fb-uid-test-1', email: 'google-user@wafa.local'};
        }
        throw new Error('INVALID_TOKEN');
      },
    }),
  );

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

    // 2. Register sets HttpOnly wafa_session + wafa_csrf cookies and NEVER leaks sessionToken in JSON
    const regRes = await fetch(`${base}/auth/register`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: 'tester@wafa.local', password: 'Password#2026'}),
    });
    assert.equal(regRes.status, 201);
    const regData = await regRes.json();
    assert.equal('sessionToken' in regData, false, 'Raw sessionToken must NEVER appear in JSON response');
    assert.ok(regData.csrfToken, 'CSRF token should be returned for double-submit header');

    const jar = extractCookieJar(regRes);
    assert.ok(jar.sessionCookie.startsWith('wafa_session='), 'HttpOnly session cookie must be set');
    assert.ok(
      jar.rawSetCookies.some((c) => c.includes('wafa_session=') && c.includes('HttpOnly') && c.includes('SameSite=Lax')),
      'Session cookie must include HttpOnly and SameSite=Lax',
    );
    assert.ok(jar.csrfCookie.startsWith('wafa_csrf='), 'CSRF cookie must be set');

    const getHeaders = {Cookie: jar.cookieHeader};
    const mutatingHeaders = {
      'Content-Type': 'application/json',
      Cookie: jar.cookieHeader,
      'X-CSRF-Token': regData.csrfToken,
    };

    // 3. CSRF enforcement: mutating request WITHOUT X-CSRF-Token returns 403
    const env1 = await encryptJsonWithPassphrase({profiles: [{id: 'p1'}]}, 'VaultPass!2026');
    const missingCsrfRes = await fetch(`${base}/sync/push`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Cookie: jar.cookieHeader},
      body: JSON.stringify({baseVersion: 0, idempotencyKey: 'csrf-check-1', envelope: env1}),
    });
    assert.equal(missingCsrfRes.status, 403);
    assert.equal((await missingCsrfRes.json()).error, 'CSRF_VALIDATION_FAILED');

    // 4. Reject plaintext / unencrypted sync payload strictly
    const badPushRes = await fetch(`${base}/sync/push`, {
      method: 'POST',
      headers: mutatingHeaders,
      body: JSON.stringify({
        baseVersion: 0,
        idempotencyKey: 'key-bad-1',
        envelope: {profiles: [{nationalId: '1234567890'}]},
      }),
    });
    assert.equal(badPushRes.status, 400);
    assert.equal((await badPushRes.json()).error, 'CLIENT_ENCRYPTION_REQUIRED');

    // 5. Genuine client-side AES-GCM encrypted push succeeds
    const push1Res = await fetch(`${base}/sync/push`, {
      method: 'POST',
      headers: mutatingHeaders,
      body: JSON.stringify({baseVersion: 0, idempotencyKey: 'idem-push-1', envelope: env1}),
    });
    assert.equal(push1Res.status, 200);
    assert.equal((await push1Res.json()).version, 1);

    // 6. Idempotent replay returns same version without incrementing
    const replayRes = await fetch(`${base}/sync/push`, {
      method: 'POST',
      headers: mutatingHeaders,
      body: JSON.stringify({baseVersion: 0, idempotencyKey: 'idem-push-1', envelope: env1}),
    });
    assert.equal(replayRes.status, 200);
    const replay = await replayRes.json();
    assert.equal(replay.idempotentReplay, true);
    assert.equal(replay.version, 1);

    // 7. Stale baseVersion triggers 409 SYNC_CONFLICT and returns remoteEnvelope without overwriting
    const env2 = await encryptJsonWithPassphrase({profiles: [{id: 'p2'}]}, 'VaultPass!2026');
    const conflictRes = await fetch(`${base}/sync/push`, {
      method: 'POST',
      headers: mutatingHeaders,
      body: JSON.stringify({baseVersion: 0, idempotencyKey: 'idem-push-conflict', envelope: env2}),
    });
    assert.equal(conflictRes.status, 409);
    const conflict = await conflictRes.json();
    assert.equal(conflict.error, 'SYNC_CONFLICT');
    assert.equal(conflict.remoteVersion, 1);
    assert.equal(conflict.remoteEnvelope.integrityHash, env1.integrityHash);

    // 8. Encrypted cloud backup create + list + invalid UUID rejection + delete
    const bCreate = await fetch(`${base}/backups`, {
      method: 'POST',
      headers: mutatingHeaders,
      body: JSON.stringify({label: 'Test Cloud Backup', envelope: env1}),
    });
    assert.equal(bCreate.status, 201);
    const createdBackup = (await bCreate.json()).backup;

    const bList = await fetch(`${base}/backups`, {headers: getHeaders});
    assert.equal(bList.status, 200);
    assert.equal((await bList.json()).backups.length, 1);

    const badDel = await fetch(`${base}/backups/not-a-uuid`, {
      method: 'DELETE',
      headers: mutatingHeaders,
    });
    assert.equal(badDel.status, 400);

    const bDel = await fetch(`${base}/backups/${createdBackup.id}`, {
      method: 'DELETE',
      headers: mutatingHeaders,
    });
    assert.equal(bDel.status, 200);

    // 9. Login anti-enumeration: unknown email & wrong password return identical generic 401
    const unknownLogin = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: 'nobody@wafa.local', password: 'WrongPassword1'}),
    });
    assert.equal(unknownLogin.status, 401);
    const wrongPassLogin = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: 'tester@wafa.local', password: 'WrongPassword1'}),
    });
    assert.equal(wrongPassLogin.status, 401);
    assert.deepEqual(await unknownLogin.json(), await wrongPassLogin.json());

    // 10. Logout revokes session server-side so replaying the old cookie returns 401
    const logoutRes = await fetch(`${base}/auth/logout`, {
      method: 'POST',
      headers: mutatingHeaders,
    });
    assert.equal(logoutRes.status, 200);
    const replayAfterLogout = await fetch(`${base}/auth/me`, {headers: getHeaders});
    assert.equal(replayAfterLogout.status, 401);

    // 11. Firebase Auth ID token exchange issues HttpOnly session & CSRF cookie
    const fbBadRes = await fetch(`${base}/auth/firebase`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({idToken: 'invalid-firebase-token-0000000000'}),
    });
    assert.equal(fbBadRes.status, 401);

    const fbOkRes = await fetch(`${base}/auth/firebase`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({idToken: 'valid-firebase-id-token-1234567890'}),
    });
    assert.equal(fbOkRes.status, 200);
    const fbData = await fbOkRes.json();
    assert.equal(fbData.account.email, 'google-user@wafa.local');
    const fbJar = extractCookieJar(fbOkRes);
    const fbMe = await fetch(`${base}/auth/me`, {headers: {Cookie: fbJar.cookieHeader}});
    assert.equal(fbMe.status, 200);

    // 12. Reproducible Chrome/Edge extension ZIP download returns valid PKZIP header
    const zipRes = await fetch(`${base}/extension/download`);
    assert.equal(zipRes.status, 200);
    assert.equal(zipRes.headers.get('content-type'), 'application/zip');
    const zipBytes = new Uint8Array(await zipRes.arrayBuffer());
    assert.equal(zipBytes[0], 0x50); // 'P'
    assert.equal(zipBytes[1], 0x4b); // 'K'

    // 13. Account & cloud data deletion removes account and invalidates session
    const delAcc = await fetch(`${base}/account`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Cookie: fbJar.cookieHeader,
        'X-CSRF-Token': fbData.csrfToken,
      },
    });
    assert.equal(delAcc.status, 200);
    const afterDel = await fetch(`${base}/auth/me`, {headers: {Cookie: fbJar.cookieHeader}});
    assert.equal(afterDel.status, 401);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
});

test('idle session timeout and persistent rate limiting return 401 and 429 cleanly', async () => {
  const tmpFile = path.join(os.tmpdir(), `wafa-test-rate-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  const store = new CloudStore(tmpFile);
  const app = express();
  app.use(
    '/api/v1',
    createCloudApiRouter(store, {
      idleTimeoutMs: 40,
      authRateLimitMax: 3,
    }),
  );

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = (server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}/api/v1`;

  try {
    const reg = await fetch(`${base}/auth/register`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: 'idle@wafa.local', password: 'Password#2026'}),
    });
    assert.equal(reg.status, 201);
    const jar = extractCookieJar(reg);

    // Wait beyond idleTimeoutMs (40ms)
    await new Promise((r) => setTimeout(r, 80));
    const idleCheck = await fetch(`${base}/auth/me`, {headers: {Cookie: jar.cookieHeader}});
    assert.equal(idleCheck.status, 401);

    // Exhaust auth rate limit (max 3 total; 1 already consumed by register)
    await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: 'idle@wafa.local', password: 'WrongPassword1'}),
    });
    await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: 'idle@wafa.local', password: 'WrongPassword1'}),
    });
    const rateLimited = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: 'idle@wafa.local', password: 'WrongPassword1'}),
    });
    assert.equal(rateLimited.status, 429);
    assert.equal((await rateLimited.json()).error, 'RATE_LIMIT_EXCEEDED');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
});

test(
  'live Cloud SQL PostgreSQL repository executes atomic encrypted sync, backup CRUD, and cascade deletion',
  {skip: !isPostgresConfigured()},
  async () => {
    const pgStore = new PostgresCloudStore();
    const app = express();
    app.use('/api/v1', createCloudApiRouter(pgStore, {authRateLimitMax: 50}));

    const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const port = (server.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${port}/api/v1`;
    const testEmail = `pg-verify-${Date.now()}@wafa.local`;

    try {
      const regRes = await fetch(`${base}/auth/register`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: testEmail, password: 'PgPassword#2026'}),
      });
      assert.equal(regRes.status, 201);
      const regData = await regRes.json();
      const jar = extractCookieJar(regRes);
      const headers = {
        'Content-Type': 'application/json',
        Cookie: jar.cookieHeader,
        'X-CSRF-Token': regData.csrfToken,
      };

      const env = await encryptJsonWithPassphrase({profiles: [{id: 'pg-p1'}]}, 'PgVaultPass!2026');
      const pushRes = await fetch(`${base}/sync/push`, {
        method: 'POST',
        headers,
        body: JSON.stringify({baseVersion: 0, idempotencyKey: `pg-idem-${Date.now()}`, envelope: env}),
      });
      assert.equal(pushRes.status, 200);
      assert.equal((await pushRes.json()).version, 1);

      const pullRes = await fetch(`${base}/sync/pull`, {headers: {Cookie: jar.cookieHeader}});
      assert.equal(pullRes.status, 200);
      const pulled = await pullRes.json();
      assert.equal(pulled.hasRemoteVault, true);
      assert.equal(pulled.envelope.integrityHash, env.integrityHash);

      const bRes = await fetch(`${base}/backups`, {
        method: 'POST',
        headers,
        body: JSON.stringify({label: 'PG Verification Backup', envelope: env}),
      });
      assert.equal(bRes.status, 201);

      // Clean up test account and all cascaded PostgreSQL records
      const delRes = await fetch(`${base}/account`, {method: 'DELETE', headers});
      assert.equal(delRes.status, 200);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  },
);
