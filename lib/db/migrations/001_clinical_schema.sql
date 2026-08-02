-- =============================================================================
-- Migration 001 — IRISSAM Hospital ERP: Full Clinical Schema
-- =============================================================================
-- Strategy:
--   1. Create all PostgreSQL enums (idempotent with IF NOT EXISTS guards).
--   2. Create all new clinical tables in FK-dependency order.
--   3. Rename/drop old minimal tables that are replaced by the new design.
--   4. Add performance indexes.
--   5. Add referential-integrity constraints that create circular deps last.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- SECTION 1: PostgreSQL Enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE gender               AS ENUM ('M', 'F');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE blood_type_val       AS ENUM ('A+','A-','B+','B-','AB+','AB-','O+','O-');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rhesus_val           AS ENUM ('+', '-');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE marital_status       AS ENUM ('celibataire','marie','divorce','veuf');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE id_document_type     AS ENUM ('cni','passeport','permis','autre');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE insurance_type       AS ENUM ('cnas','casnos','mutuelle','militaire','gratuite','payant');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE patient_status       AS ENUM ('active','inactive','archived','deceased');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sync_status_val      AS ENUM ('synced','pending','conflict','error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_role            AS ENUM ('admin','doctor','nurse','pharmacist','lab_technician',
                                            'radiology_technician','ambulance_driver','receptionist','finance');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE staff_status         AS ENUM ('actif','pause','intervention_urgente','conge','inactif');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE encounter_type       AS ENUM ('urgence','consultation','admission','externe');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE encounter_status     AS ENUM ('open','closed','suspended','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE emergency_priority   AS ENUM ('P1','P2','P3','P4','P5','non_classe');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE emergency_patient_status AS ENUM (
    'attente_triage','en_triage','attente_soins','en_soins','observation',
    'hospitalise','bloque','reanimation','transfere','sorti','decede'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE er_room_type         AS ENUM ('triage','soins','reanimation','observation','attente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE er_room_status       AS ENUM ('libre','occupee','partielle','nettoyage','hors_service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ambulance_status     AS ENUM (
    'disponible','vers_hopital','vers_patient','sur_place',
    'maintenance','en_route','transport_patient','hors_service'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE visit_close_reason   AS ENUM ('domicile','hospitalisation','bloc','reanimation','transfert','deces');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE admission_type       AS ENUM ('hospitalisation','ambulatoire','preadmission','urgence','maternite','chirurgie');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE admission_status     AS ENUM ('active','preadmission','ambulatoire','transferred','discharged','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE admission_priority   AS ENUM ('normal','urgent','tres_urgent','vital');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE discharge_type       AS ENUM ('domicile','transfert_interne','transfert_externe','deces','fugue','contre_avis');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE occupancy_bed_status AS ENUM ('disponible','occupe','reserve','nettoyage','hors_service','maintenance');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE bed_type             AS ENUM ('standard','soins_intensifs','isolement','maternite','pediatrie');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE icu_bed_status       AS ENUM ('disponible','occupe','reserve','nettoyage','hors_service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE icu_type             AS ENUM ('icu','hdu','nicu');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE icu_admission_status AS ENUM ('demande','accepte','en_cours','transfere','sorti');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE or_status            AS ENUM ('libre','reserve','en_preparation','en_intervention','nettoyage','hors_service','maintenance');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE or_slot_status       AS ENUM ('planifie','en_cours','termine','annule');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE surgical_status      AS ENUM ('demande','planifie','en_cours','termine','annule');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE surgical_urgency     AS ENUM ('elective','urgent','emergency');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE urgency_level        AS ENUM ('STAT','urgent','routine');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lab_status           AS ENUM ('demandee','prelevee','en_cours','validee','critique','annulee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE imaging_status       AS ENUM ('demandee','planifiee','realisee','interpretee','annulee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE prescription_status  AS ENUM ('prescrit','prepare','delivre','annule');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE appointment_status   AS ENUM ('confirmed','pending','cancelled','completed','no_show','in_progress');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE consultation_type    AS ENUM ('consultation_externe','urgence','hospitalier','teleconsultation');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE consultation_status  AS ENUM ('en_attente','en_cours','terminee','planifiee','annulee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE consultation_origin  AS ENUM ('hospitalisation','urgence','rdv','walk_in');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invoice_status       AS ENUM ('pending','paid','partial','cancelled','disputed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method       AS ENUM ('cash','card','virement','cheque','insurance');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE audit_severity       AS ENUM ('info','warning','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_priority AS ENUM ('low','normal','high','urgent','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE source_module        AS ENUM (
    'urgences','consultations','hospitalisation','bloc','reanimation',
    'pharmacie','laboratoire','imagerie','admissions','system'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- SECTION 2: Infrastructure (no FK dependencies)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  code        TEXT NOT NULL UNIQUE,
  address     TEXT,
  city        TEXT,
  wilaya      TEXT,
  postal_code TEXT,
  phone       TEXT,
  email       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS buildings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id      UUID NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  name         TEXT NOT NULL,
  code         TEXT NOT NULL,
  floors_count INTEGER NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS floors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE RESTRICT,
  name        TEXT NOT NULL,
  level       INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS departments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id        UUID NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  building_id    UUID REFERENCES buildings(id) ON DELETE SET NULL,
  floor_id       UUID REFERENCES floors(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  code           TEXT NOT NULL,
  color          TEXT NOT NULL DEFAULT '#6366F1',
  head_doctor_id UUID,   -- FK to users added below (avoids circular)
  capacity       INTEGER NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ,
  created_by     UUID,
  updated_by     UUID,
  UNIQUE (site_id, code)
);

CREATE TABLE IF NOT EXISTS services (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       UUID REFERENCES sites(id) ON DELETE RESTRICT,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  code          TEXT NOT NULL,
  specialty     TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- SECTION 3: Users
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES sites(id) ON DELETE SET NULL,
  department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  role            user_role NOT NULL,
  specialty       TEXT,
  status          staff_status NOT NULL DEFAULT 'actif',
  hashed_password TEXT NOT NULL,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_by      UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Add FK from departments.head_doctor_id → users (deferred to avoid circular)
DO $$ BEGIN
  ALTER TABLE departments ADD CONSTRAINT fk_departments_head_doctor FOREIGN KEY (head_doctor_id) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE departments ADD CONSTRAINT fk_departments_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE departments ADD CONSTRAINT fk_departments_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS user_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  ip         TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- SECTION 4: Patients
-- ---------------------------------------------------------------------------

-- Rename old serial-PK patients table if it exists (data migration)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='patients' AND column_name='id'
             AND data_type='integer') THEN
    ALTER TABLE patients RENAME TO patients_legacy;

    -- Immediately rename any explicitly-named constraints that were kept from
    -- the original table, so their names do not collide with constraints that
    -- drizzle-kit or future migrations will create on the new `patients` table.
    -- PostgreSQL requires constraint/index names to be unique per schema.
    IF EXISTS (
      SELECT 1 FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid
      WHERE c.conname = 'patients_file_number_unique' AND t.relname = 'patients_legacy'
    ) THEN
      ALTER TABLE patients_legacy
        RENAME CONSTRAINT patients_file_number_unique TO patients_legacy_file_number_unique;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid
      WHERE c.conname = 'patients_pkey' AND t.relname = 'patients_legacy'
    ) THEN
      ALTER TABLE patients_legacy
        RENAME CONSTRAINT patients_pkey TO patients_legacy_pkey;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS patients (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mpi_id                   TEXT NOT NULL UNIQUE,
  file_number              TEXT NOT NULL UNIQUE,
  internal_number          TEXT,

  -- Identity
  first_name               TEXT NOT NULL,
  last_name                TEXT NOT NULL,
  maiden_name              TEXT,
  gender                   gender NOT NULL,
  date_of_birth            DATE NOT NULL,
  place_of_birth           TEXT,
  nationality              TEXT NOT NULL DEFAULT 'DZ',
  marital_status           marital_status,
  photo_url                TEXT,

  -- Documents
  id_document_type         id_document_type,
  id_document_number       TEXT,
  social_security_number   TEXT,

  -- Contact
  phone                    TEXT NOT NULL,
  phone_secondary          TEXT,
  email                    TEXT,
  address                  TEXT,
  commune                  TEXT,
  wilaya                   TEXT,
  postal_code              TEXT,
  country                  TEXT NOT NULL DEFAULT 'DZ',

  -- Medical
  blood_type               blood_type_val,
  rhesus                   rhesus_val,
  allergies                TEXT[] NOT NULL DEFAULT '{}',
  chronic_diseases         TEXT[] NOT NULL DEFAULT '{}',
  major_history            TEXT[] NOT NULL DEFAULT '{}',
  disability               TEXT,
  critical_notes           TEXT,

  -- Emergency contact
  emergency_contact_name     TEXT,
  emergency_contact_relation TEXT,
  emergency_contact_phone    TEXT,
  emergency_contact_address  TEXT,

  -- Insurance
  insurance_type             insurance_type,
  insurance_org_name         TEXT,
  insurance_member_number    TEXT,
  insurance_valid_until      DATE,

  -- Site
  site_id        UUID REFERENCES sites(id) ON DELETE SET NULL,
  department_id  UUID REFERENCES departments(id) ON DELETE SET NULL,

  -- Status
  status              patient_status NOT NULL DEFAULT 'active',
  sync_status         sync_status_val NOT NULL DEFAULT 'synced',
  is_incomplete       BOOLEAN NOT NULL DEFAULT false,
  potential_duplicate BOOLEAN NOT NULL DEFAULT false,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS patient_timeline_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  site_id     UUID REFERENCES sites(id) ON DELETE SET NULL,
  site_name   TEXT,
  doctor      TEXT,
  service     TEXT,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- SECTION 5: Encounters
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS encounters (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  patient_name     TEXT NOT NULL,
  type             encounter_type NOT NULL,
  status           encounter_status NOT NULL DEFAULT 'open',
  chief_complaint  TEXT NOT NULL,
  source_module    source_module NOT NULL,
  source_record_id TEXT,
  linked_records   JSONB NOT NULL DEFAULT '[]',
  workflow_status  TEXT,

  -- Staff
  primary_doctor_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  primary_doctor_name TEXT,
  primary_nurse_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  primary_nurse_name  TEXT,

  -- Location
  room_id   UUID,
  room_name TEXT,
  ward_id   UUID,
  ward_name TEXT,
  site_id   UUID REFERENCES sites(id) ON DELETE SET NULL,

  -- Timestamps
  opened_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at    TIMESTAMPTZ,
  close_reason TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ,

  -- Audit
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- SECTION 6: Emergency
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS emergency_rooms (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id    UUID REFERENCES sites(id) ON DELETE SET NULL,
  floor_id   UUID REFERENCES floors(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  short_name TEXT NOT NULL,
  type       er_room_type NOT NULL,
  capacity   INTEGER NOT NULL DEFAULT 1,
  occupied   INTEGER NOT NULL DEFAULT 0,
  status     er_room_status NOT NULL DEFAULT 'libre',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS emergency_visits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL UNIQUE REFERENCES encounters(id) ON DELETE RESTRICT,
  patient_id   UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,

  priority     emergency_priority NOT NULL DEFAULT 'non_classe',
  status       emergency_patient_status NOT NULL DEFAULT 'attente_triage',

  -- Staff
  assigned_doctor_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_doctor_name TEXT,
  assigned_nurse_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_nurse_name  TEXT,
  assigned_room_id     UUID REFERENCES emergency_rooms(id) ON DELETE SET NULL,
  assigned_room_name   TEXT,

  -- Clinical
  chief_complaint TEXT NOT NULL,
  mechanism       TEXT,
  triage_notes    TEXT,
  by_ambulance    BOOLEAN NOT NULL DEFAULT false,
  is_minor        BOOLEAN NOT NULL DEFAULT false,
  tags            TEXT[] NOT NULL DEFAULT '{}',

  -- Linked records
  linked_admission_id       UUID,
  linked_surgical_request_id UUID,
  linked_icu_admission_id   UUID,

  -- Timestamps
  arrival_time   TIMESTAMPTZ NOT NULL DEFAULT now(),
  triage_time    TIMESTAMPTZ,
  care_start_time TIMESTAMPTZ,
  closed_at      TIMESTAMPTZ,
  close_reason   visit_close_reason,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS emergency_vitals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id     UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  visit_id         UUID NOT NULL REFERENCES emergency_visits(id) ON DELETE CASCADE,
  heart_rate       INTEGER,
  blood_pressure   TEXT,
  spo2             REAL,
  temperature      REAL,
  respiratory_rate INTEGER,
  gcs              INTEGER,
  pain_level       INTEGER,
  glucose          REAL,
  notes            TEXT,
  recorded_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  recorded_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ambulances (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id                  UUID REFERENCES sites(id) ON DELETE SET NULL,
  call_sign                TEXT NOT NULL UNIQUE,
  type                     TEXT NOT NULL DEFAULT 'ambulance',
  status                   ambulance_status NOT NULL DEFAULT 'disponible',
  crew                     TEXT,
  crew_count               INTEGER NOT NULL DEFAULT 2,
  current_patient_id       UUID REFERENCES patients(id) ON DELETE SET NULL,
  current_patient_name     TEXT,
  current_patient_priority emergency_priority,
  chief_complaint          TEXT,
  location                 TEXT,
  dispatched_at            TIMESTAMPTZ,
  eta_minutes              INTEGER,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at               TIMESTAMPTZ,
  created_by               UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- SECTION 7: Occupancy
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS occupancy_beds (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number               TEXT NOT NULL,
  room_id              UUID,
  room_number          TEXT,
  floor_id             UUID REFERENCES floors(id) ON DELETE SET NULL,
  floor_label          TEXT,
  building_id          UUID REFERENCES buildings(id) ON DELETE SET NULL,
  building_name        TEXT,
  building_code        TEXT,
  site_id              UUID NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  type                 bed_type NOT NULL DEFAULT 'standard',
  status               occupancy_bed_status NOT NULL DEFAULT 'disponible',
  patient_id           UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_name         TEXT,
  encounter_id         UUID REFERENCES encounters(id) ON DELETE SET NULL,
  admission_id         UUID,    -- FK to admissions added later
  occupied_at          TIMESTAMPTZ,
  expected_release_at  TIMESTAMPTZ,
  cleaning_started_at  TIMESTAMPTZ,
  cleaning_completed_at TIMESTAMPTZ,
  notes                TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ,
  updated_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by           UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS icu_beds (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number             TEXT NOT NULL,
  unit_name          TEXT NOT NULL,
  site_id            UUID NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  type               icu_type NOT NULL DEFAULT 'icu',
  status             icu_bed_status NOT NULL DEFAULT 'disponible',
  patient_id         UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_name       TEXT,
  encounter_id       UUID REFERENCES encounters(id) ON DELETE SET NULL,
  icu_admission_id   UUID,    -- FK added after icu_admissions created
  priority           TEXT,
  occupied_at        TIMESTAMPTZ,
  expected_release_at TIMESTAMPTZ,
  cleaning_started_at TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ,
  updated_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by         UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS icu_admissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id     UUID REFERENCES encounters(id) ON DELETE RESTRICT,
  patient_id       UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  patient_name     TEXT NOT NULL,
  motif            TEXT NOT NULL,
  priority         TEXT NOT NULL,
  icu_bed_id       UUID REFERENCES icu_beds(id) ON DELETE SET NULL,
  team_notified    TEXT NOT NULL DEFAULT 'false',
  status           icu_admission_status NOT NULL DEFAULT 'demande',
  requested_by_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  requested_by_name TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by       UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Close the circular ref: icu_beds.icu_admission_id → icu_admissions
DO $$ BEGIN
  ALTER TABLE icu_beds ADD CONSTRAINT fk_icu_beds_icu_admission FOREIGN KEY (icu_admission_id) REFERENCES icu_admissions(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS bed_stats (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           UUID REFERENCES sites(id) ON DELETE CASCADE,
  service           TEXT NOT NULL,
  total_beds        TEXT NOT NULL DEFAULT '0',
  occupied_beds     TEXT NOT NULL DEFAULT '0',
  cleaning_beds     TEXT NOT NULL DEFAULT '0',
  out_of_service_beds TEXT NOT NULL DEFAULT '0',
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- SECTION 8: Admissions
-- ---------------------------------------------------------------------------

-- Drop minimal legacy table (safe: it only had name+service+admittedAt+dischargedAt)
DROP TABLE IF EXISTS admissions CASCADE;

CREATE TABLE IF NOT EXISTS admissions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_number        TEXT NOT NULL UNIQUE,
  encounter_id            UUID REFERENCES encounters(id) ON DELETE SET NULL,
  patient_id              UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  patient_mpi_id          TEXT,
  patient_name            TEXT NOT NULL,
  patient_dob             DATE,
  patient_phone           TEXT,
  type                    admission_type NOT NULL,
  status                  admission_status NOT NULL DEFAULT 'active',
  priority                admission_priority NOT NULL DEFAULT 'normal',
  service_id              UUID REFERENCES departments(id) ON DELETE SET NULL,
  service_name            TEXT NOT NULL,
  doctor_id               UUID REFERENCES users(id) ON DELETE SET NULL,
  doctor_name             TEXT NOT NULL,
  motif                   TEXT NOT NULL,
  diagnosis               TEXT,
  bed_id                  UUID REFERENCES occupancy_beds(id) ON DELETE SET NULL,
  bed_number              TEXT,
  room_number             TEXT,
  floor_label             TEXT,
  building_name           TEXT,
  admission_date          DATE NOT NULL,
  admission_time          TEXT NOT NULL,
  expected_discharge_date DATE,
  actual_discharge_date   DATE,
  actual_discharge_time   TEXT,
  discharge_type          discharge_type,
  discharge_notes         TEXT,
  transfer_to             TEXT,
  transfer_date           DATE,
  preadmission_date       DATE,
  preadmission_converted_at TIMESTAMPTZ,
  site_id                 UUID REFERENCES sites(id) ON DELETE SET NULL,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at              TIMESTAMPTZ,
  created_by              UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by              UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_by              UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Close the circular ref: occupancy_beds.admission_id → admissions
DO $$ BEGIN
  ALTER TABLE occupancy_beds ADD CONSTRAINT fk_occ_beds_admission FOREIGN KEY (admission_id) REFERENCES admissions(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS admission_timeline_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  description  TEXT NOT NULL,
  date         TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name    TEXT,
  meta         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- SECTION 9: Surgical / OR
-- ---------------------------------------------------------------------------

-- Replace minimal operating_rooms (drop + recreate with UUID PK)
DROP TABLE IF EXISTS operating_rooms CASCADE;

CREATE TABLE IF NOT EXISTS operating_rooms (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id                    UUID REFERENCES sites(id) ON DELETE SET NULL,
  floor_id                   UUID REFERENCES floors(id) ON DELETE SET NULL,
  floor_label                TEXT,
  name                       TEXT NOT NULL,
  short_name                 TEXT NOT NULL,
  specialty                  TEXT,
  status                     or_status NOT NULL DEFAULT 'libre',
  current_surgical_request_id UUID,
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at                 TIMESTAMPTZ,
  updated_by                 UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by                 UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS surgical_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id      UUID REFERENCES encounters(id) ON DELETE SET NULL,
  patient_id        UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  patient_name      TEXT NOT NULL,
  intervention      TEXT NOT NULL,
  surgeon_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  surgeon_name      TEXT,
  anesthesist_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  anesthesist_name  TEXT,
  urgency_degree    surgical_urgency NOT NULL DEFAULT 'elective',
  pre_op_prep       TEXT,
  consent_signed    BOOLEAN NOT NULL DEFAULT false,
  status            surgical_status NOT NULL DEFAULT 'demande',
  requested_by_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  requested_by_name TEXT,
  or_room_id        UUID REFERENCES operating_rooms(id) ON DELETE SET NULL,
  scheduled_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by        UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS or_slots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  or_room_id          UUID NOT NULL REFERENCES operating_rooms(id) ON DELETE CASCADE,
  surgical_request_id UUID REFERENCES surgical_requests(id) ON DELETE SET NULL,
  patient_id          UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_name        TEXT,
  intervention        TEXT NOT NULL,
  surgeon             TEXT,
  start_at            TIMESTAMPTZ NOT NULL,
  end_at              TIMESTAMPTZ NOT NULL,
  status              or_slot_status NOT NULL DEFAULT 'planifie',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ,
  created_by          UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Close the circular ref: emergency_visits.linked_* columns
DO $$ BEGIN
  ALTER TABLE emergency_visits ADD CONSTRAINT fk_ev_linked_admission FOREIGN KEY (linked_admission_id) REFERENCES admissions(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE emergency_visits ADD CONSTRAINT fk_ev_linked_surgical FOREIGN KEY (linked_surgical_request_id) REFERENCES surgical_requests(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE emergency_visits ADD CONSTRAINT fk_ev_linked_icu FOREIGN KEY (linked_icu_admission_id) REFERENCES icu_admissions(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- SECTION 10: Clinical Orders
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lab_orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id      UUID REFERENCES encounters(id) ON DELETE RESTRICT,
  patient_id        UUID REFERENCES patients(id) ON DELETE RESTRICT,
  patient_name      TEXT NOT NULL,
  visit_id          TEXT,
  test              TEXT NOT NULL,
  category          TEXT NOT NULL,
  urgency           urgency_level NOT NULL DEFAULT 'routine',
  requested_by_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  requested_by_name TEXT NOT NULL,
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  status            lab_status NOT NULL DEFAULT 'demandee',
  result            TEXT,
  is_critical       BOOLEAN NOT NULL DEFAULT false,
  result_at         TIMESTAMPTZ,
  validated_by_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  validated_by_name TEXT,
  laboratory        TEXT,
  source_module     source_module NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by        UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS imaging_orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id        UUID REFERENCES encounters(id) ON DELETE RESTRICT,
  patient_id          UUID REFERENCES patients(id) ON DELETE RESTRICT,
  patient_name        TEXT NOT NULL,
  visit_id            TEXT,
  exam                TEXT NOT NULL,
  region              TEXT NOT NULL,
  side                TEXT,
  urgency             urgency_level NOT NULL DEFAULT 'routine',
  with_contrast       BOOLEAN NOT NULL DEFAULT false,
  requested_by_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  requested_by_name   TEXT NOT NULL,
  requested_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  status              imaging_status NOT NULL DEFAULT 'demandee',
  result              TEXT,
  result_at           TIMESTAMPTZ,
  report              TEXT,
  reported_by_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  reported_by_name    TEXT,
  reported_at         TIMESTAMPTZ,
  interpreted_by_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  interpreted_by_name TEXT,
  interpreted_at      TIMESTAMPTZ,
  source_module       source_module NOT NULL,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ,
  created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by          UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id      UUID REFERENCES encounters(id) ON DELETE RESTRICT,
  patient_id        UUID REFERENCES patients(id) ON DELETE RESTRICT,
  patient_name      TEXT NOT NULL,
  visit_id          TEXT,
  drug              TEXT NOT NULL,
  dosage            TEXT NOT NULL,
  route             TEXT NOT NULL,
  frequency         TEXT NOT NULL,
  duration          TEXT,
  prescribed_by_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  prescribed_by_name TEXT NOT NULL,
  prescribed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  status            prescription_status NOT NULL DEFAULT 'prescrit',
  prepared_by_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  prepared_by_name  TEXT,
  prepared_at       TIMESTAMPTZ,
  dispensed_by_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  dispensed_by_name TEXT,
  dispensed_at      TIMESTAMPTZ,
  dispenser_comment TEXT,
  source_module     source_module NOT NULL,
  notes             TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by        UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- SECTION 11: Pharmacy Stock
-- ---------------------------------------------------------------------------

-- Replace legacy serial-PK medications
DROP TABLE IF EXISTS medications CASCADE;

CREATE TABLE IF NOT EXISTS medications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  generic_name        TEXT,
  category            TEXT,
  form                TEXT,
  unit                TEXT NOT NULL DEFAULT 'unités',
  quantity            INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 50,
  expiry_date         DATE,
  supplier            TEXT,
  location            TEXT,
  price               REAL,
  site_id             UUID REFERENCES sites(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ,
  created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_by          UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS medication_lots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  lot_number    TEXT NOT NULL,
  quantity      INTEGER NOT NULL DEFAULT 0,
  expiry_date   DATE NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- SECTION 12: Consultations & Appointments
-- ---------------------------------------------------------------------------

-- Drop and recreate with UUID PK
DROP TABLE IF EXISTS consultations CASCADE;

CREATE TABLE IF NOT EXISTS consultations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id  UUID REFERENCES encounters(id) ON DELETE SET NULL,
  number        TEXT NOT NULL UNIQUE,
  patient_id    UUID REFERENCES patients(id) ON DELETE RESTRICT,
  patient_name  TEXT NOT NULL,
  patient_mpi   TEXT NOT NULL,
  doctor_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  doctor_name   TEXT NOT NULL,
  specialty     TEXT NOT NULL,
  service_id    UUID REFERENCES departments(id) ON DELETE SET NULL,
  service_name  TEXT NOT NULL,
  scheduled_at  TIMESTAMPTZ,
  started_at    TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  duration      INTEGER,
  type          consultation_type NOT NULL DEFAULT 'consultation_externe',
  origin        consultation_origin NOT NULL DEFAULT 'rdv',
  reason        TEXT NOT NULL,
  status        consultation_status NOT NULL DEFAULT 'en_attente',
  diagnosis     TEXT,
  notes         TEXT,
  site_id       UUID REFERENCES sites(id) ON DELETE SET NULL,
  sync_status   sync_status_val NOT NULL DEFAULT 'synced',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by    UUID REFERENCES users(id) ON DELETE SET NULL
);

DROP TABLE IF EXISTS appointments CASCADE;

CREATE TABLE IF NOT EXISTS appointments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       UUID REFERENCES patients(id) ON DELETE RESTRICT,
  patient_name     TEXT NOT NULL,
  patient_mpi      TEXT,
  doctor_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  doctor_name      TEXT NOT NULL,
  department_id    UUID REFERENCES departments(id) ON DELETE SET NULL,
  department_name  TEXT NOT NULL,
  scheduled_at     TIMESTAMPTZ NOT NULL,
  duration         INTEGER NOT NULL DEFAULT 30,
  status           appointment_status NOT NULL DEFAULT 'pending',
  type             consultation_type NOT NULL DEFAULT 'consultation_externe',
  cancelled_reason TEXT,
  notes            TEXT,
  site_id          UUID REFERENCES sites(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by       UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- SECTION 13: Billing
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS invoices (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id               UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  patient_name             TEXT NOT NULL,
  encounter_id             UUID REFERENCES encounters(id) ON DELETE SET NULL,
  admission_id             UUID REFERENCES admissions(id) ON DELETE SET NULL,
  type                     TEXT NOT NULL DEFAULT 'consultation',
  status                   invoice_status NOT NULL DEFAULT 'pending',
  insurance_type           insurance_type,
  insurance_coverage_percent REAL DEFAULT 0,
  total_amount             REAL NOT NULL DEFAULT 0,
  paid_amount              REAL NOT NULL DEFAULT 0,
  due_amount               REAL NOT NULL DEFAULT 0,
  due_date                 TIMESTAMPTZ,
  notes                    TEXT,
  site_id                  UUID REFERENCES sites(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at               TIMESTAMPTZ,
  created_by               UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by               UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category    TEXT,
  quantity    REAL NOT NULL DEFAULT 1,
  unit_price  REAL NOT NULL,
  total_price REAL NOT NULL,
  ref_type    TEXT,
  ref_id      UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  amount      REAL NOT NULL,
  method      payment_method NOT NULL,
  reference   TEXT,
  notes       TEXT,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  paid_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- SECTION 14: Audit & Notifications
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT now(),
  module        source_module NOT NULL,
  action        TEXT NOT NULL,
  old_value     JSONB,
  new_value     JSONB,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name     TEXT NOT NULL,
  user_role     TEXT NOT NULL,
  patient_id    UUID REFERENCES patients(id) ON DELETE SET NULL,
  encounter_id  UUID REFERENCES encounters(id) ON DELETE SET NULL,
  resource_id   TEXT,
  resource_type TEXT,
  ip            TEXT,
  site_id       UUID REFERENCES sites(id) ON DELETE SET NULL,
  severity      audit_severity NOT NULL DEFAULT 'info'
);

CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          TEXT NOT NULL,
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  for_roles     TEXT[] NOT NULL DEFAULT '{}',
  priority      notification_priority NOT NULL DEFAULT 'normal',
  source_module source_module NOT NULL,
  entity_id     TEXT,
  entity_type   TEXT,
  site_id       UUID REFERENCES sites(id) ON DELETE SET NULL,
  read_by       UUID[] NOT NULL DEFAULT '{}',
  is_dismissed  BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- SECTION 15: Blood Bank, Alerts (replace legacy)
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS blood_bank CASCADE;

CREATE TABLE IF NOT EXISTS blood_bank (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  blood_type      blood_type_val NOT NULL,
  rhesus          rhesus_val NOT NULL,
  units_available INTEGER NOT NULL DEFAULT 0,
  units_reserved  INTEGER NOT NULL DEFAULT 0,
  expiry_date     DATE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE (site_id, blood_type, rhesus)
);

DROP TABLE IF EXISTS alerts CASCADE;

CREATE TABLE IF NOT EXISTS alerts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id    UUID REFERENCES sites(id) ON DELETE SET NULL,
  type       TEXT NOT NULL,
  severity   audit_severity NOT NULL DEFAULT 'info',
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  module     TEXT,
  entity_id  TEXT,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  read_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  read_at    TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- SECTION 16: Performance Indexes
-- ---------------------------------------------------------------------------

-- sites
CREATE INDEX IF NOT EXISTS idx_sites_active        ON sites(is_active) WHERE deleted_at IS NULL;
-- buildings
CREATE INDEX IF NOT EXISTS idx_buildings_site       ON buildings(site_id);
-- floors
CREATE INDEX IF NOT EXISTS idx_floors_building      ON floors(building_id);
-- departments
CREATE INDEX IF NOT EXISTS idx_depts_site           ON departments(site_id);
CREATE INDEX IF NOT EXISTS idx_depts_building       ON departments(building_id);
-- users
CREATE INDEX IF NOT EXISTS idx_users_role           ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status         ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_site           ON users(site_id) WHERE deleted_at IS NULL;
-- sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user        ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires     ON user_sessions(expires_at);
-- patients
CREATE INDEX IF NOT EXISTS idx_patients_name        ON patients(last_name, first_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_site        ON patients(site_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_status      ON patients(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_dob         ON patients(date_of_birth);
-- encounters
CREATE INDEX IF NOT EXISTS idx_enc_patient          ON encounters(patient_id);
CREATE INDEX IF NOT EXISTS idx_enc_status           ON encounters(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_enc_type             ON encounters(type);
CREATE INDEX IF NOT EXISTS idx_enc_site             ON encounters(site_id);
CREATE INDEX IF NOT EXISTS idx_enc_opened           ON encounters(opened_at DESC);
-- emergency_visits
CREATE INDEX IF NOT EXISTS idx_ev_patient           ON emergency_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_ev_status            ON emergency_visits(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ev_priority          ON emergency_visits(priority);
CREATE INDEX IF NOT EXISTS idx_ev_arrival           ON emergency_visits(arrival_time DESC);
-- ambulances
CREATE INDEX IF NOT EXISTS idx_amb_status           ON ambulances(status) WHERE deleted_at IS NULL;
-- occupancy_beds
CREATE INDEX IF NOT EXISTS idx_occ_beds_status      ON occupancy_beds(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_occ_beds_site        ON occupancy_beds(site_id);
CREATE INDEX IF NOT EXISTS idx_occ_beds_patient     ON occupancy_beds(patient_id);
-- icu_beds
CREATE INDEX IF NOT EXISTS idx_icu_beds_status      ON icu_beds(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_icu_beds_site        ON icu_beds(site_id);
-- icu_admissions
CREATE INDEX IF NOT EXISTS idx_icu_adm_patient      ON icu_admissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_icu_adm_status       ON icu_admissions(status) WHERE deleted_at IS NULL;
-- admissions
CREATE INDEX IF NOT EXISTS idx_adm_patient          ON admissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_adm_status           ON admissions(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_adm_date             ON admissions(admission_date DESC);
CREATE INDEX IF NOT EXISTS idx_adm_site             ON admissions(site_id);
CREATE INDEX IF NOT EXISTS idx_adm_service          ON admissions(service_id);
-- surgical_requests
CREATE INDEX IF NOT EXISTS idx_surg_patient         ON surgical_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_surg_status          ON surgical_requests(status) WHERE deleted_at IS NULL;
-- or_slots
CREATE INDEX IF NOT EXISTS idx_or_slots_room        ON or_slots(or_room_id);
CREATE INDEX IF NOT EXISTS idx_or_slots_start       ON or_slots(start_at);
-- lab_orders
CREATE INDEX IF NOT EXISTS idx_lab_encounter        ON lab_orders(encounter_id);
CREATE INDEX IF NOT EXISTS idx_lab_patient          ON lab_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_status           ON lab_orders(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lab_urgency          ON lab_orders(urgency);
CREATE INDEX IF NOT EXISTS idx_lab_requested        ON lab_orders(requested_at DESC);
-- imaging_orders
CREATE INDEX IF NOT EXISTS idx_img_encounter        ON imaging_orders(encounter_id);
CREATE INDEX IF NOT EXISTS idx_img_patient          ON imaging_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_img_status           ON imaging_orders(status) WHERE deleted_at IS NULL;
-- prescriptions
CREATE INDEX IF NOT EXISTS idx_rx_encounter         ON prescriptions(encounter_id);
CREATE INDEX IF NOT EXISTS idx_rx_patient           ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_rx_status            ON prescriptions(status) WHERE deleted_at IS NULL;
-- medications
CREATE INDEX IF NOT EXISTS idx_med_name             ON medications(name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_med_expiry           ON medications(expiry_date);
-- consultations
CREATE INDEX IF NOT EXISTS idx_cons_patient         ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_cons_doctor          ON consultations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_cons_status          ON consultations(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cons_scheduled       ON consultations(scheduled_at);
-- appointments
CREATE INDEX IF NOT EXISTS idx_appt_patient         ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appt_doctor          ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appt_status          ON appointments(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_appt_scheduled       ON appointments(scheduled_at);
-- invoices
CREATE INDEX IF NOT EXISTS idx_inv_patient          ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_inv_status           ON invoices(status) WHERE deleted_at IS NULL;
-- audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_timestamp      ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_module         ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_patient        ON audit_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_user           ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_severity       ON audit_logs(severity);
-- notifications
CREATE INDEX IF NOT EXISTS idx_notif_priority       ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notif_created        ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_dismissed      ON notifications(is_dismissed);

COMMIT;
