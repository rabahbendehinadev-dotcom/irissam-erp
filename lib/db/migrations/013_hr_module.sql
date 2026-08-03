-- =============================================================================
-- Migration 013 — Module Ressources Humaines (RH)
-- 26 tables, 15 enums, full audit/soft-delete pattern
-- Safe to run on a clean DB or incrementally (CREATE TYPE IF NOT EXISTS / CREATE TABLE IF NOT EXISTS)
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- -1. Extensions required
-- ---------------------------------------------------------------------------
-- btree_gist is needed for EXCLUDE USING gist on scalar (UUID/text) columns
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------------
-- 0. Enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE employee_status AS ENUM (
    'actif','en_conge','absent','suspendu','detache',
    'en_formation','en_arret','fin_contrat','archive'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE personnel_category AS ENUM (
    'medical','paramedical','administratif','technique','support'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE gender_type AS ENUM ('M','F','autre');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE contract_type AS ENUM (
    'CDI','CDD','vacataire','garde','stage','prestataire','convention'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE contract_status AS ENUM (
    'brouillon','actif','periode_essai','suspendu','expire','resilie','renouvele'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE shift_type AS ENUM (
    'matin','apres_midi','nuit','garde_12h','garde_24h',
    'astreinte','repos','formation'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE shift_status AS ENUM (
    'planifie','confirme','en_cours','termine','annule','remplace'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE attendance_status AS ENUM (
    'present','absent','retard','sorti','en_pause',
    'en_mission','en_garde','non_pointe'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE attendance_source AS ENUM (
    'badge','qr_code','manuel','mobile','import','api_badgeuse'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE leave_type AS ENUM (
    'annuel','maladie','maternite','paternite','mariage',
    'deces_familial','sans_solde','recuperation','formation','exceptionnel'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE leave_status AS ENUM (
    'brouillon','soumise','validation_manager','validation_rh',
    'approuvee','rejetee','annulee'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE absence_type AS ENUM (
    'injustifiee','maladie','mission','formation',
    'accident_travail','conge_exceptionnel','suspension','autre'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE absence_status AS ENUM (
    'brouillon','soumise','approuvee','rejetee','annulee'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE late_status AS ENUM (
    'en_attente','justifie','non_justifie','approuve','rejete'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE overtime_compensation AS ENUM ('paiement','recuperation');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE badge_event_type AS ENUM (
    'check_in','check_out','break_start','break_end',
    'access_granted','access_denied'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE badge_device_status AS ENUM ('active','offline','maintenance','retired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 1. Organisational units (departments, positions, sites)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS hr_departments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(20)  NOT NULL UNIQUE,
  name          VARCHAR(200) NOT NULL,
  parent_id     UUID REFERENCES hr_departments(id),
  site_id       VARCHAR(100),
  manager_id    UUID,              -- FK to employees added below
  description   TEXT,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  version       INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  created_by    UUID,
  updated_by    UUID,
  deleted_by    UUID
);

CREATE TABLE IF NOT EXISTS employee_positions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                   VARCHAR(50)  NOT NULL UNIQUE,
  name                   VARCHAR(200) NOT NULL,
  category               personnel_category,
  department_id          UUID REFERENCES hr_departments(id),
  description            TEXT,
  required_qualification TEXT,
  max_headcount          INTEGER,
  active                 BOOLEAN NOT NULL DEFAULT TRUE,
  version                INTEGER NOT NULL DEFAULT 1,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at             TIMESTAMPTZ,
  created_by             UUID,
  updated_by             UUID,
  deleted_by             UUID
);

-- ---------------------------------------------------------------------------
-- 2. Core employee record
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS employees (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matricule               VARCHAR(50) NOT NULL UNIQUE,
  first_name              VARCHAR(100) NOT NULL,
  last_name               VARCHAR(100) NOT NULL,
  gender                  gender_type,
  date_of_birth           DATE,
  place_of_birth          VARCHAR(200),
  nationality             VARCHAR(100) DEFAULT 'Algérienne',
  marital_status          VARCHAR(50),
  photo_url               TEXT,
  -- Identifiers
  id_document_number      VARCHAR(100),
  social_security_number  VARCHAR(100),
  professional_order_number VARCHAR(100),   -- doctors/pharmacists
  linked_user_id          UUID REFERENCES users(id),
  -- Status
  status                  employee_status NOT NULL DEFAULT 'actif',
  category                personnel_category,
  -- Timestamps & soft-delete
  hire_date               DATE,
  end_date                DATE,
  version                 INTEGER NOT NULL DEFAULT 1,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at              TIMESTAMPTZ,
  created_by              UUID,
  updated_by              UUID,
  deleted_by              UUID
);

-- Add FK on departments.manager_id after employees exists
DO $$ BEGIN
  ALTER TABLE hr_departments ADD CONSTRAINT fk_dept_manager
    FOREIGN KEY (manager_id) REFERENCES employees(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 3. Employee extended profiles
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS employee_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id           UUID NOT NULL UNIQUE REFERENCES employees(id),
  -- Professional
  position_id           UUID REFERENCES employee_positions(id),
  department_id         UUID REFERENCES hr_departments(id),
  site_id               VARCHAR(100),
  building              VARCHAR(100),
  floor                 VARCHAR(50),
  service               VARCHAR(200),
  team                  VARCHAR(200),
  manager_id            UUID REFERENCES employees(id),
  -- Salary placeholder (no payroll in this phase)
  salary_base           NUMERIC(12,2),
  allowances            JSONB DEFAULT '[]',
  deductions            JSONB DEFAULT '[]',
  payroll_status        VARCHAR(50) DEFAULT 'non_configure',
  version               INTEGER NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,
  created_by            UUID,
  updated_by            UUID,
  deleted_by            UUID
);

-- ---------------------------------------------------------------------------
-- 4. Contacts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS employee_contacts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id          UUID NOT NULL UNIQUE REFERENCES employees(id),
  phone_primary        VARCHAR(50),
  phone_secondary      VARCHAR(50),
  email_professional   VARCHAR(200),
  email_personal       VARCHAR(200),
  address              TEXT,
  commune              VARCHAR(200),
  wilaya               VARCHAR(200),
  country              VARCHAR(100) DEFAULT 'Algérie',
  version              INTEGER NOT NULL DEFAULT 1,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ,
  created_by           UUID,
  updated_by           UUID,
  deleted_by           UUID
);

CREATE TABLE IF NOT EXISTS employee_emergency_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  name        VARCHAR(200) NOT NULL,
  relation    VARCHAR(100),
  phone       VARCHAR(50),
  address     TEXT,
  is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ,
  created_by  UUID,
  updated_by  UUID,
  deleted_by  UUID
);

-- ---------------------------------------------------------------------------
-- 5. Contracts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS employee_contracts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number     VARCHAR(100) NOT NULL UNIQUE,
  employee_id         UUID NOT NULL REFERENCES employees(id),
  type                contract_type NOT NULL,
  status              contract_status NOT NULL DEFAULT 'brouillon',
  start_date          DATE NOT NULL,
  end_date            DATE,
  trial_end_date      DATE,
  is_full_time        BOOLEAN NOT NULL DEFAULT TRUE,
  weekly_hours        NUMERIC(5,2) DEFAULT 40,
  salary_base         NUMERIC(12,2),
  notes               TEXT,
  document_url        TEXT,              -- uploaded PDF
  renewed_from_id     UUID REFERENCES employee_contracts(id),
  terminated_at       TIMESTAMPTZ,
  termination_reason  TEXT,
  version             INTEGER NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,
  created_by          UUID,
  updated_by          UUID,
  deleted_by          UUID
);

-- ---------------------------------------------------------------------------
-- 6. Schedules & Shifts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS employee_schedules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES employees(id),
  work_days     JSONB NOT NULL DEFAULT '[1,2,3,4,5]',  -- 1=Mon…7=Sun
  start_time    TIME,
  end_time      TIME,
  break_minutes INTEGER DEFAULT 0,
  rotation      BOOLEAN NOT NULL DEFAULT FALSE,
  night_work    BOOLEAN NOT NULL DEFAULT FALSE,
  on_call       BOOLEAN NOT NULL DEFAULT FALSE,
  notes         TEXT,
  valid_from    DATE,
  valid_until   DATE,
  version       INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  created_by    UUID,
  updated_by    UUID,
  deleted_by    UUID
);

CREATE TABLE IF NOT EXISTS employee_shifts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES employees(id),
  department_id   UUID REFERENCES hr_departments(id),
  site_id         VARCHAR(100),
  service         VARCHAR(200),
  shift_date      DATE NOT NULL,
  type            shift_type NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  break_minutes   INTEGER DEFAULT 0,
  role            VARCHAR(200),
  status          shift_status NOT NULL DEFAULT 'planifie',
  notes           TEXT,
  template_id     UUID,
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  created_by      UUID,
  updated_by      UUID,
  deleted_by      UUID,
  -- Conflict detection: same employee cannot have overlapping shifts
  CONSTRAINT no_shift_overlap EXCLUDE USING gist (
    employee_id WITH =,
    tsrange(
      shift_date + start_time,
      shift_date + end_time
    ) WITH &&
  ) WHERE (deleted_at IS NULL AND status != 'annule')
);

-- ---------------------------------------------------------------------------
-- 7. Attendance
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS attendance_records (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id          UUID NOT NULL REFERENCES employees(id),
  shift_id             UUID REFERENCES employee_shifts(id),
  record_date          DATE NOT NULL,
  planned_start        TIMESTAMPTZ,
  planned_end          TIMESTAMPTZ,
  check_in             TIMESTAMPTZ,
  check_out            TIMESTAMPTZ,
  break_start          TIMESTAMPTZ,
  break_end            TIMESTAMPTZ,
  total_worked_minutes INTEGER,
  overtime_minutes     INTEGER DEFAULT 0,
  late_minutes         INTEGER DEFAULT 0,
  early_leave_minutes  INTEGER DEFAULT 0,
  source               attendance_source DEFAULT 'manuel',
  device_id            UUID,
  status               attendance_status NOT NULL DEFAULT 'non_pointe',
  anomaly              TEXT,
  approved_by          UUID REFERENCES users(id),
  approved_at          TIMESTAMPTZ,
  notes                TEXT,
  version              INTEGER NOT NULL DEFAULT 1,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ,
  created_by           UUID,
  updated_by           UUID,
  deleted_by           UUID,
  UNIQUE (employee_id, record_date)
);

CREATE TABLE IF NOT EXISTS attendance_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id    UUID NOT NULL REFERENCES attendance_records(id),
  employee_id  UUID NOT NULL REFERENCES employees(id),
  event_type   badge_event_type NOT NULL,
  event_time   TIMESTAMPTZ NOT NULL,
  source       attendance_source DEFAULT 'manuel',
  device_id    UUID,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   UUID
);

-- ---------------------------------------------------------------------------
-- 8. Late records
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS late_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES employees(id),
  record_date     DATE NOT NULL,
  planned_time    TIME NOT NULL,
  arrival_time    TIME NOT NULL,
  late_minutes    INTEGER NOT NULL,
  reason          TEXT,
  status          late_status NOT NULL DEFAULT 'en_attente',
  justified       BOOLEAN DEFAULT FALSE,
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  created_by      UUID,
  updated_by      UUID,
  deleted_by      UUID
);

-- ---------------------------------------------------------------------------
-- 9. Absences
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS absence_records (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES employees(id),
  date_from    DATE NOT NULL,
  date_to      DATE NOT NULL,
  type         absence_type NOT NULL,
  reason       TEXT,
  document_url TEXT,
  status       absence_status NOT NULL DEFAULT 'brouillon',
  approved_by  UUID REFERENCES users(id),
  approved_at  TIMESTAMPTZ,
  version      INTEGER NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ,
  created_by   UUID,
  updated_by   UUID,
  deleted_by   UUID,
  CONSTRAINT absence_dates_order CHECK (date_to >= date_from)
);

-- ---------------------------------------------------------------------------
-- 10. Leave requests & balances
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS leave_balances (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES employees(id),
  leave_type    leave_type NOT NULL,
  year          INTEGER NOT NULL,
  total_days    NUMERIC(6,2) NOT NULL DEFAULT 0,
  used_days     NUMERIC(6,2) NOT NULL DEFAULT 0,
  pending_days  NUMERIC(6,2) NOT NULL DEFAULT 0,
  remaining_days NUMERIC(6,2) GENERATED ALWAYS AS (total_days - used_days - pending_days) STORED,
  version       INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, leave_type, year),
  CONSTRAINT positive_balance CHECK (total_days >= 0 AND used_days >= 0 AND pending_days >= 0)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id             UUID NOT NULL REFERENCES employees(id),
  leave_type              leave_type NOT NULL,
  date_from               DATE NOT NULL,
  date_to                 DATE NOT NULL,
  number_of_days          NUMERIC(6,2) NOT NULL,
  balance_before          NUMERIC(6,2),
  balance_after           NUMERIC(6,2),
  replacement_employee_id UUID REFERENCES employees(id),
  reason                  TEXT,
  status                  leave_status NOT NULL DEFAULT 'brouillon',
  manager_id              UUID REFERENCES employees(id),
  manager_approved_at     TIMESTAMPTZ,
  manager_rejected_at     TIMESTAMPTZ,
  manager_comment         TEXT,
  hr_approved_at          TIMESTAMPTZ,
  hr_rejected_at          TIMESTAMPTZ,
  hr_comment              TEXT,
  approved_by             UUID REFERENCES users(id),
  document_url            TEXT,
  version                 INTEGER NOT NULL DEFAULT 1,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at              TIMESTAMPTZ,
  created_by              UUID,
  updated_by              UUID,
  deleted_by              UUID,
  CONSTRAINT leave_dates_order CHECK (date_to >= date_from),
  CONSTRAINT positive_days CHECK (number_of_days > 0)
);

-- ---------------------------------------------------------------------------
-- 11. Overtime
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS overtime_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         UUID NOT NULL REFERENCES employees(id),
  record_date         DATE NOT NULL,
  planned_hours       NUMERIC(5,2) NOT NULL,
  worked_hours        NUMERIC(5,2) NOT NULL,
  overtime_hours      NUMERIC(5,2) NOT NULL,
  reason              TEXT,
  status              absence_status NOT NULL DEFAULT 'soumise',
  compensation_type   overtime_compensation DEFAULT 'paiement',
  approved_by         UUID REFERENCES users(id),
  approved_at         TIMESTAMPTZ,
  version             INTEGER NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,
  created_by          UUID,
  updated_by          UUID,
  deleted_by          UUID,
  CONSTRAINT positive_overtime CHECK (overtime_hours >= 0)
);

-- ---------------------------------------------------------------------------
-- 12. Badge devices, assignments, events
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS badge_devices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(50) NOT NULL UNIQUE,
  name          VARCHAR(200) NOT NULL,
  site_id       VARCHAR(100),
  location      VARCHAR(200),
  ip_address    INET,
  serial_number VARCHAR(100),
  status        badge_device_status NOT NULL DEFAULT 'active',
  last_seen_at  TIMESTAMPTZ,
  firmware      VARCHAR(100),
  notes         TEXT,
  version       INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  created_by    UUID,
  updated_by    UUID,
  deleted_by    UUID
);

CREATE TABLE IF NOT EXISTS badge_assignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES employees(id),
  badge_number VARCHAR(100) NOT NULL,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at   TIMESTAMPTZ,
  status       VARCHAR(30) NOT NULL DEFAULT 'active',
  assigned_by  UUID REFERENCES users(id),
  revoked_by   UUID REFERENCES users(id),
  version      INTEGER NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ,
  created_by   UUID,
  updated_by   UUID,
  deleted_by   UUID
);

CREATE TABLE IF NOT EXISTS badge_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID REFERENCES employees(id),
  badge_number VARCHAR(100) NOT NULL,
  device_id    UUID REFERENCES badge_devices(id),
  event_type   badge_event_type NOT NULL,
  event_time   TIMESTAMPTZ NOT NULL,
  raw_data     JSONB,
  processed    BOOLEAN NOT NULL DEFAULT FALSE,
  anomaly      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 13. Employee documents
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS employee_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES employees(id),
  doc_type     VARCHAR(100) NOT NULL,   -- CNI, diplome, contrat, etc.
  title        VARCHAR(300) NOT NULL,
  file_url     TEXT,
  file_size    INTEGER,
  mime_type    VARCHAR(100),
  expiry_date  DATE,
  reminder_days INTEGER DEFAULT 30,
  version_num  INTEGER NOT NULL DEFAULT 1,
  notes        TEXT,
  visible_to   JSONB DEFAULT '["hr_manager","hr_officer","administrator"]',
  version      INTEGER NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ,
  created_by   UUID,
  updated_by   UUID,
  deleted_by   UUID
);

-- ---------------------------------------------------------------------------
-- 14. HR Alerts & Notes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS hr_alerts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID REFERENCES employees(id),
  type         VARCHAR(100) NOT NULL,
  severity     VARCHAR(30) NOT NULL DEFAULT 'info',  -- info, warning, critical
  title        VARCHAR(300) NOT NULL,
  message      TEXT,
  read         BOOLEAN NOT NULL DEFAULT FALSE,
  read_at      TIMESTAMPTZ,
  read_by      UUID REFERENCES users(id),
  expires_at   TIMESTAMPTZ,
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   UUID
);

CREATE TABLE IF NOT EXISTS hr_notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES employees(id),
  author_id    UUID REFERENCES users(id),
  content      TEXT NOT NULL,
  is_private   BOOLEAN NOT NULL DEFAULT FALSE,
  version      INTEGER NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ,
  created_by   UUID,
  updated_by   UUID,
  deleted_by   UUID
);

-- ---------------------------------------------------------------------------
-- 15. HR Audit events (dedicated HR audit trail)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS hr_audit_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID REFERENCES employees(id),
  actor_id     UUID REFERENCES users(id),
  actor_name   VARCHAR(200),
  action       VARCHAR(200) NOT NULL,
  entity_type  VARCHAR(100) NOT NULL,
  entity_id    UUID,
  old_values   JSONB,
  new_values   JSONB,
  ip_address   INET,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 16. Sequences
-- ---------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS matricule_seq START 1000 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS contract_number_seq START 1 INCREMENT 1;

-- ---------------------------------------------------------------------------
-- 17. Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_employees_status     ON employees(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_employees_category   ON employees(category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_employees_matricule  ON employees(matricule);
CREATE INDEX IF NOT EXISTS idx_employees_name       ON employees(last_name, first_name) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_emp_profiles_emp     ON employee_profiles(employee_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_emp_profiles_dept    ON employee_profiles(department_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_employee   ON employee_contracts(employee_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_status     ON employee_contracts(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_end_date   ON employee_contracts(end_date) WHERE deleted_at IS NULL AND end_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shifts_employee_date ON employee_shifts(employee_id, shift_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_shifts_date          ON employee_shifts(shift_date) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_emp_date  ON attendance_records(employee_id, record_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_date      ON attendance_records(record_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_status    ON attendance_records(status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_late_employee        ON late_records(employee_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_late_date            ON late_records(record_date) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_absence_employee     ON absence_records(employee_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leave_employee       ON leave_requests(employee_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leave_status         ON leave_requests(status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_overtime_employee    ON overtime_records(employee_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_badge_events_emp     ON badge_events(employee_id, event_time);
CREATE INDEX IF NOT EXISTS idx_badge_events_time    ON badge_events(event_time);
CREATE INDEX IF NOT EXISTS idx_badge_events_proc    ON badge_events(processed) WHERE processed = FALSE;

CREATE INDEX IF NOT EXISTS idx_hr_alerts_employee   ON hr_alerts(employee_id) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_hr_audit_employee    ON hr_audit_events(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_audit_action      ON hr_audit_events(action);

CREATE INDEX IF NOT EXISTS idx_emp_docs_employee    ON employee_documents(employee_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_emp_docs_expiry      ON employee_documents(expiry_date) WHERE deleted_at IS NULL AND expiry_date IS NOT NULL;

COMMIT;
