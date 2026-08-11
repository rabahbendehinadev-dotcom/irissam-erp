-- ============================================================================
-- 042 — Libération des ressources de soins "occupées" orphelines
-- ============================================================================
-- Contexte : la migration 007 a migré les lits de réanimation et salles de
-- bloc de démonstration avec leur statut d'origine (occupe / en_intervention…)
-- mais avec patient_id / encounter_id / icu_admission_id NULL lorsque le
-- patient legacy n'existait pas dans la table patients (LEFT JOIN).
-- La suppression individuelle de patients ne libère que les ressources LIÉES
-- au patient supprimé : ces lignes fantômes restent donc "occupées" à jamais
-- et faussent le Dashboard (Réanimation 20/24, Bloc 3/2/1).
--
-- Règle : une ressource est orpheline si son statut indique une occupation
-- SANS AUCUNE référence réelle (patient, encounter, admission, demande).
-- Une ressource réellement liée n'est JAMAIS touchée. Idempotent.

-- Lits de réanimation orphelins → disponibles
UPDATE icu_beds SET
  patient_name        = NULL,
  priority            = NULL,
  occupied_at         = NULL,
  expected_release_at = NULL,
  cleaning_started_at = NULL,
  status              = 'disponible',
  updated_at          = now()
WHERE status IN ('occupe', 'reserve', 'nettoyage')
  AND patient_id IS NULL
  AND encounter_id IS NULL
  AND icu_admission_id IS NULL;

-- Salles du bloc opératoire orphelines → libres
UPDATE operating_rooms SET
  status     = 'libre',
  updated_at = now()
WHERE status IN ('reserve', 'en_preparation', 'en_intervention', 'nettoyage')
  AND current_surgical_request_id IS NULL;
