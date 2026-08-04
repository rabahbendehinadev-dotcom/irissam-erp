-- ── Migration 031: Patient Portal OTP Security & Preview Tokens ───────────────
-- 1. Replace plain-text otp_code with HMAC-SHA256 otp_hash
-- 2. Add internal_only flag to document_records
-- 3. Add publication fields to encounters (discharge docs foundation)
-- 4. Create portal_preview_tokens table (5-min read-only staff preview)
-- 5. Insert patient_portal.accounts.preview permission

-- ── 1. OTP: rename otp_code → otp_hash ───────────────────────────────────────
ALTER TABLE patient_portal_accounts
  ADD COLUMN IF NOT EXISTS otp_hash TEXT;

-- Invalidate existing plain-text OTPs (cannot hash retroactively)
UPDATE patient_portal_accounts SET otp_hash = NULL WHERE otp_code IS NOT NULL;

ALTER TABLE patient_portal_accounts DROP COLUMN IF EXISTS otp_code;

-- ── 2. internal_only on document_records ─────────────────────────────────────
ALTER TABLE document_records
  ADD COLUMN IF NOT EXISTS internal_only BOOLEAN NOT NULL DEFAULT FALSE;

-- Propagate from existing confidentiality flags
UPDATE document_records
SET internal_only = TRUE
WHERE confidentiality IN ('direction_only','hr_confidential','finance_confidential','medical_confidential');

-- ── 3. Discharge publication fields on encounters ─────────────────────────────
ALTER TABLE encounters
  ADD COLUMN IF NOT EXISTS published_to_patient BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS published_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unpublished_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unpublished_by       UUID REFERENCES users(id) ON DELETE SET NULL;

-- ── 4. Preview tokens table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portal_preview_tokens (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID        NOT NULL REFERENCES patient_portal_accounts(id) ON DELETE CASCADE,
  patient_id    UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  staff_user_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT        NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '5 minutes',
  used_at       TIMESTAMPTZ,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_preview_tokens_active
  ON portal_preview_tokens(token_hash)
  WHERE used_at IS NULL;

-- ── 5. New permission ─────────────────────────────────────────────────────────
INSERT INTO permissions (name, module, description) VALUES
  ('patient_portal.accounts.preview', 'patient_portal', 'Apercu portail patient en mode lecture seule')
ON CONFLICT (name) DO NOTHING;

DO $$
DECLARE
  v_role_id UUID;
  v_perm_id UUID;
BEGIN
  SELECT id INTO v_perm_id FROM permissions WHERE name = 'patient_portal.accounts.preview';
  FOR v_role_id IN
    SELECT id FROM roles WHERE name IN ('administrateur','directeur','medecin_chef','secretaire_medicale')
  LOOP
    INSERT INTO role_permissions (role_id, permission_id) VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
