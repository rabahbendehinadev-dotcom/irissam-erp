---
name: Consultation professionnelle (walk-in, favoris, ordonnance)
description: Règles durables du module Consultation pro — patients de passage sans colonne dédiée, rattachement patient transactionnel, favoris médecin, prescriptions par consultationId, documents 2 temps
---

# Module Consultation professionnelle

## Walk-in (patient de passage)
- **Pas de colonne `is_walk_in`** : `isWalkIn` est DÉRIVÉ côté API (`!consultation.patientId`). L'identité minimale vit sur `consultations.patient_name/patient_phone/patient_birth_date/patient_gender`; `origin='walk_in'` (enum consultation_origin).
- MPI provisoire `EXT-…` généré à partir du numéro CONS (swap de préfixe) — stocké dans `consultations.patient_mpi`.
- **Rattachement ultérieur** : POST `/consultations/:id/attach-patient` = transaction `FOR UPDATE`, 409 si déjà rattachée, **backfill** de `prescriptions.patient_id` et `consultation_treatments.patient_id`, audit `patient_attached`. Jamais de création de doublon patient.
- **Why:** l'exigence était zéro doublon dans le registre patient; dériver isWalkIn évite une colonne redondante qui peut diverger du patientId réel.
- **How to apply:** tout nouvel écran/endpoint qui teste "passage" doit tester `patientId IS NULL`, pas un flag.

## Verrou médecin connecté
- Rôle `doctor` ⇒ `doctorId` forcé = `req.auth.userId` à la création; écriture (diagnostic, rx, traitements, documents, ordonnance) dans la consultation d'un AUTRE médecin → **403**; consultation annulée → **409**; guard commun `consultationForWrite()` dans routes/consultations.ts.
- Côté front, le select médecin est désactivé et forcé à l'utilisateur connecté (ConsultationForm).

## Prescriptions rattachées à la consultation
- `prescriptions.consultation_id` (+ `instructions` ≤500, imprimées sur l'ordonnance; `notes` = interne pharmacie). POST avec `consultationId` : patient/encounter **hérités** de la consultation (tous deux possiblement NULL en walk-in), `sourceModule` forcé `consultations`.
- GET `/prescriptions?consultationId=` ; le front fusionne avec `?encounterId=` (lignes historiques) dédupliquées par id.
- **Champ réponse = `drug`** (PAS drugName); statuts singuliers `prescrit|prepare|delivre|annule`.

## Favoris médecin (doctor_favorites)
- Self-scoped (userId du JWT), kinds `diagnosis|medication|treatment`, index unique `lower(label)` par (doctor,kind) → 23505 mappé 409; `POST /:id/use` incrémente use_count. Route montée sous `/consultation-favorites`.

## Documents de consultation
- Deux temps : 1) `POST /api/storage/upload` (FormData) → `storageKey` UUID; 2) `POST /consultations/:id/attachments` → ligne dans la table polymorphe `attachments`, objectPath `/api/storage/objects/:key`. **Pas d'endpoint delete** (choix assumé — traçabilité).
- apiClient front : base `'/api'` ⇒ endpoints SANS préfixe (`/storage/upload`); `postForm`/`getBlob` avec retry 401-refresh.

## Piège récurrent
- `safeUuid()` renvoie `string | undefined` — coalescer `?? null` quand la cible est `string | null` (TS2322 sinon).
