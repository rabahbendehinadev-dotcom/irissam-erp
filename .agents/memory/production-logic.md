---
name: Production Logic Layer
description: Architecture of the 8-phase production logic implementation in the Urgences module
---

# Production Logic Layer — Urgences Module

## What was built

Phases 2–8 of Production Logic implemented across these files:

**New files:**
- `src/types/encounter.ts` — Encounter, EncounterLinkedRecord, EncounterType/Status
- `src/engine/workflowEngine.ts` — ALLOWED_TRANSITIONS map, `canTransition`, `canStartCare`, `isTerminalStatus`, `TRANSITION_LABELS`
- `src/engine/validationEngine.ts` — 9 validators: `validateLabOrder`, `validateImagingOrder`, `validateHospitalization`, `validateBloc`, `validateICU`, `validateCloseFile`, `validateTransfer`, `validateReopenDeceased`, `validatePrescription`

**Rewritten:**
- `src/store/MockRepository.tsx` — full 8-phase implementation (encounters, occupancy, notifications, workflow, audit). Exports `MockRepositoryContextType` as the PostgreSQL-compatible service contract.

**Extended:**
- `src/types/repository.ts` — added optional `encounterId` to RepoLabOrder, RepoImagingOrder, RepoPrescription, RepoAuditEntry
- `src/contexts/EmergencyDossierContext.tsx` — added validation calls in addLabRequest/addImagingRequest/confirmDecision/closeFile, passes `encounterId: 'enc-${patientId}'` in all repo calls

## Key architectural rules

**Why:** Each phase was intentionally decoupled so the PostgreSQL swap (Phase 8) only requires replacing `MockRepositoryProvider` with `ApiRepositoryProvider`.

**Encounter ID convention:** `enc-${patientId}` — generated deterministically so callers don't need to look it up.
**Visit ID convention:** `visit-${patientId}` — used in all cross-module record types.

**Phase 5 (notifications):** `NotificationsProvider` wraps `MockRepositoryProvider` in AppProvider, so `useNotifications()` is always available inside the Repository provider.

**Phase 4 (workflow):** `canTransition(from, to)` is the single gate; `updatePatientStatus` silently rejects invalid transitions (no throw). `canStartCare(status)` is a convenience for the startCare mutation.

**Phase 3 (validation):** Validators return `{ valid: boolean; error?: string }`. EmergencyDossierContext calls them before repo mutations and shows errors via `useToast` (`variant: 'destructive'`). They never throw.

## Not yet done

- Lab, Pharmacy, Imaging pages still read their own local state (not MockRepository) — Task #52
- Room/bed occupancy is tracked but no UI shows it — Task #53  
- Mock data resets on refresh; PostgreSQL swap is Task #54
- `src/config/permissions.ts` — medecin/infirmier still only have `emergencies.view` and `emergencies.triage`; the 20 new `emergencies.*` permission keys are not yet added
