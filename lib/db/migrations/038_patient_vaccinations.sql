-- ─────────────────────────────────────────────────────────────────────────────
-- 038 — Patient vaccinations (carnet vaccinal)
--
-- The Patient Detail "Vaccinations" tab previously displayed hardcoded demo
-- data (identical for every patient). This table stores real per-patient
-- vaccination records; the tab now reads exclusively from it and shows an
-- empty state when the patient has none.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS patient_vaccinations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id           UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  vaccine              TEXT NOT NULL,
  disease              TEXT,
  dose_label           TEXT,
  date_given           DATE,
  next_dose_date       DATE,
  status               TEXT NOT NULL DEFAULT 'administre'
                       CHECK (status IN ('administre', 'planifie', 'en_retard', 'refuse')),
  lot_number           TEXT,
  administered_by_id   UUID,
  administered_by_name TEXT,
  service              TEXT,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by           UUID,
  updated_by           UUID,
  deleted_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_patient_vaccinations_patient
  ON patient_vaccinations (patient_id)
  WHERE deleted_at IS NULL;
