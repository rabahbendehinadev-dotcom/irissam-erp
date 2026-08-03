-- =============================================================================
-- Migration 021: Executive Dashboard / Business Intelligence — RBAC & Indexes
-- =============================================================================
BEGIN;

-- ── Permissions ───────────────────────────────────────────────────────────────
INSERT INTO permissions (name, description, module) VALUES
  ('executive.view',               'Accéder au tableau de bord direction',        'executive'),
  ('executive.view_medical',       'Voir les données médicales exécutives',        'executive'),
  ('executive.view_finance',       'Voir les données financières exécutives',      'executive'),
  ('executive.view_hr',            'Voir les données RH exécutives',               'executive'),
  ('executive.view_stock',         'Voir les données stock exécutives',            'executive'),
  ('executive.view_biomedical',    'Voir les données biomédicales exécutives',     'executive'),
  ('executive.view_quality',       'Voir les données qualité exécutives',          'executive'),
  ('executive.export_pdf',         'Exporter le rapport PDF direction',            'executive'),
  ('executive.export_excel',       'Exporter le rapport Excel direction',          'executive'),
  ('executive.view_sensitive',     'Voir les données sensibles direction',         'executive'),
  ('executive.configure_widgets',  'Configurer les widgets du tableau de bord',    'executive')
ON CONFLICT (name) DO NOTHING;

-- ── New executive roles ───────────────────────────────────────────────────────
INSERT INTO roles (name, display_name, description) VALUES
  ('directeur_general',  'Directeur Général',     'Directeur Général de l''établissement'),
  ('directeur_medical',  'Directeur Médical',     'Directeur des affaires médicales'),
  ('directeur_financier','Directeur Financier',   'Directeur administratif et financier'),
  ('directeur_rh',       'Directeur RH',          'Directeur des ressources humaines'),
  ('directeur_soins',    'Directeur des Soins',   'Directeur des soins infirmiers')
ON CONFLICT (name) DO NOTHING;

-- ── directeur_general — full access ──────────────────────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'directeur_general' AND p.module = 'executive'
ON CONFLICT DO NOTHING;

-- ── directeur_medical — medical + quality ────────────────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'directeur_medical'
  AND p.name IN (
    'executive.view','executive.view_medical','executive.view_quality',
    'executive.export_pdf','executive.export_excel'
  )
ON CONFLICT DO NOTHING;

-- ── directeur_financier — finance only ───────────────────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'directeur_financier'
  AND p.name IN (
    'executive.view','executive.view_finance','executive.view_sensitive',
    'executive.export_pdf','executive.export_excel'
  )
ON CONFLICT DO NOTHING;

-- ── directeur_rh — HR only ───────────────────────────────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'directeur_rh'
  AND p.name IN (
    'executive.view','executive.view_hr',
    'executive.export_pdf','executive.export_excel'
  )
ON CONFLICT DO NOTHING;

-- ── directeur_soins — medical + quality ──────────────────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'directeur_soins'
  AND p.name IN (
    'executive.view','executive.view_medical','executive.view_quality',
    'executive.export_pdf'
  )
ON CONFLICT DO NOTHING;

-- ── super_admin, directeur, admin get everything ─────────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('super_admin','directeur','admin') AND p.module = 'executive'
ON CONFLICT DO NOTHING;

-- ── responsable_qualite gets quality section ──────────────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'responsable_qualite'
  AND p.name IN ('executive.view','executive.view_quality','executive.export_pdf')
ON CONFLICT DO NOTHING;

COMMIT;

-- ── Performance indexes (outside transaction) ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_exec_admissions_date    ON admissions(admission_date, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_exec_invoices_date      ON invoices(invoice_date, status)     WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_exec_attendance_date    ON attendance_records(record_date, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_exec_emergency_status   ON emergency_visits(status, created_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_exec_consult_date       ON consultations(scheduled_at, status) WHERE deleted_at IS NULL;
