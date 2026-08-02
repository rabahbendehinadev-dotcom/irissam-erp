-- =============================================================================
-- Migration 005 — Idempotent RBAC Seed
-- Roles · Permissions · Role-Permission mappings · Admin user
-- Safe to run multiple times (INSERT ... ON CONFLICT DO NOTHING).
-- Run after 004_auth_rbac.sql.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Roles
-- ---------------------------------------------------------------------------
INSERT INTO roles (name, display_name, description) VALUES
  ('super_admin',   'Super Administrateur', 'Accès complet sans restriction'),
  ('administrator', 'Administrateur',       'Gestion complète de l''établissement'),
  ('director',      'Directeur',            'Direction médicale et administrative'),
  ('doctor',        'Médecin',              'Prise en charge médicale des patients'),
  ('nurse',         'Infirmier/Infirmière', 'Soins infirmiers et suivi patient'),
  ('reception',     'Réception',            'Accueil et gestion administrative'),
  ('laboratory',    'Laborantin',           'Analyses biologiques'),
  ('radiology',     'Radiologue / Technicien radiologue', 'Imagerie médicale'),
  ('pharmacist',    'Pharmacien',           'Dispensation des médicaments'),
  ('finance',       'Finance',              'Facturation et comptabilité'),
  ('hr',            'Ressources Humaines',  'Gestion du personnel')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Permissions (all 70+)
-- ---------------------------------------------------------------------------
INSERT INTO permissions (name, module, description) VALUES
  -- Dashboard
  ('dashboard.view',                   'dashboard',       'Voir le tableau de bord'),
  -- Patients
  ('patients.view',                    'patients',        'Consulter les patients'),
  ('patients.create',                  'patients',        'Créer un dossier patient'),
  ('patients.edit',                    'patients',        'Modifier un dossier patient'),
  ('patients.archive',                 'patients',        'Archiver un dossier patient'),
  ('patients.export',                  'patients',        'Exporter les données patients'),
  ('patients.view_sensitive',          'patients',        'Voir les données médicales sensibles'),
  ('patients.override_duplicate',      'patients',        'Forcer la création malgré doublon'),
  ('patients.view_audit',              'patients',        'Voir l''audit patient'),
  -- Appointments
  ('appointments.view',                'appointments',    'Consulter les rendez-vous'),
  ('appointments.create',              'appointments',    'Créer un rendez-vous'),
  ('appointments.edit',                'appointments',    'Modifier un rendez-vous'),
  ('appointments.cancel',              'appointments',    'Annuler un rendez-vous'),
  -- Admissions
  ('admissions.view',                  'admissions',      'Consulter les hospitalisations'),
  ('admissions.create',                'admissions',      'Créer une hospitalisation'),
  ('admissions.edit',                  'admissions',      'Modifier une hospitalisation'),
  ('admissions.discharge',             'admissions',      'Sortir un patient'),
  ('admissions.transfer',              'admissions',      'Transférer un patient'),
  ('admissions.cancel',                'admissions',      'Annuler une admission'),
  ('admissions.export',                'admissions',      'Exporter les admissions'),
  ('admissions.view_audit',            'admissions',      'Voir l''audit admissions'),
  -- Emergencies
  ('emergencies.view',                 'emergencies',     'Consulter les urgences'),
  ('emergencies.create',               'emergencies',     'Créer un dossier urgences'),
  ('emergencies.triage',               'emergencies',     'Effectuer le triage'),
  ('emergencies.start_care',           'emergencies',     'Démarrer la prise en charge'),
  ('emergencies.update',               'emergencies',     'Mettre à jour le dossier'),
  ('emergencies.assign_staff',         'emergencies',     'Affecter du personnel'),
  ('emergencies.assign_room',          'emergencies',     'Affecter une salle'),
  ('emergencies.order_lab',            'emergencies',     'Prescrire des analyses'),
  ('emergencies.order_imaging',        'emergencies',     'Prescrire de l''imagerie'),
  ('emergencies.prescribe',            'emergencies',     'Prescrire des médicaments'),
  ('emergencies.administer_medication','emergencies',     'Administrer des médicaments'),
  ('emergencies.add_note',             'emergencies',     'Ajouter une note'),
  ('emergencies.decide',               'emergencies',     'Prendre la décision finale'),
  ('emergencies.transfer',             'emergencies',     'Transférer vers autre établissement'),
  ('emergencies.hospitalize',          'emergencies',     'Hospitaliser'),
  ('emergencies.send_to_or',           'emergencies',     'Envoyer au bloc'),
  ('emergencies.send_to_icu',          'emergencies',     'Envoyer en réanimation'),
  ('emergencies.close',                'emergencies',     'Clôturer un dossier urgences'),
  ('emergencies.reopen',               'emergencies',     'Rouvrir un dossier urgences'),
  ('emergencies.print',                'emergencies',     'Imprimer le compte-rendu'),
  ('emergencies.export',               'emergencies',     'Exporter le dossier'),
  ('emergencies.view_audit',           'emergencies',     'Voir l''audit urgences'),
  -- Consultations
  ('consultations.view',               'consultations',   'Consulter les consultations'),
  ('consultations.create',             'consultations',   'Créer une consultation'),
  ('consultations.edit',               'consultations',   'Modifier une consultation'),
  ('consultations.start',              'consultations',   'Démarrer une consultation'),
  ('consultations.complete',           'consultations',   'Terminer une consultation'),
  ('consultations.cancel',             'consultations',   'Annuler une consultation'),
  ('consultations.print',              'consultations',   'Imprimer CR'),
  ('consultations.export',             'consultations',   'Exporter CR'),
  ('consultations.view_sensitive',     'consultations',   'Voir données sensibles'),
  ('consultations.edit_completed',     'consultations',   'Modifier consultation terminée'),
  ('consultations.create_prescription','consultations',   'Créer une ordonnance'),
  ('consultations.request_lab',        'consultations',   'Demander des analyses'),
  ('consultations.request_imaging',    'consultations',   'Demander imagerie'),
  ('consultations.create_certificate', 'consultations',   'Créer un certificat médical'),
  ('consultations.view_audit',         'consultations',   'Voir l''audit consultations'),
  ('consultations.vitals_entry',       'consultations',   'Saisir les constantes'),
  -- Operating room
  ('operating_room.view',              'operating_room',  'Voir le bloc opératoire'),
  ('operating_room.schedule',          'operating_room',  'Planifier une intervention'),
  ('operating_room.start',             'operating_room',  'Démarrer une intervention'),
  ('operating_room.complete',          'operating_room',  'Terminer une intervention'),
  -- Laboratory
  ('laboratory.view',                  'laboratory',      'Voir les analyses'),
  ('laboratory.create',                'laboratory',      'Créer une demande d''analyse'),
  ('laboratory.validate',              'laboratory',      'Valider un résultat d''analyse'),
  ('laboratory.collect',               'laboratory',      'Enregistrer un prélèvement'),
  -- Imaging
  ('imaging.view',                     'imaging',         'Voir l''imagerie'),
  ('imaging.request',                  'imaging',         'Demander une imagerie'),
  ('imaging.perform',                  'imaging',         'Réaliser un examen d''imagerie'),
  ('imaging.interpret',                'imaging',         'Interpréter les résultats'),
  -- Pharmacy
  ('pharmacy.view',                    'pharmacy',        'Voir la pharmacie'),
  ('pharmacy.dispense',                'pharmacy',        'Dispenser des médicaments'),
  ('pharmacy.manage_stock',            'pharmacy',        'Gérer le stock'),
  ('pharmacy.prepare',                 'pharmacy',        'Préparer une préparation'),
  -- Blood bank
  ('blood_bank.view',                  'blood_bank',      'Voir la banque de sang'),
  ('blood_bank.manage',                'blood_bank',      'Gérer la banque de sang'),
  -- Medical stock
  ('medical_stock.view',               'medical_stock',   'Voir le stock médical'),
  ('medical_stock.manage',             'medical_stock',   'Gérer le stock médical'),
  -- Finance
  ('finance.view',                     'finance',         'Voir la facturation'),
  ('finance.create_invoice',           'finance',         'Créer une facture'),
  ('finance.validate',                 'finance',         'Valider une facture'),
  -- HR
  ('hr.view',                          'hr',              'Voir les RH'),
  ('hr.manage',                        'hr',              'Gérer le personnel'),
  -- Doctors
  ('doctors.view',                     'doctors',         'Voir les médecins'),
  ('doctors.manage',                   'doctors',         'Gérer les médecins'),
  -- Reports
  ('reports.view',                     'reports',         'Voir les rapports'),
  ('reports.export',                   'reports',         'Exporter les rapports'),
  -- Settings
  ('settings.view',                    'settings',        'Voir les paramètres'),
  ('settings.manage',                  'settings',        'Gérer les paramètres'),
  -- Admin
  ('admin.users',                      'admin',           'Gérer les utilisateurs'),
  ('admin.roles',                      'admin',           'Gérer les rôles'),
  ('admin.audit',                      'admin',           'Voir tous les audits'),
  ('admin.backup',                     'admin',           'Sauvegardes'),
  -- ICU
  ('icu.view',                         'icu',             'Voir la réanimation'),
  ('icu.admit',                        'icu',             'Admettre en réanimation'),
  ('icu.transfer',                     'icu',             'Transférer depuis réanimation'),
  ('icu.discharge',                    'icu',             'Sortir de réanimation'),
  -- Audit (cross-module)
  ('audit.view',                       'audit',           'Voir les journaux d''audit')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Role → Permission mappings
-- ---------------------------------------------------------------------------

-- Helper: assign all permissions to a role by name
-- super_admin: ALL permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- administrator: almost all (no admin.backup, no icu.* surgical)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'administrator'
  AND p.name NOT IN ('admin.backup')
ON CONFLICT DO NOTHING;

-- director: read-wide + audit
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'director'
  AND p.name IN (
    'dashboard.view',
    'patients.view','patients.view_sensitive','patients.view_audit',
    'appointments.view',
    'admissions.view','admissions.export','admissions.view_audit',
    'emergencies.view','emergencies.view_audit',
    'consultations.view','consultations.view_sensitive','consultations.view_audit',
    'operating_room.view',
    'laboratory.view','imaging.view','pharmacy.view',
    'blood_bank.view','medical_stock.view',
    'finance.view','finance.validate',
    'hr.view','hr.manage',
    'doctors.view','doctors.manage',
    'reports.view','reports.export',
    'settings.view',
    'audit.view',
    'icu.view'
  )
ON CONFLICT DO NOTHING;

-- doctor: clinical full
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'doctor'
  AND p.name IN (
    'dashboard.view',
    'patients.view','patients.create','patients.edit','patients.view_sensitive',
    'appointments.view','appointments.create','appointments.edit',
    'admissions.view','admissions.create',
    'emergencies.view','emergencies.create','emergencies.triage',
    'emergencies.start_care','emergencies.update',
    'emergencies.order_lab','emergencies.order_imaging','emergencies.prescribe',
    'emergencies.add_note','emergencies.decide',
    'emergencies.hospitalize','emergencies.send_to_or','emergencies.send_to_icu',
    'emergencies.close','emergencies.print','emergencies.export',
    'consultations.view','consultations.create','consultations.edit',
    'consultations.start','consultations.complete',
    'consultations.print','consultations.create_prescription',
    'consultations.request_lab','consultations.request_imaging',
    'consultations.create_certificate','consultations.view_sensitive',
    'operating_room.view','operating_room.schedule',
    'laboratory.view','laboratory.create',
    'imaging.view','imaging.request',
    'pharmacy.view',
    'blood_bank.view',
    'icu.view','icu.admit',
    'reports.view'
  )
ON CONFLICT DO NOTHING;

-- nurse: care + vitals
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'nurse'
  AND p.name IN (
    'dashboard.view',
    'patients.view','patients.view_sensitive',
    'admissions.view',
    'emergencies.view','emergencies.triage','emergencies.start_care',
    'emergencies.update','emergencies.administer_medication',
    'emergencies.add_note','emergencies.order_lab',
    'consultations.view','consultations.vitals_entry',
    'laboratory.view','laboratory.collect',
    'pharmacy.view',
    'icu.view',
    'reports.view'
  )
ON CONFLICT DO NOTHING;

-- reception: admissions + appointments
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'reception'
  AND p.name IN (
    'dashboard.view',
    'patients.view','patients.create','patients.edit',
    'appointments.view','appointments.create','appointments.edit','appointments.cancel',
    'admissions.view','admissions.create',
    'emergencies.view','emergencies.create',
    'consultations.view',
    'reports.view'
  )
ON CONFLICT DO NOTHING;

-- laboratory: lab only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'laboratory'
  AND p.name IN (
    'dashboard.view',
    'patients.view',
    'laboratory.view','laboratory.create','laboratory.collect','laboratory.validate'
  )
ON CONFLICT DO NOTHING;

-- radiology: imaging only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'radiology'
  AND p.name IN (
    'dashboard.view',
    'patients.view',
    'imaging.view','imaging.request','imaging.perform','imaging.interpret'
  )
ON CONFLICT DO NOTHING;

-- pharmacist: pharmacy
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'pharmacist'
  AND p.name IN (
    'dashboard.view',
    'patients.view',
    'pharmacy.view','pharmacy.dispense','pharmacy.manage_stock','pharmacy.prepare',
    'medical_stock.view','medical_stock.manage'
  )
ON CONFLICT DO NOTHING;

-- finance: billing
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'finance'
  AND p.name IN (
    'dashboard.view',
    'patients.view',
    'admissions.view','admissions.export',
    'finance.view','finance.create_invoice','finance.validate',
    'reports.view','reports.export'
  )
ON CONFLICT DO NOTHING;

-- hr: personnel
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'hr'
  AND p.name IN (
    'dashboard.view',
    'hr.view','hr.manage',
    'doctors.view','doctors.manage',
    'reports.view','reports.export',
    'settings.view'
  )
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Admin user (force_password_change = true, first login must reset)
--    Password: Admin@2026 — bcrypt cost 12
-- ---------------------------------------------------------------------------
INSERT INTO users (
  id,
  first_name, last_name, email,
  role, status, account_status,
  hashed_password,
  force_password_change,
  language,
  created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'Admin', 'IRISSAM',
  'admin@irissam.dz',
  'administrateur',
  'actif',
  'active',
  '$2b$12$YuCltOy2wdHaBCksz.VZT.4rYzX4K5pyOfg5ZLYnXaY.LlqyR37Iy',
  TRUE,
  'fr',
  now(), now()
) ON CONFLICT (email) DO UPDATE SET
  hashed_password       = EXCLUDED.hashed_password,
  force_password_change = EXCLUDED.force_password_change,
  account_status        = 'active',
  updated_at            = now();

-- ---------------------------------------------------------------------------
-- 5. Assign administrator role to admin user
-- ---------------------------------------------------------------------------
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.email = 'admin@irissam.dz'
  AND r.name   = 'administrator'
ON CONFLICT DO NOTHING;

COMMIT;
