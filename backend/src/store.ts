import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {EncryptedEnvelope} from '../../shared/schemas/types';

export interface CloudAccount {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  recoveryHint?: string;
  createdAt: string;
}

export interface CloudSession {
  tokenHash: string;
  accountId: string;
  deviceLabel: string;
  createdAt: string;
  expiresAt: string;
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

interface PersistedCloudDb {
  accounts: CloudAccount[];
  sessions: CloudSession[];
  vaultStates: EncryptedVaultState[];
  backups: EncryptedCloudBackup[];
  auditLogs: AuditLogEntry[];
}

const EMPTY_DB: PersistedCloudDb = {
  accounts: [],
  sessions: [],
  vaultStates: [],
  backups: [],
  auditLogs: [],
};

/**
 * Atomic file-backed repository mirroring the PostgreSQL schema (backend/migrations/001_initial_schema.sql)
 * so the optional cloud sync backend runs out-of-the-box inside AI Studio while keeping a clean
 * drop-in boundary for PostgreSQL in external server deployments.
 */
export class CloudStore {
  private readonly filePath: string;
  private data: PersistedCloudDb;

  constructor(customPath?: string) {
    this.filePath =
      customPath ||
      path.join(os.tmpdir(), 'wafa-formassist-cloud-store.json');
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
          auditLogs: parsed.auditLogs || [],
        };
      }
    } catch {
      // Fallback to fresh store on read error
    }
    return structuredClone(EMPTY_DB);
  }

  private flush(): void {
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
    fs.renameSync(tmp, this.filePath);
  }

  public findAccountByEmail(email: string): CloudAccount | undefined {
    const norm = email.trim().toLowerCase();
    return this.data.accounts.find((a) => a.email === norm);
  }

  public findAccountById(id: string): CloudAccount | undefined {
    return this.data.accounts.find((a) => a.id === id);
  }

  public createAccount(params: {
    email: string;
    passwordHash: string;
    passwordSalt: string;
    recoveryHint?: string;
  }): CloudAccount {
    const account: CloudAccount = {
      id: crypto.randomUUID(),
      email: params.email.trim().toLowerCase(),
      passwordHash: params.passwordHash,
      passwordSalt: params.passwordSalt,
      recoveryHint: params.recoveryHint,
      createdAt: new Date().toISOString(),
    };
    this.data.accounts.push(account);
    this.flush();
    return account;
  }

  public createSession(accountId: string, tokenHash: string, deviceLabel: string): CloudSession {
    const now = Date.now();
    const session: CloudSession = {
      tokenHash,
      accountId,
      deviceLabel: deviceLabel || 'Web Dashboard',
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    this.data.sessions.push(session);
    this.flush();
    return session;
  }

  public findValidSession(tokenHash: string): CloudSession | undefined {
    const now = new Date().toISOString();
    return this.data.sessions.find((s) => s.tokenHash === tokenHash && s.expiresAt > now);
  }

  public deleteSession(tokenHash: string): void {
    this.data.sessions = this.data.sessions.filter((s) => s.tokenHash !== tokenHash);
    this.flush();
  }

  public getVaultState(accountId: string): EncryptedVaultState | undefined {
    return this.data.vaultStates.find((v) => v.accountId === accountId);
  }

  public upsertVaultState(state: EncryptedVaultState): void {
    const idx = this.data.vaultStates.findIndex((v) => v.accountId === state.accountId);
    if (idx >= 0) {
      this.data.vaultStates[idx] = state;
    } else {
      this.data.vaultStates.push(state);
    }
    this.flush();
  }

  public listBackups(accountId: string): EncryptedCloudBackup[] {
    return this.data.backups
      .filter((b) => b.accountId === accountId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public addBackup(backup: Omit<EncryptedCloudBackup, 'id' | 'createdAt'>): EncryptedCloudBackup {
    const entry: EncryptedCloudBackup = {
      ...backup,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.data.backups.push(entry);
    // Apply minimum cloud retention: retain most recent 10 encrypted backups per account
    const userBackups = this.listBackups(backup.accountId);
    if (userBackups.length > 10) {
      const toRemove = new Set(userBackups.slice(10).map((b) => b.id));
      this.data.backups = this.data.backups.filter((b) => !toRemove.has(b.id));
    }
    this.flush();
    return entry;
  }

  public deleteBackup(accountId: string, backupId: string): boolean {
    const before = this.data.backups.length;
    this.data.backups = this.data.backups.filter(
      (b) => !(b.accountId === accountId && b.id === backupId),
    );
    const changed = this.data.backups.length !== before;
    if (changed) this.flush();
    return changed;
  }

  public deleteAccountAndAllCloudData(accountId: string): void {
    this.data.accounts = this.data.accounts.filter((a) => a.id !== accountId);
    this.data.sessions = this.data.sessions.filter((s) => s.accountId !== accountId);
    this.data.vaultStates = this.data.vaultStates.filter((v) => v.accountId !== accountId);
    this.data.backups = this.data.backups.filter((b) => b.accountId !== accountId);
    this.flush();
  }

  public recordAudit(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>): void {
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
