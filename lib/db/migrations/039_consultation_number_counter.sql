-- ─────────────────────────────────────────────────────────────────────────────
-- 039 — Atomic per-year consultation number counter
--
-- Replaces COUNT(*)+1 CONS number generation, which had two live defects:
--   1. Race under concurrent creates (two requests read the same count and
--      both emit the same number — the unique index turns one into a 500).
--   2. Collision with soft-deleted rows: the unique index on
--      consultations.number spans soft-deleted rows, but COUNT(*) excludes
--      them.  Concretely: CONS-2026-00008 exists soft-deleted while the live
--      count is 7 → the very next create would regenerate 00008 and fail.
--
-- Same pattern as patient_mrn_counters (migration 037):
--
--   INSERT INTO consultation_number_counters (year, last_value) VALUES ($1, 1)
--   ON CONFLICT (year) DO UPDATE
--     SET last_value = consultation_number_counters.last_value + 1
--   RETURNING last_value;
--
-- INSERT ... ON CONFLICT DO UPDATE acquires a row-level lock: concurrent
-- transactions serialize on the year row, so each caller receives a distinct
-- value.  Gaps can appear when a transaction rolls back — acceptable.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consultation_number_counters (
  year       INTEGER PRIMARY KEY,
  last_value INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE consultation_number_counters IS
  'Atomic per-year counter for consultation numbers (CONS-YYYY-NNNNN). Incremented via INSERT ... ON CONFLICT DO UPDATE RETURNING — never COUNT(*)+1.';

-- Seed each year''s counter from the highest sequence already in use,
-- INCLUDING soft-deleted rows (the unique index on number spans them).
-- Legacy CON-YYYY-NNNN rows use a different prefix and can never collide
-- with CONS-…, so they are ignored.  On an empty table this inserts nothing
-- and the first increment starts at 1.
INSERT INTO consultation_number_counters (year, last_value)
SELECT
  (substring(number FROM '^CONS-([0-9]{4})-[0-9]+$'))::int      AS year,
  MAX((substring(number FROM '^CONS-[0-9]{4}-([0-9]+)$'))::int) AS last_value
FROM consultations
WHERE number ~ '^CONS-[0-9]{4}-[0-9]+$'
GROUP BY 1
ON CONFLICT (year) DO UPDATE
  SET last_value = GREATEST(consultation_number_counters.last_value, EXCLUDED.last_value);
