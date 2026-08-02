---
name: Encounter Unification
description: How real encounter UUIDs replaced synthetic enc-${patientId} keys, and the full clinical order API built on top.
---

## Rule
EmergencyDossierContext creates a real DB encounter via `POST /api/encounters` on mount.
- On success → `encounterStatus = 'ready'`, `realEncounterId` = UUID
- On failure → `encounterStatus = 'error'`, NO fallback, all clinical actions blocked
- User must click "Réessayer" → calls `retryEncounter()` → increments `retryKey` → re-runs effect

## Clinical Orders Block
`addLabRequest`, `addImagingRequest`, `addPrescription` hard-block if `!realEncounterId`:
- Show toast with "Cliquez sur Réessayer"
- Return immediately
- No order is created with a synthetic ID — ever

## API Routes (all require real encounterId in body)
- POST /lab-orders → 400 if no encounterId
- POST /imaging-orders → 400 if no encounterId
- POST /prescriptions → 400 if no encounterId
- POST /lab-orders/:id/result → sets status=validee or critique
- POST /imaging-orders/:id/report → sets status=interpretee
- POST /prescriptions/:id/dispense → sets status=delivre
- GET /encounters/:id/timeline → aggregates all events chronologically
- GET /encounters/:id/lab-orders, /imaging-orders, /prescriptions → nested reads

## jsonb_append bug
PostgreSQL has NO `jsonb_append` function. Use the `||` operator:
```sql
COALESCE(linked_records, '[]'::jsonb) || $1::jsonb
```
Fixed in: `artifacts/api-server/src/repositories/encounter.ts` → `appendLinkedRecord()`

## MockRepository synthetic IDs removed
- Line 233: `e.id === \`enc-${patientId}\`` → changed to `e.patientId === patientId`
- Lines 407, 434: `encounterId: \`enc-${patientId}\`` removed from internal audit calls

## safeUuid
Must always apply `safeUuid(ctx.userId)` before any UUID FK column. Prescription repo was missing it — fixed.

## encounter_type enum
DB uses `"urgence"` (singular). Routes map `urgences → urgence`, `hospitalisation → admission`.
