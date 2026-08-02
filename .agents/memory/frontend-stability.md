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

## TypeScript Zero Errors fix (post-audit)
All 13 pre-existing TypeScript errors in MockRepository.tsx fixed:
- **Root cause:** `addNotification()` calls passed `{ title, body, type, link }` but `Omit<AppNotification,'id'|'createdAt'|'isRead'>` required `priority`, `sourceModule`, `entityId` (all non-optional in the stored type).
- **Fix:** Added `AddNotificationInput` export type in NotificationsContext.tsx making those 3 fields optional with defaults (`priority: 'normal'`, `sourceModule: 'system'`, `entityId: null`). The stored `AppNotification` type stays strict.
- `EmergencyPatientDetail.tsx` error was fixed by Task #37 merge (no longer present).
- **Result:** `pnpm tsc --noEmit` → 0 errors. `PORT=3000 BASE_PATH=/irissam-erp pnpm build` → success in 6.10s.
- **Note:** `pnpm build` without PORT+BASE_PATH always fails — it's the vite.config.ts design, not a bug.

## Smoke test results (all 20/20 pass, 200 OK)
- Object responses: /api/dashboard/stats, /api/auth/me, /api/beds/summary, /api/beds/by-service
- Array responses: all other 16 endpoints including charts, alerts, patients, admissions, etc.

## api-client-react rebuild rule
**Why:** After editing `lib/api-client-react/src/generated/api.ts`, run `cd lib/api-client-react && pnpm tsc -p tsconfig.json` to update the dist declarations used by TypeScript project references.
**How to apply:** Any time the generated api.ts changes (new hooks, schema changes), rebuild dist before running frontend tsc check.
