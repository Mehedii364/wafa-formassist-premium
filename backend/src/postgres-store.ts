import crypto from 'node:crypto';
import {and, desc, eq, inArray, isNull, lte} from 'drizzle-orm';
import {db} from '../../src/db/index.ts';
import {
  auditLogs,
  authSessions,
  cloudAccounts,
  encryptedCloudBackups,
  encryptedVaultStates,
  rateLimitBuckets,
} from '../../src/db/schema.ts';
import type {EncryptedEnvelope} from '../../shared/schemas/types';
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

const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CLOUD_BACKUPS_PER_ACCOUNT = 10;

function toIso(date: Date | string): string {
  return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
}

function mapAccount(row: typeof cloudAccounts.$inferSelect): CloudAccount {
  return {
    id: row.id,
    firebaseUid: row.firebaseUid,
    email: row.email,
    passwordHash: row.passwordHash,
    passwordSalt: row.passwordSalt,
    recoveryHint: row.recoveryHint,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function mapSession(row: typeof authSessions.$inferSelect): CloudSession {
  return {
    tokenHash: row.tokenHash,
    accountId: row.accountId,
    csrfTokenHash: row.csrfTokenHash,
    deviceLabel: row.deviceLabel,
    createdAt: toIso(row.createdAt),
    lastActiveAt: toIso(row.lastActiveAt),
    expiresAt: toIso(row.expiresAt),
    revokedAt: row.revokedAt ? toIso(row.revokedAt) : null,
  };
}

function mapVault(row: typeof encryptedVaultStates.$inferSelect): EncryptedVaultState {
  return {
    accountId: row.accountId,
    currentVersion: row.currentVersion,
    envelope: row.envelopeJson as EncryptedEnvelope,
    lastIdempotencyKey: row.lastIdempotencyKey,
    updatedAt: toIso(row.updatedAt),
  };
}

function mapBackup(row: typeof encryptedCloudBackups.$inferSelect): EncryptedCloudBackup {
  return {
    id: row.id,
    accountId: row.accountId,
    label: row.label,
    schemaVersion: row.schemaVersion,
    integrityHash: row.integrityHash,
    byteSize: row.byteSize,
    envelope: row.envelopeJson as EncryptedEnvelope,
    createdAt: toIso(row.createdAt),
  };
}

function wrapDbError(operation: string, err: unknown): Error {
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as {code?: unknown}).code) : 'UNKNOWN';
  console.error(JSON.stringify({level: 'error', component: 'postgres-store', operation, pgCode: code}));
  if (code === '23505') {
    return new Error('DB_UNIQUE_CONFLICT', {cause: err});
  }
  return new Error('DB_OPERATION_FAILED', {cause: err});
}

export class PostgresCloudStore implements CloudRepository {
  public async findAccountByEmail(email: string): Promise<CloudAccount | undefined> {
    try {
      const normalized = email.trim().toLowerCase();
      const rows = await db
        .select()
        .from(cloudAccounts)
        .where(eq(cloudAccounts.email, normalized))
        .limit(1);
      return rows[0] ? mapAccount(rows[0]) : undefined;
    } catch (err) {
      throw wrapDbError('findAccountByEmail', err);
    }
  }

  public async findAccountById(id: string): Promise<CloudAccount | undefined> {
    try {
      const rows = await db
        .select()
        .from(cloudAccounts)
        .where(eq(cloudAccounts.id, id))
        .limit(1);
      return rows[0] ? mapAccount(rows[0]) : undefined;
    } catch (err) {
      throw wrapDbError('findAccountById', err);
    }
  }

  public async findAccountByFirebaseUid(firebaseUid: string): Promise<CloudAccount | undefined> {
    try {
      const rows = await db
        .select()
        .from(cloudAccounts)
        .where(eq(cloudAccounts.firebaseUid, firebaseUid))
        .limit(1);
      return rows[0] ? mapAccount(rows[0]) : undefined;
    } catch (err) {
      throw wrapDbError('findAccountByFirebaseUid', err);
    }
  }

  public async createAccount(params: {
    email: string;
    passwordHash: string;
    passwordSalt: string;
    recoveryHint?: string;
  }): Promise<CloudAccount> {
    try {
      const now = new Date();
      const [inserted] = await db
        .insert(cloudAccounts)
        .values({
          id: crypto.randomUUID(),
          email: params.email.trim().toLowerCase(),
          passwordHash: params.passwordHash,
          passwordSalt: params.passwordSalt,
          recoveryHint: params.recoveryHint ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return mapAccount(inserted);
    } catch (err) {
      throw wrapDbError('createAccount', err);
    }
  }

  public async upsertFirebaseAccount(params: {
    firebaseUid: string;
    email: string;
  }): Promise<CloudAccount> {
    try {
      const normalizedEmail = params.email.trim().toLowerCase();
      return await db.transaction(async (tx) => {
        const byUid = await tx
          .select()
          .from(cloudAccounts)
          .where(eq(cloudAccounts.firebaseUid, params.firebaseUid))
          .limit(1);

        if (byUid[0]) {
          const [updated] = await tx
            .update(cloudAccounts)
            .set({email: normalizedEmail, updatedAt: new Date()})
            .where(eq(cloudAccounts.id, byUid[0].id))
            .returning();
          return mapAccount(updated);
        }

        const byEmail = await tx
          .select()
          .from(cloudAccounts)
          .where(eq(cloudAccounts.email, normalizedEmail))
          .limit(1);

        if (byEmail[0]) {
          const [linked] = await tx
            .update(cloudAccounts)
            .set({firebaseUid: params.firebaseUid, updatedAt: new Date()})
            .where(eq(cloudAccounts.id, byEmail[0].id))
            .returning();
          return mapAccount(linked);
        }

        const now = new Date();
        const [created] = await tx
          .insert(cloudAccounts)
          .values({
            id: crypto.randomUUID(),
            firebaseUid: params.firebaseUid,
            email: normalizedEmail,
            passwordHash: null,
            passwordSalt: null,
            recoveryHint: null,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        return mapAccount(created);
      });
    } catch (err) {
      throw wrapDbError('upsertFirebaseAccount', err);
    }
  }

  public async createSession(params: {
    accountId: string;
    tokenHash: string;
    csrfTokenHash: string;
    deviceLabel: string;
    ttlMs?: number;
  }): Promise<CloudSession> {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (params.ttlMs ?? DEFAULT_SESSION_TTL_MS));
      const [inserted] = await db
        .insert(authSessions)
        .values({
          tokenHash: params.tokenHash,
          accountId: params.accountId,
          csrfTokenHash: params.csrfTokenHash,
          deviceLabel: (params.deviceLabel || 'Web Dashboard').slice(0, 80),
          createdAt: now,
          lastActiveAt: now,
          expiresAt,
          revokedAt: null,
        })
        .returning();
      return mapSession(inserted);
    } catch (err) {
      throw wrapDbError('createSession', err);
    }
  }

  public async findValidSession(
    tokenHash: string,
    idleTimeoutMs: number,
  ): Promise<CloudSession | undefined> {
    try {
      const rows = await db
        .select()
        .from(authSessions)
        .where(and(eq(authSessions.tokenHash, tokenHash), isNull(authSessions.revokedAt)))
        .limit(1);

      const row = rows[0];
      if (!row) return undefined;

      const nowMs = Date.now();
      if (row.expiresAt.getTime() <= nowMs) {
        return undefined;
      }
      if (nowMs - row.lastActiveAt.getTime() > idleTimeoutMs) {
        await db
          .update(authSessions)
          .set({revokedAt: new Date()})
          .where(eq(authSessions.tokenHash, tokenHash));
        return undefined;
      }

      return mapSession(row);
    } catch (err) {
      throw wrapDbError('findValidSession', err);
    }
  }

  public async touchSession(tokenHash: string): Promise<void> {
    try {
      await db
        .update(authSessions)
        .set({lastActiveAt: new Date()})
        .where(and(eq(authSessions.tokenHash, tokenHash), isNull(authSessions.revokedAt)));
    } catch (err) {
      throw wrapDbError('touchSession', err);
    }
  }

  public async revokeSession(tokenHash: string): Promise<void> {
    try {
      await db
        .update(authSessions)
        .set({revokedAt: new Date()})
        .where(eq(authSessions.tokenHash, tokenHash));
    } catch (err) {
      throw wrapDbError('revokeSession', err);
    }
  }

  public async revokeAllUserSessions(accountId: string): Promise<void> {
    try {
      await db
        .update(authSessions)
        .set({revokedAt: new Date()})
        .where(and(eq(authSessions.accountId, accountId), isNull(authSessions.revokedAt)));
    } catch (err) {
      throw wrapDbError('revokeAllUserSessions', err);
    }
  }

  public async getVaultState(accountId: string): Promise<EncryptedVaultState | undefined> {
    try {
      const rows = await db
        .select()
        .from(encryptedVaultStates)
        .where(eq(encryptedVaultStates.accountId, accountId))
        .limit(1);
      return rows[0] ? mapVault(rows[0]) : undefined;
    } catch (err) {
      throw wrapDbError('getVaultState', err);
    }
  }

  public async atomicPushVaultState(params: {
    accountId: string;
    baseVersion: number;
    idempotencyKey: string;
    envelope: EncryptedEnvelope;
    forceResolve?: boolean;
  }): Promise<AtomicPushVaultResult> {
    try {
      return await db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(encryptedVaultStates)
          .where(eq(encryptedVaultStates.accountId, params.accountId))
          .for('update');

        const current = rows[0];
        if (current && current.lastIdempotencyKey === params.idempotencyKey) {
          return {
            status: 'idempotent',
            version: current.currentVersion,
            updatedAt: toIso(current.updatedAt),
          };
        }

        if (current && current.currentVersion > params.baseVersion && !params.forceResolve) {
          return {
            status: 'conflict',
            remoteVersion: current.currentVersion,
            remoteUpdatedAt: toIso(current.updatedAt),
            remoteEnvelope: current.envelopeJson as EncryptedEnvelope,
          };
        }

        const nextVersion = (current?.currentVersion ?? 0) + 1;
        const now = new Date();

        if (current) {
          await tx
            .update(encryptedVaultStates)
            .set({
              currentVersion: nextVersion,
              envelopeJson: params.envelope,
              lastIdempotencyKey: params.idempotencyKey,
              updatedAt: now,
            })
            .where(eq(encryptedVaultStates.accountId, params.accountId));
        } else {
          await tx.insert(encryptedVaultStates).values({
            accountId: params.accountId,
            currentVersion: nextVersion,
            envelopeJson: params.envelope,
            lastIdempotencyKey: params.idempotencyKey,
            updatedAt: now,
          });
        }

        return {
          status: 'ok',
          version: nextVersion,
          updatedAt: now.toISOString(),
        };
      });
    } catch (err) {
      throw wrapDbError('atomicPushVaultState', err);
    }
  }

  public async listBackups(accountId: string): Promise<EncryptedCloudBackup[]> {
    try {
      const rows = await db
        .select()
        .from(encryptedCloudBackups)
        .where(eq(encryptedCloudBackups.accountId, accountId))
        .orderBy(desc(encryptedCloudBackups.createdAt));
      return rows.map(mapBackup);
    } catch (err) {
      throw wrapDbError('listBackups', err);
    }
  }

  public async addBackup(backup: {
    accountId: string;
    label: string;
    schemaVersion: string;
    integrityHash: string;
    byteSize: number;
    envelope: EncryptedEnvelope;
  }): Promise<EncryptedCloudBackup> {
    try {
      return await db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(encryptedCloudBackups)
          .values({
            id: crypto.randomUUID(),
            accountId: backup.accountId,
            label: backup.label,
            schemaVersion: backup.schemaVersion,
            integrityHash: backup.integrityHash,
            byteSize: backup.byteSize,
            envelopeJson: backup.envelope,
            createdAt: new Date(),
          })
          .returning();

        const all = await tx
          .select({id: encryptedCloudBackups.id})
          .from(encryptedCloudBackups)
          .where(eq(encryptedCloudBackups.accountId, backup.accountId))
          .orderBy(desc(encryptedCloudBackups.createdAt));

        if (all.length > MAX_CLOUD_BACKUPS_PER_ACCOUNT) {
          const toDelete = all.slice(MAX_CLOUD_BACKUPS_PER_ACCOUNT).map((r) => r.id);
          await tx
            .delete(encryptedCloudBackups)
            .where(
              and(
                eq(encryptedCloudBackups.accountId, backup.accountId),
                inArray(encryptedCloudBackups.id, toDelete),
              ),
            );
        }

        return mapBackup(inserted);
      });
    } catch (err) {
      throw wrapDbError('addBackup', err);
    }
  }

  public async deleteBackup(accountId: string, backupId: string): Promise<boolean> {
    try {
      const deleted = await db
        .delete(encryptedCloudBackups)
        .where(
          and(
            eq(encryptedCloudBackups.accountId, accountId),
            eq(encryptedCloudBackups.id, backupId),
          ),
        )
        .returning({id: encryptedCloudBackups.id});
      return deleted.length > 0;
    } catch (err) {
      throw wrapDbError('deleteBackup', err);
    }
  }

  public async deleteAccountAndAllCloudData(accountId: string): Promise<void> {
    try {
      // ON DELETE CASCADE cleans up sessions, vault state, and backups; audit logs set null.
      await db.delete(cloudAccounts).where(eq(cloudAccounts.id, accountId));
    } catch (err) {
      throw wrapDbError('deleteAccountAndAllCloudData', err);
    }
  }

  public async consumeRateLimit(params: {
    bucketKey: string;
    windowMs: number;
    maxRequests: number;
  }): Promise<RateLimitResult> {
    try {
      return await db.transaction(async (tx) => {
        const now = new Date();
        const nowMs = now.getTime();
        const nextExpiry = new Date(nowMs + params.windowMs);

        const rows = await tx
          .select()
          .from(rateLimitBuckets)
          .where(eq(rateLimitBuckets.bucketKey, params.bucketKey))
          .for('update');

        const existing = rows[0];
        if (!existing || existing.expiresAt.getTime() <= nowMs) {
          if (existing) {
            await tx
              .update(rateLimitBuckets)
              .set({
                requestCount: 1,
                windowStart: now,
                expiresAt: nextExpiry,
              })
              .where(eq(rateLimitBuckets.bucketKey, params.bucketKey));
          } else {
            await tx.insert(rateLimitBuckets).values({
              bucketKey: params.bucketKey,
              requestCount: 1,
              windowStart: now,
              expiresAt: nextExpiry,
            });
          }

          // Opportunistic cleanup of expired buckets (~5% of resets)
          if (Math.random() < 0.05) {
            await tx.delete(rateLimitBuckets).where(lte(rateLimitBuckets.expiresAt, now));
          }

          return {
            allowed: true,
            remaining: Math.max(0, params.maxRequests - 1),
            resetAt: nextExpiry.toISOString(),
          };
        }

        if (existing.requestCount >= params.maxRequests) {
          return {
            allowed: false,
            remaining: 0,
            resetAt: existing.expiresAt.toISOString(),
          };
        }

        const nextCount = existing.requestCount + 1;
        await tx
          .update(rateLimitBuckets)
          .set({requestCount: nextCount})
          .where(eq(rateLimitBuckets.bucketKey, params.bucketKey));

        return {
          allowed: true,
          remaining: Math.max(0, params.maxRequests - nextCount),
          resetAt: existing.expiresAt.toISOString(),
        };
      });
    } catch (err) {
      throw wrapDbError('consumeRateLimit', err);
    }
  }

  public async recordAudit(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        accountId: entry.accountId,
        action: entry.action,
        status: entry.status,
        requestIpHash: entry.ipHash,
        createdAt: new Date(),
      });
    } catch (err) {
      // Audit logging must not leak PII or crash request lifecycle if DB write fails transiently
      console.error(
        JSON.stringify({
          level: 'warn',
          component: 'postgres-store',
          operation: 'recordAudit',
          reason: err instanceof Error ? err.message : 'AUDIT_WRITE_FAILED',
        }),
      );
    }
  }
}
