-- =============================================================================
-- Migration 008: Billing extension
-- Extends invoices/invoice_items/payments and adds insurance, credit-notes,
-- billable-events tables.  Idempotent (uses IF NOT EXISTS / ON CONFLICT).
-- =============================================================================

-- ── 1. Extend invoice_status enum ────────────────────────────────────────────
DO $$ BEGIN
  BEGIN ALTER TYPE invoice_status ADD VALUE 'draft'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE invoice_status ADD VALUE 'issued'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE invoice_status ADD VALUE 'partially_paid'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE invoice_status ADD VALUE 'overdue'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE invoice_status ADD VALUE 'refunded'; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ── 2. Extend payment_method enum ────────────────────────────────────────────
DO $$ BEGIN
  BEGIN ALTER TYPE payment_method ADD VALUE 'mobile'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE payment_method ADD VALUE 'tiers_payant'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE payment_method ADD VALUE 'convention'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE payment_method ADD VALUE 'gratuite'; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ── 3. Invoice number sequence ────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS payment_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS claim_number_seq   START 1;
CREATE SEQUENCE IF NOT EXISTS credit_note_seq    START 1;

-- ── 4. Extend invoices table ──────────────────────────────────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_number   TEXT,
  ADD COLUMN IF NOT EXISTS consultation_id  UUID REFERENCES consultations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoice_date     TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS subtotal         REAL DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS discount_amount  REAL DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS tax_amount       REAL DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS patient_share    REAL DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS insurer_share    REAL DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS remaining_amount REAL DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS currency         TEXT DEFAULT 'DZD' NOT NULL,
  ADD COLUMN IF NOT EXISTS version          INT  DEFAULT 1    NOT NULL,
  ADD COLUMN IF NOT EXISTS issued_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS issued_at        TIMESTAMPTZ;

-- Unique constraint (safe to add if not already there)
DO $$ BEGIN
  ALTER TABLE invoices ADD CONSTRAINT invoices_invoice_number_unique UNIQUE (invoice_number);
EXCEPTION WHEN duplicate_table THEN NULL;
         WHEN duplicate_object THEN NULL;
END $$;

-- Backfill invoice_number for rows that have none
UPDATE invoices
   SET invoice_number = 'FACT-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('invoice_number_seq')::TEXT, 6, '0')
 WHERE invoice_number IS NULL;

-- ── 5. Extend invoice_items table ─────────────────────────────────────────────
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS source_module     TEXT,
  ADD COLUMN IF NOT EXISTS source_entity_id  UUID,
  ADD COLUMN IF NOT EXISTS service_code      TEXT,
  ADD COLUMN IF NOT EXISTS discount          REAL DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS tax               REAL DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS performed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS performed_by      TEXT;

-- ── 6. Extend payments table ──────────────────────────────────────────────────
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_number TEXT,
  ADD COLUMN IF NOT EXISTS patient_id     UUID REFERENCES patients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS collected_by   UUID REFERENCES users(id)    ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status         TEXT DEFAULT 'completed' NOT NULL;

DO $$ BEGIN
  ALTER TABLE payments ADD CONSTRAINT payments_payment_number_unique UNIQUE (payment_number);
EXCEPTION WHEN duplicate_table THEN NULL;
         WHEN duplicate_object THEN NULL;
END $$;

UPDATE payments
   SET payment_number = 'PAY-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('payment_number_seq')::TEXT, 6, '0')
 WHERE payment_number IS NULL;

-- ── 7. insurance_policies ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insurance_policies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id        UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  insurer_name      TEXT NOT NULL,
  policy_number     TEXT NOT NULL,
  subscriber_number TEXT,
  coverage_type     TEXT NOT NULL,
  coverage_percent  REAL DEFAULT 80 NOT NULL,
  ceiling_amount    REAL,
  valid_from        DATE,
  valid_until       DATE,
  is_active         BOOLEAN DEFAULT TRUE NOT NULL,
  notes             TEXT,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS insurance_policies_patient_idx ON insurance_policies(patient_id);

-- ── 8. insurance_claims ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insurance_claims (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_number      TEXT NOT NULL,
  invoice_id        UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  patient_id        UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  policy_id         UUID REFERENCES insurance_policies(id) ON DELETE SET NULL,
  insurer_name      TEXT NOT NULL,
  amount_requested  REAL NOT NULL,
  amount_approved   REAL,
  amount_paid       REAL,
  status            TEXT DEFAULT 'draft' NOT NULL,
  submitted_at      TIMESTAMPTZ,
  reviewed_at       TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  rejection_reason  TEXT,
  notes             TEXT,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
DO $$ BEGIN
  ALTER TABLE insurance_claims ADD CONSTRAINT insurance_claims_number_unique UNIQUE (claim_number);
EXCEPTION WHEN duplicate_table THEN NULL;
         WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS insurance_claims_invoice_idx ON insurance_claims(invoice_id);
CREATE INDEX IF NOT EXISTS insurance_claims_patient_idx ON insurance_claims(patient_id);
CREATE INDEX IF NOT EXISTS insurance_claims_status_idx  ON insurance_claims(status);

-- ── 9. credit_notes ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_number  TEXT NOT NULL,
  invoice_id   UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  patient_id   UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  amount       REAL NOT NULL,
  reason       TEXT NOT NULL,
  status       TEXT DEFAULT 'active' NOT NULL,
  issued_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  issued_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
DO $$ BEGIN
  ALTER TABLE credit_notes ADD CONSTRAINT credit_notes_number_unique UNIQUE (note_number);
EXCEPTION WHEN duplicate_table THEN NULL;
         WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS credit_notes_invoice_idx ON credit_notes(invoice_id);

-- ── 10. billable_events ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billable_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id     UUID REFERENCES encounters(id) ON DELETE SET NULL,
  source_module    TEXT NOT NULL,
  source_entity_id UUID,
  description      TEXT NOT NULL,
  quantity         REAL DEFAULT 1 NOT NULL,
  unit_price       REAL NOT NULL,
  total_price      REAL NOT NULL,
  service_code     TEXT,
  performed_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  performed_by     TEXT,
  is_billed        BOOLEAN DEFAULT FALSE NOT NULL,
  invoice_id       UUID REFERENCES invoices(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS billable_events_patient_idx   ON billable_events(patient_id);
CREATE INDEX IF NOT EXISTS billable_events_encounter_idx ON billable_events(encounter_id);
CREATE INDEX IF NOT EXISTS billable_events_billed_idx    ON billable_events(is_billed);

-- ── 11. Billing permissions (idempotent) ──────────────────────────────────────
INSERT INTO permissions (name, module, description) VALUES
  ('billing.view',            'billing', 'Voir les factures'),
  ('billing.create',          'billing', 'Créer une facture'),
  ('billing.update',          'billing', 'Modifier une facture'),
  ('billing.issue',           'billing', 'Émettre une facture'),
  ('billing.cancel',          'billing', 'Annuler une facture'),
  ('billing.print',           'billing', 'Imprimer une facture'),
  ('billing.export',          'billing', 'Exporter les factures'),
  ('payments.view',           'billing', 'Voir les paiements'),
  ('payments.create',         'billing', 'Enregistrer un paiement'),
  ('payments.refund',         'billing', 'Rembourser un paiement'),
  ('insurance.view',          'billing', 'Voir les dossiers assurance'),
  ('insurance.create_claim',  'billing', 'Créer un dossier assurance'),
  ('insurance.approve_claim', 'billing', 'Approuver un dossier assurance'),
  ('insurance.reject_claim',  'billing', 'Rejeter un dossier assurance'),
  ('credit_notes.create',     'billing', 'Créer une note de crédit'),
  ('financial_reports.view',  'billing', 'Voir les rapports financiers')
ON CONFLICT (name) DO NOTHING;

-- ── 12. Grant billing permissions to comptable + admin roles ──────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.name IN ('super_admin', 'directeur', 'medecin_chef', 'comptable', 'admin')
   AND p.name IN (
     'billing.view','billing.create','billing.update','billing.issue',
     'billing.cancel','billing.print','billing.export',
     'payments.view','payments.create','payments.refund',
     'insurance.view','insurance.create_claim','insurance.approve_claim','insurance.reject_claim',
     'credit_notes.create','financial_reports.view'
   )
ON CONFLICT DO NOTHING;
