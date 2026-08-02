---
name: Encounter Unification
description: How real encounter UUIDs replaced synthetic enc-${patientId} keys in the emergency module, and where fallbacks still exist.
---

## Rule
EmergencyDossierContext creates a real DB encounter via `POST /api/encounters` on mount and stores it in `realEncounterId` state.
All cross-module operations (createLabOrder, createImagingOrder, createPrescription, closeVisit*) use `realEncounterId ?? \`enc-${patientId}\`` — the fallback only fires if the API call failed on mount.

## MockRepository remaining synthetic IDs
Three internal in-memory uses remain intentionally:
- Line 233: `e.id === \`enc-${patientId}\`` — legacy mock encounter lookup for seeded demo patients
- Lines 407, 434: audit calls in `startCare`/`updatePatientStatus` — in-memory only, never reach DB

Lines 726-788 (`closeVisit*`): all use `encounterId ?? \`enc-${patientId}\`` — real ID is passed from EmergencyDossierContext.

## Why
These 3 mock uses are for pre-seeded demo patients displayed on page load. They are NOT new clinical operations — they don't flow to the DB audit or encounter service.

## encounter_type enum
DB uses `"urgence"` (singular), not `"urgences"`. The encounters route maps: `urgences → urgence`, `hospitalisation → admission`.

## safeUuid in audit service
`auditService.log` applies `safeUuid(actor.userId) ?? null` before writing to `audit_logs.user_id` (nullable FK). Without this, non-UUID userIds like "user-1" cause a DB type error.
