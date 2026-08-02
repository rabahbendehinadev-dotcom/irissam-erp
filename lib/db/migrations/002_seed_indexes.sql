-- =============================================================================
-- Migration 002 — Additional composite indexes for high-volume queries
-- =============================================================================
-- These indexes optimize the most frequent query patterns in the ERP:
--   - Searching patients by name + site
--   - Finding open encounters per patient
--   - Listing active admissions per service/site
--   - Dashboard aggregation queries
-- =============================================================================

BEGIN;

-- Composite: patients active at a site
CREATE INDEX IF NOT EXISTS idx_patients_site_status
  ON patients(site_id, status) WHERE deleted_at IS NULL;

-- Composite: encounters open for a patient
CREATE INDEX IF NOT EXISTS idx_enc_patient_status
  ON encounters(patient_id, status) WHERE deleted_at IS NULL;

-- Composite: admissions active per service
CREATE INDEX IF NOT EXISTS idx_adm_service_status
  ON admissions(service_id, status) WHERE deleted_at IS NULL;

-- Composite: beds available at a site (most used query in occupancy)
CREATE INDEX IF NOT EXISTS idx_occ_beds_site_status
  ON occupancy_beds(site_id, status) WHERE deleted_at IS NULL;

-- Composite: ICU beds available at a site
CREATE INDEX IF NOT EXISTS idx_icu_beds_site_status
  ON icu_beds(site_id, status) WHERE deleted_at IS NULL;

-- Composite: lab orders for an encounter ordered by time
CREATE INDEX IF NOT EXISTS idx_lab_enc_requested
  ON lab_orders(encounter_id, requested_at DESC) WHERE deleted_at IS NULL;

-- Composite: prescriptions for an encounter ordered by time
CREATE INDEX IF NOT EXISTS idx_rx_enc_prescribed
  ON prescriptions(encounter_id, prescribed_at DESC) WHERE deleted_at IS NULL;

-- Composite: emergency visits open at a site
CREATE INDEX IF NOT EXISTS idx_ev_site_status
  ON emergency_visits(encounter_id, status) WHERE deleted_at IS NULL;

-- Composite: appointments upcoming per doctor
CREATE INDEX IF NOT EXISTS idx_appt_doctor_scheduled
  ON appointments(doctor_id, scheduled_at) WHERE deleted_at IS NULL;

-- Composite: consultations per patient ordered by time
CREATE INDEX IF NOT EXISTS idx_cons_patient_scheduled
  ON consultations(patient_id, scheduled_at DESC) WHERE deleted_at IS NULL;

-- Partial index: only active (non-soft-deleted) records for audit search
CREATE INDEX IF NOT EXISTS idx_audit_patient_timestamp
  ON audit_logs(patient_id, timestamp DESC);

-- OR slots conflict detection (overlap queries)
CREATE INDEX IF NOT EXISTS idx_or_slots_room_time
  ON or_slots(or_room_id, start_at, end_at) WHERE deleted_at IS NULL;

-- Medication low stock monitoring
CREATE INDEX IF NOT EXISTS idx_med_low_stock
  ON medications(site_id, quantity, low_stock_threshold) WHERE deleted_at IS NULL;

COMMIT;
