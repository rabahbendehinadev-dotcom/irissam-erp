-- 047 — Fiche consommable du séjour (admissions)
--
-- Médicaments et consommables utilisés pour un patient pendant son séjour :
-- désignation (saisie libre), quantité, date/heure d'utilisation, note et
-- utilisateur responsable.
--
-- ÉTAPE 1 volontairement autonome : AUCUNE liaison avec le Stock Médical ni
-- la Pharmacie (étape 2 prévue — colonnes de liaison à ajouter par ALTER TABLE,
-- sans casser les enregistrements existants).

CREATE TABLE IF NOT EXISTS admission_consumables (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id     uuid NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  patient_id       uuid NOT NULL REFERENCES patients(id)   ON DELETE RESTRICT,
  encounter_id     uuid REFERENCES encounters(id) ON DELETE SET NULL,
  item_type        text NOT NULL DEFAULT 'consommable'
                     CHECK (item_type IN ('medicament', 'consommable')),
  designation      text NOT NULL CHECK (length(trim(designation)) > 0),
  quantity         integer NOT NULL CHECK (quantity > 0),
  used_at          timestamptz NOT NULL DEFAULT now(),
  note             text,
  recorded_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  recorded_by_name text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS adm_consumables_admission_idx ON admission_consumables(admission_id);
CREATE INDEX IF NOT EXISTS adm_consumables_patient_idx   ON admission_consumables(patient_id);
CREATE INDEX IF NOT EXISTS adm_consumables_used_at_idx   ON admission_consumables(used_at);
