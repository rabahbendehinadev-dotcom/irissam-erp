-- 040 — Prescription ↔ Médicament : lien réel vers le stock pharmacie.
-- La délivrance déduit le stock du médicament lié ; la colonne reste nullable
-- pour les anciennes prescriptions saisies en texte libre (aucune valeur inventée).

ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS medication_id uuid REFERENCES medications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS rx_medication_idx ON prescriptions(medication_id);
