import crypto from 'node:crypto';
import express, {type NextFunction, type Request, type Response} from 'express';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import {z} from 'zod';
import {BUILTIN_ADAPTERS} from '../../shared/adapters/registry';
import {APP_VERSION} from '../../shared/constants/app-constants';
import {BD_DISTRICTS} from '../../shared/constants/bd-locations';
import {validateEncryptedEnvelope} from '../../shared/security/crypto';
import {
  buildAuthCookies,
  buildClearAuthCookies,
  createPersistentRateLimiter,
  createSessionCredentials,
  extractClientIp,
  hashIp,
  hashPassword,
  hashToken,
  isSecureRequest,
  parseCookieValue,
  runDummyPasswordCheck,
  SESSION_COOKIE_NAME,
  verifyPassword,
  verifyTokenHash,
} from './auth';
import type {CloudAccount, CloudRepository, CloudSession} from './repository';
import {CloudStore} from './store';

interface AuthedRequest extends Request {
  cloudAccount?: CloudAccount;
  cloudSession?: CloudSession;
  requestId?: string;
}

export interface CloudApiOptions {
  idleTimeoutMs?: number;
  authRateLimitMax?: number;
  syncRateLimitMax?: number;
  verifyFirebaseIdToken?: (idToken: string) => Promise<{uid: string; email?: string}>;
}

const registerSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  recoveryHint: z.string().trim().max(120).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

const firebaseAuthSchema = z.object({
  idToken: z.string().min(20).max(8192),
});

const syncPushSchema = z.object({
  baseVersion: z.number().int().min(0),
  idempotencyKey: z.string().trim().min(4).max(128),
  envelope: z.unknown(),
  forceResolve: z.boolean().optional(),
});

const backupCreateSchema = z.object({
  label: z.string().trim().max(80).optional(),
  envelope: z.unknown(),
});

const uuidSchema = z.string().uuid();

const EXCLUDED_ZIP_NAMES = new Set(['.DS_Store', 'Thumbs.db', 'node_modules', '.git']);

function isAllowedExtensionFile(fileName: string): boolean {
  if (EXCLUDED_ZIP_NAMES.has(fileName)) return false;
  if (fileName.startsWith('.')) return false;
  if (fileName.endsWith('.map') || fileName.endsWith('.pem') || fileName.endsWith('.key')) {
    return false;
  }
  return true;
}

function addDirectoryToZip(zip: JSZip, dirPath: string, zipRoot = ''): void {
  if (!fs.existsSync(dirPath)) return;
  for (const entry of fs.readdirSync(dirPath, {withFileTypes: true})) {
    if (!isAllowedExtensionFile(entry.name)) continue;
    const full = path.join(dirPath, entry.name);
    const rel = zipRoot ? `${zipRoot}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      addDirectoryToZip(zip, full, rel);
    } else if (entry.isFile()) {
      zip.file(rel, fs.readFileSync(full));
    }
  }
}

async function defaultVerifyFirebaseToken(idToken: string): Promise<{uid: string; email?: string}> {
  const {adminAuth} = await import('../../src/lib/firebase-admin.ts');
  const decoded = await adminAuth.verifyIdToken(idToken);
  return {uid: decoded.uid, email: decoded.email};
}

export function createCloudApiRouter(
  repo: CloudRepository = new CloudStore(),
  options: CloudApiOptions = {},
) {
  const router = express.Router();
  const configuredIdleMinutes = Number(process.env.SESSION_IDLE_MINUTES) || 120;
  const idleTimeoutMs = options.idleTimeoutMs ?? configuredIdleMinutes * 60 * 1000;
  const verifyFirebaseIdToken = options.verifyFirebaseIdToken ?? defaultVerifyFirebaseToken;

  router.use(express.json({limit: '4mb'}));

  // Sanitized structured request logger — NEVER logs bodies, cookies, tokens, emails, or PII
  router.use((req: AuthedRequest, res: Response, next: NextFunction) => {
    const start = Date.now();
    const requestId = crypto.randomUUID().slice(0, 12);
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('Cache-Control', 'no-store');
    res.on('finish', () => {
      if (process.env.NODE_ENV !== 'test') {
        console.log(
          JSON.stringify({
            level: 'info',
            component: 'cloud-api',
            requestId,
            method: req.method,
            path: req.path,
            status: res.statusCode,
            durationMs: Date.now() - start,
          }),
        );
      }
    });
    next();
  });

  const authRateLimit = createPersistentRateLimiter({
    repo,
    scope: 'auth',
    windowMs: 60_000,
    maxRequests: options.authRateLimitMax ?? 20,
  });

  const syncRateLimit = createPersistentRateLimiter({
    repo,
    scope: 'sync',
    windowMs: 60_000,
    maxRequests: options.syncRateLimitMax ?? 60,
  });

  const requireSession = async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const raw = parseCookieValue(req, SESSION_COOKIE_NAME);
      if (!raw) {
        res.status(401).json({error: 'UNAUTHORIZED', message: 'Valid session cookie required.'});
        return;
      }
      const tokenHash = hashToken(raw);
      const session = await repo.findValidSession(tokenHash, idleTimeoutMs);
      if (!session) {
        res.status(401).json({error: 'SESSION_EXPIRED', message: 'Session is invalid or expired.'});
        return;
      }
      const account = await repo.findAccountById(session.accountId);
      if (!account) {
        res.status(401).json({error: 'ACCOUNT_NOT_FOUND', message: 'Account no longer exists.'});
        return;
      }
      await repo.touchSession(tokenHash);
      req.cloudAccount = account;
      req.cloudSession = session;
      next();
    } catch {
      res.status(500).json({error: 'INTERNAL_ERROR', message: 'Unable to validate session.'});
    }
  };

  const requireCsrf = (req: AuthedRequest, res: Response, next: NextFunction) => {
    const headerToken = req.headers['x-csrf-token'];
    const rawHeader = Array.isArray(headerToken) ? headerToken[0] : headerToken;
    const expectedHash = req.cloudSession?.csrfTokenHash;
    if (!rawHeader || !expectedHash || !verifyTokenHash(rawHeader, expectedHash)) {
      res.status(403).json({
        error: 'CSRF_VALIDATION_FAILED',
        message: 'Missing or invalid CSRF protection token.',
      });
      return;
    }
    next();
  };

  const revokePreviousCookieIfPresent = async (req: Request): Promise<void> => {
    const previousRaw = parseCookieValue(req, SESSION_COOKIE_NAME);
    if (previousRaw) {
      await repo.revokeSession(hashToken(previousRaw));
    }
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

  // --- Optional Account Registration ---
  router.post('/auth/register', authRateLimit, async (req, res) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Please provide a valid email address and a password between 8 and 128 characters.',
        });
        return;
      }

      const {email, password, recoveryHint} = parsed.data;
      const existing = await repo.findAccountByEmail(email);
      if (existing) {
        res.status(409).json({
          error: 'ACCOUNT_EXISTS',
          message: 'Unable to register with the provided email address.',
        });
        return;
      }

      await revokePreviousCookieIfPresent(req);

      const {hash, salt} = hashPassword(password);
      const account = await repo.createAccount({
        email,
        passwordHash: hash,
        passwordSalt: salt,
        recoveryHint,
      });

      const creds = createSessionCredentials();
      await repo.createSession({
        accountId: account.id,
        tokenHash: creds.tokenHash,
        csrfTokenHash: creds.csrfTokenHash,
        deviceLabel: String(req.headers['user-agent'] || 'Web Dashboard').slice(0, 80),
      });

      await repo.recordAudit({
        accountId: account.id,
        action: 'AUTH_REGISTER',
        status: 'ok',
        ipHash: hashIp(extractClientIp(req)),
      });

      res.setHeader(
        'Set-Cookie',
        buildAuthCookies({
          sessionToken: creds.rawSessionToken,
          csrfToken: creds.rawCsrfToken,
          secure: isSecureRequest(req),
        }),
      );
      res.status(201).json({
        account: {id: account.id, email: account.email, createdAt: account.createdAt},
        csrfToken: creds.rawCsrfToken,
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'DB_UNIQUE_CONFLICT') {
        res.status(409).json({
          error: 'ACCOUNT_EXISTS',
          message: 'Unable to register with the provided email address.',
        });
        return;
      }
      res.status(500).json({error: 'INTERNAL_ERROR', message: 'Registration failed.'});
    }
  });

  // --- Optional Email/Password Login ---
  router.post('/auth/login', authRateLimit, async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'INVALID_CREDENTIALS',
          message: 'Email and password are required.',
        });
        return;
      }

      const {email, password} = parsed.data;
      const account = await repo.findAccountByEmail(email);

      let valid = false;
      if (account && account.passwordHash && account.passwordSalt) {
        valid = verifyPassword(password, account.passwordHash, account.passwordSalt);
      } else {
        // Equalize timing to prevent email enumeration
        runDummyPasswordCheck(password);
      }

      if (!account || !valid) {
        await repo.recordAudit({
          accountId: account?.id || null,
          action: 'AUTH_LOGIN',
          status: 'rejected',
          ipHash: hashIp(extractClientIp(req)),
        });
        res.status(401).json({error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.'});
        return;
      }

      await revokePreviousCookieIfPresent(req);

      const creds = createSessionCredentials();
      await repo.createSession({
        accountId: account.id,
        tokenHash: creds.tokenHash,
        csrfTokenHash: creds.csrfTokenHash,
        deviceLabel: String(req.headers['user-agent'] || 'Web Dashboard').slice(0, 80),
      });

      await repo.recordAudit({
        accountId: account.id,
        action: 'AUTH_LOGIN',
        status: 'ok',
        ipHash: hashIp(extractClientIp(req)),
      });

      res.setHeader(
        'Set-Cookie',
        buildAuthCookies({
          sessionToken: creds.rawSessionToken,
          csrfToken: creds.rawCsrfToken,
          secure: isSecureRequest(req),
        }),
      );
      res.json({
        account: {id: account.id, email: account.email, createdAt: account.createdAt},
        csrfToken: creds.rawCsrfToken,
      });
    } catch {
      res.status(500).json({error: 'INTERNAL_ERROR', message: 'Authentication failed.'});
    }
  });

  // --- Optional Firebase Auth (Google Sign-In) Session Exchange ---
  router.post('/auth/firebase', authRateLimit, async (req, res) => {
    try {
      const parsed = firebaseAuthSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({error: 'INVALID_TOKEN', message: 'Valid Firebase ID token required.'});
        return;
      }

      let decoded: {uid: string; email?: string};
      try {
        decoded = await verifyFirebaseIdToken(parsed.data.idToken);
      } catch {
        await repo.recordAudit({
          accountId: null,
          action: 'AUTH_FIREBASE',
          status: 'rejected',
          ipHash: hashIp(extractClientIp(req)),
        });
        res.status(401).json({error: 'INVALID_TOKEN', message: 'Firebase token verification failed.'});
        return;
      }

      if (!decoded.uid || !decoded.email) {
        res.status(400).json({
          error: 'EMAIL_REQUIRED',
          message: 'Verified email address is required for optional cloud sync.',
        });
        return;
      }

      await revokePreviousCookieIfPresent(req);

      const account = await repo.upsertFirebaseAccount({
        firebaseUid: decoded.uid,
        email: decoded.email,
      });

      const creds = createSessionCredentials();
      await repo.createSession({
        accountId: account.id,
        tokenHash: creds.tokenHash,
        csrfTokenHash: creds.csrfTokenHash,
        deviceLabel: String(req.headers['user-agent'] || 'Google Sign-In').slice(0, 80),
      });

      await repo.recordAudit({
        accountId: account.id,
        action: 'AUTH_FIREBASE',
        status: 'ok',
        ipHash: hashIp(extractClientIp(req)),
      });

      res.setHeader(
        'Set-Cookie',
        buildAuthCookies({
          sessionToken: creds.rawSessionToken,
          csrfToken: creds.rawCsrfToken,
          secure: isSecureRequest(req),
        }),
      );
      res.json({
        account: {id: account.id, email: account.email, createdAt: account.createdAt},
        csrfToken: creds.rawCsrfToken,
      });
    } catch {
      res.status(500).json({error: 'INTERNAL_ERROR', message: 'Authentication failed.'});
    }
  });

  router.post('/auth/logout', requireSession, requireCsrf, async (req: AuthedRequest, res) => {
    try {
      if (req.cloudSession?.tokenHash) {
        await repo.revokeSession(req.cloudSession.tokenHash);
      }
      res.setHeader('Set-Cookie', buildClearAuthCookies({secure: isSecureRequest(req)}));
      res.json({ok: true});
    } catch {
      res.status(500).json({error: 'INTERNAL_ERROR', message: 'Logout failed.'});
    }
  });

  router.get('/auth/me', requireSession, async (req: AuthedRequest, res) => {
    try {
      const acc = req.cloudAccount!;
      const state = await repo.getVaultState(acc.id);
      res.json({
        account: {id: acc.id, email: acc.email, createdAt: acc.createdAt},
        remoteVersion: state?.currentVersion || 0,
        lastRemoteUpdate: state?.updatedAt || null,
      });
    } catch {
      res.status(500).json({error: 'INTERNAL_ERROR', message: 'Failed to load account status.'});
    }
  });

  // --- Encrypted Sync Endpoints (Strict Client-Side AES-GCM Enforcement) ---
  router.get('/sync/pull', syncRateLimit, requireSession, async (req: AuthedRequest, res) => {
    try {
      const state = await repo.getVaultState(req.cloudAccount!.id);
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
    } catch {
      res.status(500).json({error: 'INTERNAL_ERROR', message: 'Failed to retrieve vault.'});
    }
  });

  router.post(
    '/sync/push',
    syncRateLimit,
    requireSession,
    requireCsrf,
    async (req: AuthedRequest, res) => {
      try {
        const acc = req.cloudAccount!;
        const parsed = syncPushSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'baseVersion, idempotencyKey, and encrypted envelope are required.',
          });
          return;
        }

        const {baseVersion, idempotencyKey, envelope, forceResolve} = parsed.data;
        if (!validateEncryptedEnvelope(envelope)) {
          await repo.recordAudit({
            accountId: acc.id,
            action: 'SYNC_PUSH_REJECTED_UNENCRYPTED',
            status: 'rejected',
            ipHash: hashIp(extractClientIp(req)),
          });
          res.status(400).json({
            error: 'CLIENT_ENCRYPTION_REQUIRED',
            message:
              'Cloud sync strictly rejects unencrypted or malformed payloads. Encrypt via AES-GCM client-side first.',
          });
          return;
        }

        const result = await repo.atomicPushVaultState({
          accountId: acc.id,
          baseVersion,
          idempotencyKey,
          envelope,
          forceResolve,
        });

        if (result.status === 'idempotent') {
          res.json({
            ok: true,
            idempotentReplay: true,
            version: result.version,
            updatedAt: result.updatedAt,
          });
          return;
        }

        if (result.status === 'conflict') {
          await repo.recordAudit({
            accountId: acc.id,
            action: 'SYNC_CONFLICT',
            status: 'conflict',
            ipHash: hashIp(extractClientIp(req)),
          });
          res.status(409).json({
            error: 'SYNC_CONFLICT',
            message:
              'Remote vault has a newer version than baseVersion. Preserve both and resolve explicitly.',
            remoteVersion: result.remoteVersion,
            remoteUpdatedAt: result.remoteUpdatedAt,
            remoteEnvelope: result.remoteEnvelope,
          });
          return;
        }

        await repo.recordAudit({
          accountId: acc.id,
          action: 'SYNC_PUSH',
          status: 'ok',
          ipHash: hashIp(extractClientIp(req)),
        });

        res.json({ok: true, version: result.version, updatedAt: result.updatedAt});
      } catch {
        res.status(500).json({error: 'INTERNAL_ERROR', message: 'Failed to store encrypted vault.'});
      }
    },
  );

  // --- Encrypted Cloud Backups ---
  router.get('/backups', syncRateLimit, requireSession, async (req: AuthedRequest, res) => {
    try {
      const backups = (await repo.listBackups(req.cloudAccount!.id)).map((b) => ({
        id: b.id,
        label: b.label,
        schemaVersion: b.schemaVersion,
        byteSize: b.byteSize,
        createdAt: b.createdAt,
        envelope: b.envelope,
      }));
      res.json({backups});
    } catch {
      res.status(500).json({error: 'INTERNAL_ERROR', message: 'Failed to list cloud backups.'});
    }
  });

  router.post(
    '/backups',
    syncRateLimit,
    requireSession,
    requireCsrf,
    async (req: AuthedRequest, res) => {
      try {
        const acc = req.cloudAccount!;
        const parsed = backupCreateSchema.safeParse(req.body);
        if (!parsed.success || !validateEncryptedEnvelope(parsed.data.envelope)) {
          res.status(400).json({
            error: 'CLIENT_ENCRYPTION_REQUIRED',
            message: 'Only client-side AES-GCM encrypted envelopes may be uploaded as cloud backups.',
          });
          return;
        }

        const envelope = parsed.data.envelope;
        const byteSize = Buffer.byteLength(JSON.stringify(envelope), 'utf8');
        const created = await repo.addBackup({
          accountId: acc.id,
          label: parsed.data.label || 'Encrypted Vault Snapshot',
          schemaVersion: envelope.schemaVersion,
          integrityHash: envelope.integrityHash,
          byteSize,
          envelope,
        });

        await repo.recordAudit({
          accountId: acc.id,
          action: 'CLOUD_BACKUP_CREATE',
          status: 'ok',
          ipHash: hashIp(extractClientIp(req)),
        });

        res.status(201).json({backup: created});
      } catch {
        res.status(500).json({error: 'INTERNAL_ERROR', message: 'Failed to save cloud backup.'});
      }
    },
  );

  router.delete(
    '/backups/:id',
    syncRateLimit,
    requireSession,
    requireCsrf,
    async (req: AuthedRequest, res) => {
      try {
        const idCheck = uuidSchema.safeParse(req.params.id);
        if (!idCheck.success) {
          res.status(400).json({error: 'INVALID_BACKUP_ID', message: 'Invalid backup identifier.'});
          return;
        }
        const deleted = await repo.deleteBackup(req.cloudAccount!.id, idCheck.data);
        if (!deleted) {
          res.status(404).json({error: 'NOT_FOUND', message: 'Backup not found.'});
          return;
        }
        await repo.recordAudit({
          accountId: req.cloudAccount!.id,
          action: 'CLOUD_BACKUP_DELETE',
          status: 'ok',
          ipHash: hashIp(extractClientIp(req)),
        });
        res.json({ok: true});
      } catch {
        res.status(500).json({error: 'INTERNAL_ERROR', message: 'Failed to delete backup.'});
      }
    },
  );

  // --- Cloud Account & Data Deletion ---
  router.delete(
    '/account',
    authRateLimit,
    requireSession,
    requireCsrf,
    async (req: AuthedRequest, res) => {
      try {
        const accId = req.cloudAccount!.id;
        await repo.deleteAccountAndAllCloudData(accId);
        await repo.recordAudit({
          accountId: null,
          action: 'ACCOUNT_DELETED',
          status: 'ok',
          ipHash: hashIp(extractClientIp(req)),
        });
        res.setHeader('Set-Cookie', buildClearAuthCookies({secure: isSecureRequest(req)}));
        res.json({
          ok: true,
          message: 'Cloud account and all encrypted cloud records permanently deleted.',
        });
      } catch {
        res.status(500).json({error: 'INTERNAL_ERROR', message: 'Failed to delete cloud account.'});
      }
    },
  );

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
      releaseNotes:
        'WAFA FormAssist Premium v1.0.0 — Offline-first vault, DGBPO 2026 adapter, Manifest V3 Chrome & Edge extension, optional encrypted cloud sync.',
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

  // Centralized error boundary preventing stack-trace or SQL leakage
  router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof SyntaxError && 'status' in err) {
      res.status(400).json({error: 'INVALID_JSON', message: 'Malformed JSON request body.'});
      return;
    }
    res.status(500).json({error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.'});
  });

  return router;
}
