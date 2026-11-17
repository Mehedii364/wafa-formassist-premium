import express, {type NextFunction, type Request, type Response} from 'express';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import {BUILTIN_ADAPTERS} from '../../shared/adapters/registry';
import {APP_VERSION} from '../../shared/constants/app-constants';
import {BD_DISTRICTS} from '../../shared/constants/bd-locations';
import type {EncryptedEnvelope} from '../../shared/schemas/types';
import {
  createRateLimiter,
  createSessionToken,
  hashIp,
  hashPassword,
  hashToken,
  verifyPassword,
} from './auth';
import {CloudStore, type CloudAccount} from './store';

interface AuthedRequest extends Request {
  cloudAccount?: CloudAccount;
  sessionTokenHash?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isValidEncryptedEnvelope(obj: unknown): obj is EncryptedEnvelope {
  if (!obj || typeof obj !== 'object') return false;
  const e = obj as Record<string, unknown>;
  return (
    e.algorithm === 'AES-GCM' &&
    e.keyDerivation === 'PBKDF2-SHA256' &&
    typeof e.iterations === 'number' &&
    e.iterations >= 100000 &&
    typeof e.salt === 'string' &&
    e.salt.length >= 16 &&
    typeof e.iv === 'string' &&
    e.iv.length >= 12 &&
    typeof e.ciphertext === 'string' &&
    e.ciphertext.length >= 16 &&
    typeof e.integrityHash === 'string' &&
    e.integrityHash.length === 64 &&
    // Explicitly reject any accidental plaintext fields attached to the envelope
    !('profiles' in e) &&
    !('nationalId' in e) &&
    !('personalInformation' in e)
  );
}

function parseSessionTokenFromRequest(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice('Bearer '.length).trim();
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    for (const part of cookieHeader.split(';')) {
      const [k, v] = part.trim().split('=');
      if (k === 'wafa_session' && v) {
        return decodeURIComponent(v);
      }
    }
  }
  return null;
}

function addDirectoryToZip(zip: JSZip, dirPath: string, zipRoot = ''): void {
  if (!fs.existsSync(dirPath)) return;
  for (const entry of fs.readdirSync(dirPath, {withFileTypes: true})) {
    const full = path.join(dirPath, entry.name);
    const rel = zipRoot ? `${zipRoot}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      addDirectoryToZip(zip, full, rel);
    } else {
      zip.file(rel, fs.readFileSync(full));
    }
  }
}

export function createCloudApiRouter(store = new CloudStore()) {
  const router = express.Router();
  router.use(express.json({limit: '4mb'}));

  const authRateLimit = createRateLimiter({windowMs: 60_000, maxRequests: 30});
  const syncRateLimit = createRateLimiter({windowMs: 60_000, maxRequests: 60});

  const requireSession = (req: AuthedRequest, res: Response, next: NextFunction) => {
    const raw = parseSessionTokenFromRequest(req);
    if (!raw) {
      res.status(401).json({error: 'UNAUTHORIZED', message: 'Valid session required.'});
      return;
    }
    const tokenHash = hashToken(raw);
    const session = store.findValidSession(tokenHash);
    if (!session) {
      res.status(401).json({error: 'SESSION_EXPIRED', message: 'Session is invalid or expired.'});
      return;
    }
    const account = store.findAccountById(session.accountId);
    if (!account) {
      res.status(401).json({error: 'ACCOUNT_NOT_FOUND', message: 'Account no longer exists.'});
      return;
    }
    req.cloudAccount = account;
    req.sessionTokenHash = tokenHash;
    next();
  };

  // --- Health & API Availability Probe ---
  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'wafa-formassist-cloud-api',
      apiVersion: 'v1',
      appVersion: APP_VERSION,
      serverTime: new Date().toISOString(),
      zeroKnowledgeEncryptionRequired: true,
    });
  });

  // --- Optional Account Registration & Session Authentication ---
  router.post('/auth/register', authRateLimit, (req, res) => {
    const {email, password, recoveryHint} = req.body || {};
    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      res.status(400).json({error: 'INVALID_EMAIL', message: 'Please provide a valid email address.'});
      return;
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      res.status(400).json({
        error: 'INVALID_PASSWORD',
        message: 'Account password must be between 8 and 128 characters.',
      });
      return;
    }
    if (store.findAccountByEmail(email)) {
      res.status(409).json({error: 'ACCOUNT_EXISTS', message: 'An account with this email already exists.'});
      return;
    }
    const {hash, salt} = hashPassword(password);
    const account = store.createAccount({
      email,
      passwordHash: hash,
      passwordSalt: salt,
      recoveryHint: typeof recoveryHint === 'string' ? recoveryHint.slice(0, 120) : undefined,
    });
    const {rawToken, tokenHash} = createSessionToken();
    store.createSession(account.id, tokenHash, String(req.headers['user-agent'] || 'Web').slice(0, 80));
    store.recordAudit({
      accountId: account.id,
      action: 'AUTH_REGISTER',
      status: 'ok',
      ipHash: hashIp(req.ip || ''),
    });

    res.setHeader(
      'Set-Cookie',
      `wafa_session=${encodeURIComponent(rawToken)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`,
    );
    res.status(201).json({
      account: {id: account.id, email: account.email, createdAt: account.createdAt},
      sessionToken: rawToken,
    });
  });

  router.post('/auth/login', authRateLimit, (req, res) => {
    const {email, password} = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({error: 'INVALID_CREDENTIALS', message: 'Email and password are required.'});
      return;
    }
    const account = store.findAccountByEmail(email);
    if (!account || !verifyPassword(password, account.passwordHash, account.passwordSalt)) {
      store.recordAudit({
        accountId: account?.id || null,
        action: 'AUTH_LOGIN',
        status: 'rejected',
        ipHash: hashIp(req.ip || ''),
      });
      res.status(401).json({error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.'});
      return;
    }
    const {rawToken, tokenHash} = createSessionToken();
    store.createSession(account.id, tokenHash, String(req.headers['user-agent'] || 'Web').slice(0, 80));
    store.recordAudit({
      accountId: account.id,
      action: 'AUTH_LOGIN',
      status: 'ok',
      ipHash: hashIp(req.ip || ''),
    });
    res.setHeader(
      'Set-Cookie',
      `wafa_session=${encodeURIComponent(rawToken)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`,
    );
    res.json({
      account: {id: account.id, email: account.email, createdAt: account.createdAt},
      sessionToken: rawToken,
    });
  });

  router.post('/auth/logout', requireSession, (req: AuthedRequest, res) => {
    if (req.sessionTokenHash) {
      store.deleteSession(req.sessionTokenHash);
    }
    res.setHeader('Set-Cookie', 'wafa_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    res.json({ok: true});
  });

  router.get('/auth/me', requireSession, (req: AuthedRequest, res) => {
    const acc = req.cloudAccount!;
    const state = store.getVaultState(acc.id);
    res.json({
      account: {id: acc.id, email: acc.email, createdAt: acc.createdAt},
      remoteVersion: state?.currentVersion || 0,
      lastRemoteUpdate: state?.updatedAt || null,
    });
  });

  // --- Encrypted Sync Endpoints (Strict Client-Side AES-GCM Enforcement) ---
  router.get('/sync/pull', syncRateLimit, requireSession, (req: AuthedRequest, res) => {
    const state = store.getVaultState(req.cloudAccount!.id);
    if (!state) {
      res.json({hasRemoteVault: false, version: 0, envelope: null, updatedAt: null});
      return;
    }
    res.json({
      hasRemoteVault: true,
      version: state.currentVersion,
      envelope: state.envelope,
      updatedAt: state.updatedAt,
    });
  });

  router.post('/sync/push', syncRateLimit, requireSession, (req: AuthedRequest, res) => {
    const acc = req.cloudAccount!;
    const {baseVersion, idempotencyKey, envelope, forceResolve} = req.body || {};

    if (typeof baseVersion !== 'number' || baseVersion < 0) {
      res.status(400).json({error: 'INVALID_BASE_VERSION', message: 'Numeric baseVersion required.'});
      return;
    }
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 4) {
      res.status(400).json({error: 'INVALID_IDEMPOTENCY_KEY', message: 'Idempotency key required.'});
      return;
    }
    if (!isValidEncryptedEnvelope(envelope)) {
      store.recordAudit({
        accountId: acc.id,
        action: 'SYNC_PUSH_REJECTED_UNENCRYPTED',
        status: 'rejected',
        ipHash: hashIp(req.ip || ''),
      });
      res.status(400).json({
        error: 'CLIENT_ENCRYPTION_REQUIRED',
        message: 'Cloud sync strictly rejects unencrypted or malformed payloads. Encrypt via AES-GCM client-side first.',
      });
      return;
    }

    const current = store.getVaultState(acc.id);
    // Idempotent retry handling
    if (current && current.lastIdempotencyKey === idempotencyKey) {
      res.json({
        ok: true,
        idempotentReplay: true,
        version: current.currentVersion,
        updatedAt: current.updatedAt,
      });
      return;
    }

    // Conflict detection: never silently overwrite newer remote state
    if (current && current.currentVersion > baseVersion && !forceResolve) {
      store.recordAudit({
        accountId: acc.id,
        action: 'SYNC_CONFLICT',
        status: 'conflict',
        ipHash: hashIp(req.ip || ''),
      });
      res.status(409).json({
        error: 'SYNC_CONFLICT',
        message: 'Remote vault has a newer version than baseVersion. Preserve both and resolve explicitly.',
        remoteVersion: current.currentVersion,
        remoteUpdatedAt: current.updatedAt,
        remoteEnvelope: current.envelope,
      });
      return;
    }

    const nextVersion = (current?.currentVersion || 0) + 1;
    const updatedAt = new Date().toISOString();
    store.upsertVaultState({
      accountId: acc.id,
      currentVersion: nextVersion,
      envelope,
      lastIdempotencyKey: idempotencyKey,
      updatedAt,
    });
    store.recordAudit({
      accountId: acc.id,
      action: 'SYNC_PUSH',
      status: 'ok',
      ipHash: hashIp(req.ip || ''),
    });

    res.json({ok: true, version: nextVersion, updatedAt});
  });

  // --- Encrypted Cloud Backups ---
  router.get('/backups', syncRateLimit, requireSession, (req: AuthedRequest, res) => {
    const backups = store.listBackups(req.cloudAccount!.id).map((b) => ({
      id: b.id,
      label: b.label,
      schemaVersion: b.schemaVersion,
      byteSize: b.byteSize,
      createdAt: b.createdAt,
      envelope: b.envelope,
    }));
    res.json({backups});
  });

  router.post('/backups', syncRateLimit, requireSession, (req: AuthedRequest, res) => {
    const acc = req.cloudAccount!;
    const {label, envelope} = req.body || {};
    if (!isValidEncryptedEnvelope(envelope)) {
      res.status(400).json({
        error: 'CLIENT_ENCRYPTION_REQUIRED',
        message: 'Only client-side AES-GCM encrypted envelopes may be uploaded as cloud backups.',
      });
      return;
    }
    const byteSize = Buffer.byteLength(JSON.stringify(envelope), 'utf8');
    const created = store.addBackup({
      accountId: acc.id,
      label: typeof label === 'string' && label.trim() ? label.trim().slice(0, 80) : 'Encrypted Vault Snapshot',
      schemaVersion: envelope.schemaVersion,
      byteSize,
      envelope,
    });
    store.recordAudit({
      accountId: acc.id,
      action: 'CLOUD_BACKUP_CREATE',
      status: 'ok',
      ipHash: hashIp(req.ip || ''),
    });
    res.status(201).json({backup: created});
  });

  router.delete('/backups/:id', syncRateLimit, requireSession, (req: AuthedRequest, res) => {
    const backupId = String(req.params.id || '');
    const deleted = store.deleteBackup(req.cloudAccount!.id, backupId);
    if (!deleted) {
      res.status(404).json({error: 'NOT_FOUND', message: 'Backup not found.'});
      return;
    }
    store.recordAudit({
      accountId: req.cloudAccount!.id,
      action: 'CLOUD_BACKUP_DELETE',
      status: 'ok',
      ipHash: hashIp(req.ip || ''),
    });
    res.json({ok: true});
  });

  // --- Cloud Account & Data Deletion ---
  router.delete('/account', authRateLimit, requireSession, (req: AuthedRequest, res) => {
    const accId = req.cloudAccount!.id;
    store.deleteAccountAndAllCloudData(accId);
    store.recordAudit({
      accountId: null,
      action: 'ACCOUNT_DELETED',
      status: 'ok',
      ipHash: hashIp(req.ip || ''),
    });
    res.setHeader('Set-Cookie', 'wafa_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    res.json({ok: true, message: 'Cloud account and all encrypted cloud records permanently deleted.'});
  });

  // --- Public Optional Online Enhancement Feeds (Adapters, Verified Datasets, Updates) ---
  router.get('/adapters', (_req, res) => {
    res.json({
      schemaVersion: '1.0.0',
      updatedAt: '2026-11-17T00:00:00.000Z',
      adapters: BUILTIN_ADAPTERS,
    });
  });

  router.get('/datasets/bd-locations', (_req, res) => {
    res.json({
      datasetVersion: '2026.1',
      districtCount: BD_DISTRICTS.length,
      note: 'Official 64 districts of Bangladesh with curated Upazilas/Thanas; postal codes intentionally require user verification.',
      districts: BD_DISTRICTS,
    });
  });

  router.get('/updates/check', (_req, res) => {
    res.json({
      latestDashboardVersion: APP_VERSION,
      latestExtensionVersion: '1.0.0',
      docsUpdatedAt: '2026-11-17',
      updateAvailable: false,
      releaseNotes: 'WAFA FormAssist Premium v1.0.0 — Offline-first vault, DGBPO 2026 adapter, Manifest V3 Chrome & Edge extension, optional encrypted cloud sync.',
    });
  });

  // --- Reproducible Chrome & Edge Extension ZIP Download ---
  router.get('/extension/download', async (_req, res) => {
    try {
      const extDir = path.resolve(process.cwd(), 'extension');
      if (!fs.existsSync(extDir)) {
        res.status(404).json({error: 'EXTENSION_DIR_MISSING'});
        return;
      }
      const zip = new JSZip();
      addDirectoryToZip(zip, extDir);
      const buffer = await zip.generateAsync({type: 'nodebuffer', compression: 'DEFLATE'});
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="wafa-formassist-extension-mv3-v1.0.0.zip"',
      );
      res.send(buffer);
    } catch {
      res.status(500).json({error: 'EXTENSION_PACKAGE_FAILED'});
    }
  });

  return router;
}
