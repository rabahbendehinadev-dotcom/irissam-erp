-- =============================================================================
-- Migration 014 — HR Module: Expand permissions + new roles
-- Replaces the 2 generic hr.* permissions with 30 granular ones.
-- Safe to run multiple times (ON CONFLICT DO NOTHING).
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Remove old generic HR permissions from role_permissions first
--    (we replace with granular ones; super_admin keeps all via wildcard below)
-- ---------------------------------------------------------------------------
DELETE FROM role_permissions
WHERE permission_id IN (
  SELECT id FROM permissions WHERE name IN ('hr.view','hr.manage')
);

DELETE FROM permissions WHERE name IN ('hr.view','hr.manage');

-- ---------------------------------------------------------------------------
-- 2. Insert 30 granular HR permissions
-- ---------------------------------------------------------------------------
INSERT INTO permissions (name, module, description) VALUES
  ('hr.view',                    'hr', 'Accéder au module RH'),
  ('hr.dashboard.view',          'hr', 'Voir le tableau de bord RH'),
  ('hr.employees.view',          'hr', 'Consulter les employés'),
  ('hr.employees.create',        'hr', 'Créer un employé'),
  ('hr.employees.update',        'hr', 'Modifier un employé'),
  ('hr.employees.archive',       'hr', 'Archiver un employé'),
  ('hr.contracts.view',          'hr', 'Voir les contrats'),
  ('hr.contracts.create',        'hr', 'Créer un contrat'),
  ('hr.contracts.update',        'hr', 'Modifier un contrat'),
  ('hr.contracts.renew',         'hr', 'Renouveler un contrat'),
  ('hr.planning.view',           'hr', 'Voir le planning'),
  ('hr.planning.manage',         'hr', 'Gérer le planning'),
  ('hr.attendance.view',         'hr', 'Voir la présence'),
  ('hr.attendance.create',       'hr', 'Enregistrer une présence'),
  ('hr.attendance.correct',      'hr', 'Corriger une présence'),
  ('hr.absences.view',           'hr', 'Voir les absences'),
  ('hr.absences.manage',         'hr', 'Gérer les absences'),
  ('hr.leaves.view',             'hr', 'Voir les congés'),
  ('hr.leaves.create',           'hr', 'Créer une demande de congé'),
  ('hr.leaves.manager_approve',  'hr', 'Approuver congé (manager)'),
  ('hr.leaves.hr_approve',       'hr', 'Approuver congé (RH)'),
  ('hr.overtime.view',           'hr', 'Voir les heures supplémentaires'),
  ('hr.overtime.approve',        'hr', 'Approuver les heures supplémentaires'),
  ('hr.badges.view',             'hr', 'Voir les badges'),
  ('hr.badges.manage',           'hr', 'Gérer les badges'),
  ('hr.documents.view',          'hr', 'Voir les documents RH'),
  ('hr.documents.upload',        'hr', 'Téléverser des documents RH'),
  ('hr.documents.delete',        'hr', 'Supprimer des documents RH'),
  ('hr.reports.view',            'hr', 'Voir les rapports RH'),
  ('hr.export',                  'hr', 'Exporter les données RH'),
  ('hr.settings.manage',         'hr', 'Gérer les paramètres RH')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. New roles: hr_manager, hr_officer, manager, employee
-- ---------------------------------------------------------------------------
INSERT INTO roles (name, display_name, description) VALUES
  ('hr_manager', 'Responsable RH',      'Gestion complète des ressources humaines'),
  ('hr_officer', 'Chargé RH',           'Opérations RH quotidiennes'),
  ('manager',    'Manager / Chef de service', 'Gestion de son équipe uniquement'),
  ('employee',   'Employé',             'Accès à son propre dossier uniquement')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. super_admin: grant all new hr.* permissions
-- ---------------------------------------------------------------------------
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'super_admin'
  AND p.module = 'hr'
ON CONFLICT DO NOTHING;

-- administrator: same as super_admin for HR
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'administrator'
  AND p.module = 'hr'
ON CONFLICT DO NOTHING;

-- director: read access to HR
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'director'
  AND p.name IN (
    'hr.view','hr.dashboard.view',
    'hr.employees.view','hr.contracts.view',
    'hr.planning.view','hr.attendance.view',
    'hr.absences.view','hr.leaves.view',
    'hr.overtime.view','hr.badges.view',
    'hr.documents.view','hr.reports.view'
  )
ON CONFLICT DO NOTHING;

-- hr_manager: full HR access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'hr_manager'
  AND p.module = 'hr'
ON CONFLICT DO NOTHING;

-- hr_officer: most HR ops except settings and delete
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'hr_officer'
  AND p.name IN (
    'hr.view','hr.dashboard.view',
    'hr.employees.view','hr.employees.create','hr.employees.update',
    'hr.contracts.view','hr.contracts.create','hr.contracts.update','hr.contracts.renew',
    'hr.planning.view','hr.planning.manage',
    'hr.attendance.view','hr.attendance.create','hr.attendance.correct',
    'hr.absences.view','hr.absences.manage',
    'hr.leaves.view','hr.leaves.create','hr.leaves.hr_approve',
    'hr.overtime.view','hr.overtime.approve',
    'hr.badges.view','hr.badges.manage',
    'hr.documents.view','hr.documents.upload',
    'hr.reports.view','hr.export'
  )
ON CONFLICT DO NOTHING;

-- manager: limited to own team
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'manager'
  AND p.name IN (
    'hr.view',
    'hr.employees.view',
    'hr.planning.view','hr.planning.manage',
    'hr.attendance.view',
    'hr.absences.view',
    'hr.leaves.view','hr.leaves.create','hr.leaves.manager_approve',
    'hr.overtime.view',
    'hr.documents.view'
  )
ON CONFLICT DO NOTHING;

-- employee: own profile only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'employee'
  AND p.name IN (
    'hr.view',
    'hr.leaves.view','hr.leaves.create',
    'hr.attendance.view',
    'hr.documents.view'
  )
ON CONFLICT DO NOTHING;

-- existing hr role: hr_manager level
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'hr'
  AND p.module = 'hr'
ON CONFLICT DO NOTHING;

COMMIT;
