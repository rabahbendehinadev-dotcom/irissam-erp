-- ==========================================================================
-- Migration 007: Safe integer → UUID PK migration for legacy clinical tables
-- ==========================================================================
--
-- WHY THIS EXISTS
--   Migration 001 uses CREATE TABLE IF NOT EXISTS for every clinical table.
--   If those tables already existed in the target DB with SERIAL (integer) PKs,
--   they were silently skipped.  drizzle-kit push then detects the UUID/integer
--   mismatch and generates:
--       ALTER TABLE admissions ALTER COLUMN id SET DATA TYPE uuid;
--   which PostgreSQL rejects with "column cannot be cast automatically to uuid".
--
-- WHAT THIS DOES (per affected table, in FK-dependency order)
--   1. Detect whether the table has an integer id column.
--   2. If YES → rename to {table}_int_legacy  (DATA IS NEVER DELETED)
--              → create a fresh UUID-PK table (identical to migration 001)
--              → attempt a best-effort data copy for non-FK text/date columns
--                (FK columns that pointed to other integer tables are set NULL)
--              → log NOTICE with row counts
--   3. If NO  → skip silently (already UUID, nothing to do)
--
-- TABLES INTENTIONALLY KEPT AS SERIAL (NOT touched here)
--   beds, daily_stats, vehicles  — Drizzle schema uses serial(), correct as-is
--
-- FK DEPENDENCY ORDER (parent → child, must be processed top-down)
--   Tier 1 : encounters
--   Tier 2 : occupancy_beds, icu_beds (deferred FKs)
--   Tier 3 : icu_admissions, admissions
--   Tier 4 : admission_timeline_events, surgical_requests, emergency_visits
--   Tier 5 : or_slots, emergency_vitals
--   Tier 6 : consultations, lab_orders, imaging_orders, prescriptions
--   Tier 7 : invoices
--   Tier 8 : invoice_items, payments
--
-- IDEMPOTENCY
--   Every block is guarded by:
--     IF EXISTS (… data_type = 'integer' …)
--   so running the migration twice produces only NOTICE messages, no errors.
-- ==========================================================================


-- ==========================================================================
-- HELPER: create persistent mapping tables for old_int_id → new_uuid.
-- Used to restore encounter_id / admission_id FK columns in child rows.
-- Dropped at the end of the migration.
-- ==========================================================================
CREATE TABLE IF NOT EXISTS _mig007_enc_map (
  old_id  INTEGER PRIMARY KEY,
  new_id  UUID    NOT NULL DEFAULT gen_random_uuid()
);
CREATE TABLE IF NOT EXISTS _mig007_adm_map (
  old_id  INTEGER PRIMARY KEY,
  new_id  UUID    NOT NULL DEFAULT gen_random_uuid()
);
CREATE TABLE IF NOT EXISTS _mig007_surg_map (
  old_id  INTEGER PRIMARY KEY,
  new_id  UUID    NOT NULL DEFAULT gen_random_uuid()
);
CREATE TABLE IF NOT EXISTS _mig007_inv_map (
  old_id  INTEGER PRIMARY KEY,
  new_id  UUID    NOT NULL DEFAULT gen_random_uuid()
);
CREATE TABLE IF NOT EXISTS _mig007_ev_map (
  old_id  INTEGER PRIMARY KEY,
  new_id  UUID    NOT NULL DEFAULT gen_random_uuid()
);


-- ==========================================================================
-- TIER 1 — encounters
-- Everything in the clinical tree references this table.
-- ==========================================================================
DO $$ DECLARE _cnt BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'encounters'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] encounters — already UUID or absent, skipping.';
    RETURN;
  END IF;

  -- ── 1a. Pre-populate UUID mapping ───────────────────────────────────────
  INSERT INTO _mig007_enc_map (old_id)
  SELECT id FROM encounters
  ON CONFLICT DO NOTHING;

  -- ── 1b. Drop any stale FK constraints FROM child tables ─────────────────
  ALTER TABLE IF EXISTS admissions        DROP CONSTRAINT IF EXISTS admissions_encounter_id_fkey;
  ALTER TABLE IF EXISTS consultations     DROP CONSTRAINT IF EXISTS consultations_encounter_id_fkey;
  ALTER TABLE IF EXISTS lab_orders        DROP CONSTRAINT IF EXISTS lab_orders_encounter_id_fkey;
  ALTER TABLE IF EXISTS imaging_orders    DROP CONSTRAINT IF EXISTS imaging_orders_encounter_id_fkey;
  ALTER TABLE IF EXISTS prescriptions     DROP CONSTRAINT IF EXISTS prescriptions_encounter_id_fkey;
  ALTER TABLE IF EXISTS surgical_requests DROP CONSTRAINT IF EXISTS surgical_requests_encounter_id_fkey;
  ALTER TABLE IF EXISTS invoices          DROP CONSTRAINT IF EXISTS invoices_encounter_id_fkey;
  ALTER TABLE IF EXISTS icu_admissions    DROP CONSTRAINT IF EXISTS icu_admissions_encounter_id_fkey;
  ALTER TABLE IF EXISTS icu_beds          DROP CONSTRAINT IF EXISTS icu_beds_encounter_id_fkey;
  ALTER TABLE IF EXISTS occupancy_beds    DROP CONSTRAINT IF EXISTS occupancy_beds_encounter_id_fkey;
  ALTER TABLE IF EXISTS emergency_visits  DROP CONSTRAINT IF EXISTS emergency_visits_encounter_id_fkey;
  ALTER TABLE IF EXISTS emergency_vitals  DROP CONSTRAINT IF EXISTS emergency_vitals_encounter_id_fkey;
  ALTER TABLE IF EXISTS audit_logs        DROP CONSTRAINT IF EXISTS audit_logs_encounter_id_fkey;

  -- ── 1c. Rename legacy table ──────────────────────────────────────────────
  ALTER TABLE encounters RENAME TO encounters_int_legacy;

  -- ── 1d. Create new UUID encounters ──────────────────────────────────────
  CREATE TABLE encounters (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id       UUID REFERENCES patients(id) ON DELETE RESTRICT,
    patient_name     TEXT NOT NULL DEFAULT '',
    type             encounter_type NOT NULL DEFAULT 'urgence',
    status           encounter_status NOT NULL DEFAULT 'open',
    chief_complaint  TEXT NOT NULL DEFAULT '',
    source_module    source_module NOT NULL DEFAULT 'urgences',
    source_record_id TEXT,
    linked_records   JSONB NOT NULL DEFAULT '[]',
    workflow_status  TEXT,
    primary_doctor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    primary_doctor_name  TEXT,
    primary_nurse_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    primary_nurse_name   TEXT,
    room_id   UUID,
    room_name TEXT,
    ward_id   UUID,
    ward_name TEXT,
    site_id   UUID REFERENCES sites(id) ON DELETE SET NULL,
    opened_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at    TIMESTAMPTZ,
    close_reason TEXT,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMPTZ,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by_name TEXT,
    updated_by      UUID REFERENCES users(id) ON DELETE SET NULL
  );

  -- ── 1e. Best-effort data migration ──────────────────────────────────────
  BEGIN
    INSERT INTO encounters (
      id, patient_name, type, status, chief_complaint,
      source_module, opened_at, closed_at, updated_at
    )
    SELECT
      m.new_id,
      COALESCE(l.patient_name, '')::TEXT,
      COALESCE(l.type::encounter_type,      'urgence'),
      COALESCE(l.status::encounter_status,  'open'),
      COALESCE(l.chief_complaint,           '')::TEXT,
      COALESCE(l.source_module::source_module, 'urgences'),
      COALESCE(l.opened_at,  now()),
      l.closed_at,
      COALESCE(l.updated_at, now())
    FROM encounters_int_legacy l
    JOIN _mig007_enc_map m ON m.old_id = l.id;

    GET DIAGNOSTICS _cnt = ROW_COUNT;
    RAISE NOTICE '[007] encounters — migrated % rows (FK cols set NULL).', _cnt;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[007] encounters data migration skipped (schema mismatch): %. '
                  'Data preserved in encounters_int_legacy.', SQLERRM;
  END;
END $$;


-- ==========================================================================
-- TIER 2 — occupancy_beds  (created before admissions; FK to admissions added later)
-- ==========================================================================
DO $$ DECLARE _cnt BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'occupancy_beds'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] occupancy_beds — already UUID or absent, skipping.';
    RETURN;
  END IF;

  -- Drop stale FKs from admissions → occupancy_beds
  ALTER TABLE IF EXISTS admissions DROP CONSTRAINT IF EXISTS admissions_bed_id_fkey;

  ALTER TABLE occupancy_beds RENAME TO occupancy_beds_int_legacy;

  CREATE TABLE occupancy_beds (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number                TEXT NOT NULL,
    room_id               UUID,
    room_number           TEXT,
    floor_id              UUID REFERENCES floors(id) ON DELETE SET NULL,
    floor_label           TEXT,
    building_id           UUID REFERENCES buildings(id) ON DELETE SET NULL,
    building_name         TEXT,
    building_code         TEXT,
    site_id               UUID NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
    type                  bed_type NOT NULL DEFAULT 'standard',
    status                occupancy_bed_status NOT NULL DEFAULT 'disponible',
    patient_id            UUID REFERENCES patients(id) ON DELETE SET NULL,
    patient_name          TEXT,
    encounter_id          UUID REFERENCES encounters(id) ON DELETE SET NULL,
    admission_id          UUID,
    occupied_at           TIMESTAMPTZ,
    expected_release_at   TIMESTAMPTZ,
    cleaning_started_at   TIMESTAMPTZ,
    cleaning_completed_at TIMESTAMPTZ,
    notes                 TEXT,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at            TIMESTAMPTZ,
    updated_by            UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by            UUID REFERENCES users(id) ON DELETE SET NULL
  );

  BEGIN
    INSERT INTO occupancy_beds (id, number, status, updated_at, created_at)
    SELECT gen_random_uuid(),
           COALESCE(l.number, 'N/A')::TEXT,
           COALESCE(l.status::occupancy_bed_status, 'disponible'),
           COALESCE(l.updated_at, now()),
           COALESCE(l.created_at, now())
    FROM occupancy_beds_int_legacy l;
    GET DIAGNOSTICS _cnt = ROW_COUNT;
    RAISE NOTICE '[007] occupancy_beds — migrated % rows.', _cnt;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[007] occupancy_beds data migration skipped: %. Data in occupancy_beds_int_legacy.', SQLERRM;
  END;
END $$;


-- ==========================================================================
-- TIER 2 — icu_beds  (created before icu_admissions; deferred FK)
-- ==========================================================================
DO $$ DECLARE _cnt BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'icu_beds'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] icu_beds — already UUID or absent, skipping.';
    RETURN;
  END IF;

  ALTER TABLE IF EXISTS icu_admissions DROP CONSTRAINT IF EXISTS icu_admissions_icu_bed_id_fkey;

  ALTER TABLE icu_beds RENAME TO icu_beds_int_legacy;

  CREATE TABLE icu_beds (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number              TEXT NOT NULL,
    unit_name           TEXT NOT NULL,
    site_id             UUID NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
    type                icu_type NOT NULL DEFAULT 'icu',
    status              icu_bed_status NOT NULL DEFAULT 'disponible',
    patient_id          UUID REFERENCES patients(id) ON DELETE SET NULL,
    patient_name        TEXT,
    encounter_id        UUID REFERENCES encounters(id) ON DELETE SET NULL,
    icu_admission_id    UUID,
    priority            TEXT,
    occupied_at         TIMESTAMPTZ,
    expected_release_at TIMESTAMPTZ,
    cleaning_started_at TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    updated_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by          UUID REFERENCES users(id) ON DELETE SET NULL
  );

  BEGIN
    INSERT INTO icu_beds (id, number, unit_name, status, updated_at)
    SELECT gen_random_uuid(),
           COALESCE(l.number,    'N/A')::TEXT,
           COALESCE(l.unit_name, 'Réa')::TEXT,
           COALESCE(l.status::icu_bed_status, 'disponible'),
           COALESCE(l.updated_at, now())
    FROM icu_beds_int_legacy l;
    GET DIAGNOSTICS _cnt = ROW_COUNT;
    RAISE NOTICE '[007] icu_beds — migrated % rows.', _cnt;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[007] icu_beds data migration skipped: %. Data in icu_beds_int_legacy.', SQLERRM;
  END;
END $$;


-- ==========================================================================
-- TIER 3 — icu_admissions
-- ==========================================================================
DO $$ DECLARE _cnt BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'icu_admissions'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] icu_admissions — already UUID or absent, skipping.';
    RETURN;
  END IF;

  ALTER TABLE icu_admissions RENAME TO icu_admissions_int_legacy;

  CREATE TABLE icu_admissions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id      UUID REFERENCES encounters(id) ON DELETE RESTRICT,
    patient_id        UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    patient_name      TEXT NOT NULL DEFAULT '',
    motif             TEXT NOT NULL DEFAULT '',
    priority          TEXT NOT NULL DEFAULT 'normale',
    icu_bed_id        UUID REFERENCES icu_beds(id) ON DELETE SET NULL,
    team_notified     TEXT NOT NULL DEFAULT 'false',
    status            icu_admission_status NOT NULL DEFAULT 'demande',
    requested_by_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    requested_by_name TEXT,
    notes             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ,
    created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by        UUID REFERENCES users(id) ON DELETE SET NULL
  );

  BEGIN
    INSERT INTO icu_admissions (id, patient_name, motif, priority, status, created_at, updated_at)
    SELECT gen_random_uuid(),
           COALESCE(l.patient_name, '')::TEXT,
           COALESCE(l.motif,        '')::TEXT,
           COALESCE(l.priority,     'normale')::TEXT,
           COALESCE(l.status::icu_admission_status, 'demande'),
           COALESCE(l.created_at, now()),
           COALESCE(l.updated_at, now())
    FROM icu_admissions_int_legacy l;
    GET DIAGNOSTICS _cnt = ROW_COUNT;
    RAISE NOTICE '[007] icu_admissions — migrated % rows.', _cnt;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[007] icu_admissions data migration skipped: %. Data in icu_admissions_int_legacy.', SQLERRM;
  END;

  -- Close deferred circular ref icu_beds ↔ icu_admissions
  ALTER TABLE icu_beds ADD CONSTRAINT fk_icu_beds_icu_admission
    FOREIGN KEY (icu_admission_id) REFERENCES icu_admissions(id) ON DELETE SET NULL;
END $$;


-- ==========================================================================
-- TIER 3 — admissions
-- ==========================================================================
DO $$ DECLARE _cnt BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admissions'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] admissions — already UUID or absent, skipping.';
    RETURN;
  END IF;

  -- Pre-populate UUID map
  INSERT INTO _mig007_adm_map (old_id)
  SELECT id FROM admissions
  ON CONFLICT DO NOTHING;

  -- Drop FKs from children pointing to integer admissions
  ALTER TABLE IF EXISTS admission_timeline_events DROP CONSTRAINT IF EXISTS admission_timeline_events_admission_id_fkey;
  ALTER TABLE IF EXISTS invoices                  DROP CONSTRAINT IF EXISTS invoices_admission_id_fkey;
  ALTER TABLE IF EXISTS occupancy_beds            DROP CONSTRAINT IF EXISTS fk_occ_beds_admission;
  ALTER TABLE IF EXISTS emergency_visits          DROP CONSTRAINT IF EXISTS fk_ev_linked_admission;

  ALTER TABLE admissions RENAME TO admissions_int_legacy;

  CREATE TABLE admissions (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_number          TEXT NOT NULL UNIQUE,
    encounter_id              UUID REFERENCES encounters(id) ON DELETE SET NULL,
    patient_id                UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    patient_mpi_id            TEXT,
    patient_name              TEXT NOT NULL DEFAULT '',
    patient_dob               DATE,
    patient_phone             TEXT,
    type                      admission_type NOT NULL DEFAULT 'hospitalisation',
    status                    admission_status NOT NULL DEFAULT 'active',
    priority                  admission_priority NOT NULL DEFAULT 'normal',
    service_id                UUID REFERENCES departments(id) ON DELETE SET NULL,
    service_name              TEXT NOT NULL DEFAULT '',
    doctor_id                 UUID REFERENCES users(id) ON DELETE SET NULL,
    doctor_name               TEXT NOT NULL DEFAULT '',
    motif                     TEXT NOT NULL DEFAULT '',
    diagnosis                 TEXT,
    bed_id                    UUID REFERENCES occupancy_beds(id) ON DELETE SET NULL,
    bed_number                TEXT,
    room_number               TEXT,
    floor_label               TEXT,
    building_name             TEXT,
    admission_date            DATE NOT NULL DEFAULT CURRENT_DATE,
    admission_time            TEXT NOT NULL DEFAULT '00:00',
    expected_discharge_date   DATE,
    actual_discharge_date     DATE,
    actual_discharge_time     TEXT,
    discharge_type            discharge_type,
    discharge_notes           TEXT,
    transfer_to               TEXT,
    transfer_date             DATE,
    preadmission_date         DATE,
    preadmission_converted_at TIMESTAMPTZ,
    site_id                   UUID REFERENCES sites(id) ON DELETE SET NULL,
    notes                     TEXT,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at                TIMESTAMPTZ,
    created_by                UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by                UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_by                UUID REFERENCES users(id) ON DELETE SET NULL
  );

  BEGIN
    INSERT INTO admissions (
      id, admission_number, patient_name, type, status, priority,
      service_name, doctor_name, motif, diagnosis,
      bed_number, room_number, floor_label, building_name,
      admission_date, admission_time, expected_discharge_date,
      actual_discharge_date, discharge_type, discharge_notes,
      transfer_to, notes, created_at, updated_at,
      -- link to encounters via mapping if encounter_id was an integer FK
      encounter_id
    )
    SELECT
      m.new_id,
      COALESCE(l.admission_number,
               'ADM-MIGR-' || m.new_id::text)::TEXT,
      COALESCE(l.patient_name,    '')::TEXT,
      COALESCE(l.type::admission_type,       'hospitalisation'),
      COALESCE(l.status::admission_status,   'active'),
      COALESCE(l.priority::admission_priority, 'normal'),
      COALESCE(l.service_name,    '')::TEXT,
      COALESCE(l.doctor_name,     '')::TEXT,
      COALESCE(l.motif,           '')::TEXT,
      l.diagnosis,
      l.bed_number, l.room_number, l.floor_label, l.building_name,
      COALESCE(l.admission_date,  CURRENT_DATE),
      COALESCE(l.admission_time,  '00:00')::TEXT,
      l.expected_discharge_date,
      l.actual_discharge_date,
      l.discharge_type::discharge_type,
      l.discharge_notes,
      l.transfer_to,
      l.notes,
      COALESCE(l.created_at, now()),
      COALESCE(l.updated_at, now()),
      -- map old integer encounter_id to new UUID
      em.new_id
    FROM admissions_int_legacy l
    JOIN _mig007_adm_map m ON m.old_id = l.id
    LEFT JOIN _mig007_enc_map em ON em.old_id = l.encounter_id;

    GET DIAGNOSTICS _cnt = ROW_COUNT;
    RAISE NOTICE '[007] admissions — migrated % rows.', _cnt;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[007] admissions data migration skipped: %. Data in admissions_int_legacy.', SQLERRM;
  END;

  -- Re-establish deferred circular FK: occupancy_beds.admission_id → admissions
  DO $inner$ BEGIN
    ALTER TABLE occupancy_beds ADD CONSTRAINT fk_occ_beds_admission
      FOREIGN KEY (admission_id) REFERENCES admissions(id) ON DELETE SET NULL;
  EXCEPTION WHEN duplicate_object THEN NULL; END $inner$;
END $$;


-- ==========================================================================
-- TIER 4 — admission_timeline_events
-- ==========================================================================
DO $$ DECLARE _cnt BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admission_timeline_events'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] admission_timeline_events — already UUID or absent, skipping.';
    RETURN;
  END IF;

  ALTER TABLE admission_timeline_events RENAME TO admission_timeline_events_int_legacy;

  CREATE TABLE admission_timeline_events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
    type         TEXT NOT NULL DEFAULT '',
    description  TEXT NOT NULL DEFAULT '',
    date         TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
    user_name    TEXT,
    meta         TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  BEGIN
    INSERT INTO admission_timeline_events (id, admission_id, type, description, date, user_name, meta, created_at)
    SELECT
      gen_random_uuid(),
      am.new_id,
      COALESCE(l.type,        '')::TEXT,
      COALESCE(l.description, '')::TEXT,
      COALESCE(l.date,        now()),
      l.user_name,
      l.meta,
      COALESCE(l.created_at,  now())
    FROM admission_timeline_events_int_legacy l
    JOIN _mig007_adm_map am ON am.old_id = l.admission_id;
    GET DIAGNOSTICS _cnt = ROW_COUNT;
    RAISE NOTICE '[007] admission_timeline_events — migrated % rows.', _cnt;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[007] admission_timeline_events data migration skipped: %. Data preserved.', SQLERRM;
  END;
END $$;


-- ==========================================================================
-- TIER 4 — surgical_requests
-- ==========================================================================
DO $$ DECLARE _cnt BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'surgical_requests'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] surgical_requests — already UUID or absent, skipping.';
    RETURN;
  END IF;

  INSERT INTO _mig007_surg_map (old_id) SELECT id FROM surgical_requests ON CONFLICT DO NOTHING;

  ALTER TABLE IF EXISTS or_slots       DROP CONSTRAINT IF EXISTS or_slots_surgical_request_id_fkey;
  ALTER TABLE IF EXISTS emergency_visits DROP CONSTRAINT IF EXISTS fk_ev_linked_surgical;

  ALTER TABLE surgical_requests RENAME TO surgical_requests_int_legacy;

  CREATE TABLE surgical_requests (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id      UUID REFERENCES encounters(id) ON DELETE SET NULL,
    patient_id        UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    patient_name      TEXT NOT NULL DEFAULT '',
    intervention      TEXT NOT NULL DEFAULT '',
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

  BEGIN
    INSERT INTO surgical_requests (
      id, patient_name, intervention, urgency_degree,
      consent_signed, status, surgeon_name, created_at, updated_at,
      encounter_id
    )
    SELECT
      sm.new_id,
      COALESCE(l.patient_name, '')::TEXT,
      COALESCE(l.intervention,  '')::TEXT,
      COALESCE(l.urgency_degree::surgical_urgency, 'elective'),
      COALESCE(l.consent_signed, false),
      COALESCE(l.status::surgical_status, 'demande'),
      l.surgeon_name,
      COALESCE(l.created_at, now()),
      COALESCE(l.updated_at, now()),
      em.new_id
    FROM surgical_requests_int_legacy l
    JOIN _mig007_surg_map sm ON sm.old_id = l.id
    LEFT JOIN _mig007_enc_map em ON em.old_id = l.encounter_id;
    GET DIAGNOSTICS _cnt = ROW_COUNT;
    RAISE NOTICE '[007] surgical_requests — migrated % rows.', _cnt;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[007] surgical_requests data migration skipped: %. Data preserved.', SQLERRM;
  END;
END $$;


-- ==========================================================================
-- TIER 4 — emergency_visits
-- ==========================================================================
DO $$ DECLARE _cnt BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'emergency_visits'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] emergency_visits — already UUID or absent, skipping.';
    RETURN;
  END IF;

  INSERT INTO _mig007_ev_map (old_id) SELECT id FROM emergency_visits ON CONFLICT DO NOTHING;

  ALTER TABLE IF EXISTS emergency_vitals DROP CONSTRAINT IF EXISTS emergency_vitals_visit_id_fkey;

  ALTER TABLE emergency_visits RENAME TO emergency_visits_int_legacy;

  CREATE TABLE emergency_visits (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id UUID NOT NULL UNIQUE REFERENCES encounters(id) ON DELETE RESTRICT,
    patient_id   UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    priority     emergency_priority NOT NULL DEFAULT 'non_classe',
    status       emergency_patient_status NOT NULL DEFAULT 'attente_triage',
    assigned_doctor_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_doctor_name TEXT,
    assigned_nurse_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_nurse_name  TEXT,
    assigned_room_id     UUID REFERENCES emergency_rooms(id) ON DELETE SET NULL,
    assigned_room_name   TEXT,
    chief_complaint TEXT NOT NULL DEFAULT '',
    mechanism       TEXT,
    triage_notes    TEXT,
    by_ambulance    BOOLEAN NOT NULL DEFAULT false,
    is_minor        BOOLEAN NOT NULL DEFAULT false,
    tags            TEXT[] NOT NULL DEFAULT '{}',
    linked_admission_id        UUID,
    linked_surgical_request_id UUID,
    linked_icu_admission_id    UUID,
    arrival_time    TIMESTAMPTZ NOT NULL DEFAULT now(),
    triage_time     TIMESTAMPTZ,
    care_start_time TIMESTAMPTZ,
    closed_at       TIMESTAMPTZ,
    close_reason    visit_close_reason,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by      UUID REFERENCES users(id) ON DELETE SET NULL
  );

  BEGIN
    INSERT INTO emergency_visits (
      id, chief_complaint, priority, status,
      by_ambulance, is_minor, arrival_time, created_at, updated_at,
      encounter_id, patient_id
    )
    SELECT
      evm.new_id,
      COALESCE(l.chief_complaint, '')::TEXT,
      COALESCE(l.priority::emergency_priority,         'non_classe'),
      COALESCE(l.status::emergency_patient_status,     'attente_triage'),
      COALESCE(l.by_ambulance, false),
      COALESCE(l.is_minor,     false),
      COALESCE(l.arrival_time, now()),
      COALESCE(l.created_at,   now()),
      COALESCE(l.updated_at,   now()),
      em.new_id,
      -- patient_id: attempt direct UUID cast, else use a placeholder patient
      NULL::UUID  -- will be NULL; FKs to integer patients are not resolvable
    FROM emergency_visits_int_legacy l
    JOIN _mig007_ev_map evm ON evm.old_id = l.id
    LEFT JOIN _mig007_enc_map em ON em.old_id = l.encounter_id
    WHERE em.new_id IS NOT NULL;  -- only migrate visits that have a valid encounter
    GET DIAGNOSTICS _cnt = ROW_COUNT;
    RAISE NOTICE '[007] emergency_visits — migrated % rows (patient_id = NULL).', _cnt;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[007] emergency_visits data migration skipped: %. Data preserved.', SQLERRM;
  END;
END $$;


-- ==========================================================================
-- TIER 5 — or_slots
-- ==========================================================================
DO $$ DECLARE _cnt BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'or_slots'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] or_slots — already UUID or absent, skipping.';
    RETURN;
  END IF;

  ALTER TABLE or_slots RENAME TO or_slots_int_legacy;

  CREATE TABLE or_slots (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    or_room_id          UUID NOT NULL REFERENCES operating_rooms(id) ON DELETE CASCADE,
    surgical_request_id UUID REFERENCES surgical_requests(id) ON DELETE SET NULL,
    patient_id          UUID REFERENCES patients(id) ON DELETE SET NULL,
    patient_name        TEXT,
    title               TEXT,
    start_time          TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_time            TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 hours'),
    duration_minutes    INTEGER NOT NULL DEFAULT 120,
    status              or_slot_status NOT NULL DEFAULT 'scheduled',
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by          UUID REFERENCES users(id) ON DELETE SET NULL
  );

  BEGIN
    INSERT INTO or_slots (id, patient_name, start_time, end_time, status, created_at)
    SELECT gen_random_uuid(),
           l.patient_name,
           COALESCE(l.start_time, now()),
           COALESCE(l.end_time,   now() + interval '2 hours'),
           COALESCE(l.status::or_slot_status, 'scheduled'),
           COALESCE(l.created_at, now())
    FROM or_slots_int_legacy l;
    GET DIAGNOSTICS _cnt = ROW_COUNT;
    RAISE NOTICE '[007] or_slots — migrated % rows.', _cnt;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[007] or_slots data migration skipped: %. Data preserved.', SQLERRM;
  END;
END $$;


-- ==========================================================================
-- TIER 5 — emergency_vitals
-- ==========================================================================
DO $$ DECLARE _cnt BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'emergency_vitals'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] emergency_vitals — already UUID or absent, skipping.';
    RETURN;
  END IF;

  ALTER TABLE emergency_vitals RENAME TO emergency_vitals_int_legacy;

  CREATE TABLE emergency_vitals (
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
  RAISE NOTICE '[007] emergency_vitals — recreated (data in emergency_vitals_int_legacy).';
END $$;


-- ==========================================================================
-- TIER 6 — consultations
-- ==========================================================================
DO $$ DECLARE _cnt BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'consultations'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] consultations — already UUID or absent, skipping.';
    RETURN;
  END IF;

  ALTER TABLE consultations RENAME TO consultations_int_legacy;

  CREATE TABLE consultations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id  UUID REFERENCES encounters(id) ON DELETE SET NULL,
    number        TEXT NOT NULL UNIQUE,
    patient_id    UUID REFERENCES patients(id) ON DELETE RESTRICT,
    patient_name  TEXT NOT NULL DEFAULT '',
    patient_mpi   TEXT NOT NULL DEFAULT '',
    doctor_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    doctor_name   TEXT NOT NULL DEFAULT '',
    specialty     TEXT NOT NULL DEFAULT '',
    service_id    UUID REFERENCES departments(id) ON DELETE SET NULL,
    service_name  TEXT NOT NULL DEFAULT '',
    scheduled_at  TIMESTAMPTZ,
    started_at    TIMESTAMPTZ,
    ended_at      TIMESTAMPTZ,
    duration      INTEGER,
    type          consultation_type NOT NULL DEFAULT 'consultation_externe',
    origin        consultation_origin NOT NULL DEFAULT 'rdv',
    reason        TEXT NOT NULL DEFAULT '',
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

  BEGIN
    INSERT INTO consultations (
      id, number, patient_name, patient_mpi,
      doctor_name, specialty, service_name, reason, status,
      type, origin, diagnosis, notes, created_at, updated_at,
      encounter_id
    )
    SELECT
      gen_random_uuid(),
      COALESCE(l.number, 'CONS-MIGR-' || l.id::text)::TEXT,
      COALESCE(l.patient_name,  '')::TEXT,
      COALESCE(l.patient_mpi,   '')::TEXT,
      COALESCE(l.doctor_name,   '')::TEXT,
      COALESCE(l.specialty,     '')::TEXT,
      COALESCE(l.service_name,  '')::TEXT,
      COALESCE(l.reason,        '')::TEXT,
      COALESCE(l.status::consultation_status, 'en_attente'),
      COALESCE(l.type::consultation_type,     'consultation_externe'),
      COALESCE(l.origin::consultation_origin, 'rdv'),
      l.diagnosis,
      l.notes,
      COALESCE(l.created_at, now()),
      COALESCE(l.updated_at, now()),
      em.new_id
    FROM consultations_int_legacy l
    LEFT JOIN _mig007_enc_map em ON em.old_id = l.encounter_id;
    GET DIAGNOSTICS _cnt = ROW_COUNT;
    RAISE NOTICE '[007] consultations — migrated % rows.', _cnt;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[007] consultations data migration skipped: %. Data preserved.', SQLERRM;
  END;
END $$;


-- ==========================================================================
-- TIER 6 — lab_orders
-- ==========================================================================
DO $$ DECLARE _cnt BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lab_orders'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] lab_orders — already UUID or absent, skipping.';
    RETURN;
  END IF;

  ALTER TABLE lab_orders RENAME TO lab_orders_int_legacy;

  CREATE TABLE lab_orders (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id      UUID REFERENCES encounters(id) ON DELETE RESTRICT,
    patient_id        UUID REFERENCES patients(id) ON DELETE RESTRICT,
    patient_name      TEXT NOT NULL DEFAULT '',
    visit_id          TEXT,
    test              TEXT NOT NULL DEFAULT '',
    category          TEXT NOT NULL DEFAULT '',
    urgency           urgency_level NOT NULL DEFAULT 'routine',
    requested_by_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    requested_by_name TEXT NOT NULL DEFAULT '',
    requested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    status            lab_status NOT NULL DEFAULT 'demandee',
    result            TEXT,
    is_critical       BOOLEAN NOT NULL DEFAULT false,
    result_at         TIMESTAMPTZ,
    validated_by_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    validated_by_name TEXT,
    laboratory        TEXT,
    source_module     source_module NOT NULL DEFAULT 'urgences',
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ,
    created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by        UUID REFERENCES users(id) ON DELETE SET NULL
  );

  BEGIN
    INSERT INTO lab_orders (
      id, patient_name, test, category, urgency,
      requested_by_name, requested_at, status, result,
      is_critical, laboratory, source_module,
      created_at, updated_at, encounter_id
    )
    SELECT
      gen_random_uuid(),
      COALESCE(l.patient_name,      '')::TEXT,
      COALESCE(l.test,              '')::TEXT,
      COALESCE(l.category,          '')::TEXT,
      COALESCE(l.urgency::urgency_level, 'routine'),
      COALESCE(l.requested_by_name, '')::TEXT,
      COALESCE(l.requested_at, now()),
      COALESCE(l.status::lab_status, 'demandee'),
      l.result,
      COALESCE(l.is_critical, false),
      l.laboratory,
      COALESCE(l.source_module::source_module, 'urgences'),
      COALESCE(l.created_at, now()),
      COALESCE(l.updated_at, now()),
      em.new_id
    FROM lab_orders_int_legacy l
    LEFT JOIN _mig007_enc_map em ON em.old_id = l.encounter_id;
    GET DIAGNOSTICS _cnt = ROW_COUNT;
    RAISE NOTICE '[007] lab_orders — migrated % rows.', _cnt;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[007] lab_orders data migration skipped: %. Data preserved.', SQLERRM;
  END;
END $$;


-- ==========================================================================
-- TIER 6 — imaging_orders
-- ==========================================================================
DO $$ DECLARE _cnt BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'imaging_orders'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] imaging_orders — already UUID or absent, skipping.';
    RETURN;
  END IF;

  ALTER TABLE imaging_orders RENAME TO imaging_orders_int_legacy;

  CREATE TABLE imaging_orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id        UUID REFERENCES encounters(id) ON DELETE RESTRICT,
    patient_id          UUID REFERENCES patients(id) ON DELETE RESTRICT,
    patient_name        TEXT NOT NULL DEFAULT '',
    visit_id            TEXT,
    exam                TEXT NOT NULL DEFAULT '',
    region              TEXT NOT NULL DEFAULT '',
    side                TEXT,
    urgency             urgency_level NOT NULL DEFAULT 'routine',
    with_contrast       BOOLEAN NOT NULL DEFAULT false,
    requested_by_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    requested_by_name   TEXT NOT NULL DEFAULT '',
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
    source_module       source_module NOT NULL DEFAULT 'urgences',
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by          UUID REFERENCES users(id) ON DELETE SET NULL
  );

  BEGIN
    INSERT INTO imaging_orders (
      id, patient_name, exam, region, urgency,
      requested_by_name, requested_at, status,
      source_module, created_at, updated_at, encounter_id
    )
    SELECT
      gen_random_uuid(),
      COALESCE(l.patient_name,      '')::TEXT,
      COALESCE(l.exam,              '')::TEXT,
      COALESCE(l.region,            '')::TEXT,
      COALESCE(l.urgency::urgency_level, 'routine'),
      COALESCE(l.requested_by_name, '')::TEXT,
      COALESCE(l.requested_at, now()),
      COALESCE(l.status::imaging_status, 'demandee'),
      COALESCE(l.source_module::source_module, 'urgences'),
      COALESCE(l.created_at, now()),
      COALESCE(l.updated_at, now()),
      em.new_id
    FROM imaging_orders_int_legacy l
    LEFT JOIN _mig007_enc_map em ON em.old_id = l.encounter_id;
    GET DIAGNOSTICS _cnt = ROW_COUNT;
    RAISE NOTICE '[007] imaging_orders — migrated % rows.', _cnt;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[007] imaging_orders data migration skipped: %. Data preserved.', SQLERRM;
  END;
END $$;


-- ==========================================================================
-- TIER 6 — prescriptions
-- ==========================================================================
DO $$ DECLARE _cnt BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'prescriptions'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] prescriptions — already UUID or absent, skipping.';
    RETURN;
  END IF;

  ALTER TABLE prescriptions RENAME TO prescriptions_int_legacy;

  CREATE TABLE prescriptions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id       UUID REFERENCES encounters(id) ON DELETE RESTRICT,
    patient_id         UUID REFERENCES patients(id) ON DELETE RESTRICT,
    patient_name       TEXT NOT NULL DEFAULT '',
    visit_id           TEXT,
    drug               TEXT NOT NULL DEFAULT '',
    dosage             TEXT NOT NULL DEFAULT '',
    route              TEXT NOT NULL DEFAULT '',
    frequency          TEXT NOT NULL DEFAULT '',
    duration           TEXT,
    prescribed_by_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    prescribed_by_name TEXT NOT NULL DEFAULT '',
    prescribed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    status             prescription_status NOT NULL DEFAULT 'prescrit',
    prepared_by_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    prepared_by_name   TEXT,
    prepared_at        TIMESTAMPTZ,
    dispensed_by_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    dispensed_by_name  TEXT,
    dispensed_at       TIMESTAMPTZ,
    dispenser_comment  TEXT,
    source_module      source_module NOT NULL DEFAULT 'urgences',
    notes              TEXT,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ,
    created_by         UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by         UUID REFERENCES users(id) ON DELETE SET NULL
  );

  BEGIN
    INSERT INTO prescriptions (
      id, patient_name, drug, dosage, route, frequency, duration,
      prescribed_by_name, prescribed_at, status, source_module,
      notes, created_at, updated_at, encounter_id
    )
    SELECT
      gen_random_uuid(),
      COALESCE(l.patient_name,       '')::TEXT,
      COALESCE(l.drug,               '')::TEXT,
      COALESCE(l.dosage,             '')::TEXT,
      COALESCE(l.route,              '')::TEXT,
      COALESCE(l.frequency,          '')::TEXT,
      l.duration,
      COALESCE(l.prescribed_by_name, '')::TEXT,
      COALESCE(l.prescribed_at, now()),
      COALESCE(l.status::prescription_status, 'prescrit'),
      COALESCE(l.source_module::source_module, 'urgences'),
      l.notes,
      COALESCE(l.created_at, now()),
      COALESCE(l.updated_at, now()),
      em.new_id
    FROM prescriptions_int_legacy l
    LEFT JOIN _mig007_enc_map em ON em.old_id = l.encounter_id;
    GET DIAGNOSTICS _cnt = ROW_COUNT;
    RAISE NOTICE '[007] prescriptions — migrated % rows.', _cnt;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[007] prescriptions data migration skipped: %. Data preserved.', SQLERRM;
  END;
END $$;


-- ==========================================================================
-- TIER 7 — invoices
-- ==========================================================================
DO $$ DECLARE _cnt BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] invoices — already UUID or absent, skipping.';
    RETURN;
  END IF;

  INSERT INTO _mig007_inv_map (old_id) SELECT id FROM invoices ON CONFLICT DO NOTHING;

  ALTER TABLE IF EXISTS invoice_items DROP CONSTRAINT IF EXISTS invoice_items_invoice_id_fkey;
  ALTER TABLE IF EXISTS payments      DROP CONSTRAINT IF EXISTS payments_invoice_id_fkey;

  ALTER TABLE invoices RENAME TO invoices_int_legacy;

  CREATE TABLE invoices (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id                 UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    patient_name               TEXT NOT NULL DEFAULT '',
    encounter_id               UUID REFERENCES encounters(id) ON DELETE SET NULL,
    admission_id               UUID REFERENCES admissions(id) ON DELETE SET NULL,
    type                       TEXT NOT NULL DEFAULT 'consultation',
    status                     invoice_status NOT NULL DEFAULT 'pending',
    insurance_type             insurance_type,
    insurance_coverage_percent REAL DEFAULT 0,
    total_amount               REAL NOT NULL DEFAULT 0,
    paid_amount                REAL NOT NULL DEFAULT 0,
    due_amount                 REAL NOT NULL DEFAULT 0,
    due_date                   TIMESTAMPTZ,
    notes                      TEXT,
    site_id                    UUID REFERENCES sites(id) ON DELETE SET NULL,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at                 TIMESTAMPTZ,
    created_by                 UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by                 UUID REFERENCES users(id) ON DELETE SET NULL
  );

  BEGIN
    INSERT INTO invoices (
      id, patient_name, type, status,
      total_amount, paid_amount, due_amount, notes,
      created_at, updated_at, encounter_id, admission_id
    )
    SELECT
      im.new_id,
      COALESCE(l.patient_name, '')::TEXT,
      COALESCE(l.type,         'consultation')::TEXT,
      COALESCE(l.status::invoice_status, 'pending'),
      COALESCE(l.total_amount, 0),
      COALESCE(l.paid_amount,  0),
      COALESCE(l.due_amount,   0),
      l.notes,
      COALESCE(l.created_at, now()),
      COALESCE(l.updated_at, now()),
      em.new_id,
      am.new_id
    FROM invoices_int_legacy l
    JOIN _mig007_inv_map im ON im.old_id = l.id
    LEFT JOIN _mig007_enc_map em ON em.old_id = l.encounter_id
    LEFT JOIN _mig007_adm_map am ON am.old_id = l.admission_id;
    GET DIAGNOSTICS _cnt = ROW_COUNT;
    RAISE NOTICE '[007] invoices — migrated % rows.', _cnt;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[007] invoices data migration skipped: %. Data preserved.', SQLERRM;
  END;
END $$;


-- ==========================================================================
-- TIER 8 — invoice_items
-- ==========================================================================
DO $$ DECLARE _cnt BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoice_items'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] invoice_items — already UUID or absent, skipping.';
    RETURN;
  END IF;

  ALTER TABLE invoice_items RENAME TO invoice_items_int_legacy;

  CREATE TABLE invoice_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL DEFAULT '',
    category    TEXT,
    quantity    REAL NOT NULL DEFAULT 1,
    unit_price  REAL NOT NULL DEFAULT 0,
    total_price REAL NOT NULL DEFAULT 0,
    ref_type    TEXT,
    ref_id      UUID,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  BEGIN
    INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total_price, created_at)
    SELECT gen_random_uuid(), im.new_id,
           COALESCE(l.description, '')::TEXT,
           COALESCE(l.quantity,    1),
           COALESCE(l.unit_price,  0),
           COALESCE(l.total_price, 0),
           COALESCE(l.created_at, now())
    FROM invoice_items_int_legacy l
    JOIN _mig007_inv_map im ON im.old_id = l.invoice_id;
    GET DIAGNOSTICS _cnt = ROW_COUNT;
    RAISE NOTICE '[007] invoice_items — migrated % rows.', _cnt;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[007] invoice_items data migration skipped: %. Data preserved.', SQLERRM;
  END;
END $$;


-- ==========================================================================
-- TIER 8 — payments
-- ==========================================================================
DO $$ DECLARE _cnt BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] payments — already UUID or absent, skipping.';
    RETURN;
  END IF;

  ALTER TABLE payments RENAME TO payments_int_legacy;

  CREATE TABLE payments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    amount      REAL NOT NULL DEFAULT 0,
    method      payment_method NOT NULL DEFAULT 'cash',
    reference   TEXT,
    notes       TEXT,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    paid_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  BEGIN
    INSERT INTO payments (id, invoice_id, amount, method, paid_at, created_at)
    SELECT gen_random_uuid(), im.new_id,
           COALESCE(l.amount, 0),
           COALESCE(l.method::payment_method, 'cash'),
           COALESCE(l.paid_at,   now()),
           COALESCE(l.created_at, now())
    FROM payments_int_legacy l
    JOIN _mig007_inv_map im ON im.old_id = l.invoice_id;
    GET DIAGNOSTICS _cnt = ROW_COUNT;
    RAISE NOTICE '[007] payments — migrated % rows.', _cnt;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[007] payments data migration skipped: %. Data preserved.', SQLERRM;
  END;
END $$;


-- ==========================================================================
-- FINAL: Recreate deferred FK constraints between newly created UUID tables
-- ==========================================================================

-- occupancy_beds.admission_id → admissions (if both just migrated)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_occ_beds_admission'
  ) THEN
    ALTER TABLE occupancy_beds ADD CONSTRAINT fk_occ_beds_admission
      FOREIGN KEY (admission_id) REFERENCES admissions(id) ON DELETE SET NULL;
    RAISE NOTICE '[007] Re-added fk_occ_beds_admission.';
  END IF;
END $$;

-- emergency_visits.linked_admission_id → admissions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ev_linked_admission'
  ) THEN
    ALTER TABLE emergency_visits ADD CONSTRAINT fk_ev_linked_admission
      FOREIGN KEY (linked_admission_id) REFERENCES admissions(id) ON DELETE SET NULL;
    RAISE NOTICE '[007] Re-added fk_ev_linked_admission.';
  END IF;
END $$;

-- emergency_visits.linked_surgical_request_id → surgical_requests
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ev_linked_surgical'
  ) THEN
    ALTER TABLE emergency_visits ADD CONSTRAINT fk_ev_linked_surgical
      FOREIGN KEY (linked_surgical_request_id) REFERENCES surgical_requests(id) ON DELETE SET NULL;
    RAISE NOTICE '[007] Re-added fk_ev_linked_surgical.';
  END IF;
END $$;

-- emergency_vitals.visit_id → emergency_visits (if both migrated)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'emergency_vitals_visit_id_fkey'
  ) THEN
    ALTER TABLE emergency_vitals ADD CONSTRAINT emergency_vitals_visit_id_fkey
      FOREIGN KEY (visit_id) REFERENCES emergency_visits(id) ON DELETE CASCADE;
    RAISE NOTICE '[007] Re-added emergency_vitals_visit_id_fkey.';
  END IF;
END $$;

-- icu_beds ↔ icu_admissions circular FK (if both just migrated)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_icu_beds_icu_admission'
  ) THEN
    ALTER TABLE icu_beds ADD CONSTRAINT fk_icu_beds_icu_admission
      FOREIGN KEY (icu_admission_id) REFERENCES icu_admissions(id) ON DELETE SET NULL;
    RAISE NOTICE '[007] Re-added fk_icu_beds_icu_admission.';
  END IF;
END $$;


-- ==========================================================================
-- CLEANUP: Drop mapping helper tables (data fully migrated or preserved)
-- ==========================================================================
DROP TABLE IF EXISTS _mig007_enc_map;
DROP TABLE IF EXISTS _mig007_adm_map;
DROP TABLE IF EXISTS _mig007_surg_map;
DROP TABLE IF EXISTS _mig007_inv_map;
DROP TABLE IF EXISTS _mig007_ev_map;
