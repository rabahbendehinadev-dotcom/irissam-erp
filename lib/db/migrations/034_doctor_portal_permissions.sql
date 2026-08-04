-- Migration 034: Doctor Portal — permissions & role assignments
-- 25 permissions for the doctor_portal module.
-- Roles: super_admin, administrator, doctor, radiology get appropriate subsets.

BEGIN;

INSERT INTO permissions (name, module, description) VALUES
  ('doctor_portal.access',                  'doctor_portal', 'Accéder au Portail Médecin'),
  ('doctor_portal.dashboard.view',          'doctor_portal', 'Voir le tableau de bord médecin'),
  ('doctor_portal.agenda.view',             'doctor_portal', 'Voir l''agenda médecin'),
  ('doctor_portal.patients.view',           'doctor_portal', 'Voir la liste des patients du médecin'),
  ('doctor_portal.patient_detail.view',     'doctor_portal', 'Ouvrir le dossier patient dans le portail'),
  ('doctor_portal.consultations.create',    'doctor_portal', 'Créer une consultation'),
  ('doctor_portal.consultations.update',    'doctor_portal', 'Modifier une consultation en brouillon'),
  ('doctor_portal.consultations.finalize',  'doctor_portal', 'Finaliser une consultation'),
  ('doctor_portal.consultations.sign',      'doctor_portal', 'Signer une consultation'),
  ('doctor_portal.lab.create',              'doctor_portal', 'Demander une analyse'),
  ('doctor_portal.lab.view_results',        'doctor_portal', 'Voir les résultats de laboratoire'),
  ('doctor_portal.lab.acknowledge_critical','doctor_portal', 'Accuser réception d''un résultat critique'),
  ('doctor_portal.imaging.create',          'doctor_portal', 'Demander un examen d''imagerie'),
  ('doctor_portal.imaging.view_reports',    'doctor_portal', 'Voir les comptes rendus d''imagerie'),
  ('doctor_portal.prescriptions.create',    'doctor_portal', 'Créer une ordonnance'),
  ('doctor_portal.prescriptions.sign',      'doctor_portal', 'Signer une ordonnance'),
  ('doctor_portal.notes.create',            'doctor_portal', 'Créer une note clinique'),
  ('doctor_portal.notes.sign',              'doctor_portal', 'Signer une note clinique'),
  ('doctor_portal.hospitalized.view',       'doctor_portal', 'Voir les patients hospitalisés'),
  ('doctor_portal.emergencies.view',        'doctor_portal', 'Voir les urgences assignées'),
  ('doctor_portal.emergencies.decide',      'doctor_portal', 'Prendre une décision médicale aux urgences'),
  ('doctor_portal.tasks.manage',            'doctor_portal', 'Gérer les tâches cliniques'),
  ('doctor_portal.messages.use',            'doctor_portal', 'Utiliser la messagerie interne'),
  ('doctor_portal.portal_publish',          'doctor_portal', 'Publier des résultats vers le portail patient'),
  ('doctor_portal.audit.view',              'doctor_portal', 'Consulter les journaux d''audit (portail)')
ON CONFLICT (name) DO NOTHING;

-- super_admin gets all doctor_portal permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'super_admin' AND p.module = 'doctor_portal'
ON CONFLICT DO NOTHING;

-- administrator gets access + audit view
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'administrator'
  AND p.name IN (
    'doctor_portal.access',
    'doctor_portal.dashboard.view',
    'doctor_portal.patients.view',
    'doctor_portal.patient_detail.view',
    'doctor_portal.audit.view'
  )
ON CONFLICT DO NOTHING;

-- director gets read-only access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'director'
  AND p.name IN (
    'doctor_portal.access',
    'doctor_portal.dashboard.view',
    'doctor_portal.patients.view',
    'doctor_portal.patient_detail.view',
    'doctor_portal.hospitalized.view',
    'doctor_portal.audit.view'
  )
ON CONFLICT DO NOTHING;

-- doctor gets full clinical set
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'doctor' AND p.module = 'doctor_portal'
ON CONFLICT DO NOTHING;

-- radiology gets imaging-focused subset
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'radiology'
  AND p.name IN (
    'doctor_portal.access',
    'doctor_portal.dashboard.view',
    'doctor_portal.agenda.view',
    'doctor_portal.patients.view',
    'doctor_portal.patient_detail.view',
    'doctor_portal.imaging.create',
    'doctor_portal.imaging.view_reports',
    'doctor_portal.notes.create',
    'doctor_portal.notes.sign',
    'doctor_portal.tasks.manage',
    'doctor_portal.messages.use'
  )
ON CONFLICT DO NOTHING;

COMMIT;
