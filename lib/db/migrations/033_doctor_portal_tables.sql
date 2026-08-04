-- Migration 033: Doctor Portal — new tables
-- clinical_notes, medical_signatures, clinical_tasks, doctor_messages, doctor_portal_preferences
-- All FK references use existing tables; safe to apply multiple times (idempotent guards).

BEGIN;

-- ─── clinical_notes ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinical_notes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID        NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  encounter_id    UUID        REFERENCES encounters(id) ON DELETE SET NULL,
  author_id       UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type            TEXT        NOT NULL CHECK (type IN (
                    'note_consultation','note_evolution','note_visite',
                    'note_garde','avis_specialiste','addendum','resume_medical'
                  )),
  content         TEXT        NOT NULL DEFAULT '',
  status          TEXT        NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','signed','amended','cancelled')),
  parent_note_id  UUID        REFERENCES clinical_notes(id) ON DELETE SET NULL,
  signed_at       TIMESTAMPTZ,
  locked_at       TIMESTAMPTZ,
  version         INTEGER     NOT NULL DEFAULT 1,
  content_hash    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_patient    ON clinical_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_encounter  ON clinical_notes(encounter_id);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_author     ON clinical_notes(author_id);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_status     ON clinical_notes(status);

-- ─── medical_signatures ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_signatures (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id       UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role            TEXT        NOT NULL,
  resource_type   TEXT        NOT NULL,  -- 'consultation' | 'prescription' | 'clinical_note'
  resource_id     UUID        NOT NULL,
  signature_type  TEXT        NOT NULL CHECK (signature_type IN ('validation','signature','visa','addendum')),
  content_hash    TEXT,
  reason          TEXT,
  ip_address      TEXT,
  device          TEXT,
  signed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_med_sigs_doctor       ON medical_signatures(doctor_id);
CREATE INDEX IF NOT EXISTS idx_med_sigs_resource     ON medical_signatures(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_med_sigs_signed_at    ON medical_signatures(signed_at);

-- ─── clinical_tasks ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinical_tasks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   UUID        NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  encounter_id UUID        REFERENCES encounters(id) ON DELETE SET NULL,
  created_by   UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_to  UUID        REFERENCES users(id) ON DELETE SET NULL,
  type         TEXT        NOT NULL,
  title        TEXT        NOT NULL,
  notes        TEXT,
  due_at       TIMESTAMPTZ,
  priority     TEXT        NOT NULL DEFAULT 'medium'
               CHECK (priority IN ('low','medium','high','critical')),
  status       TEXT        NOT NULL DEFAULT 'open'
               CHECK (status IN ('open','in_progress','completed','overdue','cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clinical_tasks_patient    ON clinical_tasks(patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_tasks_assigned   ON clinical_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_clinical_tasks_status     ON clinical_tasks(status);
CREATE INDEX IF NOT EXISTS idx_clinical_tasks_due        ON clinical_tasks(due_at);

-- ─── doctor_messages ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctor_messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recipient_id UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subject      TEXT        NOT NULL,
  body         TEXT        NOT NULL,
  is_read      BOOLEAN     NOT NULL DEFAULT false,
  read_at      TIMESTAMPTZ,
  patient_id   UUID        REFERENCES patients(id) ON DELETE SET NULL,
  encounter_id UUID        REFERENCES encounters(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_doctor_msgs_recipient ON doctor_messages(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_doctor_msgs_sender    ON doctor_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_doctor_msgs_patient   ON doctor_messages(patient_id);

-- ─── doctor_portal_preferences ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctor_portal_preferences (
  user_id             UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  language            TEXT        NOT NULL DEFAULT 'fr',
  signature_text      TEXT,
  notification_prefs  JSONB       NOT NULL DEFAULT '{}',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Extend existing tables with doctor-portal-specific columns ──────────────
-- acknowledged_at / acknowledged_by on lab_orders for critical result workflow
ALTER TABLE lab_orders
  ADD COLUMN IF NOT EXISTS acknowledged_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acknowledged_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS clinical_note      TEXT;

-- acknowledged_at on imaging_orders
ALTER TABLE imaging_orders
  ADD COLUMN IF NOT EXISTS acknowledged_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acknowledged_by_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- signed_at / locked_at / content_hash on consultations for signature workflow
ALTER TABLE consultations
  ADD COLUMN IF NOT EXISTS signed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- signed_at / locked_at on prescriptions
ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS signed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

COMMIT;
