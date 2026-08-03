-- Migration 012 — Database-level overpayment guards
-- Adds CHECK constraints to prevent negative amounts and paid > total at the DB layer.
-- Uses idempotent DO $$ blocks so re-running is safe.
BEGIN;

-- invoices: paid_amount >= 0 and <= total_amount (+ 0.01 float tolerance)
DO $$ BEGIN
  ALTER TABLE invoices ADD CONSTRAINT chk_inv_paid_nonneg CHECK (paid_amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE invoices ADD CONSTRAINT chk_inv_rem_nonneg CHECK (remaining_amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE invoices ADD CONSTRAINT chk_inv_no_overpay CHECK (paid_amount <= total_amount + 0.01);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- insurance_claims: amount_paid_num >= 0
DO $$ BEGIN
  ALTER TABLE insurance_claims ADD CONSTRAINT chk_claim_paid_nonneg CHECK (amount_paid_num >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- insurance_bordereaux: total_paid >= 0
DO $$ BEGIN
  ALTER TABLE insurance_bordereaux ADD CONSTRAINT chk_bord_paid_nonneg CHECK (total_paid >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;
