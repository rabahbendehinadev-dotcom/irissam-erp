-- ============================================================================
-- RESET DONNÉES UAT/DEMO — IRISSAM HOSPITAL ERP
-- ============================================================================
-- OBJET : purger TOUTES les données patients / cliniques / financières de test
--         en CONSERVANT le système et les référentiels :
--           utilisateurs, rôles, permissions, services/départements, employés,
--           catalogue médicaments, définitions lits/chambres/blocs/ambulances,
--           organismes & plans d'assurance, paramètres système, migrations,
--           stock médical, biomédical, RH/paie, qualité (fiches processus).
--
-- CE SCRIPT NE FAIT AUCUN  DROP TABLE / TRUNCATE / modification de schéma.
--   - DELETE ciblés uniquement, dans l'ordre des clés étrangères (enfants d'abord)
--   - UPDATE de libération des ressources (lits, box urgences, salles, ambulances)
--   - remise à zéro des compteurs/séquences dont les tables sont désormais vides
--   - transaction unique : la moindre erreur annule TOUT (rollback automatique)
--   - garde-fou final : vérifie tables patients vides ET tables système intactes
--     avant COMMIT, sinon exception → ROLLBACK complet.
--
-- EXÉCUTION SUR VPS (production Docker/Dokploy) :
--   1) SAUVEGARDE OBLIGATOIRE d'abord :
--      docker exec <conteneur_pg> pg_dump -U <utilisateur> -d <base> -Fc \
--        > backup_avant_reset_$(date +%Y%m%d_%H%M%S).dump
--   2) Exécution :
--      docker exec -i <conteneur_pg> psql -U <utilisateur> -d <base> \
--        -v ON_ERROR_STOP=1 < scripts/reset-uat-data.sql
--
-- NOTE : ce fichier vit dans scripts/ et n'est JAMAIS exécuté automatiquement
--        (le système de migrations ne lit que artifacts/api-server/src/lib/migrations.ts).
-- ============================================================================

\set ON_ERROR_STOP on

-- ============================ COMPTAGES AVANT ===============================
SELECT 'AVANT' AS phase, t AS table_, n AS lignes FROM (
  SELECT 'patients' AS t, count(*) AS n FROM patients
  UNION ALL SELECT 'encounters', count(*) FROM encounters
  UNION ALL SELECT 'admissions', count(*) FROM admissions
  UNION ALL SELECT 'consultations', count(*) FROM consultations
  UNION ALL SELECT 'appointments', count(*) FROM appointments
  UNION ALL SELECT 'emergency_visits', count(*) FROM emergency_visits
  UNION ALL SELECT 'icu_admissions', count(*) FROM icu_admissions
  UNION ALL SELECT 'surgical_requests', count(*) FROM surgical_requests
  UNION ALL SELECT 'lab_orders', count(*) FROM lab_orders
  UNION ALL SELECT 'imaging_orders', count(*) FROM imaging_orders
  UNION ALL SELECT 'prescriptions', count(*) FROM prescriptions
  UNION ALL SELECT 'invoices', count(*) FROM invoices
  UNION ALL SELECT 'payments', count(*) FROM payments
  UNION ALL SELECT 'insurance_policies', count(*) FROM insurance_policies
  UNION ALL SELECT 'insurance_claims', count(*) FROM insurance_claims
  UNION ALL SELECT 'patient_portal_accounts', count(*) FROM patient_portal_accounts
  UNION ALL SELECT 'patient_vaccinations', count(*) FROM patient_vaccinations
  UNION ALL SELECT 'audit_logs (liés patients)', count(*) FROM audit_logs WHERE patient_id IS NOT NULL OR encounter_id IS NOT NULL
  UNION ALL SELECT 'document_records (liés patients)', count(*) FROM document_records WHERE patient_id IS NOT NULL OR encounter_id IS NOT NULL OR invoice_id IS NOT NULL
  UNION ALL SELECT 'notifications', count(*) FROM notifications
  UNION ALL SELECT 'alerts', count(*) FROM alerts
  UNION ALL SELECT 'daily_stats', count(*) FROM daily_stats
  UNION ALL SELECT 'patients_legacy', count(*) FROM patients_legacy
) s;

BEGIN;

-- ============ B. LIBÉRATION DES RESSOURCES MASTER (UPDATE, pas DELETE) ======
-- Lits d'hospitalisation : on garde les lits, on retire toute trace patient.
-- Les statuts opérationnels 'hors_service' / 'maintenance' sont préservés.
UPDATE occupancy_beds SET
  patient_id = NULL, patient_name = NULL, encounter_id = NULL, admission_id = NULL,
  occupied_at = NULL, expected_release_at = NULL,
  cleaning_started_at = NULL, cleaning_completed_at = NULL,
  status = 'disponible', updated_at = now()
WHERE patient_id IS NOT NULL OR admission_id IS NOT NULL OR encounter_id IS NOT NULL
   OR status IN ('occupe', 'reserve', 'nettoyage');

-- Lits de réanimation
UPDATE icu_beds SET
  patient_id = NULL, patient_name = NULL, encounter_id = NULL, icu_admission_id = NULL,
  priority = NULL, occupied_at = NULL, expected_release_at = NULL, cleaning_started_at = NULL,
  status = 'disponible', updated_at = now()
WHERE patient_id IS NOT NULL OR encounter_id IS NOT NULL OR icu_admission_id IS NOT NULL
   OR status IN ('occupe', 'reserve', 'nettoyage');

-- Box des urgences
UPDATE emergency_rooms SET
  occupied = 0, status = 'libre', updated_at = now()
WHERE occupied > 0 OR status IN ('occupee', 'partielle', 'nettoyage');

-- Salles du bloc opératoire
UPDATE operating_rooms SET
  current_surgical_request_id = NULL, status = 'libre', updated_at = now()
WHERE current_surgical_request_id IS NOT NULL
   OR status IN ('reserve', 'en_preparation', 'en_intervention', 'nettoyage');

-- Ambulances : fin de mission, retour disponible ('maintenance'/'hors_service' préservés)
UPDATE ambulances SET
  current_patient_id = NULL, current_patient_name = NULL, current_patient_priority = NULL,
  chief_complaint = NULL, location = NULL, dispatched_at = NULL, eta_minutes = NULL,
  status = 'disponible', updated_at = now()
WHERE current_patient_id IS NOT NULL OR current_patient_name IS NOT NULL
   OR status IN ('vers_patient', 'sur_place', 'vers_hopital', 'transport_patient', 'en_route');

-- Qualité : les fiches processus (NC / CAPA) sont CONSERVÉES (aucune colonne
-- patient) — on coupe seulement leur lien vers les incidents liés aux patients,
-- qui eux seront supprimés plus bas.
UPDATE quality_non_conformities SET incident_id = NULL
WHERE incident_id IN (SELECT id FROM quality_incidents WHERE patient_id IS NOT NULL OR admission_id IS NOT NULL);
UPDATE quality_corrective_actions SET incident_id = NULL
WHERE incident_id IN (SELECT id FROM quality_incidents WHERE patient_id IS NOT NULL OR admission_id IS NOT NULL);

-- ============ C. SUPPRESSIONS ORDONNÉES (enfants d'abord, ordre FK) =========
-- Chaîne admissions / assurance / urgences / facturation
DELETE FROM admission_timeline_events;
DELETE FROM insurance_approvals;
DELETE FROM insurance_bordereau_items;
DELETE FROM insurance_rejections;
DELETE FROM insurance_claim_items;
DELETE FROM insurance_org_payments;
DELETE FROM insurance_claims;
DELETE FROM coverage_requests;
DELETE FROM insurance_bordereaux;      -- lots de créances patients (démo)
DELETE FROM emergency_vitals;
DELETE FROM emergency_visits;
DELETE FROM billable_events;
DELETE FROM credit_notes;
DELETE FROM invoice_items;
DELETE FROM payments;
DELETE FROM invoices;

-- Incidents qualité liés à un patient/admission uniquement
-- (les incidents purement organisationnels restent)
DELETE FROM quality_incidents WHERE patient_id IS NOT NULL OR admission_id IS NOT NULL;

DELETE FROM admissions;
DELETE FROM patient_portal_appointment_requests;
DELETE FROM appointments;

-- Audit : uniquement les lignes liées aux patients de test ;
-- l'historique administratif (connexions, configuration) est conservé.
DELETE FROM audit_logs WHERE patient_id IS NOT NULL OR encounter_id IS NOT NULL;

DELETE FROM clinical_notes;
DELETE FROM clinical_tasks;
DELETE FROM consultations;

-- Messagerie médecin : uniquement les messages liés à un patient
DELETE FROM doctor_messages WHERE patient_id IS NOT NULL OR encounter_id IS NOT NULL;

-- GED : documents PATIENTS uniquement (les documents administratifs et les
-- dossiers/règles de rétention sont conservés).
CREATE TEMP TABLE _docs_patients ON COMMIT DROP AS
  SELECT id FROM document_records
  WHERE patient_id IS NOT NULL OR encounter_id IS NOT NULL OR invoice_id IS NOT NULL;
DELETE FROM document_access_rules   WHERE document_id IN (SELECT id FROM _docs_patients);
DELETE FROM document_approvals      WHERE document_id IN (SELECT id FROM _docs_patients);
DELETE FROM document_archive_jobs   WHERE document_id IN (SELECT id FROM _docs_patients);
DELETE FROM document_comments       WHERE document_id IN (SELECT id FROM _docs_patients);
DELETE FROM document_download_logs  WHERE document_id IN (SELECT id FROM _docs_patients);
DELETE FROM document_notifications  WHERE document_id IN (SELECT id FROM _docs_patients);
DELETE FROM document_shares         WHERE document_id IN (SELECT id FROM _docs_patients);
DELETE FROM document_signatures     WHERE document_id IN (SELECT id FROM _docs_patients);
DELETE FROM document_versions       WHERE document_id IN (SELECT id FROM _docs_patients);
DELETE FROM document_watermarks     WHERE document_id IN (SELECT id FROM _docs_patients);
DELETE FROM document_links
  WHERE source_id IN (SELECT id FROM _docs_patients) OR target_id IN (SELECT id FROM _docs_patients);
DELETE FROM document_workflow_steps
  WHERE workflow_id IN (SELECT id FROM document_workflows WHERE document_id IN (SELECT id FROM _docs_patients));
DELETE FROM document_workflows      WHERE document_id IN (SELECT id FROM _docs_patients);
DELETE FROM document_records        WHERE id IN (SELECT id FROM _docs_patients);

-- Chaîne clinique
DELETE FROM icu_admissions;
DELETE FROM imaging_orders;
DELETE FROM lab_orders;

-- Consommations de stock : uniquement celles liées à un patient/séjour
-- (les consommations de service — réassort des unités — sont conservées).
DELETE FROM medical_consumption_items
  WHERE consumption_id IN (SELECT id FROM medical_consumptions WHERE patient_id IS NOT NULL OR encounter_id IS NOT NULL);
DELETE FROM medical_consumptions WHERE patient_id IS NOT NULL OR encounter_id IS NOT NULL;

DELETE FROM prescriptions;

-- Planning bloc : créneaux liés à un patient uniquement (créneaux de blocage/maintenance conservés)
DELETE FROM or_slots WHERE patient_id IS NOT NULL OR surgical_request_id IS NOT NULL;
DELETE FROM surgical_requests;

DELETE FROM encounters;
DELETE FROM insurance_policies;

-- Portail patient (comptes, sessions, appareils, messages, consentements…)
DELETE FROM patient_portal_access_logs;
DELETE FROM patient_portal_consents;
DELETE FROM patient_portal_devices;
DELETE FROM patient_portal_messages;
DELETE FROM patient_portal_notifications;
DELETE FROM patient_portal_sessions;
DELETE FROM portal_preview_tokens;
DELETE FROM patient_portal_accounts;

DELETE FROM patient_timeline_events;
DELETE FROM patient_vaccinations;

-- Données d'événements générées par l'activité de démonstration
DELETE FROM notifications;   -- notifications d'événements démo (urgences, admissions…)
DELETE FROM alerts;          -- alertes de démo (le système régénérera les vraies alertes)
DELETE FROM daily_stats;     -- statistiques agrégées de l'activité démo

-- Ancienne table patients (héritage V1) puis la racine
DELETE FROM patients_legacy;
DELETE FROM patients;

-- ============ D. COMPTEURS ET SÉQUENCES (tables désormais vides) ============
-- Compteurs par année (MRN patients, numéros de consultation)
DELETE FROM patient_mrn_counters;
DELETE FROM consultation_number_counters;

-- Séquences dont les tables sont ENTIÈREMENT vides après ce reset
ALTER SEQUENCE invoice_number_seq     RESTART;
ALTER SEQUENCE payment_number_seq     RESTART;
ALTER SEQUENCE receipt_number_seq     RESTART;
ALTER SEQUENCE credit_note_seq        RESTART;
ALTER SEQUENCE claim_number_seq       RESTART;
ALTER SEQUENCE bordereau_number_seq   RESTART;
ALTER SEQUENCE coverage_request_seq   RESTART;
ALTER SEQUENCE org_payment_number_seq RESTART;
ALTER SEQUENCE daily_stats_id_seq     RESTART;
ALTER SEQUENCE patients_id_seq        RESTART;   -- séquence de patients_legacy
-- Volontairement NON remises à zéro (tables partiellement conservées) :
--   document_number_seq (documents administratifs GED conservés)
--   medical_cons_number_seq (consommations de service conservées)

-- ============ E. GARDE-FOU AUTOMATIQUE AVANT COMMIT =========================
DO $$
DECLARE
  t text;
  n bigint;
BEGIN
  -- 1) Les tables patients doivent être VIDES
  FOREACH t IN ARRAY ARRAY[
    'patients','patients_legacy','encounters','admissions','admission_timeline_events',
    'appointments','consultations','clinical_notes','clinical_tasks',
    'emergency_visits','emergency_vitals','icu_admissions','surgical_requests',
    'lab_orders','imaging_orders','prescriptions',
    'invoices','invoice_items','payments','credit_notes','billable_events',
    'insurance_policies','insurance_claims','insurance_claim_items','insurance_approvals',
    'insurance_rejections','insurance_bordereaux','insurance_bordereau_items',
    'insurance_org_payments','coverage_requests',
    'patient_portal_accounts','patient_portal_sessions','patient_portal_devices',
    'patient_portal_messages','patient_portal_notifications','patient_portal_consents',
    'patient_portal_access_logs','patient_portal_appointment_requests','portal_preview_tokens',
    'patient_timeline_events','patient_vaccinations',
    'patient_mrn_counters','consultation_number_counters',
    'notifications','alerts','daily_stats'
  ] LOOP
    EXECUTE format('SELECT count(*) FROM %I', t) INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION 'RESET ÉCHOUÉ : la table % contient encore % ligne(s) → ROLLBACK', t, n;
    END IF;
  END LOOP;

  -- 2) Les tables SYSTÈME ne doivent PAS être vides
  FOREACH t IN ARRAY ARRAY[
    'users','roles','permissions','role_permissions','user_roles',
    'departments','employees','medications','beds','occupancy_beds','icu_beds',
    'operating_rooms','emergency_rooms','ambulances',
    'insurance_organizations','service_catalog','system_settings','__migrations'
  ] LOOP
    EXECUTE format('SELECT count(*) FROM %I', t) INTO n;
    IF n = 0 THEN
      RAISE EXCEPTION 'RESET ÉCHOUÉ : la table système % a été vidée par erreur → ROLLBACK', t;
    END IF;
  END LOOP;

  -- 3) Plus aucun lit / ambulance lié à un patient
  SELECT count(*) INTO n FROM occupancy_beds
    WHERE patient_id IS NOT NULL OR admission_id IS NOT NULL OR encounter_id IS NOT NULL;
  IF n > 0 THEN RAISE EXCEPTION 'RESET ÉCHOUÉ : % lit(s) encore lié(s) à un patient → ROLLBACK', n; END IF;
  SELECT count(*) INTO n FROM icu_beds
    WHERE patient_id IS NOT NULL OR encounter_id IS NOT NULL OR icu_admission_id IS NOT NULL;
  IF n > 0 THEN RAISE EXCEPTION 'RESET ÉCHOUÉ : % lit(s) réa encore lié(s) → ROLLBACK', n; END IF;
  SELECT count(*) INTO n FROM ambulances WHERE current_patient_id IS NOT NULL;
  IF n > 0 THEN RAISE EXCEPTION 'RESET ÉCHOUÉ : % ambulance(s) encore liée(s) → ROLLBACK', n; END IF;

  RAISE NOTICE 'Garde-fou OK : données patients purgées, données système intactes.';
END $$;

COMMIT;

-- ============================ COMPTAGES APRÈS ===============================
SELECT 'APRES (doit être 0)' AS phase, t AS table_, n AS lignes FROM (
  SELECT 'patients' AS t, count(*) AS n FROM patients
  UNION ALL SELECT 'encounters', count(*) FROM encounters
  UNION ALL SELECT 'admissions', count(*) FROM admissions
  UNION ALL SELECT 'consultations', count(*) FROM consultations
  UNION ALL SELECT 'appointments', count(*) FROM appointments
  UNION ALL SELECT 'emergency_visits', count(*) FROM emergency_visits
  UNION ALL SELECT 'lab_orders', count(*) FROM lab_orders
  UNION ALL SELECT 'imaging_orders', count(*) FROM imaging_orders
  UNION ALL SELECT 'prescriptions', count(*) FROM prescriptions
  UNION ALL SELECT 'invoices', count(*) FROM invoices
  UNION ALL SELECT 'payments', count(*) FROM payments
  UNION ALL SELECT 'insurance_claims', count(*) FROM insurance_claims
  UNION ALL SELECT 'patient_portal_accounts', count(*) FROM patient_portal_accounts
) s;

SELECT 'CONSERVÉ (doit être > 0)' AS phase, t AS table_, n AS lignes FROM (
  SELECT 'users' AS t, count(*) AS n FROM users
  UNION ALL SELECT 'roles', count(*) FROM roles
  UNION ALL SELECT 'permissions', count(*) FROM permissions
  UNION ALL SELECT 'departments', count(*) FROM departments
  UNION ALL SELECT 'employees', count(*) FROM employees
  UNION ALL SELECT 'medications', count(*) FROM medications
  UNION ALL SELECT 'beds', count(*) FROM beds
  UNION ALL SELECT 'occupancy_beds', count(*) FROM occupancy_beds
  UNION ALL SELECT 'icu_beds', count(*) FROM icu_beds
  UNION ALL SELECT 'operating_rooms', count(*) FROM operating_rooms
  UNION ALL SELECT 'emergency_rooms', count(*) FROM emergency_rooms
  UNION ALL SELECT 'ambulances', count(*) FROM ambulances
  UNION ALL SELECT 'insurance_organizations', count(*) FROM insurance_organizations
  UNION ALL SELECT 'service_catalog', count(*) FROM service_catalog
  UNION ALL SELECT 'system_settings', count(*) FROM system_settings
  UNION ALL SELECT '__migrations', count(*) FROM __migrations
) s;

\echo '============================================'
\echo 'RESET UAT TERMINÉ AVEC SUCCÈS'
\echo '============================================'
