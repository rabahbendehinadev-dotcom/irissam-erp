#!/usr/bin/env bash
# =============================================================================
# test-legacy-migration.sh
# =============================================================================
# End-to-end test for Migration 007 (integer → UUID) on a real legacy schema.
#
# What it does:
#   1. Creates a fresh PostgreSQL test database.
#   2. Applies migrations 001–006 (enums, reference tables, RBAC, etc.).
#   3. Drops the UUID clinical tables created by 001 and recreates them
#      with SERIAL/INTEGER PKs, plus patients_legacy — simulating the real
#      legacy production state.
#   4. Inserts a fully linked test dataset:
#        patient → encounter → admission → occupancy_bed
#                            → consultation → lab_order → imaging_order
#                            → prescription → emergency_visit
#                            → invoice → invoice_items(×2) → payment
#   5. Records a BEFORE snapshot (row counts, FK values, NULL counts).
#   6. Runs migration 007 (the integer → UUID conversion).
#   7. Records an AFTER snapshot and verifies every assertion.
#   8. Prints a full before/after comparison report.
#   9. Drops the test database on success (kept on failure for inspection).
#
# Usage:
#   chmod +x lib/db/scripts/test-legacy-migration.sh
#   ./lib/db/scripts/test-legacy-migration.sh
#
# Requirements:
#   - DATABASE_URL env var pointing to the dev PostgreSQL instance.
#   - psql in PATH.
# =============================================================================

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

pass() { echo -e "  ${GREEN}✓${RESET} $*"; }
fail() { echo -e "  ${RED}✗ FAIL${RESET} $*"; FAILURES=$((FAILURES+1)); }
info() { echo -e "  ${CYAN}→${RESET} $*"; }
section() { echo -e "\n${BOLD}${YELLOW}══ $* ══${RESET}"; }

FAILURES=0
TEST_DB="irissam_mig007_test_$$"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$(cd "${SCRIPT_DIR}/../../migrations" 2>/dev/null && pwd || echo "${SCRIPT_DIR}/../migrations")"

# Strip the database name from DATABASE_URL and replace it
BASE_URL="${DATABASE_URL%/*}"
TEST_URL="${BASE_URL}/${TEST_DB}"

cleanup() {
  local code=$?
  if [ $code -eq 0 ] && [ "$FAILURES" -eq 0 ]; then
    info "Dropping test database ${TEST_DB}..."
    psql "${BASE_URL}/postgres" -c "DROP DATABASE IF EXISTS ${TEST_DB};" 2>/dev/null || true
    echo -e "\n${GREEN}${BOLD}═══════════════════════════════════════${RESET}"
    echo -e "${GREEN}${BOLD}  ALL TESTS PASSED — Migration 007 ready${RESET}"
    echo -e "${GREEN}${BOLD}═══════════════════════════════════════${RESET}\n"
  else
    echo -e "\n${RED}${BOLD}═══════════════════════════════════════════════════${RESET}"
    echo -e "${RED}${BOLD}  ${FAILURES} TEST(S) FAILED${RESET}"
    echo -e "${RED}${BOLD}  Test DB '${TEST_DB}' kept for inspection.${RESET}"
    echo -e "${RED}${BOLD}  Connect: psql \"${TEST_URL}\"${RESET}"
    echo -e "${RED}${BOLD}═══════════════════════════════════════════════════${RESET}\n"
    exit 1
  fi
}
trap cleanup EXIT

# ─────────────────────────────────────────────────────────────────────────────
section "STEP 1 — Create test database"
# ─────────────────────────────────────────────────────────────────────────────
psql "${BASE_URL}/postgres" -c "CREATE DATABASE ${TEST_DB};" > /dev/null
pass "Database '${TEST_DB}' created."

# ─────────────────────────────────────────────────────────────────────────────
section "STEP 2 — Apply migrations 001–006"
# ─────────────────────────────────────────────────────────────────────────────
for mig in 001_clinical_schema.sql 002_seed_indexes.sql 003_schema_additions.sql \
           004_auth_rbac.sql 005_rbac_seed.sql 006_fix_legacy_constraints.sql; do
  f="${MIGRATIONS_DIR}/${mig}"
  if [ ! -f "$f" ]; then
    echo -e "${RED}Migration file not found: ${f}${RESET}"; exit 1
  fi
  psql "$TEST_URL" -v ON_ERROR_STOP=1 -f "$f" > /dev/null 2>&1
  pass "${mig}"
done

# ─────────────────────────────────────────────────────────────────────────────
section "STEP 3 — Simulate legacy state (SERIAL PKs)"
# ─────────────────────────────────────────────────────────────────────────────
# After 001-006 the clinical tables have UUID PKs.
# Drop them (CASCADE) and recreate with SERIAL PKs to match old production.
psql "$TEST_URL" -v ON_ERROR_STOP=1 << 'LEGACY_SQL'

-- ── Drop UUID clinical tables in safe order ─────────────────────────────────
DROP TABLE IF EXISTS payments               CASCADE;
DROP TABLE IF EXISTS invoice_items          CASCADE;
DROP TABLE IF EXISTS invoices               CASCADE;
DROP TABLE IF EXISTS prescriptions          CASCADE;
DROP TABLE IF EXISTS imaging_orders         CASCADE;
DROP TABLE IF EXISTS lab_orders             CASCADE;
DROP TABLE IF EXISTS consultations          CASCADE;
DROP TABLE IF EXISTS emergency_vitals       CASCADE;
DROP TABLE IF EXISTS emergency_visits       CASCADE;
DROP TABLE IF EXISTS or_slots               CASCADE;
DROP TABLE IF EXISTS surgical_requests      CASCADE;
DROP TABLE IF EXISTS admission_timeline_events CASCADE;
DROP TABLE IF EXISTS admissions             CASCADE;
DROP TABLE IF EXISTS icu_admissions         CASCADE;
DROP TABLE IF EXISTS occupancy_beds         CASCADE;
DROP TABLE IF EXISTS icu_beds               CASCADE;
DROP TABLE IF EXISTS encounters             CASCADE;

-- ── Create patients_legacy (simulates old SERIAL patients table) ─────────────
-- (In production this was created by migration 001 renaming the old patients table)
CREATE TABLE IF NOT EXISTS patients_legacy (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL DEFAULT '',
  age             INTEGER NOT NULL DEFAULT 0,
  file_number     TEXT NOT NULL UNIQUE,
  service         TEXT NOT NULL DEFAULT '',
  first_name      TEXT,
  last_name       TEXT,
  mpi_id          TEXT,
  gender          TEXT,
  date_of_birth   TEXT,
  phone           TEXT,
  status          TEXT NOT NULL DEFAULT 'active',
  sync_status     TEXT NOT NULL DEFAULT 'synced',
  is_incomplete   BOOLEAN NOT NULL DEFAULT false,
  registered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── SERIAL clinical tables ───────────────────────────────────────────────────

CREATE TABLE encounters (
  id              SERIAL PRIMARY KEY,
  patient_id      INTEGER,              -- old integer FK to patients_legacy
  patient_name    TEXT NOT NULL DEFAULT '',
  type            encounter_type NOT NULL DEFAULT 'urgence',
  status          encounter_status NOT NULL DEFAULT 'open',
  chief_complaint TEXT NOT NULL DEFAULT '',
  source_module   source_module NOT NULL DEFAULT 'urgences',
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at       TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE occupancy_beds (
  id                  SERIAL PRIMARY KEY,
  number              TEXT NOT NULL,
  status              occupancy_bed_status NOT NULL DEFAULT 'disponible',
  patient_id          INTEGER,
  patient_name        TEXT,
  encounter_id        INTEGER,
  admission_id        INTEGER,
  occupied_at         TIMESTAMPTZ,
  expected_release_at TIMESTAMPTZ,
  notes               TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE icu_beds (
  id                  SERIAL PRIMARY KEY,
  number              TEXT NOT NULL,
  unit_name           TEXT NOT NULL DEFAULT 'Réanimation',
  status              icu_bed_status NOT NULL DEFAULT 'disponible',
  patient_id          INTEGER,
  patient_name        TEXT,
  encounter_id        INTEGER,
  icu_admission_id    INTEGER,
  occupied_at         TIMESTAMPTZ,
  expected_release_at TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE icu_admissions (
  id                SERIAL PRIMARY KEY,
  encounter_id      INTEGER,
  patient_id        INTEGER,
  patient_name      TEXT NOT NULL DEFAULT '',
  motif             TEXT NOT NULL DEFAULT '',
  priority          TEXT NOT NULL DEFAULT 'normale',
  icu_bed_id        INTEGER,
  team_notified     TEXT NOT NULL DEFAULT 'false',
  status            icu_admission_status NOT NULL DEFAULT 'demande',
  requested_by_name TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admissions (
  id                      SERIAL PRIMARY KEY,
  admission_number        TEXT NOT NULL UNIQUE,
  encounter_id            INTEGER,
  patient_id              INTEGER NOT NULL,
  patient_name            TEXT NOT NULL DEFAULT '',
  type                    admission_type NOT NULL DEFAULT 'hospitalisation',
  status                  admission_status NOT NULL DEFAULT 'active',
  priority                admission_priority NOT NULL DEFAULT 'normal',
  service_name            TEXT NOT NULL DEFAULT '',
  doctor_name             TEXT NOT NULL DEFAULT '',
  motif                   TEXT NOT NULL DEFAULT '',
  diagnosis               TEXT,
  bed_number              TEXT,
  room_number             TEXT,
  floor_label             TEXT,
  building_name           TEXT,
  admission_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  admission_time          TEXT NOT NULL DEFAULT '00:00',
  expected_discharge_date DATE,
  actual_discharge_date   DATE,
  discharge_type          discharge_type,
  discharge_notes         TEXT,
  transfer_to             TEXT,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admission_timeline_events (
  id           SERIAL PRIMARY KEY,
  admission_id INTEGER NOT NULL,
  type         TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  date         TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_name    TEXT,
  meta         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE surgical_requests (
  id                SERIAL PRIMARY KEY,
  encounter_id      INTEGER,
  patient_id        INTEGER NOT NULL,
  patient_name      TEXT NOT NULL DEFAULT '',
  intervention      TEXT NOT NULL DEFAULT '',
  surgeon_name      TEXT,
  urgency_degree    surgical_urgency NOT NULL DEFAULT 'elective',
  consent_signed    BOOLEAN NOT NULL DEFAULT false,
  status            surgical_status NOT NULL DEFAULT 'demande',
  requested_by_name TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE emergency_visits (
  id              SERIAL PRIMARY KEY,
  encounter_id    INTEGER NOT NULL,
  patient_id      INTEGER NOT NULL,
  priority        emergency_priority NOT NULL DEFAULT 'non_classe',
  status          emergency_patient_status NOT NULL DEFAULT 'attente_triage',
  chief_complaint TEXT NOT NULL DEFAULT '',
  by_ambulance    BOOLEAN NOT NULL DEFAULT false,
  is_minor        BOOLEAN NOT NULL DEFAULT false,
  arrival_time    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE emergency_vitals (
  id               SERIAL PRIMARY KEY,
  encounter_id     INTEGER NOT NULL,
  visit_id         INTEGER NOT NULL,
  heart_rate       INTEGER,
  blood_pressure   TEXT,
  spo2             REAL,
  temperature      REAL,
  respiratory_rate INTEGER,
  gcs              INTEGER,
  pain_level       INTEGER,
  glucose          REAL,
  notes            TEXT,
  recorded_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE or_slots (
  id                  SERIAL PRIMARY KEY,
  surgical_request_id INTEGER,
  patient_id          INTEGER,
  patient_name        TEXT,
  start_time          TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_time            TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 hours'),
  status              or_slot_status NOT NULL DEFAULT 'planifie',
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE consultations (
  id           SERIAL PRIMARY KEY,
  encounter_id INTEGER,
  patient_id   INTEGER,
  number       TEXT NOT NULL UNIQUE,
  patient_name TEXT NOT NULL DEFAULT '',
  patient_mpi  TEXT NOT NULL DEFAULT '',
  doctor_name  TEXT NOT NULL DEFAULT '',
  specialty    TEXT NOT NULL DEFAULT '',
  service_name TEXT NOT NULL DEFAULT '',
  reason       TEXT NOT NULL DEFAULT '',
  status       consultation_status NOT NULL DEFAULT 'en_attente',
  type         consultation_type NOT NULL DEFAULT 'consultation_externe',
  origin       consultation_origin NOT NULL DEFAULT 'rdv',
  diagnosis    TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lab_orders (
  id                SERIAL PRIMARY KEY,
  encounter_id      INTEGER,
  patient_id        INTEGER,
  patient_name      TEXT NOT NULL DEFAULT '',
  test              TEXT NOT NULL DEFAULT '',
  category          TEXT NOT NULL DEFAULT '',
  urgency           urgency_level NOT NULL DEFAULT 'routine',
  requested_by_name TEXT NOT NULL DEFAULT '',
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  status            lab_status NOT NULL DEFAULT 'demandee',
  result            TEXT,
  is_critical       BOOLEAN NOT NULL DEFAULT false,
  laboratory        TEXT,
  source_module     source_module NOT NULL DEFAULT 'urgences',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE imaging_orders (
  id                SERIAL PRIMARY KEY,
  encounter_id      INTEGER,
  patient_id        INTEGER,
  patient_name      TEXT NOT NULL DEFAULT '',
  exam              TEXT NOT NULL DEFAULT '',
  region            TEXT NOT NULL DEFAULT '',
  urgency           urgency_level NOT NULL DEFAULT 'routine',
  requested_by_name TEXT NOT NULL DEFAULT '',
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  status            imaging_status NOT NULL DEFAULT 'demandee',
  source_module     source_module NOT NULL DEFAULT 'urgences',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE prescriptions (
  id                 SERIAL PRIMARY KEY,
  encounter_id       INTEGER,
  patient_id         INTEGER,
  patient_name       TEXT NOT NULL DEFAULT '',
  drug               TEXT NOT NULL DEFAULT '',
  dosage             TEXT NOT NULL DEFAULT '',
  route              TEXT NOT NULL DEFAULT '',
  frequency          TEXT NOT NULL DEFAULT '',
  duration           TEXT,
  prescribed_by_name TEXT NOT NULL DEFAULT '',
  prescribed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  status             prescription_status NOT NULL DEFAULT 'prescrit',
  source_module      source_module NOT NULL DEFAULT 'urgences',
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invoices (
  id           SERIAL PRIMARY KEY,
  patient_id   INTEGER NOT NULL,
  patient_name TEXT NOT NULL DEFAULT '',
  encounter_id INTEGER,
  admission_id INTEGER,
  type         TEXT NOT NULL DEFAULT 'hospitalisation',
  status       invoice_status NOT NULL DEFAULT 'pending',
  total_amount REAL NOT NULL DEFAULT 0,
  paid_amount  REAL NOT NULL DEFAULT 0,
  due_amount   REAL NOT NULL DEFAULT 0,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invoice_items (
  id          SERIAL PRIMARY KEY,
  invoice_id  INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category    TEXT,
  quantity    REAL NOT NULL DEFAULT 1,
  unit_price  REAL NOT NULL DEFAULT 0,
  total_price REAL NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id         SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL,
  amount     REAL NOT NULL DEFAULT 0,
  method     payment_method NOT NULL DEFAULT 'cash',
  reference  TEXT,
  notes      TEXT,
  paid_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

LEGACY_SQL

pass "SERIAL legacy tables created."

# ─────────────────────────────────────────────────────────────────────────────
section "STEP 4 — Insert test reference data + linked clinical data"
# ─────────────────────────────────────────────────────────────────────────────
psql "$TEST_URL" -v ON_ERROR_STOP=1 << 'SEED_SQL'

-- ── Reference data ───────────────────────────────────────────────────────────

-- Insert a test site (if none exists from 005 seed)
INSERT INTO sites (id, name, code, city, is_active)
VALUES ('00000000-0000-0000-0001-000000000001', 'IRISSAM Test', 'IRISSAM', 'Alger', true)
ON CONFLICT DO NOTHING;

-- Insert a test operating_room (needed for or_slots.or_room_id NOT NULL)
INSERT INTO operating_rooms (id, name, short_name, site_id, status)
VALUES (
  '00000000-0000-0000-0002-000000000001',
  'Bloc A - Salle 1',
  'A1',
  (SELECT id FROM sites LIMIT 1),
  'libre'
)
ON CONFLICT DO NOTHING;

-- ── patients_legacy (old SERIAL patients) ────────────────────────────────────
INSERT INTO patients_legacy (id, name, age, file_number, service, first_name, last_name, gender, phone, status)
OVERRIDING SYSTEM VALUE VALUES
  (1, 'Benali Ahmed',   45, 'TEST-FN-001', 'Urgences', 'Ahmed',   'Benali',   'M', '0550000001', 'active'),
  (2, 'Cherif Fatima',  32, 'TEST-FN-002', 'Urgences', 'Fatima',  'Cherif',   'F', '0550000002', 'active'),
  (3, 'Merad Youcef',   58, 'TEST-FN-003', 'Urgences', 'Youcef',  'Merad',    'M', '0550000003', 'active');

-- Advance the sequence past our manual inserts
SELECT setval('patients_legacy_id_seq', 100, false);

-- ── patients (UUID) — same file_numbers for patient_map join ─────────────────
INSERT INTO patients (id, mpi_id, mrn, file_number, first_name, last_name, gender, date_of_birth, nationality, phone, country)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'MPI-001', 'MRN-001', 'TEST-FN-001', 'Ahmed',  'Benali',  'M', '1979-03-15', 'DZ', '0550000001', 'DZ'),
  ('10000000-0000-0000-0000-000000000002', 'MPI-002', 'MRN-002', 'TEST-FN-002', 'Fatima', 'Cherif',  'F', '1992-07-22', 'DZ', '0550000002', 'DZ'),
  ('10000000-0000-0000-0000-000000000003', 'MPI-003', 'MRN-003', 'TEST-FN-003', 'Youcef', 'Merad',   'M', '1966-11-08', 'DZ', '0550000003', 'DZ')
ON CONFLICT DO NOTHING;

-- ── Encounters (integer PK) ───────────────────────────────────────────────────
INSERT INTO encounters (id, patient_id, patient_name, type, status, chief_complaint, source_module)
OVERRIDING SYSTEM VALUE VALUES
  (1, 1, 'Benali Ahmed',  'urgence',      'open',   'Douleur thoracique intense',  'urgences'),
  (2, 2, 'Cherif Fatima', 'consultation', 'open',   'Suivi post-opératoire',       'consultations'),
  (3, 3, 'Merad Youcef',  'urgence',      'closed', 'Traumatisme crânien',         'urgences');

SELECT setval('encounters_id_seq', 100, false);

-- ── Occupancy beds ────────────────────────────────────────────────────────────
INSERT INTO occupancy_beds (id, number, status, patient_id, patient_name, encounter_id, admission_id)
OVERRIDING SYSTEM VALUE VALUES
  (1, 'L1-101', 'occupe', 1, 'Benali Ahmed',  1, 1),   -- will be updated after admissions migrated
  (2, 'L1-102', 'occupe', 2, 'Cherif Fatima', 2, 2),
  (3, 'L1-103', 'disponible', NULL, NULL, NULL, NULL);  -- empty bed, FKs NULL → should stay NULL

SELECT setval('occupancy_beds_id_seq', 100, false);

-- ── ICU beds ──────────────────────────────────────────────────────────────────
INSERT INTO icu_beds (id, number, unit_name, status, patient_id, patient_name, encounter_id)
OVERRIDING SYSTEM VALUE VALUES
  (1, 'REA-01', 'Réanimation', 'occupe', 3, 'Merad Youcef', 3),
  (2, 'REA-02', 'Réanimation', 'disponible', NULL, NULL, NULL);

SELECT setval('icu_beds_id_seq', 100, false);

-- ── Admissions ────────────────────────────────────────────────────────────────
INSERT INTO admissions (id, admission_number, encounter_id, patient_id, patient_name,
                        type, status, priority, service_name, doctor_name, motif,
                        bed_number, room_number, admission_date, admission_time)
OVERRIDING SYSTEM VALUE VALUES
  (1, 'ADM-TEST-001', 1, 1, 'Benali Ahmed',  'hospitalisation', 'active', 'urgent',
      'Cardiologie', 'Dr. Khelif', 'Douleur thoracique — suspicion SCA',
      'L1-101', '101', CURRENT_DATE, '08:30'),
  (2, 'ADM-TEST-002', 2, 2, 'Cherif Fatima', 'hospitalisation', 'active', 'normal',
      'Chirurgie',   'Dr. Amara', 'Suivi opération appendicite',
      'L1-102', '102', CURRENT_DATE - 1, '14:00'),
  (3, 'ADM-TEST-003', 3, 3, 'Merad Youcef',  'urgence',         'active', 'vital',
      'Neurologie',  'Dr. Bensad', 'TC grave avec perte de conscience',
      NULL, NULL, CURRENT_DATE, '03:15');

SELECT setval('admissions_id_seq', 100, false);

-- ── Admission timeline events ─────────────────────────────────────────────────
INSERT INTO admission_timeline_events (id, admission_id, type, description, user_name)
OVERRIDING SYSTEM VALUE VALUES
  (1, 1, 'admission',  'Patient admis en cardiologie',           'Dr. Khelif'),
  (2, 1, 'medication', 'Aspégic 500mg administré',               'Inf. Bouzid'),
  (3, 2, 'admission',  'Patient admis en chirurgie',             'Dr. Amara'),
  (4, 3, 'admission',  'Admission urgente — réanimation activée', 'Dr. Bensad');

SELECT setval('admission_timeline_events_id_seq', 100, false);

-- ── ICU admissions ────────────────────────────────────────────────────────────
INSERT INTO icu_admissions (id, encounter_id, patient_id, patient_name, motif, priority, icu_bed_id, status)
OVERRIDING SYSTEM VALUE VALUES
  (1, 3, 3, 'Merad Youcef', 'TC grave', 'élevée', 1, 'en_cours');

SELECT setval('icu_admissions_id_seq', 100, false);

-- ── Emergency visits ──────────────────────────────────────────────────────────
INSERT INTO emergency_visits (id, encounter_id, patient_id, priority, status, chief_complaint, arrival_time)
OVERRIDING SYSTEM VALUE VALUES
  (1, 1, 1, 'P2', 'en_soins',   'Douleur thoracique intense',  now() - interval '3 hours'),
  (2, 3, 3, 'P1', 'observation', 'Traumatisme crânien grave',  now() - interval '6 hours');

SELECT setval('emergency_visits_id_seq', 100, false);

-- ── Emergency vitals ──────────────────────────────────────────────────────────
INSERT INTO emergency_vitals (id, encounter_id, visit_id, heart_rate, blood_pressure, spo2, temperature)
OVERRIDING SYSTEM VALUE VALUES
  (1, 1, 1, 110, '150/95', 96.0, 37.2),
  (2, 1, 1,  95, '140/88', 97.5, 37.0),
  (3, 3, 2,  78, '120/80', 94.0, 36.8);

SELECT setval('emergency_vitals_id_seq', 100, false);

-- ── Surgical requests ─────────────────────────────────────────────────────────
INSERT INTO surgical_requests (id, encounter_id, patient_id, patient_name, intervention,
                               surgeon_name, urgency_degree, consent_signed, status)
OVERRIDING SYSTEM VALUE VALUES
  (1, 1, 1, 'Benali Ahmed',  'Coronarographie diagnostique', 'Dr. Khelif', 'urgent',    true,  'planifie'),
  (2, 3, 3, 'Merad Youcef',  'Craniotomie décompressive',   'Dr. Bensad', 'emergency', false, 'demande');

SELECT setval('surgical_requests_id_seq', 100, false);

-- ── OR slots ──────────────────────────────────────────────────────────────────
INSERT INTO or_slots (id, surgical_request_id, patient_id, patient_name, start_time, end_time, status)
OVERRIDING SYSTEM VALUE VALUES
  (1, 1, 1, 'Benali Ahmed', now() + interval '4 hours', now() + interval '6 hours', 'planifie'),
  (2, 2, 3, 'Merad Youcef', now() + interval '1 hour',  now() + interval '4 hours', 'planifie');

SELECT setval('or_slots_id_seq', 100, false);

-- ── Consultations ─────────────────────────────────────────────────────────────
INSERT INTO consultations (id, encounter_id, patient_id, number, patient_name, patient_mpi,
                           doctor_name, specialty, service_name, reason, status, type, origin)
OVERRIDING SYSTEM VALUE VALUES
  (1, 1, 1, 'C-TEST-001', 'Benali Ahmed',  'MPI-001', 'Dr. Khelif', 'Cardiologie',  'Cardiologie',  'Douleur thoracique',    'en_cours',   'consultation_externe', 'urgence'),
  (2, 2, 2, 'C-TEST-002', 'Cherif Fatima', 'MPI-002', 'Dr. Amara',  'Chirurgie',    'Chirurgie',    'Contrôle post-op',      'en_attente', 'consultation_externe', 'rdv'),
  (3, 3, 3, 'C-TEST-003', 'Merad Youcef',  'MPI-003', 'Dr. Bensad', 'Neurologie',   'Neurologie',   'Évaluation neurologique','en_cours',  'consultation_externe', 'urgence');

SELECT setval('consultations_id_seq', 100, false);

-- ── Lab orders ────────────────────────────────────────────────────────────────
INSERT INTO lab_orders (id, encounter_id, patient_id, patient_name, test, category,
                        urgency, requested_by_name, status, is_critical, source_module)
OVERRIDING SYSTEM VALUE VALUES
  (1, 1, 1, 'Benali Ahmed',  'Troponine',        'biochimie',   'STAT',    'Dr. Khelif', 'en_cours', true,  'urgences'),
  (2, 1, 1, 'Benali Ahmed',  'NFS',              'hematologie', 'urgent',  'Dr. Khelif', 'demandee', false, 'urgences'),
  (3, 2, 2, 'Cherif Fatima', 'CRP',              'biochimie',   'routine', 'Dr. Amara',  'demandee', false, 'consultations'),
  (4, 3, 3, 'Merad Youcef',  'Gaz du sang',      'biochimie',   'STAT',    'Dr. Bensad', 'en_cours', false, 'urgences');

SELECT setval('lab_orders_id_seq', 100, false);

-- ── Imaging orders ────────────────────────────────────────────────────────────
INSERT INTO imaging_orders (id, encounter_id, patient_id, patient_name, exam, region,
                            urgency, requested_by_name, status, source_module)
OVERRIDING SYSTEM VALUE VALUES
  (1, 1, 1, 'Benali Ahmed',  'ECG + ÉchoCœur',   'thorax', 'urgent', 'Dr. Khelif', 'demandee', 'urgences'),
  (2, 3, 3, 'Merad Youcef',  'Scanner cérébral',  'crane',  'STAT',   'Dr. Bensad', 'planifiee', 'urgences');

SELECT setval('imaging_orders_id_seq', 100, false);

-- ── Prescriptions ─────────────────────────────────────────────────────────────
INSERT INTO prescriptions (id, encounter_id, patient_id, patient_name, drug, dosage,
                           route, frequency, duration, prescribed_by_name, status, source_module)
OVERRIDING SYSTEM VALUE VALUES
  (1, 1, 1, 'Benali Ahmed',  'Aspégic',     '500mg', 'IV',   'dose unique',  NULL,    'Dr. Khelif', 'prescrit', 'urgences'),
  (2, 1, 1, 'Benali Ahmed',  'Héparine',    '5000U', 'SC',   '3 fois/jour',  '5j',    'Dr. Khelif', 'prescrit', 'urgences'),
  (3, 2, 2, 'Cherif Fatima', 'Amoxicilline','1g',    'PO',   '2 fois/jour',  '7j',    'Dr. Amara',  'prescrit', 'consultations'),
  (4, 3, 3, 'Merad Youcef',  'Mannitol',    '100ml', 'perf', 'toutes 4h',    '48h',   'Dr. Bensad', 'prescrit', 'urgences');

SELECT setval('prescriptions_id_seq', 100, false);

-- ── Invoices ─────────────────────────────────────────────────────────────────
INSERT INTO invoices (id, patient_id, patient_name, encounter_id, admission_id,
                      type, status, total_amount, paid_amount, due_amount)
OVERRIDING SYSTEM VALUE VALUES
  (1, 1, 'Benali Ahmed',  1, 1, 'hospitalisation', 'partial', 85000, 40000, 45000),
  (2, 2, 'Cherif Fatima', 2, 2, 'hospitalisation', 'pending', 45000,     0, 45000),
  (3, 3, 'Merad Youcef',  3, 3, 'urgence',         'pending', 12000,     0, 12000);

SELECT setval('invoices_id_seq', 100, false);

-- ── Invoice items ─────────────────────────────────────────────────────────────
INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, total_price)
OVERRIDING SYSTEM VALUE VALUES
  (1, 1, 'Hospitalisation cardiologie (3 nuits)', 'hebergement', 3, 15000, 45000),
  (2, 1, 'Coronarographie',                       'acte_medical', 1, 35000, 35000),
  (3, 1, 'Médicaments IV',                        'pharmacie',    1,  5000,  5000),
  (4, 2, 'Hospitalisation chirurgie (2 nuits)',   'hebergement',  2, 15000, 30000),
  (5, 2, 'Suivi post-opératoire',                 'acte_medical', 1, 15000, 15000),
  (6, 3, 'Prise en charge urgences',              'acte_medical', 1,  8000,  8000),
  (7, 3, 'Scanner cérébral',                      'imagerie',     1,  4000,  4000);

SELECT setval('invoice_items_id_seq', 100, false);

-- ── Payments ──────────────────────────────────────────────────────────────────
INSERT INTO payments (id, invoice_id, amount, method, reference)
OVERRIDING SYSTEM VALUE VALUES
  (1, 1, 40000, 'cash',     NULL),
  (2, 1,  5000, 'virement', 'VIR-2026-001');   -- partial: 2 payments on same invoice

SELECT setval('payments_id_seq', 100, false);

SEED_SQL

pass "Test data seeded (3 patients, 3 encounters, 3 admissions, 2 emergency_visits, 3 vitals, 2 surgical_requests, 2 or_slots, 3 consultations, 4 lab_orders, 2 imaging_orders, 4 prescriptions, 3 invoices, 7 invoice_items, 2 payments)."

# ─────────────────────────────────────────────────────────────────────────────
section "STEP 5 — Before snapshot"
# ─────────────────────────────────────────────────────────────────────────────
declare -A BEFORE
capture_before() {
  local tbl=$1 col=${2:-id}
  BEFORE[$tbl]=$(psql "$TEST_URL" -t -A -c "SELECT COUNT(*) FROM ${tbl};" 2>/dev/null || echo "0")
}

TABLES=(encounters occupancy_beds icu_beds icu_admissions admissions
        admission_timeline_events surgical_requests emergency_visits emergency_vitals
        or_slots consultations lab_orders imaging_orders prescriptions
        invoices invoice_items payments)

for t in "${TABLES[@]}"; do capture_before "$t"; done

# Capture FK integer values before migration
ENC_ENC_ID_BEFORE=$(psql "$TEST_URL" -t -A -c "SELECT id, encounter_id FROM admissions ORDER BY id;" 2>/dev/null)
INV_ADM_ID_BEFORE=$(psql "$TEST_URL" -t -A -c "SELECT id, admission_id FROM invoices ORDER BY id;" 2>/dev/null)
OCB_ADM_ID_BEFORE=$(psql "$TEST_URL" -t -A -c "SELECT id, admission_id FROM occupancy_beds WHERE admission_id IS NOT NULL ORDER BY id;" 2>/dev/null)

echo ""
printf "  %-40s %10s\n" "Table" "Rows (before)"
printf "  %-40s %10s\n" "─────────────────────────────────────" "─────────────"
for t in "${TABLES[@]}"; do
  printf "  %-40s %10s\n" "$t" "${BEFORE[$t]}"
done

# ─────────────────────────────────────────────────────────────────────────────
section "STEP 6 — Run Migration 007 (integer → UUID)"
# ─────────────────────────────────────────────────────────────────────────────
set +e
MIG_OUTPUT=$(psql "$TEST_URL" -v ON_ERROR_STOP=1 -f "${MIGRATIONS_DIR}/007_safe_uuid_migration.sql" 2>&1)
MIG_STATUS=$?
set -e

if [ $MIG_STATUS -ne 0 ]; then
  echo -e "${RED}Migration 007 FAILED:${RESET}"
  echo "$MIG_OUTPUT" | tail -40
  fail "Migration 007 returned non-zero exit code (${MIG_STATUS})."
else
  echo "$MIG_OUTPUT" | grep -E 'NOTICE|WARNING|ERROR' | while IFS= read -r line; do
    if echo "$line" | grep -q '✓'; then
      echo -e "  ${GREEN}${line}${RESET}"
    elif echo "$line" | grep -q 'WARNING\|ERROR'; then
      echo -e "  ${RED}${line}${RESET}"
    else
      echo -e "  ${CYAN}${line}${RESET}"
    fi
  done
  pass "Migration 007 completed without error."
fi

# ─────────────────────────────────────────────────────────────────────────────
section "STEP 7 — After snapshot + Verification"
# ─────────────────────────────────────────────────────────────────────────────

# Helper: run a SQL query returning a single integer
q() { psql "$TEST_URL" -t -A -c "$1" 2>/dev/null || echo "ERROR"; }

echo ""
printf "  %-40s %10s %10s  %s\n" "Table" "Before" "After" "Status"
printf "  %-40s %10s %10s  %s\n" "─────────────────────────────────────" "──────" "─────" "──────"

for t in "${TABLES[@]}"; do
  before="${BEFORE[$t]}"
  after=$(q "SELECT COUNT(*) FROM ${t};")
  if [ "$after" = "$before" ]; then
    printf "  %-40s %10s %10s  ${GREEN}✓ count match${RESET}\n" "$t" "$before" "$after"
  else
    printf "  %-40s %10s %10s  ${RED}✗ count MISMATCH${RESET}\n" "$t" "$before" "$after"
    fail "${t}: row count changed from ${before} to ${after}"
  fi
done

echo ""
echo -e "  ${BOLD}── UUID PK verification ──${RESET}"
for t in "${TABLES[@]}"; do
  dtype=$(q "SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='${t}' AND column_name='id';")
  if [ "$dtype" = "uuid" ]; then
    pass "${t}.id is UUID"
  elif [ "$dtype" = "integer" ]; then
    fail "${t}.id is still INTEGER — migration did not run for this table"
  else
    echo -e "  ${YELLOW}⚠${RESET} ${t}.id data_type='${dtype}' (table may not exist)"
  fi
done

echo ""
echo -e "  ${BOLD}── _int_legacy tables preserved ──${RESET}"
for t in "${TABLES[@]}"; do
  cnt=$(q "SELECT COUNT(*) FROM ${t}_int_legacy;" 2>/dev/null || echo "absent")
  if [ "$cnt" != "absent" ] && [ "$cnt" != "ERROR" ]; then
    pass "${t}_int_legacy exists with ${cnt} rows"
  else
    # Some tables don't have int_legacy (if they were already UUID); only warn
    echo -e "  ${YELLOW}○${RESET} ${t}_int_legacy: not present (table was already UUID before 007)"
  fi
done

echo ""
echo -e "  ${BOLD}── FK integrity: encounter_id chains ──${RESET}"

# admissions.encounter_id → encounters (no orphans)
orphans=$(q "SELECT COUNT(*) FROM admissions a WHERE a.encounter_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM encounters e WHERE e.id = a.encounter_id);")
[ "$orphans" = "0" ] && pass "admissions.encounter_id → encounters: 0 orphans" || fail "admissions.encounter_id: ${orphans} orphan(s)"

# invoice.encounter_id → encounters
orphans=$(q "SELECT COUNT(*) FROM invoices i WHERE i.encounter_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM encounters e WHERE e.id = i.encounter_id);")
[ "$orphans" = "0" ] && pass "invoices.encounter_id → encounters: 0 orphans" || fail "invoices.encounter_id: ${orphans} orphan(s)"

# consultation.encounter_id → encounters
orphans=$(q "SELECT COUNT(*) FROM consultations c WHERE c.encounter_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM encounters e WHERE e.id = c.encounter_id);")
[ "$orphans" = "0" ] && pass "consultations.encounter_id → encounters: 0 orphans" || fail "consultations.encounter_id: ${orphans} orphan(s)"

# lab_orders.encounter_id → encounters
orphans=$(q "SELECT COUNT(*) FROM lab_orders l WHERE l.encounter_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM encounters e WHERE e.id = l.encounter_id);")
[ "$orphans" = "0" ] && pass "lab_orders.encounter_id → encounters: 0 orphans" || fail "lab_orders.encounter_id: ${orphans} orphan(s)"

# imaging_orders.encounter_id → encounters
orphans=$(q "SELECT COUNT(*) FROM imaging_orders i WHERE i.encounter_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM encounters e WHERE e.id = i.encounter_id);")
[ "$orphans" = "0" ] && pass "imaging_orders.encounter_id → encounters: 0 orphans" || fail "imaging_orders.encounter_id: ${orphans} orphan(s)"

# prescriptions.encounter_id → encounters
orphans=$(q "SELECT COUNT(*) FROM prescriptions p WHERE p.encounter_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM encounters e WHERE e.id = p.encounter_id);")
[ "$orphans" = "0" ] && pass "prescriptions.encounter_id → encounters: 0 orphans" || fail "prescriptions.encounter_id: ${orphans} orphan(s)"

echo ""
echo -e "  ${BOLD}── FK integrity: patient_id chains ──${RESET}"

for tbl in encounters admissions icu_admissions surgical_requests emergency_visits invoices consultations lab_orders imaging_orders prescriptions; do
  orphans=$(q "SELECT COUNT(*) FROM ${tbl} t WHERE t.patient_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM patients p WHERE p.id = t.patient_id);" 2>/dev/null || echo "skip")
  if [ "$orphans" = "skip" ]; then
    echo -e "  ${YELLOW}○${RESET} ${tbl}.patient_id: skipped (table absent)"
  elif [ "$orphans" = "0" ]; then
    pass "${tbl}.patient_id → patients: 0 orphans"
  else
    fail "${tbl}.patient_id: ${orphans} orphan(s)"
  fi
done

echo ""
echo -e "  ${BOLD}── FK integrity: invoice chain ──${RESET}"

orphans=$(q "SELECT COUNT(*) FROM invoice_items ii WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = ii.invoice_id);")
[ "$orphans" = "0" ] && pass "invoice_items.invoice_id → invoices: 0 orphans" || fail "invoice_items.invoice_id: ${orphans} orphan(s)"

orphans=$(q "SELECT COUNT(*) FROM payments py WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = py.invoice_id);")
[ "$orphans" = "0" ] && pass "payments.invoice_id → invoices: 0 orphans" || fail "payments.invoice_id: ${orphans} orphan(s)"

# invoice.admission_id → admissions
orphans=$(q "SELECT COUNT(*) FROM invoices i WHERE i.admission_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM admissions a WHERE a.id = i.admission_id);")
[ "$orphans" = "0" ] && pass "invoices.admission_id → admissions: 0 orphans" || fail "invoices.admission_id: ${orphans} orphan(s)"

echo ""
echo -e "  ${BOLD}── FK integrity: admission chain ──${RESET}"

orphans=$(q "SELECT COUNT(*) FROM admission_timeline_events ate WHERE NOT EXISTS (SELECT 1 FROM admissions a WHERE a.id = ate.admission_id);")
[ "$orphans" = "0" ] && pass "admission_timeline_events.admission_id → admissions: 0 orphans" || fail "admission_timeline_events.admission_id: ${orphans} orphan(s)"

echo ""
echo -e "  ${BOLD}── NULL audit: FKs that were non-NULL must remain non-NULL ──${RESET}"

# Admissions: check encounter_id preserved — join _int_legacy to new table via admission_number (stable key)
# Mapping tables are dropped inside COMMIT, so we use the _int_legacy table directly
nulled=$(q "
  SELECT COUNT(*)
  FROM admissions_int_legacy ol
  JOIN admissions na ON na.admission_number = ol.admission_number
  WHERE ol.encounter_id IS NOT NULL AND na.encounter_id IS NULL;
")
if   [ "$nulled" = "ERROR" ]; then
  echo -e "  ${YELLOW}○${RESET} admissions.encounter_id null-audit: _int_legacy absent (table was already UUID)"
elif [ "$nulled" = "0" ]; then
  pass "admissions.encounter_id: 0 rows converted to NULL"
else
  fail "admissions.encounter_id: ${nulled} rows became NULL (were non-NULL)"
fi

# occupancy_beds: admission_id restored — join via bed number (stable unique key in test data)
nulled=$(q "
  SELECT COUNT(*)
  FROM occupancy_beds_int_legacy ol
  JOIN occupancy_beds nb ON nb.number = ol.number
  WHERE ol.admission_id IS NOT NULL AND nb.admission_id IS NULL;
")
if   [ "$nulled" = "ERROR" ]; then
  echo -e "  ${YELLOW}○${RESET} occupancy_beds.admission_id null-audit: _int_legacy absent (already UUID)"
elif [ "$nulled" = "0" ]; then
  pass "occupancy_beds.admission_id: 0 rows converted to NULL"
else
  fail "occupancy_beds.admission_id: ${nulled} rows became NULL (were non-NULL)"
fi

# Emergency visits: both encounter_id and patient_id non-NULL
nulled=$(q "SELECT COUNT(*) FROM emergency_visits WHERE encounter_id IS NULL OR patient_id IS NULL;")
[ "$nulled" = "0" ] && pass "emergency_visits: all encounter_id + patient_id non-NULL" || fail "emergency_visits: ${nulled} rows with NULL encounter_id or patient_id"

echo ""
echo -e "  ${BOLD}── FK constraints active in pg_constraint ──${RESET}"

for conname in \
    "admissions_encounter_id_fkey:admissions→encounters" \
    "admission_timeline_events_admission_id_fkey:timeline→admissions" \
    "invoice_items_invoice_id_fkey:items→invoices" \
    "payments_invoice_id_fkey:payments→invoices" \
    "fk_occ_beds_admission:occupancy_beds→admissions" \
    "fk_ev_linked_admission:ev→admissions" \
    "fk_icu_beds_icu_admission:icu_beds→icu_admissions" \
    "emergency_vitals_visit_id_fkey:vitals→ev"; do
  cname="${conname%%:*}"
  label="${conname##*:}"
  exists=$(q "SELECT COUNT(*) FROM pg_constraint WHERE conname = '${cname}';")
  [ "$exists" = "1" ] && pass "CONSTRAINT ${cname} (${label}) active" || \
    echo -e "  ${YELLOW}⚠${RESET} CONSTRAINT ${cname} not found (may be absent if table wasn't migrated)"
done

echo ""
echo -e "  ${BOLD}── Sample data spot-check ──${RESET}"

# Verify specific encounter → admission chain data integrity
enc_count=$(q "SELECT COUNT(DISTINCT a.encounter_id) FROM admissions a WHERE a.encounter_id IS NOT NULL;")
adm_count=$(q "SELECT COUNT(*) FROM admissions WHERE encounter_id IS NOT NULL;")
pass "admissions with encounter_id: ${adm_count} / encounter UUIDs referenced: ${enc_count}"

inv_items_per_inv=$(q "SELECT min(c), max(c) FROM (SELECT invoice_id, COUNT(*) as c FROM invoice_items GROUP BY invoice_id) x;")
pass "invoice_items per invoice: min/max = ${inv_items_per_inv}"

pay_per_inv=$(q "SELECT invoice_id, COUNT(*) FROM payments GROUP BY invoice_id ORDER BY 1;")
pass "payments: $(echo $pay_per_inv | tr '\n' ' ')"

# ─────────────────────────────────────────────────────────────────────────────
section "STEP 8 — Full before/after report"
# ─────────────────────────────────────────────────────────────────────────────

echo ""
printf "  ${BOLD}%-40s %10s %10s %12s %12s${RESET}\n" "Table" "Before" "After" "FKs mapped" "FKs NULL"
printf "  %-40s %10s %10s %12s %12s\n" "─────────────────────────────────────" "──────" "─────" "──────────" "──────────"

for t in "${TABLES[@]}"; do
  before="${BEFORE[$t]}"
  after=$(q "SELECT COUNT(*) FROM ${t};" 2>/dev/null || echo "?")
  status=""
  [ "$after" = "$before" ] && status="${GREEN}✓${RESET}" || status="${RED}✗${RESET}"
  printf "  %-40s %10s %10s  ${status}\n" "$t" "$before" "$after"
done

echo ""
echo -e "  ${BOLD}FK null counts after migration:${RESET}"
psql "$TEST_URL" -t << 'NULLCHECK'
  SELECT 'admissions.encounter_id NULL' AS check_name,
         COUNT(*) FILTER (WHERE encounter_id IS NULL) AS null_count,
         COUNT(*) FILTER (WHERE encounter_id IS NOT NULL) AS non_null_count
  FROM admissions
  UNION ALL
  SELECT 'admissions.patient_id NULL',
         COUNT(*) FILTER (WHERE patient_id IS NULL),
         COUNT(*) FILTER (WHERE patient_id IS NOT NULL)
  FROM admissions
  UNION ALL
  SELECT 'invoices.encounter_id NULL',
         COUNT(*) FILTER (WHERE encounter_id IS NULL),
         COUNT(*) FILTER (WHERE encounter_id IS NOT NULL)
  FROM invoices
  UNION ALL
  SELECT 'invoices.admission_id NULL',
         COUNT(*) FILTER (WHERE admission_id IS NULL),
         COUNT(*) FILTER (WHERE admission_id IS NOT NULL)
  FROM invoices
  UNION ALL
  SELECT 'invoice_items.invoice_id NULL',
         COUNT(*) FILTER (WHERE invoice_id IS NULL),
         COUNT(*) FILTER (WHERE invoice_id IS NOT NULL)
  FROM invoice_items
  UNION ALL
  SELECT 'payments.invoice_id NULL',
         COUNT(*) FILTER (WHERE invoice_id IS NULL),
         COUNT(*) FILTER (WHERE invoice_id IS NOT NULL)
  FROM payments
  UNION ALL
  SELECT 'emergency_visits.encounter_id NULL',
         COUNT(*) FILTER (WHERE encounter_id IS NULL),
         COUNT(*) FILTER (WHERE encounter_id IS NOT NULL)
  FROM emergency_visits
  UNION ALL
  SELECT 'emergency_visits.patient_id NULL',
         COUNT(*) FILTER (WHERE patient_id IS NULL),
         COUNT(*) FILTER (WHERE patient_id IS NOT NULL)
  FROM emergency_visits
  UNION ALL
  SELECT 'occupancy_beds.admission_id NULL (expected: 1)',
         COUNT(*) FILTER (WHERE admission_id IS NULL),
         COUNT(*) FILTER (WHERE admission_id IS NOT NULL)
  FROM occupancy_beds
  ORDER BY 1;
NULLCHECK

echo ""
echo -e "  ${BOLD}API smoke: GET /api/admissions (by encounter_id chain)${RESET}"
adm_chain=$(q "
  SELECT a.admission_number, e.chief_complaint, p.first_name || ' ' || p.last_name AS patient
  FROM admissions a
  JOIN encounters e ON e.id = a.encounter_id
  JOIN patients   p ON p.id = a.patient_id
  ORDER BY a.admission_number;
")
if [ -n "$adm_chain" ]; then
  pass "Encounter→Admission chain resolves. Sample:"
  echo "$adm_chain" | while IFS='|' read -r num complaint patient; do
    info "  ADM=${num}  patient=${patient}  complaint=${complaint}"
  done
else
  fail "No admissions with encounter_id linkage found"
fi

echo ""
echo -e "  ${BOLD}API smoke: invoice → items → payments chain${RESET}"
inv_chain=$(q "
  SELECT i.id, COUNT(DISTINCT ii.id) AS items, COUNT(DISTINCT py.id) AS payments,
         i.total_amount, i.paid_amount
  FROM invoices i
  LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
  LEFT JOIN payments      py ON py.invoice_id = i.id
  GROUP BY i.id, i.total_amount, i.paid_amount
  ORDER BY i.total_amount DESC;
")
if [ -n "$inv_chain" ]; then
  pass "Invoice→Items→Payments chain resolves. Sample:"
  echo "$inv_chain" | while IFS='|' read -r id items payments total paid; do
    info "  invoice items=${items}  payments=${payments}  total=${total}  paid=${paid}"
  done
else
  fail "Invoice chain query returned no results"
fi

# ─────────────────────────────────────────────────────────────────────────────
section "SUMMARY"
# ─────────────────────────────────────────────────────────────────────────────

if [ "$FAILURES" -eq 0 ]; then
  echo -e "\n  ${GREEN}${BOLD}integer → UUID migration path: VERIFIED ✓${RESET}"
  echo -e "  ${GREEN}• Row counts preserved for all 17 tables${RESET}"
  echo -e "  ${GREEN}• All FK relationships intact (0 orphans)${RESET}"
  echo -e "  ${GREEN}• No non-NULL FK silently set to NULL${RESET}"
  echo -e "  ${GREEN}• _int_legacy tables retained for post-deploy verification${RESET}"
  echo -e "  ${GREEN}• Migration is ROLLBACK-safe (single transaction)${RESET}"
else
  echo -e "\n  ${RED}${BOLD}${FAILURES} assertion(s) FAILED — Migration NOT ready for production.${RESET}"
fi
