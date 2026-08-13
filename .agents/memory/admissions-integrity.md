---
name: Admissions integrity & bed lifecycle
description: Referential-integrity contract of POST /admissions, transactional cancel, occupancy-beds RBAC/guards, and the free-only-if-still-linked rule
---

# Admissions integrity & bed lifecycle

## POST /admissions contract (strict, no fiction)
- `bedId` required (checked FIRST — negatives must include it to reach deeper checks), `doctorId` required and must be a real active user (name always resolved server-side; client `doctorName` ignored).
- `serviceName` without `serviceId` is resolved strictly (case-insensitive exact match) against real `departments`; unknown name → 400. `serviceId` verified.
- `encounterId` must belong to the same `patientId` → else 400 (cross-patient attach refused).
- Priority alias: `critique` → `vital` (emergency module vocabulary; `critique` is NOT in admission_priority enum). Emergency ICU flow depends on it.
- **Why:** review found fictional doctors/services and foreign encounters were persisted silently.

## Transactional cancel + hardening
- `admissionService.cancel()` mirrors discharge: status→cancelled + free bed + close encounter + audit in ONE transaction. Route no longer flips status inline; frontend must NOT call `/occupancy-beds/:id/release` manually.
- **Free-only-if-still-linked rule:** before freeing, check the bed still references THIS admission (admissionId, encounterId or patientId). Legacy data had active admissions pointing at beds since reassigned to other patients — blind free() would evict the current occupant. transferBed(), cancel() AND discharge() all have it now.

## Transfer = internal ADT move (rework 2026-08)
- `transferBed(id, {newBedId, motif, notes?})` — ONE transaction: admission must be `active` (409), target bed must have roomId+serviceId (strict structure, 409), claim-first occupy (sets bed.admissionId), old bed → **nettoyage** only-if-still-linked, admission realigned on the FULL denorm chain (bed/room/floor/building/service inherited from the new bed — stale-service bug fixed), audit `bed_transferred` with complete from/to + motif (patient history via /audit-logs?patientId).
- `motif` is required at the route (400). Frontend must NOT call `/occupancy-beds/:id/start-cleaning` after transfer anymore — the server does it atomically.
- `admit()` also sets `bed.admission_id` now (bed-cards join + still-linked checks depend on it).
- Transfer UI = shared cascade modal (`TransferBedModal`) built from `/infrastructure/tree` (active rooms only) + `/infrastructure/bed-cards`; internal transfer keeps status `active` — never mark `transferred` (that's the mock-context legacy semantic).

## Discharge = ADT exit (rework 2026-08)
- ONE tx: active-only guard (déjà sorti / annulée → 409), user-entered dischargeDate/Time actually persisted (pre-rework they were silently discarded and now() was stored) with chronology checks (≤ today, ≥ admission date/heure → 400), bed → **nettoyage** only-if-still-linked, encounter closed, audit `discharged` with full bed/room/floor/building/service chain + type/date/heure/notes.
- Route validates dischargeType against the 6 `discharge_type` enum values → 400 (was silently defaulting bad input to "domicile"); repos.encounter.close is idempotent (plain UPDATE) — safe when encounter already closed.
- Frontend must NOT call `/occupancy-beds/:id/start-cleaning` after discharge (server does it in-tx). DischargeModal surfaces API errors (was `.catch(() => {})` — closed pretending success while admission stayed active).
- Retour à disponible = existing complete-cleaning workflow (page Hospitalisation), guarded 409 unless status=nettoyage.

## Occupancy-beds RBAC + guards
- All bed routes gated with `admissions.*` (no dedicated bed permissions exist in DB): GET→view, assign→create, release→edit, cleaning→view (nurse class has only view).
- Guard: release/start-cleaning return 409 when the bed belongs to an ACTIVE admission — those transitions must go through /admissions/:id/cancel|discharge|transfer. complete-cleaning requires status='nettoyage' (409 otherwise).

## Stale-data repair precedent
- Incoherent ACTIVE admissions (bed freed long ago, or bed now occupied by someone else) are repaired via the official cancel endpoint, never SQL. Coherent seed occupancies (bed occupied by the same patient) are left alone.

## Misc schema gotchas
- `audit_logs` time column is `timestamp` (not created_at). Audit `action` is free text — 'cancelled' is fine.
- E2E fixtures: `doctor.a@e2e.test` (doctor: view+create), `no.access@e2e.test` (receptionist by design), `zero.perm@e2e.test` = ephemeral zero-permission user wiped by e2e runs — recreate before 403-matrix tests; passwords live in the e2e seed script.
