-- =============================================================================
-- Migration 015: Medical Stock Management (Enterprise Grade)
-- Idempotent — uses IF NOT EXISTS, ON CONFLICT DO NOTHING, DO $$ BEGIN...END $$
-- All financial amounts stored as NUMERIC(15,2)
-- =============================================================================

BEGIN;

-- ── Sequences ──────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS medical_po_number_seq    START 1;
CREATE SEQUENCE IF NOT EXISTS medical_batch_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS medical_adj_number_seq   START 1;
CREATE SEQUENCE IF NOT EXISTS medical_transfer_seq     START 1;
CREATE SEQUENCE IF NOT EXISTS medical_inventory_seq    START 1;
CREATE SEQUENCE IF NOT EXISTS medical_cons_number_seq  START 1;

-- ── Enums ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE medical_item_type AS ENUM (
    'medicament','consommable','reactif','equipement','dispositif_medical','autre'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE medical_movement_type AS ENUM (
    'entree','sortie','transfert_in','transfert_out','ajustement_plus',
    'ajustement_moins','retour_fournisseur','retour_service','perte','peremption',
    'inventaire_plus','inventaire_moins','consommation','retour_patient'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE medical_po_status AS ENUM (
    'brouillon','soumise','approuvee','partiellement_recue','recue','annulee'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE medical_transfer_status AS ENUM (
    'brouillon','soumise','approuvee','en_transit','recue','annulee'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE medical_inventory_status AS ENUM (
    'en_cours','suspendue','terminee','validee','annulee'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE medical_adj_reason AS ENUM (
    'inventaire','perte','casse','vol','peremption','don','correction',
    'reception_non_conforme','retour_patient','autre'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE batch_status AS ENUM (
    'actif','epuise','expire','rappele','en_quarantaine','annule'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cons_status AS ENUM ('brouillon','validee','annulee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 1. medical_categories ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   UUID REFERENCES medical_categories(id) ON DELETE SET NULL,
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT DEFAULT '#3B82F6',
  icon        TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);
DO $$ BEGIN
  ALTER TABLE medical_categories ADD CONSTRAINT med_cat_code_unique UNIQUE (code);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS med_cat_parent_idx ON medical_categories(parent_id);
CREATE INDEX IF NOT EXISTS med_cat_active_idx ON medical_categories(is_active) WHERE deleted_at IS NULL;

-- ── 2. medical_units ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_units (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT NOT NULL,
  name         TEXT NOT NULL,
  symbol       TEXT NOT NULL,
  base_unit_id UUID REFERENCES medical_units(id) ON DELETE SET NULL,
  factor       NUMERIC(18,6) DEFAULT 1.000000,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DO $$ BEGIN
  ALTER TABLE medical_units ADD CONSTRAINT med_units_code_unique UNIQUE (code);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. medical_manufacturers ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_manufacturers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  country     TEXT,
  phone       TEXT,
  email       TEXT,
  website     TEXT,
  contact     TEXT,
  notes       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);
DO $$ BEGIN
  ALTER TABLE medical_manufacturers ADD CONSTRAINT med_mfr_code_unique UNIQUE (code);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 4. medical_suppliers ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_suppliers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT NOT NULL,
  name              TEXT NOT NULL,
  address           TEXT,
  city              TEXT,
  country           TEXT DEFAULT 'DZ',
  phone             TEXT,
  fax               TEXT,
  email             TEXT,
  website           TEXT,
  contact_name      TEXT,
  contact_phone     TEXT,
  tax_id            TEXT,
  registration_no   TEXT,
  payment_terms_days INT DEFAULT 30,
  currency          TEXT DEFAULT 'DZD',
  bank_name         TEXT,
  bank_account      TEXT,
  notes             TEXT,
  rating            SMALLINT CHECK (rating BETWEEN 1 AND 5),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);
DO $$ BEGIN
  ALTER TABLE medical_suppliers ADD CONSTRAINT med_sup_code_unique UNIQUE (code);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS med_sup_active_idx ON medical_suppliers(is_active) WHERE deleted_at IS NULL;

-- ── 5. medical_items ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT NOT NULL,
  barcode             TEXT,
  name                TEXT NOT NULL,
  generic_name        TEXT,
  brand_name          TEXT,
  description         TEXT,
  item_type           medical_item_type NOT NULL DEFAULT 'consommable',
  category_id         UUID REFERENCES medical_categories(id) ON DELETE SET NULL,
  unit_id             UUID REFERENCES medical_units(id) ON DELETE RESTRICT,
  purchase_unit_id    UUID REFERENCES medical_units(id) ON DELETE RESTRICT,
  dispense_unit_id    UUID REFERENCES medical_units(id) ON DELETE RESTRICT,
  manufacturer_id     UUID REFERENCES medical_manufacturers(id) ON DELETE SET NULL,
  default_supplier_id UUID REFERENCES medical_suppliers(id) ON DELETE SET NULL,
  -- Stock levels
  quantity_on_hand    NUMERIC(18,4) NOT NULL DEFAULT 0,
  quantity_reserved   NUMERIC(18,4) NOT NULL DEFAULT 0,
  quantity_on_order   NUMERIC(18,4) NOT NULL DEFAULT 0,
  -- Thresholds
  reorder_point       NUMERIC(18,4) NOT NULL DEFAULT 0,
  reorder_quantity    NUMERIC(18,4) NOT NULL DEFAULT 0,
  min_stock_level     NUMERIC(18,4) NOT NULL DEFAULT 0,
  max_stock_level     NUMERIC(18,4),
  safety_stock        NUMERIC(18,4) NOT NULL DEFAULT 0,
  -- Pricing
  unit_cost           NUMERIC(15,4) NOT NULL DEFAULT 0,
  last_purchase_price NUMERIC(15,4),
  average_cost        NUMERIC(15,4) NOT NULL DEFAULT 0,
  selling_price       NUMERIC(15,4),
  -- Regulation
  requires_prescription BOOLEAN NOT NULL DEFAULT FALSE,
  is_controlled       BOOLEAN NOT NULL DEFAULT FALSE,
  is_narcotic         BOOLEAN NOT NULL DEFAULT FALSE,
  storage_conditions  TEXT,
  temperature_min     NUMERIC(5,2),
  temperature_max     NUMERIC(5,2),
  -- Tracking
  track_by_batch      BOOLEAN NOT NULL DEFAULT TRUE,
  track_expiry        BOOLEAN NOT NULL DEFAULT TRUE,
  expiry_warning_days INT NOT NULL DEFAULT 90,
  -- Identifiers
  dci                 TEXT,
  atc_code            TEXT,
  registration_no     TEXT,
  -- Status
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  is_formulary        BOOLEAN NOT NULL DEFAULT FALSE,
  notes               TEXT,
  image_url           TEXT,
  -- Audit
  created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,
  version             INT NOT NULL DEFAULT 1
);
DO $$ BEGIN
  ALTER TABLE medical_items ADD CONSTRAINT med_items_code_unique UNIQUE (code);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE medical_items ADD CONSTRAINT med_items_barcode_unique UNIQUE (barcode);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS med_items_category_idx   ON medical_items(category_id);
CREATE INDEX IF NOT EXISTS med_items_type_idx       ON medical_items(item_type);
CREATE INDEX IF NOT EXISTS med_items_active_idx     ON medical_items(is_active) WHERE deleted_at IS NULL;
-- trgm indexes (requires pg_trgm; skip gracefully if unavailable)
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX IF NOT EXISTS med_items_name_trgm_idx ON medical_items USING GIN (name gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS med_items_code_trgm_idx ON medical_items USING GIN (code gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN
  -- fall back to btree if pg_trgm unavailable
  CREATE INDEX IF NOT EXISTS med_items_name_idx ON medical_items (name);
  CREATE INDEX IF NOT EXISTS med_items_code_idx ON medical_items (code);
END $$;
CREATE INDEX IF NOT EXISTS med_items_low_stock_idx  ON medical_items(quantity_on_hand, reorder_point) WHERE deleted_at IS NULL;

-- Trigger: keep updated_at fresh
CREATE OR REPLACE FUNCTION medical_items_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_medical_items_updated_at ON medical_items;
CREATE TRIGGER trg_medical_items_updated_at
  BEFORE UPDATE ON medical_items
  FOR EACH ROW EXECUTE FUNCTION medical_items_updated_at();

-- ── 6. medical_batches ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number    TEXT NOT NULL DEFAULT 'BCH-' || LPAD(nextval('medical_batch_number_seq')::TEXT, 8, '0'),
  item_id         UUID NOT NULL REFERENCES medical_items(id) ON DELETE RESTRICT,
  supplier_id     UUID REFERENCES medical_suppliers(id) ON DELETE SET NULL,
  manufacturer_id UUID REFERENCES medical_manufacturers(id) ON DELETE SET NULL,
  lot_number      TEXT,
  serial_number   TEXT,
  manufacture_date DATE,
  expiry_date     DATE,
  received_date   DATE DEFAULT CURRENT_DATE,
  quantity_received  NUMERIC(18,4) NOT NULL DEFAULT 0,
  quantity_on_hand   NUMERIC(18,4) NOT NULL DEFAULT 0,
  quantity_reserved  NUMERIC(18,4) NOT NULL DEFAULT 0,
  unit_cost          NUMERIC(15,4) NOT NULL DEFAULT 0,
  purchase_price     NUMERIC(15,4),
  selling_price      NUMERIC(15,4),
  storage_location   TEXT,
  storage_bin        TEXT,
  status             batch_status NOT NULL DEFAULT 'actif',
  recall_reason      TEXT,
  recall_date        DATE,
  notes              TEXT,
  po_item_id         UUID,
  created_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS med_batches_item_idx    ON medical_batches(item_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS med_batches_expiry_idx  ON medical_batches(expiry_date) WHERE deleted_at IS NULL AND status = 'actif';
CREATE INDEX IF NOT EXISTS med_batches_lot_idx     ON medical_batches(lot_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS med_batches_status_idx  ON medical_batches(status) WHERE deleted_at IS NULL;

-- ── 7. medical_stock_movements ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_stock_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         UUID NOT NULL REFERENCES medical_items(id) ON DELETE RESTRICT,
  batch_id        UUID REFERENCES medical_batches(id) ON DELETE SET NULL,
  movement_type   medical_movement_type NOT NULL,
  quantity        NUMERIC(18,4) NOT NULL,
  quantity_before NUMERIC(18,4) NOT NULL,
  quantity_after  NUMERIC(18,4) NOT NULL,
  unit_cost       NUMERIC(15,4) DEFAULT 0,
  total_cost      NUMERIC(15,2) DEFAULT 0,
  -- Reference to source document
  reference_type  TEXT, -- 'po','transfer','adjustment','consumption','inventory'
  reference_id    UUID,
  source_location TEXT,
  dest_location   TEXT,
  -- Who/when
  performed_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  performed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS med_mvt_item_idx  ON medical_stock_movements(item_id);
CREATE INDEX IF NOT EXISTS med_mvt_batch_idx ON medical_stock_movements(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS med_mvt_type_idx  ON medical_stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS med_mvt_date_idx  ON medical_stock_movements(performed_at DESC);
CREATE INDEX IF NOT EXISTS med_mvt_ref_idx   ON medical_stock_movements(reference_type, reference_id) WHERE reference_id IS NOT NULL;

-- ── 8. medical_purchase_orders ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_purchase_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number       TEXT NOT NULL DEFAULT 'PO-' || LPAD(nextval('medical_po_number_seq')::TEXT, 8, '0'),
  supplier_id     UUID NOT NULL REFERENCES medical_suppliers(id) ON DELETE RESTRICT,
  status          medical_po_status NOT NULL DEFAULT 'brouillon',
  order_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date   DATE,
  received_date   DATE,
  total_amount    NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'DZD',
  payment_terms   TEXT,
  delivery_terms  TEXT,
  shipping_address TEXT,
  notes           TEXT,
  internal_notes  TEXT,
  approved_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  received_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  version         INT NOT NULL DEFAULT 1
);
DO $$ BEGIN
  ALTER TABLE medical_purchase_orders ADD CONSTRAINT med_po_number_unique UNIQUE (po_number);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS med_po_supplier_idx ON medical_purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS med_po_status_idx   ON medical_purchase_orders(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS med_po_date_idx     ON medical_purchase_orders(order_date DESC);

-- ── 9. medical_purchase_order_items ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_purchase_order_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id            UUID NOT NULL REFERENCES medical_purchase_orders(id) ON DELETE CASCADE,
  item_id          UUID NOT NULL REFERENCES medical_items(id) ON DELETE RESTRICT,
  quantity_ordered NUMERIC(18,4) NOT NULL,
  quantity_received NUMERIC(18,4) NOT NULL DEFAULT 0,
  unit_cost        NUMERIC(15,4) NOT NULL,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  tax_percent      NUMERIC(5,2) DEFAULT 0,
  net_cost         NUMERIC(15,4) NOT NULL,
  total_cost       NUMERIC(15,2) NOT NULL,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS med_poi_po_idx   ON medical_purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS med_poi_item_idx ON medical_purchase_order_items(item_id);

-- ── 10. medical_stock_adjustments ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_stock_adjustments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adj_number     TEXT NOT NULL DEFAULT 'ADJ-' || LPAD(nextval('medical_adj_number_seq')::TEXT, 8, '0'),
  item_id        UUID NOT NULL REFERENCES medical_items(id) ON DELETE RESTRICT,
  batch_id       UUID REFERENCES medical_batches(id) ON DELETE SET NULL,
  reason         medical_adj_reason NOT NULL,
  quantity_before NUMERIC(18,4) NOT NULL,
  quantity_change NUMERIC(18,4) NOT NULL, -- positive=add, negative=remove
  quantity_after  NUMERIC(18,4) NOT NULL,
  unit_cost      NUMERIC(15,4) DEFAULT 0,
  total_value    NUMERIC(15,2) DEFAULT 0,
  notes          TEXT,
  document_ref   TEXT,
  approved_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at    TIMESTAMPTZ,
  created_by     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ
);
DO $$ BEGIN
  ALTER TABLE medical_stock_adjustments ADD CONSTRAINT med_adj_number_unique UNIQUE (adj_number);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS med_adj_item_idx ON medical_stock_adjustments(item_id);
CREATE INDEX IF NOT EXISTS med_adj_date_idx ON medical_stock_adjustments(created_at DESC);

-- ── 11. medical_stock_transfers ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_stock_transfers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_number TEXT NOT NULL DEFAULT 'TRF-' || LPAD(nextval('medical_transfer_seq')::TEXT, 8, '0'),
  from_location   TEXT NOT NULL,
  to_location     TEXT NOT NULL,
  status          medical_transfer_status NOT NULL DEFAULT 'brouillon',
  transfer_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  received_date   DATE,
  notes           TEXT,
  approved_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  received_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);
DO $$ BEGIN
  ALTER TABLE medical_stock_transfers ADD CONSTRAINT med_trf_number_unique UNIQUE (transfer_number);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS med_trf_status_idx ON medical_stock_transfers(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS med_trf_date_idx   ON medical_stock_transfers(transfer_date DESC);

-- ── 12. medical_transfer_items ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_transfer_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id    UUID NOT NULL REFERENCES medical_stock_transfers(id) ON DELETE CASCADE,
  item_id        UUID NOT NULL REFERENCES medical_items(id) ON DELETE RESTRICT,
  batch_id       UUID REFERENCES medical_batches(id) ON DELETE SET NULL,
  quantity_sent  NUMERIC(18,4) NOT NULL,
  quantity_received NUMERIC(18,4) DEFAULT 0,
  unit_cost      NUMERIC(15,4) DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS med_tri_transfer_idx ON medical_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS med_tri_item_idx     ON medical_transfer_items(item_id);

-- ── 13. medical_consumptions ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_consumptions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cons_number      TEXT NOT NULL DEFAULT 'CONS-' || LPAD(nextval('medical_cons_number_seq')::TEXT, 8, '0'),
  department       TEXT NOT NULL,
  patient_id       UUID REFERENCES patients(id) ON DELETE SET NULL,
  encounter_id     UUID REFERENCES encounters(id) ON DELETE SET NULL,
  status           cons_status NOT NULL DEFAULT 'brouillon',
  consumption_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes            TEXT,
  validated_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  validated_at     TIMESTAMPTZ,
  created_by       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);
DO $$ BEGIN
  ALTER TABLE medical_consumptions ADD CONSTRAINT med_cons_number_unique UNIQUE (cons_number);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS med_cons_dept_idx  ON medical_consumptions(department) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS med_cons_date_idx  ON medical_consumptions(consumption_date DESC);
CREATE INDEX IF NOT EXISTS med_cons_patient_idx ON medical_consumptions(patient_id) WHERE patient_id IS NOT NULL;

-- ── 14. medical_consumption_items ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_consumption_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumption_id UUID NOT NULL REFERENCES medical_consumptions(id) ON DELETE CASCADE,
  item_id        UUID NOT NULL REFERENCES medical_items(id) ON DELETE RESTRICT,
  batch_id       UUID REFERENCES medical_batches(id) ON DELETE SET NULL,
  quantity       NUMERIC(18,4) NOT NULL,
  unit_cost      NUMERIC(15,4) DEFAULT 0,
  total_cost     NUMERIC(15,2) DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS med_coni_cons_idx  ON medical_consumption_items(consumption_id);
CREATE INDEX IF NOT EXISTS med_coni_item_idx  ON medical_consumption_items(item_id);

-- ── 15. medical_expirations ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_expirations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      UUID NOT NULL REFERENCES medical_items(id) ON DELETE CASCADE,
  batch_id     UUID NOT NULL REFERENCES medical_batches(id) ON DELETE CASCADE,
  expiry_date  DATE NOT NULL,
  quantity     NUMERIC(18,4) NOT NULL DEFAULT 0,
  alert_sent   BOOLEAN NOT NULL DEFAULT FALSE,
  alert_90d    BOOLEAN NOT NULL DEFAULT FALSE,
  alert_30d    BOOLEAN NOT NULL DEFAULT FALSE,
  alert_7d     BOOLEAN NOT NULL DEFAULT FALSE,
  is_processed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS med_exp_item_idx   ON medical_expirations(item_id);
CREATE INDEX IF NOT EXISTS med_exp_expiry_idx ON medical_expirations(expiry_date) WHERE is_processed = FALSE;
DO $$ BEGIN
  ALTER TABLE medical_expirations ADD CONSTRAINT med_exp_batch_unique UNIQUE (batch_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 16. medical_inventory_sessions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_inventory_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_number   TEXT NOT NULL DEFAULT 'INV-' || LPAD(nextval('medical_inventory_seq')::TEXT, 6, '0'),
  name             TEXT NOT NULL,
  description      TEXT,
  location         TEXT,
  status           medical_inventory_status NOT NULL DEFAULT 'en_cours',
  start_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date         DATE,
  total_items      INT NOT NULL DEFAULT 0,
  items_counted    INT NOT NULL DEFAULT 0,
  variance_count   INT NOT NULL DEFAULT 0,
  variance_value   NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes            TEXT,
  validated_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  validated_at     TIMESTAMPTZ,
  created_by       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);
DO $$ BEGIN
  ALTER TABLE medical_inventory_sessions ADD CONSTRAINT med_inv_session_number_unique UNIQUE (session_number);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS med_inv_status_idx ON medical_inventory_sessions(status) WHERE deleted_at IS NULL;

-- ── 17. medical_inventory_items ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_inventory_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID NOT NULL REFERENCES medical_inventory_sessions(id) ON DELETE CASCADE,
  item_id        UUID NOT NULL REFERENCES medical_items(id) ON DELETE RESTRICT,
  batch_id       UUID REFERENCES medical_batches(id) ON DELETE SET NULL,
  theoretical_qty NUMERIC(18,4) NOT NULL DEFAULT 0,
  counted_qty    NUMERIC(18,4),
  variance       NUMERIC(18,4) GENERATED ALWAYS AS (
    CASE WHEN counted_qty IS NOT NULL THEN counted_qty - theoretical_qty ELSE NULL END
  ) STORED,
  unit_cost      NUMERIC(15,4) DEFAULT 0,
  variance_value NUMERIC(15,2) GENERATED ALWAYS AS (
    CASE WHEN counted_qty IS NOT NULL THEN (counted_qty - theoretical_qty) * unit_cost ELSE NULL END
  ) STORED,
  is_counted     BOOLEAN NOT NULL DEFAULT FALSE,
  notes          TEXT,
  counted_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  counted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS med_invi_session_idx ON medical_inventory_items(session_id);
CREATE INDEX IF NOT EXISTS med_invi_item_idx    ON medical_inventory_items(item_id);
CREATE INDEX IF NOT EXISTS med_invi_counted_idx ON medical_inventory_items(session_id, is_counted);

-- ── Views ──────────────────────────────────────────────────────────────────

-- v_medical_stock_summary: current stock level per item with status flags
CREATE OR REPLACE VIEW v_medical_stock_summary AS
SELECT
  i.id,
  i.code,
  i.name,
  i.generic_name,
  i.item_type,
  i.quantity_on_hand,
  i.quantity_reserved,
  i.quantity_on_hand - i.quantity_reserved AS quantity_available,
  i.quantity_on_order,
  i.reorder_point,
  i.min_stock_level,
  i.max_stock_level,
  i.unit_cost,
  i.average_cost,
  i.quantity_on_hand * i.average_cost AS stock_value,
  CASE
    WHEN i.quantity_on_hand <= 0 THEN 'rupture'
    WHEN i.quantity_on_hand <= i.min_stock_level THEN 'critique'
    WHEN i.quantity_on_hand <= i.reorder_point THEN 'faible'
    WHEN i.max_stock_level IS NOT NULL AND i.quantity_on_hand > i.max_stock_level THEN 'surstock'
    ELSE 'normal'
  END AS stock_status,
  cat.name AS category_name,
  u.symbol AS unit_symbol,
  -- Nearest expiry
  (SELECT MIN(b.expiry_date)
   FROM medical_batches b
   WHERE b.item_id = i.id AND b.status = 'actif'
     AND b.quantity_on_hand > 0 AND b.deleted_at IS NULL) AS nearest_expiry,
  i.is_active
FROM medical_items i
LEFT JOIN medical_categories cat ON cat.id = i.category_id
LEFT JOIN medical_units u ON u.id = i.unit_id
WHERE i.deleted_at IS NULL;

-- v_expiring_soon: batches expiring within 90 days
CREATE OR REPLACE VIEW v_expiring_soon AS
SELECT
  b.id AS batch_id,
  b.batch_number,
  b.lot_number,
  b.item_id,
  i.code AS item_code,
  i.name AS item_name,
  b.expiry_date,
  b.quantity_on_hand,
  b.unit_cost,
  (b.expiry_date - CURRENT_DATE) AS days_until_expiry,
  CASE
    WHEN b.expiry_date < CURRENT_DATE THEN 'expire'
    WHEN b.expiry_date <= CURRENT_DATE + 7  THEN 'critique_7j'
    WHEN b.expiry_date <= CURRENT_DATE + 30 THEN 'urgent_30j'
    WHEN b.expiry_date <= CURRENT_DATE + 90 THEN 'attention_90j'
    ELSE 'ok'
  END AS expiry_status
FROM medical_batches b
JOIN medical_items i ON i.id = b.item_id
WHERE b.deleted_at IS NULL
  AND b.status = 'actif'
  AND b.quantity_on_hand > 0
  AND b.expiry_date <= CURRENT_DATE + 90
ORDER BY b.expiry_date;

-- ── Trigger: auto-update medical_expirations on batch insert/update ────────
CREATE OR REPLACE FUNCTION sync_medical_expiration()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.expiry_date IS NOT NULL THEN
    INSERT INTO medical_expirations (item_id, batch_id, expiry_date, quantity)
    VALUES (NEW.item_id, NEW.id, NEW.expiry_date, NEW.quantity_on_hand)
    ON CONFLICT (batch_id) DO UPDATE
      SET expiry_date = EXCLUDED.expiry_date,
          quantity    = EXCLUDED.quantity,
          updated_at  = NOW();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sync_expiration ON medical_batches;
CREATE TRIGGER trg_sync_expiration
  AFTER INSERT OR UPDATE ON medical_batches
  FOR EACH ROW EXECUTE FUNCTION sync_medical_expiration();

-- ── Trigger: never allow negative stock ────────────────────────────────────
CREATE OR REPLACE FUNCTION check_no_negative_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.quantity_on_hand < 0 THEN
    RAISE EXCEPTION 'Stock cannot be negative for item %: attempted %', NEW.code, NEW.quantity_on_hand;
  END IF;
  IF NEW.quantity_reserved < 0 THEN
    NEW.quantity_reserved := 0;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_no_negative_stock ON medical_items;
CREATE TRIGGER trg_no_negative_stock
  BEFORE UPDATE ON medical_items
  FOR EACH ROW EXECUTE FUNCTION check_no_negative_stock();

-- Seed default categories
INSERT INTO medical_categories (code, name, description, color, sort_order) VALUES
  ('MEDS',    'Médicaments',             'Médicaments et spécialités pharmaceutiques', '#3B82F6', 1),
  ('CONS',    'Consommables',            'Consommables médicaux et de soin',            '#10B981', 2),
  ('REACTIF', 'Réactifs',                'Réactifs de laboratoire',                     '#8B5CF6', 3),
  ('EQUIP',   'Équipements',             'Équipements et matériel médical',             '#F59E0B', 4),
  ('DM',      'Dispositifs médicaux',    'Dispositifs médicaux implantables',           '#EF4444', 5),
  ('HYGIENE', 'Hygiène et désinfection', 'Produits d''hygiène et de désinfection',      '#06B6D4', 6)
ON CONFLICT (code) DO NOTHING;

-- Seed default units
INSERT INTO medical_units (code, name, symbol) VALUES
  ('COMP', 'Comprimé',    'cp'),
  ('AMP',  'Ampoule',     'amp'),
  ('FL',   'Flacon',      'fl'),
  ('SAC',  'Sachet',      'sac'),
  ('PCH',  'Poche',       'pch'),
  ('ML',   'Millilitre',  'mL'),
  ('MG',   'Milligramme', 'mg'),
  ('G',    'Gramme',      'g'),
  ('KG',   'Kilogramme',  'kg'),
  ('L',    'Litre',       'L'),
  ('PCS',  'Pièce',       'pcs'),
  ('BTE',  'Boîte',       'bte'),
  ('ROL',  'Rouleau',     'rol'),
  ('PAR',  'Paire',       'par'),
  ('COND', 'Conditionnement', 'cond')
ON CONFLICT (code) DO NOTHING;

COMMIT;
