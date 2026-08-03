-- ============================================================================
-- Migration 018 — Biomedical RBAC permissions
-- ============================================================================
BEGIN;

-- ── Insert permissions ──────────────────────────────────────────────────────
INSERT INTO permissions (name, description, module) VALUES
  ('biomed.equipment.view',      'Voir les équipements biomédicaux',        'biomedical'),
  ('biomed.equipment.create',    'Créer un équipement biomédical',          'biomedical'),
  ('biomed.equipment.edit',      'Modifier un équipement biomédical',       'biomedical'),
  ('biomed.equipment.delete',    'Supprimer un équipement biomédical',      'biomedical'),
  ('biomed.maintenance.view',    'Voir les maintenances',                   'biomedical'),
  ('biomed.maintenance.manage',  'Gérer les ordres de travail',             'biomedical'),
  ('biomed.calibration.view',    'Voir les calibrations',                   'biomedical'),
  ('biomed.calibration.manage',  'Gérer les calibrations',                  'biomedical'),
  ('biomed.incident.view',       'Voir les incidents biomédicaux',          'biomedical'),
  ('biomed.incident.manage',     'Gérer les incidents biomédicaux',         'biomedical'),
  ('biomed.contract.view',       'Voir les contrats biomédicaux',           'biomedical'),
  ('biomed.contract.manage',     'Gérer les contrats biomédicaux',          'biomedical'),
  ('biomed.spare_parts.view',    'Voir les pièces détachées',               'biomedical'),
  ('biomed.spare_parts.manage',  'Gérer les pièces détachées',              'biomedical'),
  ('biomed.inspection.view',     'Voir les inspections',                    'biomedical'),
  ('biomed.inspection.manage',   'Gérer les inspections',                   'biomedical'),
  ('biomed.disposal.view',       'Voir les réformes d''équipements',        'biomedical'),
  ('biomed.disposal.manage',     'Gérer les réformes d''équipements',       'biomedical'),
  ('biomed.dashboard.view',      'Voir le tableau de bord biomédical',      'biomedical'),
  ('biomed.reports.view',        'Voir les rapports biomédicaux',           'biomedical')
ON CONFLICT (name) DO NOTHING;

-- ── Grant to super_admin + directeur + admin → ALL ──────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('super_admin','directeur','admin')
  AND p.module = 'biomedical'
ON CONFLICT DO NOTHING;

-- ── Grant to technicien_biomed → all biomed.* ──────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'technicien_biomed') THEN
    INSERT INTO roles (name, display_name, description)
    VALUES ('technicien_biomed','Technicien Biomédical','Technicien de maintenance biomédicale');
  END IF;
END $$;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'technicien_biomed' AND p.module = 'biomedical'
ON CONFLICT DO NOTHING;

-- ── Grant to medecin_chef, infirmier_chef → view only ──────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('medecin_chef','medecin','infirmier_chef')
  AND p.name IN (
    'biomed.equipment.view','biomed.maintenance.view',
    'biomed.calibration.view','biomed.incident.view',
    'biomed.inspection.view','biomed.dashboard.view'
  )
ON CONFLICT DO NOTHING;

-- ── Grant to comptable → contract + dashboard ───────────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'comptable'
  AND p.name IN ('biomed.contract.view','biomed.dashboard.view','biomed.reports.view')
ON CONFLICT DO NOTHING;

-- ── Ensure admin user has the new role perms too ───────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_role_type_enum WHERE enumlabel = 'technicien_biomed' ) THEN NULL; END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

COMMIT;
