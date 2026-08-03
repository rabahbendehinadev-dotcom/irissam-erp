-- =============================================================
-- Migration 023 — GED Permissions & RBAC
-- =============================================================
BEGIN;

-- ─── Permissions documents.* ─────────────────────────────────

INSERT INTO permissions (name, description, module) VALUES
  ('documents.view',             'Afficher la liste et le contenu des documents',         'ged'),
  ('documents.upload',           'Uploader un nouveau fichier',                           'ged'),
  ('documents.create_folder',    'Créer et gérer la structure des dossiers',              'ged'),
  ('documents.update_metadata',  'Modifier titre, description, tags, catégorie',          'ged'),
  ('documents.new_version',      'Créer une nouvelle version d''un document',             'ged'),
  ('documents.download',         'Télécharger les fichiers',                              'ged'),
  ('documents.print',            'Lancer l''impression d''un document',                   'ged'),
  ('documents.share',            'Partager un document avec d''autres utilisateurs',      'ged'),
  ('documents.approve',          'Valider un document dans un workflow',                  'ged'),
  ('documents.reject',           'Refuser un document dans un workflow',                  'ged'),
  ('documents.sign',             'Apposer une signature électronique interne',            'ged'),
  ('documents.archive',          'Archiver un document',                                  'ged'),
  ('documents.restore',          'Restaurer un document archivé ou supprimé',             'ged'),
  ('documents.delete_soft',      'Supprimer (soft delete) un document',                   'ged'),
  ('documents.purge',            'Suppression définitive (double validation requise)',     'ged'),
  ('documents.view_audit',       'Consulter les logs d''accès et d''actions',             'ged'),
  ('documents.manage_workflows', 'Créer et configurer les workflows d''approbation',      'ged'),
  ('documents.manage_retention', 'Définir et modifier les règles de conservation',        'ged'),
  ('documents.manage_access',    'Définir les règles d''accès granulaires',               'ged'),
  ('documents.export',           'Exporter la liste des documents et les rapports',       'ged')
ON CONFLICT (name) DO NOTHING;

-- ─── Assign to existing roles ────────────────────────────────

-- admin → all documents permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
  AND p.name LIKE 'documents.%'
ON CONFLICT DO NOTHING;

-- directeur_general → all
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'directeur_general' AND p.name LIKE 'documents.%'
ON CONFLICT DO NOTHING;

-- medecin_chef → view, upload, download, print, new_version, approve, sign, manage_workflows
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'medecin_chef'
  AND p.name IN (
    'documents.view','documents.upload','documents.download','documents.print',
    'documents.new_version','documents.approve','documents.sign',
    'documents.manage_workflows','documents.view_audit','documents.share',
    'documents.update_metadata','documents.create_folder','documents.archive'
  )
ON CONFLICT DO NOTHING;

-- medecin → view, upload, download, print, new_version, sign
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'medecin'
  AND p.name IN (
    'documents.view','documents.upload','documents.download','documents.print',
    'documents.new_version','documents.sign','documents.share','documents.update_metadata'
  )
ON CONFLICT DO NOTHING;

-- infirmier → view, upload, download, print
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'infirmier'
  AND p.name IN (
    'documents.view','documents.upload','documents.download','documents.print'
  )
ON CONFLICT DO NOTHING;

-- pharmacien → view, upload, download, print, update_metadata
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'pharmacien'
  AND p.name IN (
    'documents.view','documents.upload','documents.download','documents.print',
    'documents.update_metadata','documents.new_version'
  )
ON CONFLICT DO NOTHING;

-- responsable_rh → view, upload, download, print, approve, sign, manage_access for RH docs
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'responsable_rh'
  AND p.name IN (
    'documents.view','documents.upload','documents.download','documents.print',
    'documents.new_version','documents.approve','documents.sign',
    'documents.update_metadata','documents.create_folder','documents.archive',
    'documents.manage_access','documents.view_audit'
  )
ON CONFLICT DO NOTHING;

-- responsable_facturation → view, upload, download, print, approve
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'responsable_facturation'
  AND p.name IN (
    'documents.view','documents.upload','documents.download','documents.print',
    'documents.approve','documents.update_metadata','documents.archive'
  )
ON CONFLICT DO NOTHING;

-- responsable_qualite → all except purge
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'responsable_qualite'
  AND p.name LIKE 'documents.%'
  AND p.name != 'documents.purge'
ON CONFLICT DO NOTHING;

-- responsable_biomedical → view, upload, download, print, update_metadata, new_version
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'responsable_biomedical'
  AND p.name IN (
    'documents.view','documents.upload','documents.download','documents.print',
    'documents.update_metadata','documents.new_version','documents.archive'
  )
ON CONFLICT DO NOTHING;

-- gestionnaire_stock → view, upload, download, print
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'gestionnaire_stock'
  AND p.name IN ('documents.view','documents.upload','documents.download','documents.print')
ON CONFLICT DO NOTHING;

-- secretaire → view, upload, download, print, update_metadata, create_folder
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'secretaire'
  AND p.name IN (
    'documents.view','documents.upload','documents.download','documents.print',
    'documents.update_metadata','documents.create_folder'
  )
ON CONFLICT DO NOTHING;

-- ─── Index on permissions module ─────────────────────────────

CREATE INDEX IF NOT EXISTS idx_permissions_module_ged
  ON permissions(module) WHERE module = 'ged';

COMMIT;
