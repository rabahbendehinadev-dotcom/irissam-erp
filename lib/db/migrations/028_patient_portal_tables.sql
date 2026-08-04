-- =============================================================================
-- Migration 028 — Patient Portal Tables
-- =============================================================================

-- ── Enums ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE portal_account_status AS ENUM (
    'pending_activation','active','suspended','locked','archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE portal_message_status AS ENUM ('open','assigned','answered','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE portal_message_type AS ENUM (
    'administrative','appointment','document_request',
    'invoice_dispute','insurance_update','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE portal_appt_request_status AS ENUM (
    'draft','submitted','under_review','approved',
    'proposed_new_date','rejected','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE portal_consent_status AS ENUM ('pending','signed','refused','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE portal_notification_type AS ENUM (
    'appointment_approved','appointment_changed','appointment_reminder',
    'lab_result_published','imaging_published','prescription_new',
    'invoice_new','payment_recorded','insurance_expiring',
    'document_new','message_received','general'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── patient_portal_accounts ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patient_portal_accounts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id             UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  email                  TEXT,
  phone                  TEXT,
  password_hash          TEXT,
  status                 portal_account_status NOT NULL DEFAULT 'pending_activation',
  email_verified         BOOLEAN NOT NULL DEFAULT FALSE,
  phone_verified         BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at          TIMESTAMPTZ,
  failed_login_attempts  INT NOT NULL DEFAULT 0,
  locked_until           TIMESTAMPTZ,
  mfa_enabled            BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret             TEXT,
  force_password_change  BOOLEAN NOT NULL DEFAULT TRUE,
  activation_token       TEXT,
  activation_token_exp   TIMESTAMPTZ,
  reset_token            TEXT,
  reset_token_exp        TIMESTAMPTZ,
  otp_code               TEXT,
  otp_exp                TIMESTAMPTZ,
  otp_attempts           INT NOT NULL DEFAULT 0,
  preferred_language     TEXT NOT NULL DEFAULT 'fr',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at             TIMESTAMPTZ,
  UNIQUE(patient_id),
  UNIQUE(email)
);

CREATE INDEX IF NOT EXISTS idx_portal_accounts_patient ON patient_portal_accounts(patient_id);
CREATE INDEX IF NOT EXISTS idx_portal_accounts_email   ON patient_portal_accounts(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_portal_accounts_status  ON patient_portal_accounts(status);

-- ── patient_portal_sessions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patient_portal_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID NOT NULL REFERENCES patient_portal_accounts(id) ON DELETE CASCADE,
  patient_id          UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  refresh_token_hash  TEXT NOT NULL UNIQUE,
  device_id           UUID,
  ip                  TEXT,
  user_agent          TEXT,
  expires_at          TIMESTAMPTZ NOT NULL,
  revoked_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_sessions_account   ON patient_portal_sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_rt_hash   ON patient_portal_sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_expires   ON patient_portal_sessions(expires_at);

-- ── patient_portal_devices ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patient_portal_devices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     UUID NOT NULL REFERENCES patient_portal_accounts(id) ON DELETE CASCADE,
  device_name    TEXT NOT NULL DEFAULT 'Appareil inconnu',
  device_type    TEXT NOT NULL DEFAULT 'browser',
  os             TEXT,
  browser        TEXT,
  push_token     TEXT,
  push_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at   TIMESTAMPTZ,
  trusted        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_devices_account ON patient_portal_devices(account_id);

-- ── patient_portal_notifications ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patient_portal_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL REFERENCES patient_portal_accounts(id) ON DELETE CASCADE,
  patient_id  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  type        portal_notification_type NOT NULL DEFAULT 'general',
  title       TEXT NOT NULL,
  body        TEXT,
  link        TEXT,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_notif_account ON patient_portal_notifications(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_notif_unread  ON patient_portal_notifications(account_id) WHERE read = FALSE;

-- ── patient_portal_messages ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patient_portal_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   UUID NOT NULL REFERENCES patient_portal_accounts(id) ON DELETE CASCADE,
  patient_id   UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  type         portal_message_type NOT NULL DEFAULT 'other',
  subject      TEXT NOT NULL,
  body         TEXT NOT NULL,
  status       portal_message_status NOT NULL DEFAULT 'open',
  assigned_to  UUID REFERENCES users(id) ON DELETE SET NULL,
  reply        TEXT,
  replied_at   TIMESTAMPTZ,
  replied_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  closed_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_messages_account ON patient_portal_messages(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_messages_status  ON patient_portal_messages(status);

-- ── patient_portal_appointment_requests ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS patient_portal_appointment_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID NOT NULL REFERENCES patient_portal_accounts(id) ON DELETE CASCADE,
  patient_id        UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  service           TEXT NOT NULL,
  motif             TEXT NOT NULL,
  preferred_site    TEXT,
  preferred_date    DATE,
  preferred_period  TEXT CHECK (preferred_period IN ('matin','apres_midi','any')),
  preferred_doctor  TEXT,
  notes             TEXT,
  attachment_url    TEXT,
  status            portal_appt_request_status NOT NULL DEFAULT 'draft',
  admin_notes       TEXT,
  proposed_date     TIMESTAMPTZ,
  appointment_id    UUID REFERENCES appointments(id) ON DELETE SET NULL,
  reviewed_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_appt_req_account ON patient_portal_appointment_requests(account_id);
CREATE INDEX IF NOT EXISTS idx_portal_appt_req_status  ON patient_portal_appointment_requests(status);

-- ── patient_portal_consents ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patient_portal_consents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       UUID NOT NULL REFERENCES patient_portal_accounts(id) ON DELETE CASCADE,
  patient_id       UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  document_url     TEXT,
  document_hash    TEXT,
  status           portal_consent_status NOT NULL DEFAULT 'pending',
  signed_at        TIMESTAMPTZ,
  refused_at       TIMESTAMPTZ,
  refusal_reason   TEXT,
  ip               TEXT,
  user_agent       TEXT,
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_consents_account ON patient_portal_consents(account_id);
CREATE INDEX IF NOT EXISTS idx_portal_consents_status  ON patient_portal_consents(status);

-- ── patient_portal_access_logs ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patient_portal_access_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID REFERENCES patient_portal_accounts(id) ON DELETE SET NULL,
  patient_id  UUID REFERENCES patients(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  resource    TEXT,
  resource_id UUID,
  ip          TEXT,
  user_agent  TEXT,
  success     BOOLEAN NOT NULL DEFAULT TRUE,
  meta        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_logs_account ON patient_portal_access_logs(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_logs_action  ON patient_portal_access_logs(action, created_at DESC);

-- ── Publishing columns on lab_orders ──────────────────────────────────────────
ALTER TABLE lab_orders
  ADD COLUMN IF NOT EXISTS published_to_patient BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS published_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS patient_visible_note TEXT;

-- ── Publishing columns on imaging_orders ──────────────────────────────────────
ALTER TABLE imaging_orders
  ADD COLUMN IF NOT EXISTS published_to_patient BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS published_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS patient_visible_note TEXT;

-- ── publishing columns on prescriptions ───────────────────────────────────────
ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS published_to_patient BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS published_at         TIMESTAMPTZ DEFAULT now();

-- ── publishing columns on document_records (GED) ──────────────────────────────
ALTER TABLE document_records
  ADD COLUMN IF NOT EXISTS published_to_patient BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS published_at         TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_doc_published_patient
  ON document_records(patient_id, published_at DESC)
  WHERE published_to_patient = TRUE AND deleted_at IS NULL;

-- ── Indexes for publishing queries ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_lab_published
  ON lab_orders(patient_id, published_at DESC)
  WHERE published_to_patient = TRUE AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_imaging_published
  ON imaging_orders(patient_id, published_at DESC)
  WHERE published_to_patient = TRUE AND deleted_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_confidentiality'
                 AND EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = pg_type.oid AND enumlabel = 'patient')) THEN
    -- Enum doesn't have 'patient' value — we use the published_to_patient column instead
    NULL;
  END IF;
END $$;
