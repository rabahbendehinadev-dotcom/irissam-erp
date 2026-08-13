-- 048 — Professionnalisation du module Consultation
--
-- 1) Patient de passage (consultation seule) : identité minimale portée par la
--    consultation elle-même (patient_id reste NULL, MPI affiché EXT-YYYY-NNNNN
--    dérivé du numéro CONS). Conversion propre plus tard via
--    POST /consultations/:id/attach-patient (backfill, sans ressaisie).
-- 2) Ordonnance : les prescriptions se rattachent directement à la
--    consultation (consultation_id) — l'encounter devient optionnel pour les
--    consultations externes — et gagnent des instructions de prise.
-- 3) Traitements réalisés/prescrits en consultation : consultation_treatments.
-- 4) Favoris personnels du praticien (diagnostics / médicaments fréquents,
--    épinglage + compteur d'usage) : doctor_favorites.

-- 1) Identité minimale « patient de passage »
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS patient_phone      text;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS patient_birth_date date;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS patient_gender     text;

-- 2) Prescriptions ↔ consultation + instructions de prise
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS consultation_id uuid REFERENCES consultations(id) ON DELETE SET NULL;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS instructions    text;
CREATE INDEX IF NOT EXISTS rx_consultation_idx ON prescriptions(consultation_id);

-- 3) Traitements de la consultation
CREATE TABLE IF NOT EXISTS consultation_treatments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id  uuid NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  patient_id       uuid REFERENCES patients(id) ON DELETE RESTRICT,
  designation      text NOT NULL CHECK (length(trim(designation)) > 0),
  note             text,
  performed_at     timestamptz NOT NULL DEFAULT now(),
  recorded_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  recorded_by_name text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cons_treatments_consultation_idx ON consultation_treatments(consultation_id);
CREATE INDEX IF NOT EXISTS cons_treatments_patient_idx      ON consultation_treatments(patient_id);

-- 4) Favoris personnels (recherche / épinglés / ajout personnalisé)
CREATE TABLE IF NOT EXISTS doctor_favorites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('diagnosis', 'medication', 'treatment')),
  label         text NOT NULL CHECK (length(trim(label)) > 0),
  medication_id uuid REFERENCES medications(id) ON DELETE SET NULL,
  dosage        text,
  frequency     text,
  duration      text,
  instructions  text,
  pinned        boolean NOT NULL DEFAULT false,
  usage_count   integer NOT NULL DEFAULT 0,
  last_used_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS doctor_favorites_user_kind_label_idx
  ON doctor_favorites(user_id, kind, lower(label));
CREATE INDEX IF NOT EXISTS doctor_favorites_user_idx ON doctor_favorites(user_id);
