-- =============================================================================
-- Migration 029 — Patient Portal Staff Permissions
-- =============================================================================

INSERT INTO permissions (name, description, module) VALUES
  ('patient_portal.accounts.view',       'Voir les comptes du portail patient',             'patient_portal'),
  ('patient_portal.accounts.create',     'Créer un compte portail patient',                 'patient_portal'),
  ('patient_portal.accounts.activate',   'Activer / désactiver un compte portail patient',  'patient_portal'),
  ('patient_portal.accounts.suspend',    'Suspendre un compte portail patient',             'patient_portal'),
  ('patient_portal.results.publish',     'Publier les résultats de labo au patient',        'patient_portal'),
  ('patient_portal.imaging.publish',     'Publier les rapports imagerie au patient',        'patient_portal'),
  ('patient_portal.documents.publish',   'Publier des documents au patient',                'patient_portal'),
  ('patient_portal.appointments.manage', 'Gérer les demandes de rendez-vous portail',       'patient_portal'),
  ('patient_portal.messages.manage',     'Gérer les messages du portail patient',           'patient_portal'),
  ('patient_portal.consent.manage',      'Gérer les consentements du portail patient',      'patient_portal'),
  ('patient_portal.audit.view',          'Consulter les logs d''accès du portail patient',  'patient_portal')
ON CONFLICT (name) DO NOTHING;

-- Grant portal permissions to super_admin and medecin_chef
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name IN ('super_admin','medecin_chef','infirmier_chef','secretaire_medicale','technicien_laboratoire','radiologue')
  AND p.name LIKE 'patient_portal.%'
ON CONFLICT DO NOTHING;
