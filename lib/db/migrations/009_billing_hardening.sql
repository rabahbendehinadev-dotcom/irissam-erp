-- =============================================================================
-- Migration 009: Billing hardening
-- • Status tracking on billable_events (unbilled/reserved/billed/cancelled)
-- • Unique index preventing double-billing per source entity
-- • service_catalog + default prices
-- • receipt_number on payments
-- • Partial unique index on invoices(encounter_id) for active invoices
-- • Additional billing permissions
-- Idempotent — uses IF NOT EXISTS / ON CONFLICT.
-- =============================================================================

-- ── 1. Extend billable_events ─────────────────────────────────────────────────

ALTER TABLE billable_events
  ADD COLUMN IF NOT EXISTS status                TEXT    DEFAULT 'unbilled' NOT NULL,
  ADD COLUMN IF NOT EXISTS billed_invoice_item_id UUID;

-- Backfill: rows already marked is_billed = true
UPDATE billable_events SET status = 'billed' WHERE is_billed = TRUE AND status = 'unbilled';

-- Partial unique index: a source entity cannot be billed twice simultaneously
-- (cancelled rows are excluded so re-billing after cancellation is allowed)
CREATE UNIQUE INDEX IF NOT EXISTS billable_events_source_unique
  ON billable_events(source_module, source_entity_id)
  WHERE source_entity_id IS NOT NULL AND status != 'cancelled';

CREATE INDEX IF NOT EXISTS billable_events_status_idx ON billable_events(status);

-- ── 2. service_catalog ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS service_catalog (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_code  TEXT        NOT NULL,
  name          TEXT        NOT NULL,
  category      TEXT        NOT NULL,
  source_module TEXT,
  default_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency      TEXT        NOT NULL DEFAULT 'DZD',
  site_id       UUID        REFERENCES sites(id) ON DELETE CASCADE,
  valid_from    DATE,
  valid_to      DATE,
  active        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Global codes are unique when site_id is NULL
CREATE UNIQUE INDEX IF NOT EXISTS service_catalog_code_global_idx
  ON service_catalog(service_code) WHERE site_id IS NULL;

CREATE INDEX IF NOT EXISTS service_catalog_module_idx ON service_catalog(source_module) WHERE active = TRUE;

-- Seed default catalogue (global — no site_id)
INSERT INTO service_catalog (service_code, name, category, source_module, default_price) VALUES
  ('CONS-GEN',   'Consultation générale',              'consultation',    'consultations',    1000),
  ('CONS-SPEC',  'Consultation spécialisée',           'consultation',    'consultations',    2500),
  ('LAB-GEN',    'Analyse biologique',                 'laboratoire',     'laboratoire',       800),
  ('LAB-NFS',    'NFS — Hémogramme',                   'laboratoire',     'laboratoire',       800),
  ('LAB-BIO',    'Bilan biochimique',                  'laboratoire',     'laboratoire',      1200),
  ('LAB-URINE',  'Analyse d''urine',                   'laboratoire',     'laboratoire',       600),
  ('IMG-RX',     'Radiographie standard',              'imagerie',        'imagerie',          2000),
  ('IMG-ECHO',   'Échographie',                        'imagerie',        'imagerie',          3500),
  ('IMG-SCAN',   'Scanner (TDM)',                      'imagerie',        'imagerie',         15000),
  ('IMG-IRM',    'IRM',                                'imagerie',        'imagerie',         25000),
  ('RX-DRUG',    'Médicament dispensé',                'medicament',      'pharmacie',           0),
  ('HOSP-DAY',   'Séjour journalier (chambre)',        'chambre',         'hospitalisation',   3000),
  ('BLOC-ACT',   'Acte chirurgical',                   'bloc',            'bloc',             50000),
  ('REA-DAY',    'Séjour réanimation (journée)',       'icu',             'reanimation',      15000),
  ('AMBU-TRIP',  'Transport ambulance',                'ambulance',       'ambulances',        5000)
ON CONFLICT (service_code) WHERE site_id IS NULL DO NOTHING;

-- ── 3. receipt_number on payments ─────────────────────────────────────────────

ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_number TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS payments_receipt_number_idx
  ON payments(receipt_number) WHERE receipt_number IS NOT NULL;

CREATE SEQUENCE IF NOT EXISTS receipt_number_seq START 1;

-- Backfill existing payments
UPDATE payments
   SET receipt_number = 'REC-' || TO_CHAR(paid_at, 'YYYY') || '-' || LPAD(nextval('receipt_number_seq')::TEXT, 6, '0')
 WHERE receipt_number IS NULL AND paid_at IS NOT NULL;

-- ── 4. Partial unique index: one active invoice per encounter ─────────────────

-- Prevents issuing two simultaneous non-cancelled invoices for the same encounter
CREATE UNIQUE INDEX IF NOT EXISTS invoices_encounter_active_unique
  ON invoices(encounter_id)
  WHERE encounter_id IS NOT NULL
    AND status NOT IN ('cancelled', 'refunded')
    AND deleted_at IS NULL;

-- ── 5. Additional billing permissions ────────────────────────────────────────

INSERT INTO permissions (name, module, description) VALUES
  ('billing.manual_price',          'billing', 'Saisir un prix manuel sans catalogue'),
  ('billing.view_previous_invoice', 'billing', 'Voir les factures antérieures du patient'),
  ('billing.create_credit_note',    'billing', 'Créer une note de crédit (alias)')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r, permissions p
 WHERE r.name IN ('super_admin', 'directeur', 'comptable', 'admin', 'medecin_chef')
   AND p.name IN ('billing.manual_price', 'billing.view_previous_invoice', 'billing.create_credit_note')
ON CONFLICT DO NOTHING;
