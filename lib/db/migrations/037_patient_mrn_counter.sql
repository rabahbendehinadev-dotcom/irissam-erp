-- ─────────────────────────────────────────────────────────────────────────────
-- 037 — Atomic per-year patient number counter
--
-- Replaces COUNT(*)+1 MRN generation (race-prone under concurrent creates)
-- with a row-locked counter table.  The service increments the counter with:
--
--   INSERT INTO patient_mrn_counters (year, last_value) VALUES ($1, 1)
--   ON CONFLICT (year) DO UPDATE
--     SET last_value = patient_mrn_counters.last_value + 1
--   RETURNING last_value;
--
-- INSERT ... ON CONFLICT DO UPDATE acquires a row-level lock: concurrent
-- transactions serialize on the year row, so each caller receives a distinct
-- value.  Gaps can appear when a transaction rolls back — acceptable.
--
-- Each year has its own counter (2026 → 00001…, 2027 restarts at 00001…).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS patient_mrn_counters (
  year       INTEGER PRIMARY KEY,
  last_value INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE patient_mrn_counters IS
  'Atomic per-year counter for patient identity numbers (MRN / MPI / file number). Incremented via INSERT ... ON CONFLICT DO UPDATE RETURNING — never COUNT(*)+1.';

-- Seed each year''s counter from the highest sequence already in use.
-- Only rows matching the canonical format MRN-YYYY-NNNNN are considered;
-- legacy/test rows with other formats are ignored.  On an empty database
-- this inserts nothing and the first increment starts at 1.
INSERT INTO patient_mrn_counters (year, last_value)
SELECT
  (substring(mrn FROM '^MRN-([0-9]{4})-[0-9]+$'))::int          AS year,
  MAX((substring(mrn FROM '^MRN-[0-9]{4}-([0-9]+)$'))::int)     AS last_value
FROM patients
WHERE mrn ~ '^MRN-[0-9]{4}-[0-9]+$'
GROUP BY 1
ON CONFLICT (year) DO UPDATE
  SET last_value = GREATEST(patient_mrn_counters.last_value, EXCLUDED.last_value);
