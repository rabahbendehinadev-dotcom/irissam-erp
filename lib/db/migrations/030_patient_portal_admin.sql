-- ── Migration 030: Patient Portal Admin ───────────────────────────────────────
-- Adds unpublish tracking columns to publishable tables,
-- fixes prescription publish defaults,
-- and inserts all new patient_portal admin permissions.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename='lab_orders') THEN
    RAISE EXCEPTION 'lab_orders missing — run earlier migrations first';
  END IF;
END $$;

-- ── lab_orders ────────────────────────────────────────────────────────────────
ALTER TABLE lab_orders
  ADD COLUMN IF NOT EXISTS unpublished_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unpublished_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS publication_note TEXT;

-- ── imaging_orders ────────────────────────────────────────────────────────────
ALTER TABLE imaging_orders
  ADD COLUMN IF NOT EXISTS unpublished_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unpublished_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS publication_note TEXT;

-- ── prescriptions ─────────────────────────────────────────────────────────────
ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS published_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unpublished_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unpublished_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS publication_note   TEXT,
  ADD COLUMN IF NOT EXISTS patient_visible_note TEXT;

-- Fix default: prescriptions should require explicit publish action
ALTER TABLE prescriptions
  ALTER COLUMN published_to_patient SET DEFAULT FALSE;

-- ── document_records ──────────────────────────────────────────────────────────
ALTER TABLE document_records
  ADD COLUMN IF NOT EXISTS published_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unpublished_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unpublished_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS publication_note TEXT;

-- ── New permissions ───────────────────────────────────────────────────────────
INSERT INTO permissions (name, module, description) VALUES
  ('patient_portal.results.publish',         'patient_portal', 'Publier lab/imagerie sur le portail patient'),
  ('patient_portal.results.unpublish',       'patient_portal', 'Retirer lab/imagerie du portail patient'),
  ('patient_portal.prescriptions.publish',   'patient_portal', 'Publier ordonnances sur le portail patient'),
  ('patient_portal.documents.publish',       'patient_portal', 'Publier documents GED sur le portail patient'),
  ('patient_portal.documents.unpublish',     'patient_portal', 'Retirer documents GED du portail patient'),
  ('patient_portal.bulk_publish',            'patient_portal', 'Publier plusieurs enregistrements simultanement'),
  ('patient_portal.accounts.view',           'patient_portal', 'Consulter les comptes portail patient'),
  ('patient_portal.accounts.create',         'patient_portal', 'Creer des comptes portail patient'),
  ('patient_portal.accounts.activate',       'patient_portal', 'Generer codes activation portail patient'),
  ('patient_portal.accounts.suspend',        'patient_portal', 'Suspendre ou reactiver des comptes portail'),
  ('patient_portal.accounts.unlock',         'patient_portal', 'Deverrouiller des comptes portail verrouilles'),
  ('patient_portal.accounts.revoke_sessions','patient_portal', 'Revoquer toutes les sessions portail'),
  ('patient_portal.accounts.view_audit',     'patient_portal', 'Consulter les journaux acces portail patient')
ON CONFLICT (name) DO NOTHING;

-- ── Grant permissions to relevant roles ──────────────────────────────────────
DO $$
DECLARE
  v_role_id UUID;
  v_perm_id UUID;
BEGIN
  -- Medecin/biologiste/radiologue: publish/unpublish lab, imaging, prescriptions
  FOR v_role_id IN
    SELECT id FROM roles WHERE name IN ('medecin','medecin_chef','biologiste','radiologue')
  LOOP
    FOR v_perm_id IN
      SELECT id FROM permissions WHERE name IN (
        'patient_portal.results.publish','patient_portal.results.unpublish',
        'patient_portal.prescriptions.publish'
      )
    LOOP
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  -- Techniciens: publish/unpublish results
  FOR v_role_id IN
    SELECT id FROM roles WHERE name IN ('infirmier','technicien_labo','technicien_radio')
  LOOP
    FOR v_perm_id IN
      SELECT id FROM permissions WHERE name IN (
        'patient_portal.results.publish','patient_portal.results.unpublish'
      )
    LOOP
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  -- Secretaire/DIM/archiviste: publish/unpublish documents
  FOR v_role_id IN
    SELECT id FROM roles WHERE name IN ('secretaire_medicale','dim','archiviste')
  LOOP
    FOR v_perm_id IN
      SELECT id FROM permissions WHERE name IN (
        'patient_portal.documents.publish','patient_portal.documents.unpublish'
      )
    LOOP
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  -- Administrateur/directeur: all portal admin permissions
  FOR v_role_id IN
    SELECT id FROM roles WHERE name IN ('administrateur','directeur')
  LOOP
    FOR v_perm_id IN
      SELECT id FROM permissions WHERE name LIKE 'patient_portal.%'
    LOOP
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  -- Reception/agent_accueil: account management
  FOR v_role_id IN
    SELECT id FROM roles WHERE name IN ('reception','agent_accueil')
  LOOP
    FOR v_perm_id IN
      SELECT id FROM permissions WHERE name IN (
        'patient_portal.accounts.view','patient_portal.accounts.create',
        'patient_portal.accounts.activate','patient_portal.accounts.unlock',
        'patient_portal.accounts.revoke_sessions'
      )
    LOOP
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
