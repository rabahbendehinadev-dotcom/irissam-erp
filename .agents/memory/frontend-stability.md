---
name: Frontend Stability — Zero White Screens
description: Results and patterns from the Task #106 frontend audit. Documents what was fixed, what's still pre-existing, and the architecture decisions.
---

# Frontend Stability Audit (Task #106)

## What was done
- Created `src/components/shared/PageErrorBoundary.tsx` — class component catching all Runtime Errors, logs route/name/message/componentStack only (no PII/tokens).
- All ProtectedRoute pages are wrapped via `App.tsx` (single `<PageErrorBoundary>` in ProtectedRoute covers all 30+ routes).
- Dashboard has `WidgetErrorBoundary` (inline class in `Dashboard.tsx`) around each of the 7 dashboard widget sections — one widget failure cannot crash the whole page.
- 4 dashboard chart/alert hooks were already in the generated api.ts (lines 254–1158) — no new hooks needed.
- After confirming duplicate additions, cleaned api.ts back to 2156 lines (trim via `head`).
- Rebuilt `lib/api-client-react` dist (`pnpm tsc -p tsconfig.json`) to fix stale .d.ts declarations.

## Array.isArray guards added
- `Patients.tsx` — `apiPatients` guard in rawPatients useMemo
- `Consultations.tsx` — `apiConsultations` guard
- `PatientDetail.tsx` — `apiPatients` guard before `.find()`
- `Appointments.tsx` — `storeAppointments` guard in rawAppointments useMemo
- `OperatingRoom.tsx` — `rawORooms` and `rawSurgReqs` destructured with guards
- `Emergencies.tsx` — `rawPatients`, `rawRooms`, `rawAmbulances` with guards
- `Resuscitation.tsx` — `rawIcuBeds` with guard (renamed from icuBeds)
- `MiniWidgets.tsx` — `lowStock.items` guard: `!Array.isArray(...) || length === 0`

## Pre-existing TypeScript errors (not introduced by this task)
- `MockRepository.tsx` — 13 errors: `AppNotification` type mismatch (`link` field not in type)
- `EmergencyPatientDetail.tsx` — 1 error: gender type `"M"|"F"|"other"` vs `"M"|"F"`
- These existed before; no new TS errors were introduced.

## Smoke test results (all 20/20 pass, 200 OK)
- Object responses: /api/dashboard/stats, /api/auth/me, /api/beds/summary, /api/beds/by-service
- Array responses: all other 16 endpoints including charts, alerts, patients, admissions, etc.

## api-client-react rebuild rule
**Why:** After editing `lib/api-client-react/src/generated/api.ts`, run `cd lib/api-client-react && pnpm tsc -p tsconfig.json` to update the dist declarations used by TypeScript project references.
**How to apply:** Any time the generated api.ts changes (new hooks, schema changes), rebuild dist before running frontend tsc check.
