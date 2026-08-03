-- =============================================================================
-- Migration 019: Quality Management & Risk Management (Enterprise Grade)
-- Idempotent — uses IF NOT EXISTS, ON CONFLICT DO NOTHING, DO $$ BEGIN...END $$
-- =============================================================================

BEGIN;

-- ── Sequences ─────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS quality_incident_seq   START 1001;
CREATE SEQUENCE IF NOT EXISTS quality_nc_seq         START 2001;
CREATE SEQUENCE IF NOT EXISTS quality_capa_seq       START 3001;
CREATE SEQUENCE IF NOT EXISTS quality_risk_seq       START 4001;
CREATE SEQUENCE IF NOT EXISTS quality_audit_seq      START 5001;
CREATE SEQUENCE IF NOT EXISTS quality_doc_seq        START 6001;
CREATE SEQUENCE IF NOT EXISTS quality_indicator_seq  START 7001;
CREATE SEQUENCE IF NOT EXISTS quality_checklist_seq  START 8001;

-- ── Enums ─────────────────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE quality_incident_status AS ENUM (
  'declare','qualification','investigation','analyse','cause_racine','correction','validation','clos'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE quality_incident_type AS ENUM (
  'evenement_indesirable','presque_accident','dysfonctionnement','plainte','autre'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE quality_severity AS ENUM (
  'mineur','modere','grave','critique'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE quality_nc_status AS ENUM (
  'detectee','analysee','corrigee','validee','archivee'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE quality_nc_type AS ENUM (
  'processus','produit','service','systeme','documentation','reglementaire','autre'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE quality_capa_status AS ENUM (
  'ouverte','en_cours','en_verification','efficace','inefficace','annulee'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE quality_capa_type AS ENUM (
  'corrective','preventive'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE quality_risk_status AS ENUM (
  'identifie','evalue','traitement','accepte','surveille','clos'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE quality_risk_category AS ENUM (
  'clinique','organisationnel','financier','legal','securite','it','infrastructure','autre'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE quality_audit_status AS ENUM (
  'planifie','en_cours','rapport_en_attente','clos','annule'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE quality_audit_type AS ENUM (
  'interne','externe','certification','surveillance','suivi'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE quality_finding_type AS ENUM (
  'non_conformite','observation','opportunite_amelioration','bonne_pratique'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE quality_doc_status AS ENUM (
  'brouillon','en_revision','en_approbation','approuve','publie','archive','expire'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE quality_doc_type AS ENUM (
  'procedure','protocole','instruction','formulaire','enregistrement','politique','charte','autre'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE quality_approval_status AS ENUM (
  'en_attente','approuve','rejete'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE quality_indicator_trend AS ENUM (
  'amelioration','stable','degradation'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── quality_incidents ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_incidents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference       TEXT NOT NULL UNIQUE DEFAULT 'INC-' || nextval('quality_incident_seq'),
  title           TEXT NOT NULL,
  description     TEXT,
  incident_type   quality_incident_type NOT NULL DEFAULT 'evenement_indesirable',
  severity        quality_severity NOT NULL DEFAULT 'modere',
  status          quality_incident_status NOT NULL DEFAULT 'declare',
  occurrence_date TIMESTAMPTZ NOT NULL,
  location        TEXT,
  department      TEXT,
  -- source module linkage (all nullable — incidents can be standalone)
  patient_id      UUID REFERENCES patients(id) ON DELETE SET NULL,
  admission_id    UUID REFERENCES admissions(id) ON DELETE SET NULL,
  source_module   TEXT,   -- 'patients','admissions','urgences','bloc','biomed', etc.
  source_ref_id   UUID,   -- id in the source module
  -- workflow
  declared_by     UUID,
  declared_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  qualified_by    UUID,
  qualified_at    TIMESTAMPTZ,
  investigated_by UUID,
  investigated_at TIMESTAMPTZ,
  analysed_by     UUID,
  analysed_at     TIMESTAMPTZ,
  root_cause      TEXT,
  corrective_summary TEXT,
  validated_by    UUID,
  validated_at    TIMESTAMPTZ,
  closed_by       UUID,
  closed_at       TIMESTAMPTZ,
  -- reporting
  immediate_action TEXT,
  recommendations  TEXT,
  lessons_learned  TEXT,
  is_sentinel_event BOOLEAN NOT NULL DEFAULT false,
  notified_authority BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── quality_non_conformities ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_non_conformities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference       TEXT NOT NULL UNIQUE DEFAULT 'NC-' || nextval('quality_nc_seq'),
  title           TEXT NOT NULL,
  description     TEXT,
  nc_type         quality_nc_type NOT NULL DEFAULT 'processus',
  severity        quality_severity NOT NULL DEFAULT 'modere',
  status          quality_nc_status NOT NULL DEFAULT 'detectee',
  detected_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  detected_by     UUID,
  department      TEXT,
  process_ref     TEXT,
  standard_clause TEXT,   -- ISO 9001 clause reference
  -- source linkage
  incident_id     UUID REFERENCES quality_incidents(id) ON DELETE SET NULL,
  audit_finding_id UUID,  -- FK added after quality_audit_findings
  -- workflow
  analysed_by     UUID,
  analysed_at     TIMESTAMPTZ,
  root_cause      TEXT,
  immediate_correction TEXT,
  corrected_by    UUID,
  corrected_at    TIMESTAMPTZ,
  validated_by    UUID,
  validated_at    TIMESTAMPTZ,
  archived_by     UUID,
  archived_at     TIMESTAMPTZ,
  due_date        DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── quality_corrective_actions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_corrective_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference       TEXT NOT NULL UNIQUE DEFAULT 'CA-' || nextval('quality_capa_seq'),
  title           TEXT NOT NULL,
  description     TEXT,
  capa_type       quality_capa_type NOT NULL DEFAULT 'corrective',
  status          quality_capa_status NOT NULL DEFAULT 'ouverte',
  -- source
  incident_id     UUID REFERENCES quality_incidents(id) ON DELETE SET NULL,
  nc_id           UUID REFERENCES quality_non_conformities(id) ON DELETE SET NULL,
  risk_id         UUID,   -- FK added after quality_risk_register
  audit_finding_id UUID,
  -- ownership
  responsible_id  UUID,
  responsible_name TEXT,
  department      TEXT,
  -- dates
  due_date        DATE NOT NULL,
  opened_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  verified_at     TIMESTAMPTZ,
  -- verification
  verified_by     UUID,
  effectiveness_verified BOOLEAN NOT NULL DEFAULT false,
  effectiveness_notes TEXT,
  -- cost
  estimated_cost  NUMERIC(12,2),
  actual_cost     NUMERIC(12,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── quality_preventive_actions (same structure, separate table) ───────────
CREATE TABLE IF NOT EXISTS quality_preventive_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference       TEXT NOT NULL UNIQUE DEFAULT 'PA-' || nextval('quality_capa_seq'),
  title           TEXT NOT NULL,
  description     TEXT,
  capa_type       quality_capa_type NOT NULL DEFAULT 'preventive',
  status          quality_capa_status NOT NULL DEFAULT 'ouverte',
  risk_id         UUID,
  responsible_id  UUID,
  responsible_name TEXT,
  department      TEXT,
  due_date        DATE NOT NULL,
  opened_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  verified_at     TIMESTAMPTZ,
  verified_by     UUID,
  effectiveness_verified BOOLEAN NOT NULL DEFAULT false,
  effectiveness_notes TEXT,
  estimated_cost  NUMERIC(12,2),
  actual_cost     NUMERIC(12,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── quality_risk_register ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_risk_register (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference       TEXT NOT NULL UNIQUE DEFAULT 'RSK-' || nextval('quality_risk_seq'),
  title           TEXT NOT NULL,
  description     TEXT,
  category        quality_risk_category NOT NULL DEFAULT 'organisationnel',
  status          quality_risk_status NOT NULL DEFAULT 'identifie',
  department      TEXT,
  process_ref     TEXT,
  -- initial assessment
  probability     SMALLINT NOT NULL DEFAULT 3 CHECK (probability BETWEEN 1 AND 5),
  impact          SMALLINT NOT NULL DEFAULT 3 CHECK (impact BETWEEN 1 AND 5),
  criticality     SMALLINT GENERATED ALWAYS AS (probability * impact) STORED,
  -- residual (after controls)
  residual_probability SMALLINT CHECK (residual_probability BETWEEN 1 AND 5),
  residual_impact      SMALLINT CHECK (residual_impact BETWEEN 1 AND 5),
  residual_criticality SMALLINT GENERATED ALWAYS AS (
    CASE WHEN residual_probability IS NOT NULL AND residual_impact IS NOT NULL
         THEN residual_probability * residual_impact ELSE NULL END
  ) STORED,
  -- treatment
  treatment_strategy TEXT,  -- accepter, eviter, reduire, transferer
  controls_existing  TEXT,
  controls_planned   TEXT,
  owner_id           UUID,
  owner_name         TEXT,
  -- dates
  identified_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  next_review_date   DATE,
  last_reviewed_at   TIMESTAMPTZ,
  accepted_by        UUID,
  accepted_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── quality_risk_assessments ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_risk_assessments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id         UUID NOT NULL REFERENCES quality_risk_register(id) ON DELETE CASCADE,
  assessed_by     UUID,
  assessed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  probability     SMALLINT NOT NULL CHECK (probability BETWEEN 1 AND 5),
  impact          SMALLINT NOT NULL CHECK (impact BETWEEN 1 AND 5),
  criticality     SMALLINT GENERATED ALWAYS AS (probability * impact) STORED,
  justification   TEXT,
  recommended_actions TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── quality_audits ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_audits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference       TEXT NOT NULL UNIQUE DEFAULT 'AUD-' || nextval('quality_audit_seq'),
  title           TEXT NOT NULL,
  audit_type      quality_audit_type NOT NULL DEFAULT 'interne',
  status          quality_audit_status NOT NULL DEFAULT 'planifie',
  scope           TEXT,
  objectives      TEXT,
  standard_ref    TEXT,  -- ISO 9001:2015, HAS, etc.
  department      TEXT,
  -- team
  lead_auditor_id   UUID,
  lead_auditor_name TEXT,
  -- dates
  planned_start_date DATE NOT NULL,
  planned_end_date   DATE NOT NULL,
  actual_start_date  DATE,
  actual_end_date    DATE,
  -- results
  overall_result  TEXT,   -- conforme, non_conforme, observations
  nc_count        INTEGER NOT NULL DEFAULT 0,
  observation_count INTEGER NOT NULL DEFAULT 0,
  -- report
  executive_summary TEXT,
  report_date       DATE,
  report_approved_by UUID,
  report_approved_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── quality_audit_findings ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_audit_findings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id        UUID NOT NULL REFERENCES quality_audits(id) ON DELETE CASCADE,
  finding_type    quality_finding_type NOT NULL DEFAULT 'observation',
  title           TEXT NOT NULL,
  description     TEXT,
  clause_ref      TEXT,
  evidence        TEXT,
  department      TEXT,
  -- linked actions
  nc_id           UUID REFERENCES quality_non_conformities(id) ON DELETE SET NULL,
  capa_id         UUID REFERENCES quality_corrective_actions(id) ON DELETE SET NULL,
  -- status
  is_closed       BOOLEAN NOT NULL DEFAULT false,
  closed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- add FK from non_conformities to audit_findings (deferred)
ALTER TABLE quality_non_conformities
  ADD COLUMN IF NOT EXISTS audit_finding_id_fk UUID REFERENCES quality_audit_findings(id) ON DELETE SET NULL;

-- add FK from capa to risk
ALTER TABLE quality_corrective_actions
  ADD COLUMN IF NOT EXISTS risk_id_fk UUID REFERENCES quality_risk_register(id) ON DELETE SET NULL;
ALTER TABLE quality_preventive_actions
  ADD COLUMN IF NOT EXISTS risk_id_fk UUID REFERENCES quality_risk_register(id) ON DELETE SET NULL;

-- ── quality_documents ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference       TEXT NOT NULL UNIQUE DEFAULT 'DOC-' || nextval('quality_doc_seq'),
  title           TEXT NOT NULL,
  doc_type        quality_doc_type NOT NULL DEFAULT 'procedure',
  status          quality_doc_status NOT NULL DEFAULT 'brouillon',
  department      TEXT,
  process_ref     TEXT,
  current_version TEXT NOT NULL DEFAULT '1.0',
  -- owner
  owner_id        UUID,
  owner_name      TEXT,
  -- dates
  created_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  review_date     DATE,
  expiry_date     DATE,
  published_at    TIMESTAMPTZ,
  archived_at     TIMESTAMPTZ,
  -- content
  summary         TEXT,
  keywords        TEXT[],
  is_controlled   BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── quality_document_versions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_document_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID NOT NULL REFERENCES quality_documents(id) ON DELETE CASCADE,
  version         TEXT NOT NULL,
  changes_summary TEXT,
  content         TEXT,
  file_path       TEXT,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, version)
);

-- ── quality_document_approvals ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_document_approvals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID NOT NULL REFERENCES quality_documents(id) ON DELETE CASCADE,
  version         TEXT NOT NULL,
  approver_id     UUID NOT NULL,
  approver_name   TEXT,
  approver_role   TEXT,
  status          quality_approval_status NOT NULL DEFAULT 'en_attente',
  comments        TEXT,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── quality_committees ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_committees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── quality_meetings ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_meetings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id    UUID REFERENCES quality_committees(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  meeting_date    DATE NOT NULL,
  location        TEXT,
  status          TEXT NOT NULL DEFAULT 'planifiee' CHECK (status IN ('planifiee','tenue','annulee')),
  agenda          TEXT,
  chaired_by      UUID,
  chaired_by_name TEXT,
  quorum_reached  BOOLEAN,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── quality_meeting_minutes ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_meeting_minutes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id      UUID NOT NULL REFERENCES quality_meetings(id) ON DELETE CASCADE,
  section_title   TEXT,
  content         TEXT NOT NULL,
  decisions       TEXT,
  action_items    TEXT,
  recorded_by     UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── quality_indicators ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_indicators (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference       TEXT NOT NULL UNIQUE DEFAULT 'IND-' || nextval('quality_indicator_seq'),
  name            TEXT NOT NULL,
  description     TEXT,
  category        TEXT,
  unit            TEXT NOT NULL DEFAULT '%',
  target_value    NUMERIC(10,4),
  alert_threshold NUMERIC(10,4),
  frequency       TEXT NOT NULL DEFAULT 'mensuel' CHECK (frequency IN ('quotidien','hebdomadaire','mensuel','trimestriel','annuel')),
  formula         TEXT,
  data_source     TEXT,
  responsible_id  UUID,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── quality_indicator_values ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_indicator_values (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id    UUID NOT NULL REFERENCES quality_indicators(id) ON DELETE CASCADE,
  period_label    TEXT NOT NULL,   -- '2026-07', '2026-Q2', etc.
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  value           NUMERIC(10,4) NOT NULL,
  trend           quality_indicator_trend,
  comments        TEXT,
  recorded_by     UUID,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (indicator_id, period_label)
);

-- ── quality_training ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_training (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT,
  training_date   DATE NOT NULL,
  duration_hours  NUMERIC(4,1),
  location        TEXT,
  trainer_name    TEXT,
  department      TEXT,
  max_participants INTEGER,
  status          TEXT NOT NULL DEFAULT 'planifie' CHECK (status IN ('planifie','termine','annule')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── quality_training_attendance ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_training_attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id     UUID NOT NULL REFERENCES quality_training(id) ON DELETE CASCADE,
  staff_id        UUID,
  staff_name      TEXT NOT NULL,
  attended        BOOLEAN NOT NULL DEFAULT false,
  score           NUMERIC(5,2),
  certified       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (training_id, staff_id)
);

-- ── quality_checklists ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_checklists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference       TEXT NOT NULL UNIQUE DEFAULT 'CHL-' || nextval('quality_checklist_seq'),
  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT,
  department      TEXT,
  frequency       TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── quality_checklist_items ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_checklist_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id    UUID NOT NULL REFERENCES quality_checklists(id) ON DELETE CASCADE,
  item_order      INTEGER NOT NULL DEFAULT 0,
  question        TEXT NOT NULL,
  category        TEXT,
  is_required     BOOLEAN NOT NULL DEFAULT true,
  -- execution
  checked_at      TIMESTAMPTZ,
  checked_by      UUID,
  is_compliant    BOOLEAN,
  observation     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── quality_improvements ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_improvements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT,
  source          TEXT,   -- 'indicateur','audit','incident','suggestion'
  status          TEXT NOT NULL DEFAULT 'propose' CHECK (status IN ('propose','etudie','approuve','en_cours','realise','abandonne')),
  priority        TEXT NOT NULL DEFAULT 'normale' CHECK (priority IN ('basse','normale','haute','urgente')),
  responsible_id  UUID,
  responsible_name TEXT,
  department      TEXT,
  expected_benefit TEXT,
  actual_benefit  TEXT,
  due_date        DATE,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── quality_notifications ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quality_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id    UUID NOT NULL,
  type            TEXT NOT NULL,  -- 'capa_overdue','incident_assigned','doc_expiring','audit_due','risk_review'
  title           TEXT NOT NULL,
  message         TEXT,
  source_type     TEXT,
  source_id       UUID,
  is_read         BOOLEAN NOT NULL DEFAULT false,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_qinc_status   ON quality_incidents(status);
CREATE INDEX IF NOT EXISTS idx_qinc_date     ON quality_incidents(occurrence_date DESC);
CREATE INDEX IF NOT EXISTS idx_qinc_severity ON quality_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_qinc_patient  ON quality_incidents(patient_id);
CREATE INDEX IF NOT EXISTS idx_qnc_status    ON quality_non_conformities(status);
CREATE INDEX IF NOT EXISTS idx_qnc_due       ON quality_non_conformities(due_date);
CREATE INDEX IF NOT EXISTS idx_qcapa_status  ON quality_corrective_actions(status);
CREATE INDEX IF NOT EXISTS idx_qcapa_due     ON quality_corrective_actions(due_date);
CREATE INDEX IF NOT EXISTS idx_qpapa_status  ON quality_preventive_actions(status);
CREATE INDEX IF NOT EXISTS idx_qpapa_due     ON quality_preventive_actions(due_date);
CREATE INDEX IF NOT EXISTS idx_qrisk_crit    ON quality_risk_register(criticality DESC);
CREATE INDEX IF NOT EXISTS idx_qrisk_status  ON quality_risk_register(status);
CREATE INDEX IF NOT EXISTS idx_qaud_status   ON quality_audits(status);
CREATE INDEX IF NOT EXISTS idx_qaud_date     ON quality_audits(planned_start_date);
CREATE INDEX IF NOT EXISTS idx_qdoc_status   ON quality_documents(status);
CREATE INDEX IF NOT EXISTS idx_qdoc_expiry   ON quality_documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_qind_active   ON quality_indicators(is_active);
CREATE INDEX IF NOT EXISTS idx_qnotif_recip  ON quality_notifications(recipient_id, is_read);

-- ── updated_at triggers ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION quality_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DO $$ DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'quality_incidents','quality_non_conformities','quality_corrective_actions',
    'quality_preventive_actions','quality_risk_register','quality_audits',
    'quality_documents','quality_indicators','quality_checklists','quality_improvements',
    'quality_meetings'
  ]) LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_upd ON %s;
       CREATE TRIGGER trg_%s_upd BEFORE UPDATE ON %s
       FOR EACH ROW EXECUTE FUNCTION quality_set_updated_at();', t, t, t, t);
  END LOOP;
END $$;

-- ── Trigger: audit nc_count / observation_count on finding insert ─────────
CREATE OR REPLACE FUNCTION quality_update_audit_counts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE quality_audits SET
    nc_count          = (SELECT COUNT(*) FROM quality_audit_findings WHERE audit_id = NEW.audit_id AND finding_type = 'non_conformite'),
    observation_count = (SELECT COUNT(*) FROM quality_audit_findings WHERE audit_id = NEW.audit_id AND finding_type = 'observation')
  WHERE id = NEW.audit_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_audit_findings_count ON quality_audit_findings;
CREATE TRIGGER trg_audit_findings_count
AFTER INSERT OR UPDATE OR DELETE ON quality_audit_findings
FOR EACH ROW EXECUTE FUNCTION quality_update_audit_counts();

-- ── Views ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_quality_dashboard_kpis AS
SELECT
  (SELECT COUNT(*) FROM quality_incidents WHERE status <> 'clos' AND created_at >= now() - INTERVAL '30 days') AS incidents_open_30d,
  (SELECT COUNT(*) FROM quality_incidents WHERE status = 'clos' AND created_at >= now() - INTERVAL '30 days') AS incidents_closed_30d,
  (SELECT COUNT(*) FROM quality_non_conformities WHERE status NOT IN ('validee','archivee')) AS nc_open,
  (SELECT COUNT(*) FROM quality_corrective_actions WHERE status NOT IN ('efficace','inefficace','annulee') AND due_date < CURRENT_DATE) AS capa_overdue,
  (SELECT COUNT(*) FROM quality_preventive_actions WHERE status NOT IN ('efficace','inefficace','annulee') AND due_date < CURRENT_DATE) AS papa_overdue,
  (SELECT COUNT(*) FROM quality_risk_register WHERE criticality >= 15 AND status NOT IN ('accepte','clos')) AS critical_risks,
  (SELECT COUNT(*) FROM quality_audits WHERE status = 'planifie' AND planned_start_date <= CURRENT_DATE + 30) AS audits_upcoming,
  (SELECT COUNT(*) FROM quality_audits WHERE status = 'clos' AND actual_end_date >= now() - INTERVAL '90 days') AS audits_closed_90d,
  (SELECT COUNT(*) FROM quality_documents WHERE status = 'publie' AND expiry_date <= CURRENT_DATE + 30) AS docs_expiring_soon,
  (SELECT COUNT(*) FROM quality_documents WHERE status = 'publie' AND expiry_date < CURRENT_DATE) AS docs_expired;

CREATE OR REPLACE VIEW v_quality_risk_heatmap AS
SELECT
  probability, impact, probability * impact AS criticality,
  COUNT(*) AS risk_count,
  array_agg(title ORDER BY title) AS risk_titles
FROM quality_risk_register
WHERE status NOT IN ('accepte','clos')
GROUP BY probability, impact;

-- ── Seed: default committees & indicators ─────────────────────────────────
INSERT INTO quality_committees (name, description) VALUES
  ('Comité Qualité & Sécurité', 'Comité principal de pilotage qualité'),
  ('CLIN — Comité de Lutte contre les Infections Nosocomiales', 'Prévention des infections'),
  ('CLUD — Comité de Lutte contre la Douleur', 'Gestion de la douleur')
ON CONFLICT DO NOTHING;

INSERT INTO quality_indicators (reference, name, description, category, unit, target_value, frequency) VALUES
  ('IND-7001','Taux d''infections nosocomiales','Nombre d''infections pour 1000 journées d''hospitalisation','clinique','‰',2.0,'mensuel'),
  ('IND-7002','Délai moyen de traitement CAPA','Délai moyen de clôture des CAPA (jours)','processus','jours',30,'mensuel'),
  ('IND-7003','Taux de conformité documentaire','% documents qualité à jour','documentation','%',95,'trimestriel'),
  ('IND-7004','Taux de satisfaction patients','Score satisfaction questionnaire','patients','%',85,'mensuel'),
  ('IND-7005','Incidents graves déclarés','Nombre d''événements indésirables graves','securite','nb',0,'mensuel')
ON CONFLICT (reference) DO NOTHING;

COMMIT;
