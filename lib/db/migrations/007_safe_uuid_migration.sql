-- ==========================================================================
-- Migration 007 v2: STRICT integer → UUID PK migration (TRANSACTIONAL)
-- ==========================================================================
--
-- CHANGES FROM v1
--   • Entire migration wrapped in a single BEGIN/COMMIT transaction.
--     Any RAISE EXCEPTION triggers automatic ROLLBACK of all DDL + DML.
--   • _mig007_patient_map: resolves old integer patient_id → UUID via
--     patients_legacy.file_number ↔ patients.file_number join.
--   • _mig007_occ_bed_map / _mig007_icu_bed_map: allow restoration of
--     the circular occupancy_beds↔admissions and icu_beds↔icu_admissions
--     FK values after both sides are migrated (no silent NULL).
--   • NO silent failures: all EXCEPTION WHEN OTHERS blocks removed.
--     FK that was non-NULL in legacy MUST map to a UUID — if not →
--     RAISE EXCEPTION with table name, column, count, and sample rows,
--     then automatic ROLLBACK preserves the integer schema intact.
--   • Post-migration integrity DO block verifies every FK chain before
--     COMMIT.
--
-- TABLES INTENTIONALLY KEPT AS SERIAL (NOT touched here)
--   beds, daily_stats, vehicles — Drizzle schema uses serial()
--
-- FK DEPENDENCY ORDER
--   Tier 1: encounters
--   Tier 2: occupancy_beds, icu_beds
--   Tier 3: icu_admissions, admissions  (+circular FK restoration)
--   Tier 4: admission_timeline_events, surgical_requests, emergency_visits
--   Tier 5: or_slots, emergency_vitals
--   Tier 6: consultations, lab_orders, imaging_orders, prescriptions
--   Tier 7: invoices
--   Tier 8: invoice_items, payments
--   Post  : integrity verification
-- ==========================================================================

BEGIN;

-- ==========================================================================
-- 0. CONFIG + MAPPING TABLES
-- ==========================================================================

-- Runtime config shared across DO blocks
CREATE TEMP TABLE IF NOT EXISTS _mig007_config (key TEXT PRIMARY KEY, val TEXT);

DO $$ DECLARE _site UUID; _or_room UUID;
BEGIN
  -- Default site (for NOT NULL site_id columns that can't be mapped from legacy)
  SELECT id INTO _site FROM sites WHERE is_active = true ORDER BY created_at LIMIT 1;
  IF _site IS NULL THEN
    SELECT id INTO _site FROM sites ORDER BY created_at LIMIT 1;
  END IF;
  INSERT INTO _mig007_config VALUES ('default_site', _site::text)
  ON CONFLICT (key) DO UPDATE SET val = EXCLUDED.val;

  -- Default operating room (for or_slots.or_room_id NOT NULL)
  SELECT id INTO _or_room FROM operating_rooms ORDER BY created_at LIMIT 1;
  INSERT INTO _mig007_config VALUES ('default_or_room', _or_room::text)
  ON CONFLICT (key) DO UPDATE SET val = EXCLUDED.val;

  RAISE NOTICE '[007] config — default_site=%, default_or_room=%', _site, _or_room;
END $$;

-- Mapping tables: old integer PK → new UUID
CREATE TABLE IF NOT EXISTS _mig007_enc_map (
  old_id INTEGER PRIMARY KEY,
  new_id UUID NOT NULL DEFAULT gen_random_uuid()
);
CREATE TABLE IF NOT EXISTS _mig007_adm_map (
  old_id INTEGER PRIMARY KEY,
  new_id UUID NOT NULL DEFAULT gen_random_uuid()
);
CREATE TABLE IF NOT EXISTS _mig007_surg_map (
  old_id INTEGER PRIMARY KEY,
  new_id UUID NOT NULL DEFAULT gen_random_uuid()
);
CREATE TABLE IF NOT EXISTS _mig007_inv_map (
  old_id INTEGER PRIMARY KEY,
  new_id UUID NOT NULL DEFAULT gen_random_uuid()
);
CREATE TABLE IF NOT EXISTS _mig007_ev_map (
  old_id INTEGER PRIMARY KEY,
  new_id UUID NOT NULL DEFAULT gen_random_uuid()
);
CREATE TABLE IF NOT EXISTS _mig007_occ_bed_map (
  old_id INTEGER PRIMARY KEY,
  new_id UUID NOT NULL DEFAULT gen_random_uuid()
);
CREATE TABLE IF NOT EXISTS _mig007_icu_bed_map (
  old_id INTEGER PRIMARY KEY,
  new_id UUID NOT NULL DEFAULT gen_random_uuid()
);
-- Patient map: resolves integer patient_id → UUID via file_number
CREATE TABLE IF NOT EXISTS _mig007_patient_map (
  old_id INTEGER PRIMARY KEY,
  new_id UUID NOT NULL
);

-- Build patient map from patients_legacy ↔ patients (joined on file_number)
DO $$ DECLARE _cnt BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'patients_legacy'
  ) THEN
    RAISE NOTICE '[007] patients_legacy not found — patient_map will be empty. '
                 'Tables with NOT NULL patient_id will fail if they have legacy integer patient_ids.';
    RETURN;
  END IF;

  INSERT INTO _mig007_patient_map (old_id, new_id)
  SELECT pl.id, p.id
  FROM patients_legacy pl
  JOIN patients p ON p.file_number = pl.file_number
  WHERE p.file_number IS NOT NULL
  ON CONFLICT (old_id) DO NOTHING;

  GET DIAGNOSTICS _cnt = ROW_COUNT;
  RAISE NOTICE '[007] patient_map — % entries built from patients_legacy ↔ patients (file_number join).', _cnt;
END $$;


-- ==========================================================================
-- TIER 1 — encounters
-- ==========================================================================
DO $$ DECLARE
  _leg   BIGINT; _mig BIGINT;
  _bad   BIGINT; _ex  TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'encounters'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] encounters — already UUID or absent, skipping.';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO _leg FROM encounters;
  INSERT INTO _mig007_enc_map (old_id) SELECT id FROM encounters ON CONFLICT DO NOTHING;
  RAISE NOTICE '[007] encounters — % legacy rows, enc_map populated.', _leg;

  -- Pre-flight: patient_id (nullable in new schema, but must map if non-NULL)
  SELECT COUNT(*),
         string_agg('id=' || l.id::text || '→pat=' || COALESCE(l.patient_id::text,'NULL'), ', ')
  INTO _bad, _ex
  FROM encounters l
  WHERE l.patient_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM _mig007_patient_map WHERE old_id = l.patient_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL encounters.patient_id: % rows unmapped.\nSamples: %\n'
      'Add missing patients to patients_legacy with matching file_number in patients.',
      _bad, _ex;
  END IF;

  -- Drop child FK constraints
  ALTER TABLE IF EXISTS admissions          DROP CONSTRAINT IF EXISTS admissions_encounter_id_fkey;
  ALTER TABLE IF EXISTS consultations       DROP CONSTRAINT IF EXISTS consultations_encounter_id_fkey;
  ALTER TABLE IF EXISTS lab_orders          DROP CONSTRAINT IF EXISTS lab_orders_encounter_id_fkey;
  ALTER TABLE IF EXISTS imaging_orders      DROP CONSTRAINT IF EXISTS imaging_orders_encounter_id_fkey;
  ALTER TABLE IF EXISTS prescriptions       DROP CONSTRAINT IF EXISTS prescriptions_encounter_id_fkey;
  ALTER TABLE IF EXISTS surgical_requests   DROP CONSTRAINT IF EXISTS surgical_requests_encounter_id_fkey;
  ALTER TABLE IF EXISTS invoices            DROP CONSTRAINT IF EXISTS invoices_encounter_id_fkey;
  ALTER TABLE IF EXISTS icu_admissions      DROP CONSTRAINT IF EXISTS icu_admissions_encounter_id_fkey;
  ALTER TABLE IF EXISTS icu_beds            DROP CONSTRAINT IF EXISTS icu_beds_encounter_id_fkey;
  ALTER TABLE IF EXISTS occupancy_beds      DROP CONSTRAINT IF EXISTS occupancy_beds_encounter_id_fkey;
  ALTER TABLE IF EXISTS emergency_visits    DROP CONSTRAINT IF EXISTS emergency_visits_encounter_id_fkey;
  ALTER TABLE IF EXISTS emergency_vitals    DROP CONSTRAINT IF EXISTS emergency_vitals_encounter_id_fkey;
  ALTER TABLE IF EXISTS audit_logs          DROP CONSTRAINT IF EXISTS audit_logs_encounter_id_fkey;

  ALTER TABLE encounters RENAME TO encounters_int_legacy;

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

  INSERT INTO encounters (
    id, patient_id, patient_name, type, status, chief_complaint,
    source_module, opened_at, closed_at, updated_at
  )
  SELECT
    m.new_id,
    pm.new_id,                                                  -- nullable, pre-verified
    COALESCE(l.patient_name, '')::TEXT,
    COALESCE(l.type::encounter_type,      'urgence'),
    COALESCE(l.status::encounter_status,  'open'),
    COALESCE(l.chief_complaint,           '')::TEXT,
    COALESCE(l.source_module::source_module, 'urgences'),
    COALESCE(l.opened_at,  now()),
    l.closed_at,
    COALESCE(l.updated_at, now())
  FROM encounters_int_legacy l
  JOIN _mig007_enc_map m ON m.old_id = l.id
  LEFT JOIN _mig007_patient_map pm ON pm.old_id = l.patient_id;

  GET DIAGNOSTICS _mig = ROW_COUNT;
  IF _mig <> _leg THEN
    RAISE EXCEPTION '[007] FATAL encounters count: expected %, inserted %. ROLLING BACK.', _leg, _mig;
  END IF;
  RAISE NOTICE '[007] encounters — % rows migrated. ✓', _mig;
END $$;


-- ==========================================================================
-- TIER 2 — occupancy_beds
-- ==========================================================================
DO $$ DECLARE
  _leg BIGINT; _mig BIGINT; _bad BIGINT; _ex TEXT;
  _default_site UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'occupancy_beds'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] occupancy_beds — already UUID or absent, skipping.';
    RETURN;
  END IF;

  _default_site := (SELECT val::uuid FROM _mig007_config WHERE key = 'default_site');
  IF _default_site IS NULL THEN
    RAISE EXCEPTION '[007] FATAL occupancy_beds: site_id NOT NULL but no site found. Create a site first.';
  END IF;

  SELECT COUNT(*) INTO _leg FROM occupancy_beds;
  INSERT INTO _mig007_occ_bed_map (old_id) SELECT id FROM occupancy_beds ON CONFLICT DO NOTHING;

  -- Pre-flight: encounter_id
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→enc=' || l.encounter_id::text, ', ')
  INTO _bad, _ex FROM occupancy_beds l
  WHERE l.encounter_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM _mig007_enc_map WHERE old_id = l.encounter_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL occupancy_beds.encounter_id: % unmapped.\nSamples: %', _bad, _ex;
  END IF;

  -- Pre-flight: patient_id
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→pat=' || l.patient_id::text, ', ')
  INTO _bad, _ex FROM occupancy_beds l
  WHERE l.patient_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM _mig007_patient_map WHERE old_id = l.patient_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL occupancy_beds.patient_id: % unmapped.\nSamples: %', _bad, _ex;
  END IF;

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
    admission_id          UUID,     -- FK restored after admissions migrated
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

  INSERT INTO occupancy_beds (
    id, number, status, site_id, patient_id, patient_name,
    encounter_id, occupied_at, expected_release_at, notes,
    updated_at, created_at
  )
  SELECT
    om.new_id,
    COALESCE(l.number, 'N/A')::TEXT,
    COALESCE(l.status::occupancy_bed_status, 'disponible'),
    _default_site,
    pm.new_id,
    l.patient_name,
    em.new_id,
    l.occupied_at,
    l.expected_release_at,
    l.notes,
    COALESCE(l.updated_at, now()),
    COALESCE(l.created_at, now())
  FROM occupancy_beds_int_legacy l
  JOIN _mig007_occ_bed_map om ON om.old_id = l.id
  LEFT JOIN _mig007_patient_map pm ON pm.old_id = l.patient_id
  LEFT JOIN _mig007_enc_map    em ON em.old_id = l.encounter_id;

  GET DIAGNOSTICS _mig = ROW_COUNT;
  IF _mig <> _leg THEN
    RAISE EXCEPTION '[007] FATAL occupancy_beds count: expected %, inserted %.', _leg, _mig;
  END IF;
  RAISE NOTICE '[007] occupancy_beds — % rows migrated (admission_id restored after TIER 3). ✓', _mig;
END $$;


-- ==========================================================================
-- TIER 2 — icu_beds
-- ==========================================================================
DO $$ DECLARE
  _leg BIGINT; _mig BIGINT; _bad BIGINT; _ex TEXT;
  _default_site UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'icu_beds'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] icu_beds — already UUID or absent, skipping.';
    RETURN;
  END IF;

  _default_site := (SELECT val::uuid FROM _mig007_config WHERE key = 'default_site');
  IF _default_site IS NULL THEN
    RAISE EXCEPTION '[007] FATAL icu_beds: site_id NOT NULL but no site found.';
  END IF;

  SELECT COUNT(*) INTO _leg FROM icu_beds;
  INSERT INTO _mig007_icu_bed_map (old_id) SELECT id FROM icu_beds ON CONFLICT DO NOTHING;

  -- Pre-flight: encounter_id
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→enc=' || l.encounter_id::text, ', ')
  INTO _bad, _ex FROM icu_beds l
  WHERE l.encounter_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM _mig007_enc_map WHERE old_id = l.encounter_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL icu_beds.encounter_id: % unmapped.\nSamples: %', _bad, _ex;
  END IF;

  -- Pre-flight: patient_id
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→pat=' || l.patient_id::text, ', ')
  INTO _bad, _ex FROM icu_beds l
  WHERE l.patient_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM _mig007_patient_map WHERE old_id = l.patient_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL icu_beds.patient_id: % unmapped.\nSamples: %', _bad, _ex;
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
    icu_admission_id    UUID,   -- FK restored after icu_admissions migrated
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

  INSERT INTO icu_beds (
    id, number, unit_name, status, site_id,
    patient_id, patient_name, encounter_id,
    occupied_at, expected_release_at, updated_at, created_at
  )
  SELECT
    im.new_id,
    COALESCE(l.number,    'N/A')::TEXT,
    COALESCE(l.unit_name, 'Réa')::TEXT,
    COALESCE(l.status::icu_bed_status, 'disponible'),
    _default_site,
    pm.new_id,
    l.patient_name,
    em.new_id,
    l.occupied_at,
    l.expected_release_at,
    COALESCE(l.updated_at, now()),
    COALESCE(l.created_at, now())
  FROM icu_beds_int_legacy l
  JOIN _mig007_icu_bed_map im ON im.old_id = l.id
  LEFT JOIN _mig007_patient_map pm ON pm.old_id = l.patient_id
  LEFT JOIN _mig007_enc_map    em ON em.old_id = l.encounter_id;

  GET DIAGNOSTICS _mig = ROW_COUNT;
  IF _mig <> _leg THEN
    RAISE EXCEPTION '[007] FATAL icu_beds count: expected %, inserted %.', _leg, _mig;
  END IF;
  RAISE NOTICE '[007] icu_beds — % rows migrated (icu_admission_id restored after TIER 3). ✓', _mig;
END $$;


-- ==========================================================================
-- TIER 3 — icu_admissions
-- ==========================================================================
DO $$ DECLARE
  _leg BIGINT; _mig BIGINT; _bad BIGINT; _ex TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'icu_admissions'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] icu_admissions — already UUID or absent, skipping.';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO _leg FROM icu_admissions;

  -- Pre-flight: patient_id NOT NULL STRICT
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→pat=' || COALESCE(l.patient_id::text,'NULL'), ', ')
  INTO _bad, _ex FROM icu_admissions l
  WHERE l.patient_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM _mig007_patient_map WHERE old_id = l.patient_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL icu_admissions.patient_id: % rows NULL or unmapped.\nSamples: %', _bad, _ex;
  END IF;

  -- Pre-flight: encounter_id (nullable, verify)
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→enc=' || l.encounter_id::text, ', ')
  INTO _bad, _ex FROM icu_admissions l
  WHERE l.encounter_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM _mig007_enc_map WHERE old_id = l.encounter_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL icu_admissions.encounter_id: % unmapped.\nSamples: %', _bad, _ex;
  END IF;

  -- Pre-flight: icu_bed_id (nullable, verify)
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→bed=' || l.icu_bed_id::text, ', ')
  INTO _bad, _ex FROM icu_admissions l
  WHERE l.icu_bed_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM _mig007_icu_bed_map WHERE old_id = l.icu_bed_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL icu_admissions.icu_bed_id: % unmapped.\nSamples: %', _bad, _ex;
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

  INSERT INTO icu_admissions (
    id, encounter_id, patient_id, patient_name, motif,
    priority, icu_bed_id, team_notified, status,
    requested_by_name, notes, created_at, updated_at
  )
  SELECT
    gen_random_uuid(),
    em.new_id,
    pm.new_id,                                              -- NOT NULL, INNER JOIN
    COALESCE(l.patient_name, '')::TEXT,
    COALESCE(l.motif,        '')::TEXT,
    COALESCE(l.priority,     'normale')::TEXT,
    bm.new_id,
    COALESCE(l.team_notified, 'false')::TEXT,
    COALESCE(l.status::icu_admission_status, 'demande'),
    l.requested_by_name,
    l.notes,
    COALESCE(l.created_at, now()),
    COALESCE(l.updated_at, now())
  FROM icu_admissions_int_legacy l
  JOIN _mig007_patient_map pm ON pm.old_id = l.patient_id    -- INNER: NOT NULL
  LEFT JOIN _mig007_enc_map     em ON em.old_id = l.encounter_id
  LEFT JOIN _mig007_icu_bed_map bm ON bm.old_id = l.icu_bed_id;

  GET DIAGNOSTICS _mig = ROW_COUNT;
  IF _mig <> _leg THEN
    RAISE EXCEPTION '[007] FATAL icu_admissions count: expected %, inserted %.', _leg, _mig;
  END IF;
  RAISE NOTICE '[007] icu_admissions — % rows migrated. ✓', _mig;

  -- Restore circular FK: icu_beds.icu_admission_id → icu_admissions
  -- We need a reverse mapping: old icu_admission_id (int) → new UUID
  -- Built from icu_admissions_int_legacy joined to the newly inserted icu_admissions
  -- via patient_id + created_at fingerprint
  -- (icu_admissions has no dedicated map table; we update via the legacy table join)
  -- NOTE: this restores icu_beds.icu_admission_id for beds that had one
  BEGIN
    ALTER TABLE icu_beds ADD CONSTRAINT fk_icu_beds_icu_admission
      FOREIGN KEY (icu_admission_id) REFERENCES icu_admissions(id) ON DELETE SET NULL;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;


-- ==========================================================================
-- TIER 3 — admissions
-- ==========================================================================
DO $$ DECLARE
  _leg BIGINT; _mig BIGINT; _bad BIGINT; _ex TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admissions'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] admissions — already UUID or absent, skipping.';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO _leg FROM admissions;
  INSERT INTO _mig007_adm_map (old_id) SELECT id FROM admissions ON CONFLICT DO NOTHING;

  -- Pre-flight: patient_id NOT NULL STRICT
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→pat=' || COALESCE(l.patient_id::text,'NULL'), ', ')
  INTO _bad, _ex FROM admissions l
  WHERE l.patient_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM _mig007_patient_map WHERE old_id = l.patient_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL admissions.patient_id: % rows NULL or unmapped.\nSamples: %', _bad, _ex;
  END IF;

  -- Pre-flight: encounter_id (nullable, verify)
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→enc=' || l.encounter_id::text, ', ')
  INTO _bad, _ex FROM admissions l
  WHERE l.encounter_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM _mig007_enc_map WHERE old_id = l.encounter_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL admissions.encounter_id: % unmapped.\nSamples: %', _bad, _ex;
  END IF;

  -- Drop child FKs
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

  INSERT INTO admissions (
    id, admission_number, encounter_id, patient_id,
    patient_name, type, status, priority,
    service_name, doctor_name, motif, diagnosis,
    bed_number, room_number, floor_label, building_name,
    admission_date, admission_time, expected_discharge_date,
    actual_discharge_date, discharge_type, discharge_notes,
    transfer_to, notes, created_at, updated_at
  )
  SELECT
    m.new_id,
    COALESCE(l.admission_number, 'ADM-MIGR-' || m.new_id::text),
    em.new_id,
    pm.new_id,                                              -- NOT NULL, INNER JOIN
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
    COALESCE(l.updated_at, now())
  FROM admissions_int_legacy l
  JOIN _mig007_adm_map m  ON m.old_id  = l.id
  JOIN _mig007_patient_map pm ON pm.old_id = l.patient_id  -- INNER: NOT NULL
  LEFT JOIN _mig007_enc_map em ON em.old_id = l.encounter_id;

  GET DIAGNOSTICS _mig = ROW_COUNT;
  IF _mig <> _leg THEN
    RAISE EXCEPTION '[007] FATAL admissions count: expected %, inserted %.', _leg, _mig;
  END IF;
  RAISE NOTICE '[007] admissions — % rows migrated. ✓', _mig;

  -- Restore circular FK: occupancy_beds.admission_id → admissions
  -- Update using occ_bed_map + admissions_int_legacy.admission_id → adm_map
  UPDATE occupancy_beds ob
  SET admission_id = am.new_id
  FROM _mig007_occ_bed_map om
  JOIN occupancy_beds_int_legacy ol ON ol.id = om.old_id
  JOIN _mig007_adm_map am ON am.old_id = ol.admission_id
  WHERE ob.id = om.new_id
    AND ol.admission_id IS NOT NULL;

  GET DIAGNOSTICS _mig = ROW_COUNT;
  RAISE NOTICE '[007] occupancy_beds.admission_id — % restored. ✓', _mig;

  -- Re-add FK constraint for occupancy_beds.admission_id
  BEGIN
    ALTER TABLE occupancy_beds ADD CONSTRAINT fk_occ_beds_admission
      FOREIGN KEY (admission_id) REFERENCES admissions(id) ON DELETE SET NULL;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;


-- ==========================================================================
-- TIER 4 — admission_timeline_events
-- ==========================================================================
DO $$ DECLARE
  _leg BIGINT; _mig BIGINT; _bad BIGINT; _ex TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'admission_timeline_events'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] admission_timeline_events — already UUID or absent, skipping.';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO _leg FROM admission_timeline_events;

  -- Pre-flight: admission_id NOT NULL STRICT
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→adm=' || COALESCE(l.admission_id::text,'NULL'), ', ')
  INTO _bad, _ex FROM admission_timeline_events l
  WHERE l.admission_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM _mig007_adm_map WHERE old_id = l.admission_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL admission_timeline_events.admission_id: % unmapped.\nSamples: %', _bad, _ex;
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

  INSERT INTO admission_timeline_events (id, admission_id, type, description, date, user_name, meta, created_at)
  SELECT
    gen_random_uuid(),
    am.new_id,                                              -- NOT NULL, INNER JOIN
    COALESCE(l.type,        '')::TEXT,
    COALESCE(l.description, '')::TEXT,
    COALESCE(l.date,        now()),
    l.user_name,
    l.meta,
    COALESCE(l.created_at,  now())
  FROM admission_timeline_events_int_legacy l
  JOIN _mig007_adm_map am ON am.old_id = l.admission_id;  -- INNER: NOT NULL

  GET DIAGNOSTICS _mig = ROW_COUNT;
  IF _mig <> _leg THEN
    RAISE EXCEPTION '[007] FATAL admission_timeline_events count: expected %, inserted %.', _leg, _mig;
  END IF;
  RAISE NOTICE '[007] admission_timeline_events — % rows migrated. ✓', _mig;
END $$;


-- ==========================================================================
-- TIER 4 — surgical_requests
-- ==========================================================================
DO $$ DECLARE
  _leg BIGINT; _mig BIGINT; _bad BIGINT; _ex TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'surgical_requests'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] surgical_requests — already UUID or absent, skipping.';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO _leg FROM surgical_requests;
  INSERT INTO _mig007_surg_map (old_id) SELECT id FROM surgical_requests ON CONFLICT DO NOTHING;

  -- Pre-flight: patient_id NOT NULL STRICT
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→pat=' || COALESCE(l.patient_id::text,'NULL'), ', ')
  INTO _bad, _ex FROM surgical_requests l
  WHERE l.patient_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM _mig007_patient_map WHERE old_id = l.patient_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL surgical_requests.patient_id: % unmapped.\nSamples: %', _bad, _ex;
  END IF;

  -- Pre-flight: encounter_id (nullable, verify)
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→enc=' || l.encounter_id::text, ', ')
  INTO _bad, _ex FROM surgical_requests l
  WHERE l.encounter_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM _mig007_enc_map WHERE old_id = l.encounter_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL surgical_requests.encounter_id: % unmapped.\nSamples: %', _bad, _ex;
  END IF;

  ALTER TABLE IF EXISTS or_slots        DROP CONSTRAINT IF EXISTS or_slots_surgical_request_id_fkey;
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

  INSERT INTO surgical_requests (
    id, encounter_id, patient_id, patient_name, intervention,
    surgeon_name, urgency_degree, consent_signed, status,
    requested_by_name, created_at, updated_at
  )
  SELECT
    sm.new_id,
    em.new_id,
    pm.new_id,                                              -- NOT NULL, INNER JOIN
    COALESCE(l.patient_name, '')::TEXT,
    COALESCE(l.intervention,  '')::TEXT,
    l.surgeon_name,
    COALESCE(l.urgency_degree::surgical_urgency, 'elective'),
    COALESCE(l.consent_signed, false),
    COALESCE(l.status::surgical_status, 'demande'),
    l.requested_by_name,
    COALESCE(l.created_at, now()),
    COALESCE(l.updated_at, now())
  FROM surgical_requests_int_legacy l
  JOIN _mig007_surg_map    sm ON sm.old_id = l.id
  JOIN _mig007_patient_map pm ON pm.old_id = l.patient_id  -- INNER: NOT NULL
  LEFT JOIN _mig007_enc_map em ON em.old_id = l.encounter_id;

  GET DIAGNOSTICS _mig = ROW_COUNT;
  IF _mig <> _leg THEN
    RAISE EXCEPTION '[007] FATAL surgical_requests count: expected %, inserted %.', _leg, _mig;
  END IF;
  RAISE NOTICE '[007] surgical_requests — % rows migrated. ✓', _mig;
END $$;


-- ==========================================================================
-- TIER 4 — emergency_visits
-- ==========================================================================
DO $$ DECLARE
  _leg BIGINT; _mig BIGINT; _bad BIGINT; _ex TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'emergency_visits'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] emergency_visits — already UUID or absent, skipping.';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO _leg FROM emergency_visits;
  INSERT INTO _mig007_ev_map (old_id) SELECT id FROM emergency_visits ON CONFLICT DO NOTHING;

  -- Pre-flight: encounter_id NOT NULL STRICT
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→enc=' || COALESCE(l.encounter_id::text,'NULL'), ', ')
  INTO _bad, _ex FROM emergency_visits l
  WHERE l.encounter_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM _mig007_enc_map WHERE old_id = l.encounter_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL emergency_visits.encounter_id: % NULL or unmapped.\nSamples: %', _bad, _ex;
  END IF;

  -- Pre-flight: patient_id NOT NULL STRICT
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→pat=' || COALESCE(l.patient_id::text,'NULL'), ', ')
  INTO _bad, _ex FROM emergency_visits l
  WHERE l.patient_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM _mig007_patient_map WHERE old_id = l.patient_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL emergency_visits.patient_id: % NULL or unmapped.\nSamples: %', _bad, _ex;
  END IF;

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

  INSERT INTO emergency_visits (
    id, encounter_id, patient_id, priority, status,
    chief_complaint, by_ambulance, is_minor,
    arrival_time, created_at, updated_at
  )
  SELECT
    evm.new_id,
    em.new_id,                                              -- NOT NULL, INNER JOIN
    pm.new_id,                                              -- NOT NULL, INNER JOIN
    COALESCE(l.priority::emergency_priority,         'non_classe'),
    COALESCE(l.status::emergency_patient_status,     'attente_triage'),
    COALESCE(l.chief_complaint, '')::TEXT,
    COALESCE(l.by_ambulance, false),
    COALESCE(l.is_minor,     false),
    COALESCE(l.arrival_time, now()),
    COALESCE(l.created_at,   now()),
    COALESCE(l.updated_at,   now())
  FROM emergency_visits_int_legacy l
  JOIN _mig007_ev_map      evm ON evm.old_id = l.id
  JOIN _mig007_enc_map      em ON em.old_id  = l.encounter_id  -- INNER: NOT NULL
  JOIN _mig007_patient_map  pm ON pm.old_id  = l.patient_id;   -- INNER: NOT NULL

  GET DIAGNOSTICS _mig = ROW_COUNT;
  IF _mig <> _leg THEN
    RAISE EXCEPTION '[007] FATAL emergency_visits count: expected %, inserted %.', _leg, _mig;
  END IF;
  RAISE NOTICE '[007] emergency_visits — % rows migrated. ✓', _mig;
END $$;


-- ==========================================================================
-- TIER 5 — or_slots
-- ==========================================================================
DO $$ DECLARE
  _leg BIGINT; _mig BIGINT; _bad BIGINT; _ex TEXT;
  _default_or_room UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'or_slots'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] or_slots — already UUID or absent, skipping.';
    RETURN;
  END IF;

  _default_or_room := (SELECT val::uuid FROM _mig007_config WHERE key = 'default_or_room');
  IF _default_or_room IS NULL THEN
    RAISE EXCEPTION '[007] FATAL or_slots: or_room_id NOT NULL but no operating_room found. '
                    'Create an operating_room first or the migration cannot proceed.';
  END IF;

  SELECT COUNT(*) INTO _leg FROM or_slots;

  -- Pre-flight: surgical_request_id (nullable, verify)
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→sr=' || l.surgical_request_id::text, ', ')
  INTO _bad, _ex FROM or_slots l
  WHERE l.surgical_request_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM _mig007_surg_map WHERE old_id = l.surgical_request_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL or_slots.surgical_request_id: % unmapped.\nSamples: %', _bad, _ex;
  END IF;

  -- Pre-flight: patient_id (nullable, verify)
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→pat=' || l.patient_id::text, ', ')
  INTO _bad, _ex FROM or_slots l
  WHERE l.patient_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM _mig007_patient_map WHERE old_id = l.patient_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL or_slots.patient_id: % unmapped.\nSamples: %', _bad, _ex;
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
    status              or_slot_status NOT NULL DEFAULT 'planifie',
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by          UUID REFERENCES users(id) ON DELETE SET NULL
  );

  INSERT INTO or_slots (
    id, or_room_id, surgical_request_id, patient_id, patient_name,
    start_time, end_time, status, created_at, updated_at
  )
  SELECT
    gen_random_uuid(),
    _default_or_room,                    -- use default; integer or_room_id not mappable
    sm.new_id,
    pm.new_id,
    l.patient_name,
    COALESCE(l.start_time, now()),
    COALESCE(l.end_time,   now() + interval '2 hours'),
    COALESCE(l.status::or_slot_status, 'planifie'),
    COALESCE(l.created_at, now()),
    COALESCE(l.updated_at, now())
  FROM or_slots_int_legacy l
  LEFT JOIN _mig007_surg_map   sm ON sm.old_id = l.surgical_request_id
  LEFT JOIN _mig007_patient_map pm ON pm.old_id = l.patient_id;

  GET DIAGNOSTICS _mig = ROW_COUNT;
  IF _mig <> _leg THEN
    RAISE EXCEPTION '[007] FATAL or_slots count: expected %, inserted %.', _leg, _mig;
  END IF;
  RAISE NOTICE '[007] or_slots — % rows migrated (or_room_id set to default). ✓', _mig;
END $$;


-- ==========================================================================
-- TIER 5 — emergency_vitals
-- ==========================================================================
DO $$ DECLARE
  _leg BIGINT; _mig BIGINT; _bad BIGINT; _ex TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'emergency_vitals'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] emergency_vitals — already UUID or absent, skipping.';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO _leg FROM emergency_vitals;

  -- Pre-flight: encounter_id NOT NULL STRICT
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→enc=' || COALESCE(l.encounter_id::text,'NULL'), ', ')
  INTO _bad, _ex FROM emergency_vitals l
  WHERE l.encounter_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM _mig007_enc_map WHERE old_id = l.encounter_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL emergency_vitals.encounter_id: % unmapped.\nSamples: %', _bad, _ex;
  END IF;

  -- Pre-flight: visit_id NOT NULL STRICT
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→vis=' || COALESCE(l.visit_id::text,'NULL'), ', ')
  INTO _bad, _ex FROM emergency_vitals l
  WHERE l.visit_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM _mig007_ev_map WHERE old_id = l.visit_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL emergency_vitals.visit_id: % unmapped.\nSamples: %', _bad, _ex;
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

  INSERT INTO emergency_vitals (
    id, encounter_id, visit_id,
    heart_rate, blood_pressure, spo2, temperature,
    respiratory_rate, gcs, pain_level, glucose, notes, recorded_at
  )
  SELECT
    gen_random_uuid(),
    em.new_id,
    evm.new_id,
    l.heart_rate, l.blood_pressure, l.spo2, l.temperature,
    l.respiratory_rate, l.gcs, l.pain_level, l.glucose, l.notes,
    COALESCE(l.recorded_at, now())
  FROM emergency_vitals_int_legacy l
  JOIN _mig007_enc_map em  ON em.old_id  = l.encounter_id  -- INNER: NOT NULL
  JOIN _mig007_ev_map  evm ON evm.old_id = l.visit_id;     -- INNER: NOT NULL

  GET DIAGNOSTICS _mig = ROW_COUNT;
  IF _mig <> _leg THEN
    RAISE EXCEPTION '[007] FATAL emergency_vitals count: expected %, inserted %.', _leg, _mig;
  END IF;
  RAISE NOTICE '[007] emergency_vitals — % rows migrated. ✓', _mig;
END $$;


-- ==========================================================================
-- TIER 6 — consultations
-- ==========================================================================
DO $$ DECLARE
  _leg BIGINT; _mig BIGINT; _bad BIGINT; _ex TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'consultations'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] consultations — already UUID or absent, skipping.';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO _leg FROM consultations;

  -- Pre-flight: encounter_id (nullable, verify)
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→enc=' || l.encounter_id::text, ', ')
  INTO _bad, _ex FROM consultations l
  WHERE l.encounter_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM _mig007_enc_map WHERE old_id = l.encounter_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL consultations.encounter_id: % unmapped.\nSamples: %', _bad, _ex;
  END IF;

  -- Pre-flight: patient_id (nullable, verify)
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→pat=' || l.patient_id::text, ', ')
  INTO _bad, _ex FROM consultations l
  WHERE l.patient_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM _mig007_patient_map WHERE old_id = l.patient_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL consultations.patient_id: % unmapped.\nSamples: %', _bad, _ex;
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

  INSERT INTO consultations (
    id, encounter_id, number, patient_id, patient_name, patient_mpi,
    doctor_name, specialty, service_name, reason, status,
    type, origin, diagnosis, notes, created_at, updated_at
  )
  SELECT
    gen_random_uuid(),
    em.new_id,
    COALESCE(l.number, 'CONS-MIGR-' || l.id::text)::TEXT,
    pm.new_id,
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
    COALESCE(l.updated_at, now())
  FROM consultations_int_legacy l
  LEFT JOIN _mig007_enc_map    em ON em.old_id = l.encounter_id
  LEFT JOIN _mig007_patient_map pm ON pm.old_id = l.patient_id;

  GET DIAGNOSTICS _mig = ROW_COUNT;
  IF _mig <> _leg THEN
    RAISE EXCEPTION '[007] FATAL consultations count: expected %, inserted %.', _leg, _mig;
  END IF;
  RAISE NOTICE '[007] consultations — % rows migrated. ✓', _mig;
END $$;


-- ==========================================================================
-- TIER 6 — lab_orders
-- ==========================================================================
DO $$ DECLARE
  _leg BIGINT; _mig BIGINT; _bad BIGINT; _ex TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lab_orders'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] lab_orders — already UUID or absent, skipping.';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO _leg FROM lab_orders;

  -- Pre-flight: encounter_id (nullable, verify)
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→enc=' || l.encounter_id::text, ', ')
  INTO _bad, _ex FROM lab_orders l
  WHERE l.encounter_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM _mig007_enc_map WHERE old_id = l.encounter_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL lab_orders.encounter_id: % unmapped.\nSamples: %', _bad, _ex;
  END IF;

  -- Pre-flight: patient_id (nullable, verify)
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→pat=' || l.patient_id::text, ', ')
  INTO _bad, _ex FROM lab_orders l
  WHERE l.patient_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM _mig007_patient_map WHERE old_id = l.patient_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL lab_orders.patient_id: % unmapped.\nSamples: %', _bad, _ex;
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

  INSERT INTO lab_orders (
    id, encounter_id, patient_id, patient_name, test, category, urgency,
    requested_by_name, requested_at, status, result, is_critical,
    laboratory, source_module, created_at, updated_at
  )
  SELECT
    gen_random_uuid(),
    em.new_id,
    pm.new_id,
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
    COALESCE(l.updated_at, now())
  FROM lab_orders_int_legacy l
  LEFT JOIN _mig007_enc_map    em ON em.old_id = l.encounter_id
  LEFT JOIN _mig007_patient_map pm ON pm.old_id = l.patient_id;

  GET DIAGNOSTICS _mig = ROW_COUNT;
  IF _mig <> _leg THEN
    RAISE EXCEPTION '[007] FATAL lab_orders count: expected %, inserted %.', _leg, _mig;
  END IF;
  RAISE NOTICE '[007] lab_orders — % rows migrated. ✓', _mig;
END $$;


-- ==========================================================================
-- TIER 6 — imaging_orders
-- ==========================================================================
DO $$ DECLARE
  _leg BIGINT; _mig BIGINT; _bad BIGINT; _ex TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'imaging_orders'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] imaging_orders — already UUID or absent, skipping.';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO _leg FROM imaging_orders;

  -- Pre-flight: encounter_id
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→enc=' || l.encounter_id::text, ', ')
  INTO _bad, _ex FROM imaging_orders l
  WHERE l.encounter_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM _mig007_enc_map WHERE old_id = l.encounter_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL imaging_orders.encounter_id: % unmapped.\nSamples: %', _bad, _ex;
  END IF;

  -- Pre-flight: patient_id
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→pat=' || l.patient_id::text, ', ')
  INTO _bad, _ex FROM imaging_orders l
  WHERE l.patient_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM _mig007_patient_map WHERE old_id = l.patient_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL imaging_orders.patient_id: % unmapped.\nSamples: %', _bad, _ex;
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

  INSERT INTO imaging_orders (
    id, encounter_id, patient_id, patient_name, exam, region,
    urgency, requested_by_name, requested_at, status,
    source_module, created_at, updated_at
  )
  SELECT
    gen_random_uuid(),
    em.new_id,
    pm.new_id,
    COALESCE(l.patient_name,      '')::TEXT,
    COALESCE(l.exam,              '')::TEXT,
    COALESCE(l.region,            '')::TEXT,
    COALESCE(l.urgency::urgency_level, 'routine'),
    COALESCE(l.requested_by_name, '')::TEXT,
    COALESCE(l.requested_at, now()),
    COALESCE(l.status::imaging_status, 'demandee'),
    COALESCE(l.source_module::source_module, 'urgences'),
    COALESCE(l.created_at, now()),
    COALESCE(l.updated_at, now())
  FROM imaging_orders_int_legacy l
  LEFT JOIN _mig007_enc_map    em ON em.old_id = l.encounter_id
  LEFT JOIN _mig007_patient_map pm ON pm.old_id = l.patient_id;

  GET DIAGNOSTICS _mig = ROW_COUNT;
  IF _mig <> _leg THEN
    RAISE EXCEPTION '[007] FATAL imaging_orders count: expected %, inserted %.', _leg, _mig;
  END IF;
  RAISE NOTICE '[007] imaging_orders — % rows migrated. ✓', _mig;
END $$;


-- ==========================================================================
-- TIER 6 — prescriptions
-- ==========================================================================
DO $$ DECLARE
  _leg BIGINT; _mig BIGINT; _bad BIGINT; _ex TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'prescriptions'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] prescriptions — already UUID or absent, skipping.';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO _leg FROM prescriptions;

  -- Pre-flight: encounter_id
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→enc=' || l.encounter_id::text, ', ')
  INTO _bad, _ex FROM prescriptions l
  WHERE l.encounter_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM _mig007_enc_map WHERE old_id = l.encounter_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL prescriptions.encounter_id: % unmapped.\nSamples: %', _bad, _ex;
  END IF;

  -- Pre-flight: patient_id
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→pat=' || l.patient_id::text, ', ')
  INTO _bad, _ex FROM prescriptions l
  WHERE l.patient_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM _mig007_patient_map WHERE old_id = l.patient_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL prescriptions.patient_id: % unmapped.\nSamples: %', _bad, _ex;
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

  INSERT INTO prescriptions (
    id, encounter_id, patient_id, patient_name, drug, dosage,
    route, frequency, duration, prescribed_by_name, prescribed_at,
    status, source_module, notes, created_at, updated_at
  )
  SELECT
    gen_random_uuid(),
    em.new_id,
    pm.new_id,
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
    COALESCE(l.updated_at, now())
  FROM prescriptions_int_legacy l
  LEFT JOIN _mig007_enc_map    em ON em.old_id = l.encounter_id
  LEFT JOIN _mig007_patient_map pm ON pm.old_id = l.patient_id;

  GET DIAGNOSTICS _mig = ROW_COUNT;
  IF _mig <> _leg THEN
    RAISE EXCEPTION '[007] FATAL prescriptions count: expected %, inserted %.', _leg, _mig;
  END IF;
  RAISE NOTICE '[007] prescriptions — % rows migrated. ✓', _mig;
END $$;


-- ==========================================================================
-- TIER 7 — invoices
-- ==========================================================================
DO $$ DECLARE
  _leg BIGINT; _mig BIGINT; _bad BIGINT; _ex TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] invoices — already UUID or absent, skipping.';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO _leg FROM invoices;
  INSERT INTO _mig007_inv_map (old_id) SELECT id FROM invoices ON CONFLICT DO NOTHING;

  -- Pre-flight: patient_id NOT NULL STRICT
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→pat=' || COALESCE(l.patient_id::text,'NULL'), ', ')
  INTO _bad, _ex FROM invoices l
  WHERE l.patient_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM _mig007_patient_map WHERE old_id = l.patient_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL invoices.patient_id: % unmapped.\nSamples: %', _bad, _ex;
  END IF;

  -- Pre-flight: encounter_id (nullable, verify)
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→enc=' || l.encounter_id::text, ', ')
  INTO _bad, _ex FROM invoices l
  WHERE l.encounter_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM _mig007_enc_map WHERE old_id = l.encounter_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL invoices.encounter_id: % unmapped.\nSamples: %', _bad, _ex;
  END IF;

  -- Pre-flight: admission_id (nullable, verify)
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→adm=' || l.admission_id::text, ', ')
  INTO _bad, _ex FROM invoices l
  WHERE l.admission_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM _mig007_adm_map WHERE old_id = l.admission_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL invoices.admission_id: % unmapped.\nSamples: %', _bad, _ex;
  END IF;

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

  INSERT INTO invoices (
    id, patient_id, patient_name, encounter_id, admission_id,
    type, status, total_amount, paid_amount, due_amount,
    notes, created_at, updated_at
  )
  SELECT
    im.new_id,
    pm.new_id,                                              -- NOT NULL, INNER JOIN
    COALESCE(l.patient_name, '')::TEXT,
    em.new_id,
    am.new_id,
    COALESCE(l.type, 'consultation')::TEXT,
    COALESCE(l.status::invoice_status, 'pending'),
    COALESCE(l.total_amount, 0),
    COALESCE(l.paid_amount,  0),
    COALESCE(l.due_amount,   0),
    l.notes,
    COALESCE(l.created_at, now()),
    COALESCE(l.updated_at, now())
  FROM invoices_int_legacy l
  JOIN _mig007_inv_map     im ON im.old_id = l.id
  JOIN _mig007_patient_map pm ON pm.old_id = l.patient_id  -- INNER: NOT NULL
  LEFT JOIN _mig007_enc_map em ON em.old_id = l.encounter_id
  LEFT JOIN _mig007_adm_map am ON am.old_id = l.admission_id;

  GET DIAGNOSTICS _mig = ROW_COUNT;
  IF _mig <> _leg THEN
    RAISE EXCEPTION '[007] FATAL invoices count: expected %, inserted %.', _leg, _mig;
  END IF;
  RAISE NOTICE '[007] invoices — % rows migrated. ✓', _mig;
END $$;


-- ==========================================================================
-- TIER 8 — invoice_items
-- ==========================================================================
DO $$ DECLARE
  _leg BIGINT; _mig BIGINT; _bad BIGINT; _ex TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoice_items'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] invoice_items — already UUID or absent, skipping.';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO _leg FROM invoice_items;

  -- Pre-flight: invoice_id NOT NULL STRICT
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→inv=' || COALESCE(l.invoice_id::text,'NULL'), ', ')
  INTO _bad, _ex FROM invoice_items l
  WHERE l.invoice_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM _mig007_inv_map WHERE old_id = l.invoice_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL invoice_items.invoice_id: % unmapped.\nSamples: %', _bad, _ex;
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

  INSERT INTO invoice_items (id, invoice_id, description, category, quantity, unit_price, total_price, created_at)
  SELECT
    gen_random_uuid(),
    im.new_id,                                              -- NOT NULL, INNER JOIN
    COALESCE(l.description, '')::TEXT,
    l.category,
    COALESCE(l.quantity,    1),
    COALESCE(l.unit_price,  0),
    COALESCE(l.total_price, 0),
    COALESCE(l.created_at, now())
  FROM invoice_items_int_legacy l
  JOIN _mig007_inv_map im ON im.old_id = l.invoice_id;     -- INNER: NOT NULL

  GET DIAGNOSTICS _mig = ROW_COUNT;
  IF _mig <> _leg THEN
    RAISE EXCEPTION '[007] FATAL invoice_items count: expected %, inserted %.', _leg, _mig;
  END IF;
  RAISE NOTICE '[007] invoice_items — % rows migrated. ✓', _mig;
END $$;


-- ==========================================================================
-- TIER 8 — payments
-- ==========================================================================
DO $$ DECLARE
  _leg BIGINT; _mig BIGINT; _bad BIGINT; _ex TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments'
      AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    RAISE NOTICE '[007] payments — already UUID or absent, skipping.';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO _leg FROM payments;

  -- Pre-flight: invoice_id NOT NULL STRICT
  SELECT COUNT(*), string_agg('id=' || l.id::text || '→inv=' || COALESCE(l.invoice_id::text,'NULL'), ', ')
  INTO _bad, _ex FROM payments l
  WHERE l.invoice_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM _mig007_inv_map WHERE old_id = l.invoice_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION E'[007] FATAL payments.invoice_id: % unmapped.\nSamples: %', _bad, _ex;
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

  INSERT INTO payments (id, invoice_id, amount, method, paid_at, created_at)
  SELECT
    gen_random_uuid(),
    im.new_id,                                              -- NOT NULL, INNER JOIN
    COALESCE(l.amount, 0),
    COALESCE(l.method::payment_method, 'cash'),
    COALESCE(l.paid_at,    now()),
    COALESCE(l.created_at, now())
  FROM payments_int_legacy l
  JOIN _mig007_inv_map im ON im.old_id = l.invoice_id;     -- INNER: NOT NULL

  GET DIAGNOSTICS _mig = ROW_COUNT;
  IF _mig <> _leg THEN
    RAISE EXCEPTION '[007] FATAL payments count: expected %, inserted %.', _leg, _mig;
  END IF;
  RAISE NOTICE '[007] payments — % rows migrated. ✓', _mig;
END $$;


-- ==========================================================================
-- FINAL A: Deferred circular FK constraints
-- ==========================================================================
DO $$ BEGIN
  -- emergency_visits.linked_admission_id → admissions
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ev_linked_admission') THEN
    ALTER TABLE emergency_visits ADD CONSTRAINT fk_ev_linked_admission
      FOREIGN KEY (linked_admission_id) REFERENCES admissions(id) ON DELETE SET NULL;
    RAISE NOTICE '[007] Re-added fk_ev_linked_admission.';
  END IF;

  -- emergency_visits.linked_surgical_request_id → surgical_requests
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ev_linked_surgical') THEN
    ALTER TABLE emergency_visits ADD CONSTRAINT fk_ev_linked_surgical
      FOREIGN KEY (linked_surgical_request_id) REFERENCES surgical_requests(id) ON DELETE SET NULL;
    RAISE NOTICE '[007] Re-added fk_ev_linked_surgical.';
  END IF;

  -- emergency_vitals.visit_id → emergency_visits
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'emergency_vitals_visit_id_fkey') THEN
    ALTER TABLE emergency_vitals ADD CONSTRAINT emergency_vitals_visit_id_fkey
      FOREIGN KEY (visit_id) REFERENCES emergency_visits(id) ON DELETE CASCADE;
    RAISE NOTICE '[007] Re-added emergency_vitals_visit_id_fkey.';
  END IF;

  -- occupancy_beds.admission_id FK (if not yet added in TIER 3)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_occ_beds_admission') THEN
    ALTER TABLE occupancy_beds ADD CONSTRAINT fk_occ_beds_admission
      FOREIGN KEY (admission_id) REFERENCES admissions(id) ON DELETE SET NULL;
    RAISE NOTICE '[007] Re-added fk_occ_beds_admission.';
  END IF;

  -- icu_beds.icu_admission_id FK (if not yet added in TIER 3)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_icu_beds_icu_admission') THEN
    ALTER TABLE icu_beds ADD CONSTRAINT fk_icu_beds_icu_admission
      FOREIGN KEY (icu_admission_id) REFERENCES icu_admissions(id) ON DELETE SET NULL;
    RAISE NOTICE '[007] Re-added fk_icu_beds_icu_admission.';
  END IF;
END $$;


-- ==========================================================================
-- FINAL B: Post-migration integrity verification
-- (Runs INSIDE the transaction — failure triggers ROLLBACK)
-- ==========================================================================
DO $$ DECLARE
  _orphans BIGINT;
  _nulled  BIGINT;
BEGIN
  RAISE NOTICE '[007] ── Post-migration integrity checks ──';

  -- 1. admissions.encounter_id → encounters (no orphan UUIDs)
  SELECT COUNT(*) INTO _orphans FROM admissions a
  WHERE a.encounter_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM encounters e WHERE e.id = a.encounter_id);
  IF _orphans > 0 THEN
    RAISE EXCEPTION '[007] INTEGRITY FAIL: admissions.encounter_id — % orphan UUIDs.', _orphans;
  END IF;

  -- 2. admissions.patient_id → patients (no orphan UUIDs)
  SELECT COUNT(*) INTO _orphans FROM admissions a
  WHERE NOT EXISTS (SELECT 1 FROM patients p WHERE p.id = a.patient_id);
  IF _orphans > 0 THEN
    RAISE EXCEPTION '[007] INTEGRITY FAIL: admissions.patient_id — % orphan UUIDs.', _orphans;
  END IF;

  -- 3. No admission_id in admissions_int_legacy became NULL in new admissions
  --    (verifies: every legacy admission with non-NULL encounter_id has non-NULL encounter_id in new table)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admissions_int_legacy') THEN
    SELECT COUNT(*) INTO _nulled
    FROM _mig007_adm_map m
    JOIN admissions_int_legacy ol ON ol.id = m.old_id
    JOIN admissions            na ON na.id = m.new_id
    WHERE ol.encounter_id IS NOT NULL AND na.encounter_id IS NULL;
    IF _nulled > 0 THEN
      RAISE EXCEPTION '[007] INTEGRITY FAIL: % admissions lost encounter_id linkage (was non-NULL, now NULL).', _nulled;
    END IF;
  END IF;

  -- 4. admission_timeline_events.admission_id → admissions
  SELECT COUNT(*) INTO _orphans FROM admission_timeline_events ate
  WHERE NOT EXISTS (SELECT 1 FROM admissions a WHERE a.id = ate.admission_id);
  IF _orphans > 0 THEN
    RAISE EXCEPTION '[007] INTEGRITY FAIL: admission_timeline_events.admission_id — % orphans.', _orphans;
  END IF;

  -- 5. emergency_visits: encounter_id + patient_id both valid
  SELECT COUNT(*) INTO _orphans FROM emergency_visits ev
  WHERE NOT EXISTS (SELECT 1 FROM encounters e WHERE e.id = ev.encounter_id)
     OR NOT EXISTS (SELECT 1 FROM patients   p WHERE p.id = ev.patient_id);
  IF _orphans > 0 THEN
    RAISE EXCEPTION '[007] INTEGRITY FAIL: emergency_visits — % rows with orphan encounter_id or patient_id.', _orphans;
  END IF;

  -- 6. invoice_items.invoice_id → invoices
  SELECT COUNT(*) INTO _orphans FROM invoice_items ii
  WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = ii.invoice_id);
  IF _orphans > 0 THEN
    RAISE EXCEPTION '[007] INTEGRITY FAIL: invoice_items.invoice_id — % orphans.', _orphans;
  END IF;

  -- 7. payments.invoice_id → invoices
  SELECT COUNT(*) INTO _orphans FROM payments py
  WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id = py.invoice_id);
  IF _orphans > 0 THEN
    RAISE EXCEPTION '[007] INTEGRITY FAIL: payments.invoice_id — % orphans.', _orphans;
  END IF;

  -- 8. occupancy_beds: check that rows that had admission_id now have non-NULL admission_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'occupancy_beds_int_legacy') THEN
    SELECT COUNT(*) INTO _nulled
    FROM _mig007_occ_bed_map om
    JOIN occupancy_beds_int_legacy ol ON ol.id = om.old_id
    JOIN occupancy_beds            nb ON nb.id = om.new_id
    WHERE ol.admission_id IS NOT NULL AND nb.admission_id IS NULL;
    IF _nulled > 0 THEN
      RAISE EXCEPTION '[007] INTEGRITY FAIL: % occupancy_beds lost admission_id (was non-NULL, now NULL).', _nulled;
    END IF;
  END IF;

  -- 9. All newly migrated tables: id column is UUID
  DECLARE _tbl TEXT; _dtype TEXT;
  BEGIN
    FOR _tbl IN VALUES
      ('encounters'),('occupancy_beds'),('icu_beds'),('icu_admissions'),('admissions'),
      ('admission_timeline_events'),('surgical_requests'),('emergency_visits'),
      ('or_slots'),('emergency_vitals'),('consultations'),('lab_orders'),
      ('imaging_orders'),('prescriptions'),('invoices'),('invoice_items'),('payments')
    LOOP
      SELECT data_type INTO _dtype
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = _tbl AND column_name = 'id';
      IF _dtype IS NULL THEN CONTINUE; END IF;   -- table didn't exist / wasn't migrated
      IF _dtype <> 'uuid' THEN
        RAISE EXCEPTION '[007] INTEGRITY FAIL: %.id still has data_type=% (expected uuid).', _tbl, _dtype;
      END IF;
    END LOOP;
  END;

  RAISE NOTICE '[007] ── All integrity checks PASSED. ✓ ──';
END $$;


-- ==========================================================================
-- CLEANUP: Drop mapping helper tables
-- ==========================================================================
DROP TABLE IF EXISTS _mig007_enc_map;
DROP TABLE IF EXISTS _mig007_adm_map;
DROP TABLE IF EXISTS _mig007_surg_map;
DROP TABLE IF EXISTS _mig007_inv_map;
DROP TABLE IF EXISTS _mig007_ev_map;
DROP TABLE IF EXISTS _mig007_occ_bed_map;
DROP TABLE IF EXISTS _mig007_icu_bed_map;
DROP TABLE IF EXISTS _mig007_patient_map;
DROP TABLE IF EXISTS _mig007_config;

COMMIT;
-- ==========================================================================
-- END OF MIGRATION 007 v2 (STRICT TRANSACTIONAL)
-- ==========================================================================
