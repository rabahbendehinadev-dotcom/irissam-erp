---
name: Mock Repository
description: Unified reactive data store wiring all hospital modules together without a real API
---

# Mock Repository

`src/store/MockRepository.tsx` — the single source of truth for cross-module data.

## Purpose
Acts as an in-memory PostgreSQL substitute. All modules read/write through it.
Mounted inside `AdmissionsProvider` in `AppProvider.tsx`.

## What it owns
- `patients: EmergencyPatient[]` — mutable copy of mock patients (reactive to status changes)
- `labOrders`, `imagingOrders`, `prescriptions` — orders created from the Urgences dossier
- `surgicalRequests` — created when decision = Bloc
- `icuAdmissions` — created when decision = Réanimation
- `globalAudit: RepoAuditEntry[]` — full audit trail (Date, Time, User, oldValue, newValue, module, IP)

## Key mutations
- `startCare(patientId, ctx)` → status = 'en_soins', logs audit
- `createLabOrder/createImagingOrder/createPrescription` → cross-module registration
- `createSurgicalRequest/createICUAdmission` → also patches patient status
- `closeVisit*` (Discharged/Hospitalized/Bloc/ICU/Transferred/Deceased) → update status

## Integration points
- `EmergencyDossierContext` calls repo in `addLabRequest`, `addImagingRequest`, `addPrescription`, `confirmDecision`
- `confirmDecision` also calls `useAdmissions().addAdmission()` for hospitalisation
- `Emergencies.tsx` reads `patients` from repo (live); buttons call `startCare` before navigating
- Lab/Radiology pages (placeholder) will read `labOrders`/`imagingOrders` when built

## Swap contract
To go real: replace each `useState` setter with `await apiCall(...)` then `setSetter(result)`.
Types live in `src/types/repository.ts`.

**Why:** The user wanted zero-reload cross-module reactivity with a clear PostgreSQL migration path — React state mutation is the simplest correct approach for that.
