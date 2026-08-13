---
name: Preadmission workflow
description: Préadmission = statut preadmission + lit "reserve" sans encounter; conversion atomique via /admissions/:id/confirm
---

## Rule
`admit()` branches on `type === "preadmission"`: admission status `preadmission`, bed claim-first → `reserve` (no occupiedAt), **NO clinical encounter created**. Conversion = `POST /admissions/:id/confirm` (perm `admissions.create`) → `confirmPreadmission()`: bed `reserve`→`occupe` via claim-first `occupyReserved(bedId, admissionId)` (WHERE status='reserve' AND admission_id match), encounter opened THEN, status→`active`, `admission_date/time` reset to actual entry, `preadmission_converted_at` stamped.

**Why:** an open encounter authorizes clinical ops (encounter unification) — wrong for a patient not yet in hospital; bed must show "Réservé" (purple, already handled by BedManagement UI) not "Occupé". `admissions.encounterId` is nullable by design.

**How to apply:**
- Audit actions: `preadmitted` (create) and `preadmission_converted` (confirm) — both whitelisted in the `/admissions/:id/timeline` projection with French descriptions.
- cancel() works on préadmissions unchanged: bed freed via patientId still-linked check (no encounter needed).
- discharge/transfer are blocked server-side for `preadmission` (status guard `!== "active"`); the detail page hides Sortie/Transfert/Vitaux buttons via `isPreadmission` and shows « Confirmer l'admission » instead.
- `preadmissionDate` (planned entry) flows form → POST body → admit input → column; returned by mapAdmission + mapApiAdmission.
- If confirm fails with « lit réservé n'est plus disponible » the reservation was broken (bed freed/reassigned) — user must edit the préadmission to pick another bed; do NOT silently occupy another bed.
