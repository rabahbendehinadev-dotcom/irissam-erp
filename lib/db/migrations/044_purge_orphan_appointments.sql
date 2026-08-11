-- ============================================================================
-- 044 — Suppression des rendez-vous orphelins (sans patient lié)
-- ============================================================================
-- Contexte : POST /appointments acceptait un rendez-vous « walk-in » avec un
-- simple nom libre (patient_name texte) sans lien patient_id. Or la
-- suppression définitive d'un patient collecte ses rendez-vous par
-- patient_id : une ligne sans lien est invisible pour toute purge et survit
-- indéfiniment — ex. le RDV « zohir zohir » du 10/08/2026 resté affiché
-- après suppression de tous les patients. (La FK patient_id est en ON DELETE
-- RESTRICT : un RDV réellement lié ne peut pas survivre à son patient.)
--
-- Le formulaire ERP exige déjà un patient enregistré ; la route POST est
-- durcie dans le même commit (patientId obligatoire et vérifié).
--
-- Nettoyage : suppression des rendez-vous sans patient lié. La seule table
-- référençante (patient_portal_appointment_requests.appointment_id) est en
-- ON DELETE SET NULL → aucune violation FK possible. Idempotent : ne fait
-- rien si aucune ligne orpheline n'existe.

DELETE FROM appointments WHERE patient_id IS NULL;
