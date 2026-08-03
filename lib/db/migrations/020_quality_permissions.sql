-- =============================================================================
-- Migration 020: Quality Module — RBAC permissions
-- =============================================================================
BEGIN;

-- ── Permissions ───────────────────────────────────────────────────────────
INSERT INTO permissions (name, description, module) VALUES
  ('quality.dashboard.view',      'Voir le tableau de bord qualité',          'quality'),
  ('quality.incidents.view',      'Consulter les incidents qualité',           'quality'),
  ('quality.incidents.create',    'Déclarer un incident qualité',              'quality'),
  ('quality.incidents.manage',    'Gérer le workflow des incidents',           'quality'),
  ('quality.nc.view',             'Consulter les non-conformités',             'quality'),
  ('quality.nc.manage',           'Gérer les non-conformités',                 'quality'),
  ('quality.capa.view',           'Consulter les CAPA',                        'quality'),
  ('quality.capa.manage',         'Gérer les CAPA',                            'quality'),
  ('quality.risks.view',          'Consulter le registre des risques',         'quality'),
  ('quality.risks.manage',        'Gérer le registre des risques',             'quality'),
  ('quality.audits.view',         'Consulter les audits',                      'quality'),
  ('quality.audits.manage',       'Gérer les audits qualité',                  'quality'),
  ('quality.documents.view',      'Consulter les documents qualité',           'quality'),
  ('quality.documents.manage',    'Gérer les documents qualité',               'quality'),
  ('quality.indicators.view',     'Consulter les indicateurs qualité',         'quality'),
  ('quality.indicators.manage',   'Gérer les indicateurs qualité',             'quality'),
  ('quality.meetings.view',       'Consulter les réunions qualité',            'quality'),
  ('quality.meetings.manage',     'Gérer les réunions qualité',                'quality'),
  ('quality.checklists.manage',   'Gérer les checklists qualité',              'quality'),
  ('quality.reports.view',        'Accéder aux rapports qualité',              'quality')
ON CONFLICT (name) DO NOTHING;

-- ── New role: responsable_qualite ─────────────────────────────────────────
INSERT INTO roles (name, display_name, description) VALUES
  ('responsable_qualite', 'Responsable Qualité', 'Responsable Assurance Qualité')
ON CONFLICT (name) DO NOTHING;

-- ── Grant all quality.* to super_admin, directeur, admin ─────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('super_admin','directeur','admin','responsable_qualite')
  AND p.module = 'quality'
ON CONFLICT DO NOTHING;

-- ── Grant view + create to medecin_chef, medecin, infirmier_chef ──────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('medecin_chef','medecin','infirmier_chef','infirmier')
  AND p.name IN (
    'quality.dashboard.view','quality.incidents.view','quality.incidents.create',
    'quality.nc.view','quality.capa.view','quality.risks.view',
    'quality.audits.view','quality.documents.view','quality.indicators.view',
    'quality.meetings.view','quality.reports.view'
  )
ON CONFLICT DO NOTHING;

-- ── Grant dashboard + incidents view to pharmacien, technicien_biomed ─────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('pharmacien','technicien_biomed')
  AND p.name IN (
    'quality.dashboard.view','quality.incidents.view','quality.incidents.create',
    'quality.documents.view'
  )
ON CONFLICT DO NOTHING;

COMMIT;
