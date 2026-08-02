-- =============================================================================
-- Migration 004 — Auth Extensions + RBAC
-- Extends users table with brute-force / MFA / account-status columns.
-- Extends user_sessions for refresh-token rotation.
-- Adds roles / permissions / user_roles / role_permissions tables.
-- Run after 003_schema_additions.sql.
-- Enum ADD VALUE statements must execute outside a transaction block.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend user_role enum with frontend-facing role names
--    (IF NOT EXISTS requires PG 10+; Replit uses PG 15)
-- ---------------------------------------------------------------------------
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'administrateur';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'directeur';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'medecin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'infirmier';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'reception';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'laboratoire';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'radiologie';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'pharmacie';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'rh';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- ---------------------------------------------------------------------------
-- 2. Schema additions within a transaction
-- ---------------------------------------------------------------------------
BEGIN;

-- ── 2a. Extend users table ─────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_number     TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone               TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS language            TEXT NOT NULL DEFAULT 'fr';
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until        TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status      TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled         BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret_enc      TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS version             INT NOT NULL DEFAULT 1;

-- Check constraint for account_status (idempotent via DO)
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_account_status_check
    CHECK (account_status IN ('active','inactive','suspended','locked'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2b. Extend user_sessions for refresh-token rotation ───────────────────
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS revoked_at   TIMESTAMPTZ;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS rotated_to   UUID;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'refresh';

-- ── 2c. RBAC — roles ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2d. RBAC — permissions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  module      TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2e. RBAC — user_roles ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_roles (
  user_id    UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  role_id    UUID NOT NULL REFERENCES roles(id)  ON DELETE CASCADE,
  granted_by UUID          REFERENCES users(id)  ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

-- ── 2f. RBAC — role_permissions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id)       ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ── 2g. Indexes ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_roles_user    ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role    ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_role_perms_role    ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_sessions_revoked   ON user_sessions(revoked_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status);
CREATE INDEX IF NOT EXISTS idx_users_locked_until   ON users(locked_until) WHERE locked_until IS NOT NULL;

COMMIT;
