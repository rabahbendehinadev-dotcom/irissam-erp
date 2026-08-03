-- =============================================================================
-- Migration 010: Insurance / Tiers payant / CNAS / CASNOS module
-- Idempotent — uses IF NOT EXISTS, ON CONFLICT DO NOTHING, DO $$ BEGIN...END $$
-- All financial amounts stored as NUMERIC(15,2)
-- =============================================================================

-- ── Sequences ─────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS bordereau_number_seq     START 1;
CREATE SEQUENCE IF NOT EXISTS coverage_request_seq     START 1;
CREATE SEQUENCE IF NOT EXISTS org_payment_number_seq   START 1;
CREATE SEQUENCE IF NOT EXISTS claim_number_seq         START 1;

-- ── 1. insurance_organizations ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insurance_organizations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                    TEXT NOT NULL,
  name                    TEXT NOT NULL,
  type                    TEXT NOT NULL DEFAULT 'autre',
  -- type: 'cnas' | 'casnos' | 'mutuelle' | 'assurance_privee' | 'convention_entreprise' | 'autre'
  address                 TEXT,
  phone                   TEXT,
  email                   TEXT,
  contact_name            TEXT,
  convention_number       TEXT,
  convention_start        DATE,
  convention_end          DATE,
  avg_payment_days        INT DEFAULT 30,
  default_coverage_percent NUMERIC(5,2) DEFAULT 80.00,
  annual_ceiling          NUMERIC(15,2),
  status                  TEXT NOT NULL DEFAULT 'actif',
  -- status: 'actif' | 'inactif' | 'suspendu' | 'convention_expiree'
  site_id                 UUID,
  notes                   TEXT,
  created_by              UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by              UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at              TIMESTAMPTZ,
  version                 INT NOT NULL DEFAULT 1
);
DO $$ BEGIN
  ALTER TABLE insurance_organizations ADD CONSTRAINT insurance_orgs_code_unique UNIQUE (code);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS ins_orgs_status_idx ON insurance_organizations(status);
CREATE INDEX IF NOT EXISTS ins_orgs_type_idx   ON insurance_organizations(type);

-- ── 2. insurance_plans ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insurance_plans (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL REFERENCES insurance_organizations(id) ON DELETE CASCADE,
  code                     TEXT NOT NULL,
  name                     TEXT NOT NULL,
  coverage_type            TEXT NOT NULL DEFAULT 'maladie',
  -- coverage_type: 'maladie' | 'accident' | 'maternite' | 'invalidite' | 'deces' | 'mixte'
  coverage_percent         NUMERIC(5,2) NOT NULL DEFAULT 80.00,
  annual_ceiling           NUMERIC(15,2),
  per_act_ceiling          NUMERIC(15,2),
  per_day_ceiling          NUMERIC(15,2),
  ticket_moderateur_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  franchise_amount         NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  max_acts_per_year        INT,
  requires_prior_auth      BOOLEAN NOT NULL DEFAULT FALSE,
  excluded_services        TEXT[],        -- array of service codes
  covered_services         TEXT[],        -- if set, only these are covered
  tarifs_conventionnes     JSONB,         -- {serviceCode: price}
  waiting_period_days      INT NOT NULL DEFAULT 0,
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  notes                    TEXT,
  created_by               UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by               UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at               TIMESTAMPTZ,
  version                  INT NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS ins_plans_org_idx ON insurance_plans(organization_id);

-- ── 3. Extend insurance_policies ─────────────────────────────────────────────
ALTER TABLE insurance_policies
  ADD COLUMN IF NOT EXISTS organization_id         UUID REFERENCES insurance_organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_id                 UUID REFERENCES insurance_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS numero_adherent         TEXT,
  ADD COLUMN IF NOT EXISTS beneficiaire_principal  TEXT,
  ADD COLUMN IF NOT EXISTS ayant_droit             BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS plafond_consomme        NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS ticket_moderateur_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS franchise_amount        NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS priorite                INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS statut                  TEXT NOT NULL DEFAULT 'active',
  -- statut: 'active' | 'expiree' | 'suspendue' | 'en_attente_validation' | 'refusee' | 'archivee'
  ADD COLUMN IF NOT EXISTS coverage_percent_num    NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS ceiling_amount_num      NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS updated_by              UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS version                 INT NOT NULL DEFAULT 1;

-- Backfill coverage_percent_num from existing REAL column
UPDATE insurance_policies
   SET coverage_percent_num = coverage_percent::NUMERIC(5,2)
 WHERE coverage_percent_num IS NULL;

UPDATE insurance_policies
   SET ceiling_amount_num = ceiling_amount::NUMERIC(15,2)
 WHERE ceiling_amount_num IS NULL AND ceiling_amount IS NOT NULL;

-- insurer_name is optional (org name is the canonical source)
ALTER TABLE insurance_policies
  ALTER COLUMN insurer_name DROP NOT NULL;

-- Mark expired policies
UPDATE insurance_policies
   SET statut = 'expiree'
 WHERE valid_until IS NOT NULL AND valid_until < CURRENT_DATE AND statut = 'active';

CREATE INDEX IF NOT EXISTS ins_pol_org_idx    ON insurance_policies(organization_id);
CREATE INDEX IF NOT EXISTS ins_pol_statut_idx ON insurance_policies(statut);

-- ── 4. coverage_requests (Prise en charge) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS coverage_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number        TEXT NOT NULL,
  patient_id            UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  encounter_id          UUID REFERENCES encounters(id) ON DELETE SET NULL,
  admission_id          UUID REFERENCES admissions(id) ON DELETE SET NULL,
  policy_id             UUID REFERENCES insurance_policies(id) ON DELETE SET NULL,
  organization_id       UUID REFERENCES insurance_organizations(id) ON DELETE SET NULL,
  requested_amount      NUMERIC(15,2),
  requested_services    JSONB,           -- [{serviceCode, description, amount}]
  request_date          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expected_response_date TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'brouillon',
  -- status: 'brouillon' | 'soumise' | 'en_cours' | 'infos_requises' | 'approuvee' | 'partiellement_approuvee' | 'refusee' | 'expiree' | 'annulee'
  approved_amount       NUMERIC(15,2),
  patient_share         NUMERIC(15,2),
  organization_share    NUMERIC(15,2),
  rejection_reason      TEXT,
  decision_date         TIMESTAMPTZ,
  decision_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  notes                 TEXT,
  created_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,
  version               INT NOT NULL DEFAULT 1
);
DO $$ BEGIN
  ALTER TABLE coverage_requests ADD CONSTRAINT coverage_requests_number_unique UNIQUE (request_number);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS cov_req_patient_idx ON coverage_requests(patient_id);
CREATE INDEX IF NOT EXISTS cov_req_status_idx  ON coverage_requests(status);

-- ── 5. Extend insurance_claims ────────────────────────────────────────────────
ALTER TABLE insurance_claims
  ADD COLUMN IF NOT EXISTS organization_id       UUID REFERENCES insurance_organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS encounter_id          UUID REFERENCES encounters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coverage_request_id   UUID REFERENCES coverage_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bordereau_id          UUID,   -- FK added after bordereau table creation
  ADD COLUMN IF NOT EXISTS amount_requested_num  NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS amount_approved_num   NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS amount_paid_num       NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS amount_rejected       NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS patient_share         NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS decision_date         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS decision_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS version               INT NOT NULL DEFAULT 1;

-- Backfill numeric columns from REAL
UPDATE insurance_claims
   SET amount_requested_num = amount_requested::NUMERIC(15,2)
 WHERE amount_requested_num IS NULL;

UPDATE insurance_claims
   SET amount_approved_num = amount_approved::NUMERIC(15,2)
 WHERE amount_approved_num IS NULL AND amount_approved IS NOT NULL;

UPDATE insurance_claims
   SET amount_paid_num = COALESCE(amount_paid::NUMERIC(15,2), 0)
 WHERE amount_paid_num = 0 AND amount_paid IS NOT NULL;

-- ── 6. insurance_bordereaux ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insurance_bordereaux (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bordereau_number  TEXT NOT NULL,
  organization_id   UUID NOT NULL REFERENCES insurance_organizations(id) ON DELETE RESTRICT,
  period_from       DATE,
  period_to         DATE,
  claim_count       INT NOT NULL DEFAULT 0,
  total_requested   NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  total_approved    NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  total_paid        NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  status            TEXT NOT NULL DEFAULT 'brouillon',
  -- status: 'brouillon' | 'pret' | 'soumis' | 'recu' | 'en_cours' | 'partiellement_paye' | 'paye' | 'rejete'
  submitted_at      TIMESTAMPTZ,
  submitted_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  reference_external TEXT,
  notes             TEXT,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  version           INT NOT NULL DEFAULT 1
);
DO $$ BEGIN
  ALTER TABLE insurance_bordereaux ADD CONSTRAINT bordereaux_number_unique UNIQUE (bordereau_number);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS ins_bord_org_idx    ON insurance_bordereaux(organization_id);
CREATE INDEX IF NOT EXISTS ins_bord_status_idx ON insurance_bordereaux(status);

-- ── 7. insurance_bordereau_items ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insurance_bordereau_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bordereau_id  UUID NOT NULL REFERENCES insurance_bordereaux(id) ON DELETE CASCADE,
  claim_id      UUID NOT NULL REFERENCES insurance_claims(id) ON DELETE RESTRICT,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by      UUID REFERENCES users(id) ON DELETE SET NULL
);
DO $$ BEGIN
  ALTER TABLE insurance_bordereau_items ADD CONSTRAINT bordereau_items_unique UNIQUE (bordereau_id, claim_id);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS ins_bord_items_bord_idx  ON insurance_bordereau_items(bordereau_id);
CREATE INDEX IF NOT EXISTS ins_bord_items_claim_idx ON insurance_bordereau_items(claim_id);

-- Now add bordereau FK to insurance_claims
DO $$ BEGIN
  ALTER TABLE insurance_claims
    ADD CONSTRAINT insurance_claims_bordereau_fk
    FOREIGN KEY (bordereau_id) REFERENCES insurance_bordereaux(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 8. insurance_claim_items ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insurance_claim_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id          UUID NOT NULL REFERENCES insurance_claims(id) ON DELETE CASCADE,
  invoice_item_id   UUID REFERENCES invoice_items(id) ON DELETE SET NULL,
  service_code      TEXT,
  description       TEXT,
  amount_billed     NUMERIC(15,2) NOT NULL,
  amount_requested  NUMERIC(15,2) NOT NULL,
  amount_approved   NUMERIC(15,2),
  amount_rejected   NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  rejection_reason  TEXT,
  status            TEXT NOT NULL DEFAULT 'pending',
  -- status: 'pending' | 'approved' | 'partially_approved' | 'rejected'
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ins_claim_items_claim_idx   ON insurance_claim_items(claim_id);
CREATE INDEX IF NOT EXISTS ins_claim_items_invoice_idx ON insurance_claim_items(invoice_item_id);

-- ── 9. insurance_org_payments ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insurance_org_payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number   TEXT NOT NULL,
  organization_id  UUID NOT NULL REFERENCES insurance_organizations(id) ON DELETE RESTRICT,
  bordereau_id     UUID REFERENCES insurance_bordereaux(id) ON DELETE SET NULL,
  claim_id         UUID REFERENCES insurance_claims(id) ON DELETE SET NULL,
  amount           NUMERIC(15,2) NOT NULL,
  payment_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  method           TEXT NOT NULL DEFAULT 'virement',
  -- method: 'virement' | 'cheque' | 'especes' | 'autre'
  bank_reference   TEXT,
  received_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  notes            TEXT,
  document_path    TEXT,
  status           TEXT NOT NULL DEFAULT 'completed',
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  version          INT NOT NULL DEFAULT 1
);
DO $$ BEGIN
  ALTER TABLE insurance_org_payments ADD CONSTRAINT org_payment_number_unique UNIQUE (payment_number);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS ins_org_pay_org_idx ON insurance_org_payments(organization_id);
CREATE INDEX IF NOT EXISTS ins_org_pay_bord_idx ON insurance_org_payments(bordereau_id);

-- ── 10. insurance_documents ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insurance_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   TEXT NOT NULL,
  -- entity_type: 'policy' | 'claim' | 'bordereau' | 'organization' | 'coverage_request'
  entity_id     UUID NOT NULL,
  document_type TEXT NOT NULL,
  -- document_type: 'carte_assurance' | 'attestation' | 'convention' | 'prise_en_charge' |
  --                'bordereau' | 'accuse_reception' | 'decision_refus' | 'justificatif_paiement' | 'courrier' | 'autre'
  file_path     TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  file_size     INT,
  mime_type     TEXT,
  notes         TEXT,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ins_docs_entity_idx ON insurance_documents(entity_type, entity_id);

-- ── 11. insurance_rejections ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insurance_rejections (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id             UUID NOT NULL REFERENCES insurance_claims(id) ON DELETE CASCADE,
  claim_item_id        UUID REFERENCES insurance_claim_items(id) ON DELETE CASCADE,
  rejection_type       TEXT NOT NULL DEFAULT 'complete',
  -- rejection_type: 'complete' | 'partial' | 'item_level'
  rejection_reason     TEXT NOT NULL,
  rejection_code       TEXT,
  rejected_amount      NUMERIC(15,2),
  transfer_to_patient  BOOLEAN NOT NULL DEFAULT FALSE,
  transfer_approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  transfer_approved_at TIMESTAMPTZ,
  created_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ins_rejections_claim_idx ON insurance_rejections(claim_id);

-- ── 12. insurance_approvals ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insurance_approvals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id        UUID NOT NULL REFERENCES insurance_claims(id) ON DELETE CASCADE,
  claim_item_id   UUID REFERENCES insurance_claim_items(id) ON DELETE CASCADE,
  approval_type   TEXT NOT NULL DEFAULT 'full',
  -- approval_type: 'full' | 'partial'
  approved_amount NUMERIC(15,2) NOT NULL,
  approved_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ins_approvals_claim_idx ON insurance_approvals(claim_id);

-- ── 13. Seed default organizations (CNAS + CASNOS) ───────────────────────────
INSERT INTO insurance_organizations (code, name, type, status)
VALUES
  ('CNAS',   'Caisse Nationale des Assurances Sociales des Travailleurs Salariés', 'cnas',   'actif'),
  ('CASNOS', 'Caisse Nationale de Sécurité Sociale des Non Salariés',              'casnos', 'actif')
ON CONFLICT (code) DO NOTHING;
