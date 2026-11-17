import {relations} from 'drizzle-orm';
import {
  bigserial,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const cloudAccounts = pgTable('cloud_accounts', {
  id: uuid('id').primaryKey(),
  firebaseUid: text('firebase_uid').unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  passwordSalt: text('password_salt'),
  recoveryHint: text('recovery_hint'),
  createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', {withTimezone: true}).defaultNow().notNull(),
});

export const authSessions = pgTable(
  'auth_sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => cloudAccounts.id, {onDelete: 'cascade'}),
    csrfTokenHash: text('csrf_token_hash').notNull(),
    deviceLabel: text('device_label').notNull().default('Web Dashboard'),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
    lastActiveAt: timestamp('last_active_at', {withTimezone: true}).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', {withTimezone: true}).notNull(),
    revokedAt: timestamp('revoked_at', {withTimezone: true}),
  },
  (table) => [
    index('idx_auth_sessions_account').on(table.accountId),
    index('idx_auth_sessions_expires').on(table.expiresAt),
  ],
);

export const encryptedVaultStates = pgTable('encrypted_vault_states', {
  accountId: uuid('account_id')
    .primaryKey()
    .references(() => cloudAccounts.id, {onDelete: 'cascade'}),
  currentVersion: integer('current_version').notNull().default(0),
  envelopeJson: jsonb('envelope_json').notNull(),
  lastIdempotencyKey: text('last_idempotency_key').notNull(),
  updatedAt: timestamp('updated_at', {withTimezone: true}).defaultNow().notNull(),
});

export const encryptedCloudBackups = pgTable(
  'encrypted_cloud_backups',
  {
    id: uuid('id').primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => cloudAccounts.id, {onDelete: 'cascade'}),
    label: text('label').notNull(),
    schemaVersion: text('schema_version').notNull(),
    integrityHash: text('integrity_hash').notNull(),
    byteSize: integer('byte_size').notNull(),
    envelopeJson: jsonb('envelope_json').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
  },
  (table) => [index('idx_cloud_backups_account').on(table.accountId, table.createdAt)],
);

export const adapterReleases = pgTable(
  'adapter_releases',
  {
    adapterId: text('adapter_id').notNull(),
    version: text('version').notNull(),
    specJson: jsonb('spec_json').notNull(),
    publishedAt: timestamp('published_at', {withTimezone: true}).defaultNow().notNull(),
  },
  (table) => [primaryKey({columns: [table.adapterId, table.version]})],
);

export const rateLimitBuckets = pgTable(
  'rate_limit_buckets',
  {
    bucketKey: text('bucket_key').primaryKey(),
    requestCount: integer('request_count').notNull().default(1),
    windowStart: timestamp('window_start', {withTimezone: true}).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', {withTimezone: true}).notNull(),
  },
  (table) => [index('idx_rate_limit_expires').on(table.expiresAt)],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigserial('id', {mode: 'number'}).primaryKey(),
    accountId: uuid('account_id').references(() => cloudAccounts.id, {onDelete: 'set null'}),
    action: text('action').notNull(),
    status: text('status').notNull(),
    requestIpHash: text('request_ip_hash').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true}).defaultNow().notNull(),
  },
  (table) => [index('idx_audit_logs_account').on(table.accountId, table.createdAt)],
);

export const cloudAccountsRelations = relations(cloudAccounts, ({many, one}) => ({
  sessions: many(authSessions),
  vaultState: one(encryptedVaultStates),
  backups: many(encryptedCloudBackups),
  auditLogs: many(auditLogs),
}));

export const authSessionsRelations = relations(authSessions, ({one}) => ({
  account: one(cloudAccounts, {
    fields: [authSessions.accountId],
    references: [cloudAccounts.id],
  }),
}));

export const encryptedVaultStatesRelations = relations(encryptedVaultStates, ({one}) => ({
  account: one(cloudAccounts, {
    fields: [encryptedVaultStates.accountId],
    references: [cloudAccounts.id],
  }),
}));

export const encryptedCloudBackupsRelations = relations(encryptedCloudBackups, ({one}) => ({
  account: one(cloudAccounts, {
    fields: [encryptedCloudBackups.accountId],
    references: [cloudAccounts.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({one}) => ({
  account: one(cloudAccounts, {
    fields: [auditLogs.accountId],
    references: [cloudAccounts.id],
  }),
}));
