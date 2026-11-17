import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {isPostgresConfigured} from '../../src/db/index.ts';
import type {EncryptedEnvelope} from '../../shared/schemas/types';
import {PostgresCloudStore} from './postgres-store';
import type {
  AtomicPushVaultResult,
  AuditLogEntry,
  CloudAccount,
  CloudRepository,
  CloudSession,
  EncryptedCloudBackup,
  EncryptedVaultState,
  RateLimitResult,
} from './repository';

export type {
  AtomicPushVaultResult,
  AuditLogEntry,
  CloudAccount,
  CloudRepository,
  CloudSession,
  EncryptedCloudBackup,
  EncryptedVaultState,
  RateLimitResult,
};

interface RateLimitBucketRecord {
  bucketKey: string;
  requestCount: number;
  windowStart: string;
  expiresAt: string;
}

interface PersistedCloudDb {
  accounts: CloudAccount[];
  sessions: CloudSession[];
  vaultStates: EncryptedVaultState[];
  backups: EncryptedCloudBackup[];
  rateLimitBuckets: RateLimitBucketRecord[];
  auditLogs: AuditLogEntry[];
}

const EMPTY_DB: PersistedCloudDb = {
  accounts: [],
  sessions: [],
  vaultStates: [],
  backups: [],
  rateLimitBuckets: [],
  auditLogs: [],
};

const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CLOUD_BACKUPS_PER_ACCOUNT = 10;

/**
 * Atomic file-backed development/test repository mirroring the PostgreSQL schema.
 * Production deployments with SQL_HOST/SQL_USER/SQL_PASSWORD/SQL_DB_NAME automatically
 * use PostgresCloudStore via createCloudRepository().
 */
export class CloudStore implements CloudRepository {
  private readonly filePath: string;
  private data: PersistedCloudDb;

  constructor(customPath?: string) {
    this.filePath =
      customPath || path.join(os.tmpdir(), 'wafa-formassist-cloud-store.json');
    this.data = this.load();
  }

  private load(): PersistedCloudDb {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw) as Partial<PersistedCloudDb>;
        return {
          accounts: parsed.accounts || [],
          sessions: parsed.sessions || [],
          vaultStates: parsed.vaultStates || [],
          backups: parsed.backups || [],
          rateLimitBuckets: parsed.rateLimitBuckets || [],
          auditLogs: parsed.auditLogs || [],
        };
      }
    } catch {
      // Fallback to fresh store on read error
    }
    return structuredClone(EMPTY_DB);
  }

  private flush(): void {
    const tmp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
    fs.renameSync(tmp, this.filePath);
  }

  public async findAccountByEmail(email: string): Promise<CloudAccount | undefined> {
    const norm = email.trim().toLowerCase();
    return this.data.accounts.find((a) => a.email === norm);
  }

  public async findAccountById(id: string): Promise<CloudAccount | undefined> {
    return this.data.accounts.find((a) => a.id === id);
  }

  public async findAccountByFirebaseUid(firebaseUid: string): Promise<CloudAccount | undefined> {
    return this.data.accounts.find((a) => a.firebaseUid === firebaseUid);
  }

  public async createAccount(params: {
    email: string;
    passwordHash: string;
    passwordSalt: string;
    recoveryHint?: string;
  }): Promise<CloudAccount> {
    const now = new Date().toISOString();
    const account: CloudAccount = {
      id: crypto.randomUUID(),
      firebaseUid: null,
      email: params.email.trim().toLowerCase(),
      passwordHash: params.passwordHash,
      passwordSalt: params.passwordSalt,
      recoveryHint: params.recoveryHint ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.data.accounts.push(account);
    this.flush();
    return account;
  }

  public async upsertFirebaseAccount(params: {
    firebaseUid: string;
    email: string;
  }): Promise<CloudAccount> {
    const normEmail = params.email.trim().toLowerCase();
    const now = new Date().toISOString();

    const byUid = this.data.accounts.find((a) => a.firebaseUid === params.firebaseUid);
    if (byUid) {
      byUid.email = normEmail;
      byUid.updatedAt = now;
      this.flush();
      return byUid;
    }

    const byEmail = this.data.accounts.find((a) => a.email === normEmail);
    if (byEmail) {
      byEmail.firebaseUid = params.firebaseUid;
      byEmail.updatedAt = now;
      this.flush();
      return byEmail;
    }

    const account: CloudAccount = {
      id: crypto.randomUUID(),
      firebaseUid: params.firebaseUid,
      email: normEmail,
      passwordHash: null,
      passwordSalt: null,
      recoveryHint: null,
      createdAt: now,
      updatedAt: now,
    };
    this.data.accounts.push(account);
    this.flush();
    return account;
  }

  public async createSession(params: {
    accountId: string;
    tokenHash: string;
    csrfTokenHash: string;
    deviceLabel: string;
    ttlMs?: number;
  }): Promise<CloudSession> {
    const now = Date.now();
    const session: CloudSession = {
      tokenHash: params.tokenHash,
      accountId: params.accountId,
      csrfTokenHash: params.csrfTokenHash,
      deviceLabel: (params.deviceLabel || 'Web Dashboard').slice(0, 80),
      createdAt: new Date(now).toISOString(),
      lastActiveAt: new Date(now).toISOString(),
      expiresAt: new Date(now + (params.ttlMs ?? DEFAULT_SESSION_TTL_MS)).toISOString(),
      revokedAt: null,
    };
    this.data.sessions.push(session);
    this.flush();
    return session;
  }

  public async findValidSession(
    tokenHash: string,
    idleTimeoutMs: number,
  ): Promise<CloudSession | undefined> {
    const session = this.data.sessions.find((s) => s.tokenHash === tokenHash);
    if (!session || session.revokedAt) return undefined;
    const nowMs = Date.now();
    if (new Date(session.expiresAt).getTime() <= nowMs) return undefined;
    const lastActiveMs = new Date(session.lastActiveAt || session.createdAt).getTime();
    if (nowMs - lastActiveMs > idleTimeoutMs) {
      session.revokedAt = new Date(nowMs).toISOString();
      this.flush();
      return undefined;
    }
    return session;
  }

  public async touchSession(tokenHash: string): Promise<void> {
    const session = this.data.sessions.find((s) => s.tokenHash === tokenHash && !s.revokedAt);
    if (session) {
      session.lastActiveAt = new Date().toISOString();
      this.flush();
    }
  }

  public async revokeSession(tokenHash: string): Promise<void> {
    const session = this.data.sessions.find((s) => s.tokenHash === tokenHash);
    if (session && !session.revokedAt) {
      session.revokedAt = new Date().toISOString();
      this.flush();
    }
  }

  public async revokeAllUserSessions(accountId: string): Promise<void> {
    const now = new Date().toISOString();
    let changed = false;
    for (const s of this.data.sessions) {
      if (s.accountId === accountId && !s.revokedAt) {
        s.revokedAt = now;
        changed = true;
      }
    }
    if (changed) this.flush();
  }

  public async getVaultState(accountId: string): Promise<EncryptedVaultState | undefined> {
    return this.data.vaultStates.find((v) => v.accountId === accountId);
  }

  public async atomicPushVaultState(params: {
    accountId: string;
    baseVersion: number;
    idempotencyKey: string;
    envelope: EncryptedEnvelope;
    forceResolve?: boolean;
  }): Promise<AtomicPushVaultResult> {
    const current = this.data.vaultStates.find((v) => v.accountId === params.accountId);
    if (current && current.lastIdempotencyKey === params.idempotencyKey) {
      return {
        status: 'idempotent',
        version: current.currentVersion,
        updatedAt: current.updatedAt,
      };
    }

    if (current && current.currentVersion > params.baseVersion && !params.forceResolve) {
      return {
        status: 'conflict',
        remoteVersion: current.currentVersion,
        remoteUpdatedAt: current.updatedAt,
        remoteEnvelope: current.envelope,
      };
    }

    const nextVersion = (current?.currentVersion || 0) + 1;
    const updatedAt = new Date().toISOString();
    const nextState: EncryptedVaultState = {
      accountId: params.accountId,
      currentVersion: nextVersion,
      envelope: params.envelope,
      lastIdempotencyKey: params.idempotencyKey,
      updatedAt,
    };

    const idx = this.data.vaultStates.findIndex((v) => v.accountId === params.accountId);
    if (idx >= 0) {
      this.data.vaultStates[idx] = nextState;
    } else {
      this.data.vaultStates.push(nextState);
    }
    this.flush();
    return {status: 'ok', version: nextVersion, updatedAt};
  }

  public async listBackups(accountId: string): Promise<EncryptedCloudBackup[]> {
    return this.data.backups
      .filter((b) => b.accountId === accountId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public async addBackup(backup: {
    accountId: string;
    label: string;
    schemaVersion: string;
    integrityHash: string;
    byteSize: number;
    envelope: EncryptedEnvelope;
  }): Promise<EncryptedCloudBackup> {
    const entry: EncryptedCloudBackup = {
      ...backup,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.data.backups.push(entry);
    const userBackups = await this.listBackups(backup.accountId);
    if (userBackups.length > MAX_CLOUD_BACKUPS_PER_ACCOUNT) {
      const toRemove = new Set(userBackups.slice(MAX_CLOUD_BACKUPS_PER_ACCOUNT).map((b) => b.id));
      this.data.backups = this.data.backups.filter((b) => !toRemove.has(b.id));
    }
    this.flush();
    return entry;
  }

  public async deleteBackup(accountId: string, backupId: string): Promise<boolean> {
    const before = this.data.backups.length;
    this.data.backups = this.data.backups.filter(
      (b) => !(b.accountId === accountId && b.id === backupId),
    );
    const changed = this.data.backups.length !== before;
    if (changed) this.flush();
    return changed;
  }

  public async deleteAccountAndAllCloudData(accountId: string): Promise<void> {
    this.data.accounts = this.data.accounts.filter((a) => a.id !== accountId);
    this.data.sessions = this.data.sessions.filter((s) => s.accountId !== accountId);
    this.data.vaultStates = this.data.vaultStates.filter((v) => v.accountId !== accountId);
    this.data.backups = this.data.backups.filter((b) => b.accountId !== accountId);
    this.flush();
  }

  public async consumeRateLimit(params: {
    bucketKey: string;
    windowMs: number;
    maxRequests: number;
  }): Promise<RateLimitResult> {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const nextExpiryIso = new Date(nowMs + params.windowMs).toISOString();

    let bucket = this.data.rateLimitBuckets.find((b) => b.bucketKey === params.bucketKey);
    if (!bucket || new Date(bucket.expiresAt).getTime() <= nowMs) {
      if (bucket) {
        bucket.requestCount = 1;
        bucket.windowStart = nowIso;
        bucket.expiresAt = nextExpiryIso;
      } else {
        bucket = {
          bucketKey: params.bucketKey,
          requestCount: 1,
          windowStart: nowIso,
          expiresAt: nextExpiryIso,
        };
        this.data.rateLimitBuckets.push(bucket);
      }
      // Trim expired buckets
      this.data.rateLimitBuckets = this.data.rateLimitBuckets.filter(
        (b) => new Date(b.expiresAt).getTime() > nowMs,
      );
      this.flush();
      return {
        allowed: true,
        remaining: Math.max(0, params.maxRequests - 1),
        resetAt: nextExpiryIso,
      };
    }

    if (bucket.requestCount >= params.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: bucket.expiresAt,
      };
    }

    bucket.requestCount += 1;
    this.flush();
    return {
      allowed: true,
      remaining: Math.max(0, params.maxRequests - bucket.requestCount),
      resetAt: bucket.expiresAt,
    };
  }

  public async recordAudit(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>): Promise<void> {
    this.data.auditLogs.push({
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    });
    if (this.data.auditLogs.length > 200) {
      this.data.auditLogs = this.data.auditLogs.slice(-200);
    }
    this.flush();
  }
}

export const JsonDevCloudStore = CloudStore;

export function createCloudRepository(): CloudRepository {
  if (isPostgresConfigured()) {
    return new PostgresCloudStore();
  }
  return new CloudStore();
}
