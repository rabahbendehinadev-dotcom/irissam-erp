-- ---------------------------------------------------------------------------
-- Migration 006 — Fix patients_legacy constraint names
-- ---------------------------------------------------------------------------
-- Problem:
--   When the old serial-PK `patients` table was renamed to `patients_legacy`
--   in migration 001, PostgreSQL kept the original explicitly-named UNIQUE
--   constraint `patients_file_number_unique` on the legacy table.
--   PostgreSQL requires index/constraint names to be unique *within the same
--   schema* (not just within a table).  When drizzle-kit push (or a future
--   migration) tries to add `patients_file_number_unique` to the new `patients`
--   table, PostgreSQL throws:
--       ERROR: relation "patients_file_number_unique" already exists
--
-- Fix:
--   Rename the constraint on `patients_legacy` to
--   `patients_legacy_file_number_unique` so the namespace is free.
--   Similarly rename the primary-key index `patients_pkey` →
--   `patients_legacy_pkey` for the same reason (belt-and-suspenders).
--
-- Safety:
--   • Wrapped in DO blocks — each rename is skipped if already done.
--   • No data is touched.
--   • No DROP is used.
--   • Idempotent: running this migration twice produces no error.
-- ---------------------------------------------------------------------------

-- 1. Rename file_number UNIQUE constraint on patients_legacy
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM   pg_constraint c
    JOIN   pg_class      t ON c.conrelid = t.oid
    WHERE  c.conname = 'patients_file_number_unique'
    AND    t.relname = 'patients_legacy'
  ) THEN
    ALTER TABLE patients_legacy
      RENAME CONSTRAINT patients_file_number_unique
                     TO patients_legacy_file_number_unique;
    RAISE NOTICE 'Renamed patients_file_number_unique → patients_legacy_file_number_unique';
  ELSE
    RAISE NOTICE 'patients_file_number_unique on patients_legacy not found — already renamed or table absent, skipping.';
  END IF;
END $$;

-- 2. Rename primary-key constraint on patients_legacy
--    (patients_pkey is kept by PostgreSQL on the legacy table; the new
--     patients table received the auto-incremented name patients_pkey1)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM   pg_constraint c
    JOIN   pg_class      t ON c.conrelid = t.oid
    WHERE  c.conname = 'patients_pkey'
    AND    t.relname = 'patients_legacy'
  ) THEN
    ALTER TABLE patients_legacy
      RENAME CONSTRAINT patients_pkey
                     TO patients_legacy_pkey;
    RAISE NOTICE 'Renamed patients_pkey → patients_legacy_pkey';
  ELSE
    RAISE NOTICE 'patients_pkey on patients_legacy not found — already renamed or table absent, skipping.';
  END IF;
END $$;
