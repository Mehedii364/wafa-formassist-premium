import type {EncryptedEnvelope} from '../../shared/schemas/types';

export interface CloudAccount {
  id: string;
  firebaseUid?: string | null;
  email: string;
  passwordHash: string | null;
  passwordSalt: string | null;
  recoveryHint?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface CloudSession {
  tokenHash: string;
  accountId: string;
  csrfTokenHash: string;
  deviceLabel: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

export interface EncryptedVaultState {
  accountId: string;
  currentVersion: number;
  envelope: EncryptedEnvelope;
  lastIdempotencyKey: string;
  updatedAt: string;
}

export interface EncryptedCloudBackup {
  id: string;
  accountId: string;
  label: string;
  schemaVersion: string;
  integrityHash: string;
  byteSize: number;
  envelope: EncryptedEnvelope;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  accountId: string | null;
  action: string;
  status: 'ok' | 'rejected' | 'conflict' | 'error';
  ipHash: string;
  createdAt: string;
}

export type AtomicPushVaultResult =
  | {
      status: 'ok';
      version: number;
      updatedAt: string;
    }
  | {
      status: 'idempotent';
      version: number;
      updatedAt: string;
    }
  | {
      status: 'conflict';
      remoteVersion: number;
      remoteUpdatedAt: string;
      remoteEnvelope: EncryptedEnvelope;
    };

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: string;
}

export interface CloudRepository {
  findAccountByEmail(email: string): Promise<CloudAccount | undefined>;
  findAccountById(id: string): Promise<CloudAccount | undefined>;
  findAccountByFirebaseUid(firebaseUid: string): Promise<CloudAccount | undefined>;
  createAccount(params: {
    email: string;
    passwordHash: string;
    passwordSalt: string;
    recoveryHint?: string;
  }): Promise<CloudAccount>;
  upsertFirebaseAccount(params: {
    firebaseUid: string;
    email: string;
  }): Promise<CloudAccount>;

  createSession(params: {
    accountId: string;
    tokenHash: string;
    csrfTokenHash: string;
    deviceLabel: string;
    ttlMs?: number;
  }): Promise<CloudSession>;
  findValidSession(tokenHash: string, idleTimeoutMs: number): Promise<CloudSession | undefined>;
  touchSession(tokenHash: string): Promise<void>;
  revokeSession(tokenHash: string): Promise<void>;
  revokeAllUserSessions(accountId: string): Promise<void>;

  getVaultState(accountId: string): Promise<EncryptedVaultState | undefined>;
  atomicPushVaultState(params: {
    accountId: string;
    baseVersion: number;
    idempotencyKey: string;
    envelope: EncryptedEnvelope;
    forceResolve?: boolean;
  }): Promise<AtomicPushVaultResult>;

  listBackups(accountId: string): Promise<EncryptedCloudBackup[]>;
  addBackup(backup: {
    accountId: string;
    label: string;
    schemaVersion: string;
    integrityHash: string;
    byteSize: number;
    envelope: EncryptedEnvelope;
  }): Promise<EncryptedCloudBackup>;
  deleteBackup(accountId: string, backupId: string): Promise<boolean>;

  deleteAccountAndAllCloudData(accountId: string): Promise<void>;

  consumeRateLimit(params: {
    bucketKey: string;
    windowMs: number;
    maxRequests: number;
  }): Promise<RateLimitResult>;

  recordAudit(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>): Promise<void>;
}
