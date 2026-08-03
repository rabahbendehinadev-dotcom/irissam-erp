-- ============================================================================
-- Migration 017 — Biomedical Management Module
-- 22 tables, enums, triggers, sequences, views
-- Idempotent (IF NOT EXISTS / ON CONFLICT DO NOTHING)
-- ============================================================================
BEGIN;

-- ── Enums ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE biomed_equipment_status AS ENUM (
    'actif','en_maintenance','hors_service','retire','en_attente_installation','reserve'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE biomed_criticality AS ENUM ('critique','haute','normale','faible');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE biomed_work_order_status AS ENUM (
    'ouvert','en_cours','en_attente_pieces','suspendu','termine','annule'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE biomed_work_order_type AS ENUM (
    'preventive','corrective','urgente','inspection','calibration','installation','autre'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE biomed_calibration_status AS ENUM (
    'planifiee','en_cours','conforme','non_conforme','a_refaire','annulee'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE biomed_incident_status AS ENUM (
    'declare','en_analyse','en_correction','valide','clos'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE biomed_incident_severity AS ENUM ('critique','majeur','modere','mineur');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE biomed_contract_status AS ENUM (
    'actif','expire','resilie','en_renouvellement','brouillon'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE biomed_disposal_status AS ENUM (
    'propose','approuve','en_cours','finalise','annule'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE biomed_disposal_method AS ENUM (
    'vente','don','destruction','restitution_fournisseur','reprise','autre'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE biomed_inspection_result AS ENUM ('conforme','non_conforme','a_surveiller');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Sequences ─────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS biomed_equipment_seq     START 1001;
CREATE SEQUENCE IF NOT EXISTS biomed_work_order_seq    START 3001;
CREATE SEQUENCE IF NOT EXISTS biomed_calibration_seq   START 5001;
CREATE SEQUENCE IF NOT EXISTS biomed_incident_seq      START 7001;

-- ── 1. biomedical_categories ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biomedical_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(20)  UNIQUE NOT NULL,
  name          VARCHAR(100) NOT NULL,
  description   TEXT,
  color         VARCHAR(7)   DEFAULT '#6366F1',
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_biomed_cat_active ON biomedical_categories(is_active);

-- ── 2. biomedical_manufacturers ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biomedical_manufacturers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(20)  UNIQUE NOT NULL,
  name          VARCHAR(150) NOT NULL,
  country       VARCHAR(80),
  contact_name  VARCHAR(100),
  phone         VARCHAR(30),
  email         VARCHAR(120),
  website       VARCHAR(200),
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  notes         TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── 3. biomedical_models ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biomedical_models (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id UUID         NOT NULL REFERENCES biomedical_manufacturers(id),
  name            VARCHAR(150) NOT NULL,
  reference       VARCHAR(100),
  category_id     UUID         REFERENCES biomedical_categories(id),
  description     TEXT,
  expected_life_years SMALLINT,
  maintenance_interval_days INT,
  calibration_interval_days INT,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE(manufacturer_id, name)
);

-- ── 4. biomedical_suppliers ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biomedical_suppliers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(20)  UNIQUE NOT NULL,
  name          VARCHAR(150) NOT NULL,
  address       TEXT,
  city          VARCHAR(80),
  phone         VARCHAR(30),
  email         VARCHAR(120),
  contact_name  VARCHAR(100),
  payment_terms_days INT DEFAULT 30,
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  notes         TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── 5. biomedical_locations ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biomedical_locations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(20)  UNIQUE NOT NULL,
  name          VARCHAR(150) NOT NULL,
  department    VARCHAR(100),
  building      VARCHAR(80),
  floor         VARCHAR(20),
  room          VARCHAR(20),
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
INSERT INTO biomedical_locations (code, name, department) VALUES
  ('BLK','Bloc Opératoire','Chirurgie'),
  ('REA','Réanimation','Réanimation'),
  ('URG','Urgences','Urgences'),
  ('LAB','Laboratoire','Biologie'),
  ('IMG','Imagerie','Radiologie'),
  ('HOSP','Hospitalisation','Médecine Interne'),
  ('PHARM','Pharmacie','Pharmacie'),
  ('CARD','Cardiologie','Médecine Spécialisée')
ON CONFLICT (code) DO NOTHING;

-- ── 6. biomedical_equipment ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biomedical_equipment (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_code     VARCHAR(30)  UNIQUE NOT NULL DEFAULT 'EQ-' || nextval('biomed_equipment_seq'),
  barcode           VARCHAR(50),
  qr_code           VARCHAR(50),
  serial_number     VARCHAR(100),
  name              VARCHAR(200) NOT NULL,
  category_id       UUID         REFERENCES biomedical_categories(id),
  model_id          UUID         REFERENCES biomedical_models(id),
  manufacturer_id   UUID         REFERENCES biomedical_manufacturers(id),
  supplier_id       UUID         REFERENCES biomedical_suppliers(id),
  location_id       UUID         REFERENCES biomedical_locations(id),
  department        VARCHAR(100),
  responsible_user_id UUID       REFERENCES users(id),
  status            biomed_equipment_status NOT NULL DEFAULT 'en_attente_installation',
  criticality       biomed_criticality      NOT NULL DEFAULT 'normale',
  purchase_date     DATE,
  installation_date DATE,
  commissioning_date DATE,
  warranty_end_date DATE,
  expected_life_years SMALLINT,
  purchase_price    NUMERIC(14,2),
  current_value     NUMERIC(14,2),
  maintenance_interval_days INT,
  calibration_interval_days INT,
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  last_calibration_date DATE,
  next_calibration_date DATE,
  calibration_expired BOOLEAN NOT NULL DEFAULT FALSE,
  notes             TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  version           INT NOT NULL DEFAULT 1,
  created_by        UUID REFERENCES users(id),
  updated_by        UUID REFERENCES users(id),
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_biomed_eq_status     ON biomedical_equipment(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_biomed_eq_location   ON biomedical_equipment(location_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_biomed_eq_category   ON biomedical_equipment(category_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_biomed_eq_next_maint ON biomedical_equipment(next_maintenance_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_biomed_eq_next_calib ON biomedical_equipment(next_calibration_date) WHERE deleted_at IS NULL;

-- ── 7. biomedical_installations ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biomedical_installations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id    UUID NOT NULL REFERENCES biomedical_equipment(id),
  location_id     UUID REFERENCES biomedical_locations(id),
  installed_by    UUID REFERENCES users(id),
  installation_date DATE NOT NULL,
  commissioning_date DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 8. biomedical_maintenance_plans ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS biomedical_maintenance_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id    UUID NOT NULL REFERENCES biomedical_equipment(id),
  name            VARCHAR(150) NOT NULL,
  plan_type       VARCHAR(30)  NOT NULL DEFAULT 'preventive',
  frequency_days  INT          NOT NULL,
  tasks           JSONB        NOT NULL DEFAULT '[]',
  assigned_to     UUID         REFERENCES users(id),
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  last_run_date   DATE,
  next_run_date   DATE,
  created_by      UUID         REFERENCES users(id),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── 9. biomedical_work_orders ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biomedical_work_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number    VARCHAR(30)  UNIQUE NOT NULL DEFAULT 'WO-' || nextval('biomed_work_order_seq'),
  equipment_id    UUID         NOT NULL REFERENCES biomedical_equipment(id),
  order_type      biomed_work_order_type NOT NULL DEFAULT 'corrective',
  status          biomed_work_order_status NOT NULL DEFAULT 'ouvert',
  priority        biomed_criticality NOT NULL DEFAULT 'normale',
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  assigned_to     UUID         REFERENCES users(id),
  requested_by    UUID         REFERENCES users(id),
  plan_id         UUID         REFERENCES biomedical_maintenance_plans(id),
  scheduled_date  DATE,
  start_date      TIMESTAMPTZ,
  end_date        TIMESTAMPTZ,
  estimated_hours NUMERIC(6,2),
  actual_hours    NUMERIC(6,2),
  labor_cost      NUMERIC(12,2) DEFAULT 0,
  parts_cost      NUMERIC(12,2) DEFAULT 0,
  total_cost      NUMERIC(12,2) GENERATED ALWAYS AS (COALESCE(labor_cost,0) + COALESCE(parts_cost,0)) STORED,
  resolution_notes TEXT,
  closed_by       UUID         REFERENCES users(id),
  closed_at       TIMESTAMPTZ,
  created_by      UUID         REFERENCES users(id),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_biomed_wo_equipment ON biomedical_work_orders(equipment_id);
CREATE INDEX IF NOT EXISTS idx_biomed_wo_status    ON biomedical_work_orders(status);
CREATE INDEX IF NOT EXISTS idx_biomed_wo_assigned  ON biomedical_work_orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_biomed_wo_sched     ON biomedical_work_orders(scheduled_date);

-- ── 10. biomedical_work_order_tasks ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS biomedical_work_order_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id   UUID NOT NULL REFERENCES biomedical_work_orders(id) ON DELETE CASCADE,
  task_name       VARCHAR(200) NOT NULL,
  description     TEXT,
  is_completed    BOOLEAN NOT NULL DEFAULT FALSE,
  completed_by    UUID REFERENCES users(id),
  completed_at    TIMESTAMPTZ,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 11. biomedical_preventive_maintenance ─────────────────────────────────
CREATE TABLE IF NOT EXISTS biomedical_preventive_maintenance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id   UUID NOT NULL REFERENCES biomedical_work_orders(id) ON DELETE CASCADE,
  equipment_id    UUID NOT NULL REFERENCES biomedical_equipment(id),
  performed_by    UUID REFERENCES users(id),
  performed_date  DATE NOT NULL,
  next_date       DATE,
  checklist       JSONB NOT NULL DEFAULT '[]',
  findings        TEXT,
  result          VARCHAR(30) DEFAULT 'conforme',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 12. biomedical_corrective_maintenance ─────────────────────────────────
CREATE TABLE IF NOT EXISTS biomedical_corrective_maintenance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id   UUID NOT NULL REFERENCES biomedical_work_orders(id) ON DELETE CASCADE,
  equipment_id    UUID NOT NULL REFERENCES biomedical_equipment(id),
  failure_type    VARCHAR(60),
  root_cause      TEXT,
  action_taken    TEXT,
  parts_replaced  JSONB DEFAULT '[]',
  performed_by    UUID REFERENCES users(id),
  performed_date  DATE NOT NULL,
  downtime_hours  NUMERIC(6,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 13. biomedical_calibrations ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biomedical_calibrations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calibration_number VARCHAR(30) UNIQUE NOT NULL DEFAULT 'CAL-' || nextval('biomed_calibration_seq'),
  equipment_id      UUID NOT NULL REFERENCES biomedical_equipment(id),
  status            biomed_calibration_status NOT NULL DEFAULT 'planifiee',
  calibration_type  VARCHAR(50) DEFAULT 'interne',
  performed_by      UUID REFERENCES users(id),
  external_lab      VARCHAR(150),
  planned_date      DATE NOT NULL,
  performed_date    DATE,
  next_due_date     DATE,
  reference_standards JSONB DEFAULT '[]',
  measurements      JSONB DEFAULT '[]',
  result            VARCHAR(30),
  uncertainty       NUMERIC(10,4),
  tolerance_percent NUMERIC(6,2),
  is_compliant      BOOLEAN,
  notes             TEXT,
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_biomed_cal_equip  ON biomedical_calibrations(equipment_id);
CREATE INDEX IF NOT EXISTS idx_biomed_cal_status ON biomedical_calibrations(status);
CREATE INDEX IF NOT EXISTS idx_biomed_cal_due    ON biomedical_calibrations(next_due_date);

-- ── 14. biomedical_calibration_certificates ───────────────────────────────
CREATE TABLE IF NOT EXISTS biomedical_calibration_certificates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calibration_id   UUID NOT NULL REFERENCES biomedical_calibrations(id),
  certificate_number VARCHAR(60) NOT NULL,
  issued_date      DATE NOT NULL,
  valid_until      DATE,
  issued_by        VARCHAR(150),
  file_url         TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 15. biomedical_spare_parts ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biomedical_spare_parts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(30)  UNIQUE NOT NULL,
  name            VARCHAR(150) NOT NULL,
  reference       VARCHAR(100),
  manufacturer_id UUID         REFERENCES biomedical_manufacturers(id),
  supplier_id     UUID         REFERENCES biomedical_suppliers(id),
  compatible_models JSONB DEFAULT '[]',
  quantity_on_hand NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_quantity    NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit_cost       NUMERIC(12,2),
  storage_location VARCHAR(100),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 16. biomedical_spare_part_movements ──────────────────────────────────
CREATE TABLE IF NOT EXISTS biomedical_spare_part_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spare_part_id   UUID NOT NULL REFERENCES biomedical_spare_parts(id),
  work_order_id   UUID REFERENCES biomedical_work_orders(id),
  movement_type   VARCHAR(20) NOT NULL CHECK (movement_type IN ('entree','sortie','ajustement')),
  quantity        NUMERIC(10,2) NOT NULL,
  unit_cost       NUMERIC(12,2),
  notes           TEXT,
  performed_by    UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 17. biomedical_equipment_failures ────────────────────────────────────
CREATE TABLE IF NOT EXISTS biomedical_equipment_failures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id    UUID NOT NULL REFERENCES biomedical_equipment(id),
  work_order_id   UUID REFERENCES biomedical_work_orders(id),
  failure_date    TIMESTAMPTZ NOT NULL DEFAULT now(),
  failure_type    VARCHAR(80),
  description     TEXT NOT NULL,
  severity        biomed_incident_severity NOT NULL DEFAULT 'modere',
  root_cause      TEXT,
  resolution      TEXT,
  downtime_start  TIMESTAMPTZ,
  downtime_end    TIMESTAMPTZ,
  downtime_hours  NUMERIC(6,2) GENERATED ALWAYS AS (
    CASE WHEN downtime_end IS NOT NULL AND downtime_start IS NOT NULL
    THEN EXTRACT(EPOCH FROM (downtime_end - downtime_start))/3600
    ELSE NULL END
  ) STORED,
  reported_by     UUID REFERENCES users(id),
  resolved_by     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_biomed_fail_equip ON biomedical_equipment_failures(equipment_id);

-- ── 18. biomedical_equipment_documents ───────────────────────────────────
CREATE TABLE IF NOT EXISTS biomedical_equipment_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id    UUID NOT NULL REFERENCES biomedical_equipment(id),
  doc_type        VARCHAR(50) NOT NULL,
  title           VARCHAR(200) NOT NULL,
  file_url        TEXT,
  file_size_bytes INT,
  uploaded_by     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 19. biomedical_contracts ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biomedical_contracts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number VARCHAR(40) UNIQUE NOT NULL,
  supplier_id     UUID NOT NULL REFERENCES biomedical_suppliers(id),
  contract_type   VARCHAR(50) NOT NULL DEFAULT 'maintenance',
  status          biomed_contract_status NOT NULL DEFAULT 'brouillon',
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  value           NUMERIC(14,2),
  currency        CHAR(3) DEFAULT 'DZD',
  scope           TEXT,
  sla_response_hours INT,
  sla_resolution_hours INT,
  covered_equipment JSONB DEFAULT '[]',
  renewal_reminder_days INT DEFAULT 30,
  notes           TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_biomed_contract_status ON biomedical_contracts(status);
CREATE INDEX IF NOT EXISTS idx_biomed_contract_end    ON biomedical_contracts(end_date);

-- ── 20. biomedical_incidents ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biomedical_incidents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_number     VARCHAR(30) UNIQUE NOT NULL DEFAULT 'INC-' || nextval('biomed_incident_seq'),
  equipment_id        UUID REFERENCES biomedical_equipment(id),
  status              biomed_incident_status   NOT NULL DEFAULT 'declare',
  severity            biomed_incident_severity NOT NULL DEFAULT 'modere',
  title               VARCHAR(200) NOT NULL,
  description         TEXT NOT NULL,
  incident_date       TIMESTAMPTZ NOT NULL DEFAULT now(),
  declared_by         UUID REFERENCES users(id),
  analyst             UUID REFERENCES users(id),
  root_cause          TEXT,
  corrective_action   TEXT,
  validated_by        UUID REFERENCES users(id),
  validated_at        TIMESTAMPTZ,
  closed_by           UUID REFERENCES users(id),
  closed_at           TIMESTAMPTZ,
  patient_impact      BOOLEAN DEFAULT FALSE,
  patient_safety_alert BOOLEAN DEFAULT FALSE,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_biomed_inc_equip  ON biomedical_incidents(equipment_id);
CREATE INDEX IF NOT EXISTS idx_biomed_inc_status ON biomedical_incidents(status);

-- ── 21. biomedical_inspections ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biomedical_inspections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id    UUID NOT NULL REFERENCES biomedical_equipment(id),
  inspected_by    UUID REFERENCES users(id),
  inspection_date DATE NOT NULL,
  next_due_date   DATE,
  inspection_type VARCHAR(60) DEFAULT 'reglementaire',
  checklist       JSONB NOT NULL DEFAULT '[]',
  result          biomed_inspection_result NOT NULL DEFAULT 'conforme',
  findings        TEXT,
  recommendations TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_biomed_insp_equip ON biomedical_inspections(equipment_id);

-- ── 22. biomedical_disposals ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biomedical_disposals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id    UUID NOT NULL REFERENCES biomedical_equipment(id),
  status          biomed_disposal_status NOT NULL DEFAULT 'propose',
  method          biomed_disposal_method NOT NULL DEFAULT 'autre',
  proposed_by     UUID REFERENCES users(id),
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  disposal_date   DATE,
  sale_value      NUMERIC(12,2),
  reason          TEXT NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Triggers: updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_biomed_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'biomedical_categories','biomedical_manufacturers','biomedical_models',
    'biomedical_suppliers','biomedical_locations','biomedical_equipment',
    'biomedical_maintenance_plans','biomedical_work_orders','biomedical_calibrations',
    'biomedical_spare_parts','biomedical_equipment_failures','biomedical_contracts',
    'biomedical_incidents','biomedical_disposals'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_' || t || '_updated_at') THEN
      EXECUTE format(
        'CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON %1$s FOR EACH ROW EXECUTE FUNCTION update_biomed_timestamp()',
        t
      );
    END IF;
  END LOOP;
END $$;

-- ── Trigger: block out-of-service equipment from being used ───────────────
CREATE OR REPLACE FUNCTION check_biomed_equipment_available()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE _status biomed_equipment_status;
BEGIN
  SELECT status INTO _status FROM biomedical_equipment WHERE id = NEW.equipment_id;
  IF _status = 'hors_service' THEN
    RAISE EXCEPTION 'Équipement % est hors service — affectation interdite', NEW.equipment_id;
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_biomed_wo_check_status') THEN
    CREATE TRIGGER trg_biomed_wo_check_status
      BEFORE INSERT ON biomedical_work_orders
      FOR EACH ROW WHEN (NEW.order_type NOT IN ('corrective','urgente'))
      EXECUTE FUNCTION check_biomed_equipment_available();
  END IF;
END $$;

-- ── Trigger: mark equipment calibration_expired ───────────────────────────
CREATE OR REPLACE FUNCTION biomed_update_calibration_expiry()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE biomedical_equipment
  SET calibration_expired = (
    next_calibration_date IS NOT NULL AND next_calibration_date < CURRENT_DATE
  )
  WHERE id = COALESCE(NEW.equipment_id, OLD.equipment_id);
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_biomed_cal_expiry') THEN
    CREATE TRIGGER trg_biomed_cal_expiry
      AFTER INSERT OR UPDATE ON biomedical_calibrations
      FOR EACH ROW EXECUTE FUNCTION biomed_update_calibration_expiry();
  END IF;
END $$;

-- ── View: equipment overview ───────────────────────────────────────────────
CREATE OR REPLACE VIEW v_biomed_equipment_overview AS
SELECT
  e.id, e.internal_code, e.name, e.status, e.criticality, e.department,
  c.name AS category_name, c.color AS category_color,
  m.name AS manufacturer_name,
  mo.name AS model_name,
  l.name AS location_name,
  e.next_maintenance_date, e.next_calibration_date, e.calibration_expired,
  e.purchase_price, e.current_value,
  CASE
    WHEN e.status = 'hors_service' THEN 'danger'
    WHEN e.calibration_expired THEN 'warning'
    WHEN e.next_maintenance_date < CURRENT_DATE THEN 'overdue'
    WHEN e.next_maintenance_date <= CURRENT_DATE + 7 THEN 'soon'
    ELSE 'ok'
  END AS health_status
FROM biomedical_equipment e
LEFT JOIN biomedical_categories  c  ON c.id = e.category_id
LEFT JOIN biomedical_manufacturers m ON m.id = e.manufacturer_id
LEFT JOIN biomedical_models       mo ON mo.id = e.model_id
LEFT JOIN biomedical_locations    l  ON l.id = e.location_id
WHERE e.deleted_at IS NULL;

-- ── View: dashboard KPIs ───────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_biomed_dashboard_kpis AS
SELECT
  COUNT(*)                                                        AS total_equipment,
  COUNT(*) FILTER (WHERE status = 'actif')                        AS active_count,
  COUNT(*) FILTER (WHERE status = 'hors_service')                 AS out_of_service,
  COUNT(*) FILTER (WHERE status = 'en_maintenance')               AS in_maintenance,
  COUNT(*) FILTER (WHERE calibration_expired)                     AS calibration_expired_count,
  COUNT(*) FILTER (WHERE next_maintenance_date <= CURRENT_DATE AND status='actif') AS maintenance_overdue,
  COUNT(*) FILTER (WHERE next_maintenance_date = CURRENT_DATE)    AS maintenance_today,
  COALESCE(SUM(current_value),0)                                  AS total_asset_value
FROM biomedical_equipment
WHERE deleted_at IS NULL AND is_active;

-- ── Seed: default categories ───────────────────────────────────────────────
INSERT INTO biomedical_categories (code, name, color) VALUES
  ('IMG_MED','Imagerie Médicale','#3B82F6'),
  ('MONIT'  ,'Monitoring','#10B981'),
  ('CHIR'   ,'Chirurgie','#F59E0B'),
  ('LABO'   ,'Laboratoire','#8B5CF6'),
  ('VITAL'  ,'Soins Intensifs','#EF4444'),
  ('DIAGO'  ,'Diagnostic','#06B6D4'),
  ('ASSIST' ,'Assistance Respiratoire','#EC4899'),
  ('STERIL' ,'Stérilisation','#64748B')
ON CONFLICT (code) DO NOTHING;

COMMIT;
