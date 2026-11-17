-- WAFA FormAssist Premium — Optional Cloud Sync Backend Schema (PostgreSQL)
-- Strict Zero-PII Cloud Architecture:
-- Never stores plaintext NID, passport, birth registration, personal addresses, or academic records.
-- All applicant vault payloads MUST be AES-GCM-256 encrypted client-side before upload.

CREATE TABLE IF NOT EXISTS cloud_accounts (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  recovery_hint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES cloud_accounts(id) ON DELETE CASCADE,
  device_label TEXT NOT NULL DEFAULT 'Web Dashboard',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_account ON auth_sessions(account_id);

CREATE TABLE IF NOT EXISTS encrypted_vault_states (
  account_id UUID PRIMARY KEY REFERENCES cloud_accounts(id) ON DELETE CASCADE,
  current_version INTEGER NOT NULL DEFAULT 0,
  envelope_json JSONB NOT NULL,
  last_idempotency_key TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS encrypted_cloud_backups (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES cloud_accounts(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  envelope_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cloud_backups_account ON encrypted_cloud_backups(account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS adapter_releases (
  adapter_id TEXT NOT NULL,
  version TEXT NOT NULL,
  spec_json JSONB NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (adapter_id, version)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  account_id UUID REFERENCES cloud_accounts(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  request_ip_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Intentionally excludes personal profile values, passphrases, or tokens.
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_account ON audit_logs(account_id, created_at DESC);
