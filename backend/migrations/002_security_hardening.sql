-- WAFA FormAssist Premium — Migration 002: Security Hardening & Persistent Rate Limiting
-- Synchronizes standalone PostgreSQL deployments with Drizzle schema (src/db/schema.ts).

ALTER TABLE cloud_accounts
  ADD COLUMN IF NOT EXISTS firebase_uid TEXT UNIQUE,
  ALTER COLUMN password_hash DROP NOT NULL,
  ALTER COLUMN password_salt DROP NOT NULL;

ALTER TABLE auth_sessions
  ADD COLUMN IF NOT EXISTS csrf_token_hash TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at);

ALTER TABLE encrypted_cloud_backups
  ADD COLUMN IF NOT EXISTS integrity_hash TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_expires ON rate_limit_buckets(expires_at);
