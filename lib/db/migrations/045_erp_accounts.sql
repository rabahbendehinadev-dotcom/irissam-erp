-- ═══════════════════════════════════════════════════════════════════════════
-- 045 — Comptes ERP liés aux employés + gouvernance DPI
--
--   1. Unicité du lien employé ↔ compte utilisateur : un compte ERP ne peut
--      être rattaché qu'à UNE seule fiche employé active (index partiel).
--      Défensif : si des doublons historiques existaient déjà, l'index n'est
--      pas créé (WARNING) et les contrôles applicatifs restent en vigueur.
--
--   2. Gouvernance DPI : le rôle « doctor » ne crée plus de dossiers patients.
--      Le dossier (IPP/DPI unique) est créé par l'accueil / les admissions ;
--      le médecin travaille sur les patients existants et y ajoute les
--      données médicales (consultations, prescriptions, analyses, imagerie…).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Index unique partiel sur employees.linked_user_id
DO $$
BEGIN
  BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_linked_user
      ON employees (linked_user_id)
      WHERE linked_user_id IS NOT NULL AND deleted_at IS NULL;
  EXCEPTION WHEN unique_violation THEN
    RAISE WARNING '045: index uq_employees_linked_user non créé — liens employé/compte dupliqués déjà présents, nettoyer manuellement';
  END;
END $$;

-- 2. Retirer patients.create du rôle doctor (le médecin ne crée pas de DPI)
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id       = r.id
  AND rp.permission_id = p.id
  AND r.name = 'doctor'
  AND p.name = 'patients.create';
