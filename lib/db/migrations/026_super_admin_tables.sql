-- =============================================================================
-- Migration 026 — Super Administration Tables
-- =============================================================================

-- ── Enums ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE system_backup_status   AS ENUM ('queued','running','completed','failed','expired','deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE system_backup_type     AS ENUM ('postgresql','storage_metadata','configuration','full');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE system_job_status      AS ENUM ('pending','scheduled','running','completed','failed','cancelled','retrying');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE system_job_type        AS ENUM (
    'notification','email','sms','pdf_generation','report',
    'insurance_alert','contract_expiration','document_retention',
    'payroll','backup','cleanup','webhook_delivery','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE system_log_level       AS ENUM ('debug','info','warning','error','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE system_integration_type AS ENUM (
    'smtp','sms','whatsapp','object_storage','pacs','hl7','fhir',
    'badge_device','payment_gateway','cnas','casnos','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── system_backups ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_backups (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_number    SERIAL,
  type             system_backup_type    NOT NULL DEFAULT 'postgresql',
  status           system_backup_status  NOT NULL DEFAULT 'queued',
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  size_bytes       BIGINT,
  storage_location TEXT,
  checksum         TEXT,
  retention_until  TIMESTAMPTZ,
  encrypted        BOOLEAN NOT NULL DEFAULT TRUE,
  initiated_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  notes            TEXT,
  protected        BOOLEAN NOT NULL DEFAULT FALSE,
  error_message    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_backups_status ON system_backups(status);
CREATE INDEX IF NOT EXISTS idx_system_backups_type   ON system_backups(type);
CREATE INDEX IF NOT EXISTS idx_system_backups_created ON system_backups(created_at DESC);

-- ── system_jobs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            system_job_type   NOT NULL,
  status          system_job_status NOT NULL DEFAULT 'pending',
  priority        SMALLINT NOT NULL DEFAULT 5,
  attempts        SMALLINT NOT NULL DEFAULT 0,
  max_attempts    SMALLINT NOT NULL DEFAULT 3,
  scheduled_at    TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,
  error_message   TEXT,
  payload_summary JSONB,
  logs            TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_jobs_status    ON system_jobs(status);
CREATE INDEX IF NOT EXISTS idx_system_jobs_type      ON system_jobs(type);
CREATE INDEX IF NOT EXISTS idx_system_jobs_created   ON system_jobs(created_at DESC);

-- ── system_logs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level        system_log_level NOT NULL DEFAULT 'info',
  module       TEXT,
  message      TEXT NOT NULL,
  context      JSONB,
  request_id   TEXT,
  user_id      UUID,
  ip           TEXT,
  status_code  INTEGER,
  environment  TEXT DEFAULT 'production',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_level   ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_module  ON system_logs(module);
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_user    ON system_logs(user_id);

-- ── system_api_keys ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  key_prefix   TEXT NOT NULL,
  hashed_key   TEXT NOT NULL UNIQUE,
  scopes       TEXT[] NOT NULL DEFAULT '{}',
  site_id      UUID,
  expires_at   TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  revoked_at   TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_api_keys_status  ON system_api_keys(status);
CREATE INDEX IF NOT EXISTS idx_system_api_keys_prefix  ON system_api_keys(key_prefix);

-- ── system_webhooks ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_webhooks (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  endpoint_url       TEXT NOT NULL,
  events             TEXT[] NOT NULL DEFAULT '{}',
  hashed_secret      TEXT NOT NULL,
  active             BOOLEAN NOT NULL DEFAULT TRUE,
  retry_policy       JSONB NOT NULL DEFAULT '{"maxAttempts":3,"backoffSeconds":60}',
  last_delivery_at   TIMESTAMPTZ,
  last_status        INTEGER,
  failure_count      INTEGER NOT NULL DEFAULT 0,
  created_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_webhooks_active ON system_webhooks(active);

-- ── system_webhook_deliveries ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_webhook_deliveries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id    UUID NOT NULL REFERENCES system_webhooks(id) ON DELETE CASCADE,
  event         TEXT NOT NULL,
  status_code   INTEGER,
  response_body TEXT,
  error_message TEXT,
  attempt       SMALLINT NOT NULL DEFAULT 1,
  delivered_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON system_webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created ON system_webhook_deliveries(delivered_at DESC);

-- ── system_integrations ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_integrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            system_integration_type NOT NULL,
  label           TEXT NOT NULL,
  configured      BOOLEAN NOT NULL DEFAULT FALSE,
  enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  config_masked   JSONB NOT NULL DEFAULT '{}',
  config_encrypted TEXT,
  last_test_at    TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error      TEXT,
  environment     TEXT NOT NULL DEFAULT 'production',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_system_integrations_type_env ON system_integrations(type, environment);

-- ── system_feature_flags ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_feature_flags (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key                TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  description        TEXT,
  enabled            BOOLEAN NOT NULL DEFAULT FALSE,
  environment        TEXT NOT NULL DEFAULT 'production',
  site_id            UUID,
  rollout_percentage INTEGER NOT NULL DEFAULT 100 CHECK (rollout_percentage BETWEEN 0 AND 100),
  allowed_roles      TEXT[] DEFAULT NULL,
  updated_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_env ON system_feature_flags(environment);

-- Seed default feature flags
INSERT INTO system_feature_flags (key, name, description, enabled, environment) VALUES
  ('portal_patient',       'Portail Patient',        'Accès au portail patient externe',           FALSE, 'production'),
  ('portal_doctor',        'Portail Médecin',         'Accès au portail médecin externe',           FALSE, 'production'),
  ('offline_editing',      'Édition hors ligne',     'Modification des formulaires hors connexion', FALSE, 'production'),
  ('biometric_login',      'Connexion biométrique',  'Authentification par empreinte/Face ID',      FALSE, 'production'),
  ('external_pacs',        'PACS externe',           'Intégration PACS radiologie',                FALSE, 'production'),
  ('advanced_analytics',   'Analytics avancées',     'Tableaux de bord analytiques avancés',       TRUE,  'production'),
  ('maintenance_mode',     'Mode maintenance',       'Drapeau mode maintenance (géré automatiquement)', FALSE, 'production')
ON CONFLICT (key) DO NOTHING;

-- ── system_maintenance ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_maintenance (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  message       TEXT NOT NULL DEFAULT 'Système en maintenance. Veuillez réessayer plus tard.',
  message_ar    TEXT NOT NULL DEFAULT 'النظام في وضع الصيانة. يرجى المحاولة لاحقاً.',
  message_en    TEXT NOT NULL DEFAULT 'System is under maintenance. Please try again later.',
  start_at      TIMESTAMPTZ,
  end_at        TIMESTAMPTZ,
  allowed_roles TEXT[] NOT NULL DEFAULT ARRAY['super_admin','system_administrator'],
  allowed_ips   TEXT[] NOT NULL DEFAULT '{}',
  updated_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed a single maintenance row
INSERT INTO system_maintenance (enabled) VALUES (FALSE) ON CONFLICT DO NOTHING;

-- ── system_settings ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_settings (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_name          TEXT NOT NULL DEFAULT 'IRISSAM Hospital',
  hospital_name_ar       TEXT,
  logo_url               TEXT,
  address                TEXT,
  phone                  TEXT,
  email                  TEXT,
  currency               TEXT NOT NULL DEFAULT 'DZD',
  timezone               TEXT NOT NULL DEFAULT 'Africa/Algiers',
  date_format            TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
  default_language       TEXT NOT NULL DEFAULT 'fr',
  mrn_format             TEXT NOT NULL DEFAULT 'MRN-{YYYY}-{SEQ6}',
  encounter_number_format TEXT NOT NULL DEFAULT 'ENC-{YYYY}-{SEQ6}',
  invoice_number_format  TEXT NOT NULL DEFAULT 'INV-{YYYY}-{SEQ6}',
  admission_number_format TEXT NOT NULL DEFAULT 'ADM-{YYYY}-{SEQ6}',
  backup_retention_days  INTEGER NOT NULL DEFAULT 30,
  session_duration_hours INTEGER NOT NULL DEFAULT 8,
  password_policy        JSONB NOT NULL DEFAULT '{"minLength":8,"requireUppercase":true,"requireNumber":true,"requireSymbol":false,"maxAgeDays":90}',
  notification_settings  JSONB NOT NULL DEFAULT '{"emailEnabled":false,"smsEnabled":false,"whatsappEnabled":false}',
  pwa_settings           JSONB NOT NULL DEFAULT '{"offlineEnabled":true,"pushEnabled":false}',
  blocked_ips            TEXT[] NOT NULL DEFAULT '{}',
  allowlisted_ips        TEXT[] NOT NULL DEFAULT '{}',
  updated_by             UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed defaults
INSERT INTO system_settings DEFAULT VALUES ON CONFLICT DO NOTHING;

-- ── system_release_notes ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_release_notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version      TEXT NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  environment  TEXT NOT NULL DEFAULT 'production',
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_release_notes_version ON system_release_notes(version);

-- ── system_rate_limit_policies ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_rate_limit_policies (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL UNIQUE,
  endpoint_pattern   TEXT NOT NULL,
  limit_count        INTEGER NOT NULL DEFAULT 100,
  window_seconds     INTEGER NOT NULL DEFAULT 60,
  role_overrides     JSONB NOT NULL DEFAULT '{}',
  enabled            BOOLEAN NOT NULL DEFAULT TRUE,
  action_on_exceeded TEXT NOT NULL DEFAULT 'block' CHECK (action_on_exceeded IN ('block','throttle','alert')),
  alert_threshold    INTEGER,
  is_login_policy    BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default rate limit policies
INSERT INTO system_rate_limit_policies (name, endpoint_pattern, limit_count, window_seconds, is_login_policy) VALUES
  ('login',           '/api/auth/login',          10,  300,  TRUE),
  ('refresh',         '/api/auth/refresh',         60,  60,   FALSE),
  ('password_reset',  '/api/auth/reset-password',  5,   3600, FALSE),
  ('patient_search',  '/api/patients',             200, 60,   FALSE),
  ('export',          '/api/*/export',             10,  60,   FALSE),
  ('pdf_generation',  '/api/*/pdf',                20,  60,   FALSE),
  ('file_downloads',  '/api/storage/*',            100, 60,   FALSE),
  ('admin_endpoints', '/api/system/*',             300, 60,   FALSE)
ON CONFLICT (name) DO NOTHING;

-- ── system_step_up_tokens ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_step_up_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_step_up_tokens_user    ON system_step_up_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_step_up_tokens_expires ON system_step_up_tokens(expires_at);
