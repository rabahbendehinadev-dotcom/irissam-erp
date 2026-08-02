---
name: Occupancy Architecture (Phase 6b)
description: Hospital-wide bed/ICU/OR occupancy wired to MockRepository; AdmissionsContext no longer owns beds; key constraints for future work.
---

## Rule
All bed, ICU-bed, and operating-room state lives exclusively in `MockRepository`. `AdmissionsContext` no longer has `beds` state or `freeBed` helper.

**Why:** `AdmissionsProvider` is mounted OUTSIDE `MockRepositoryProvider` in `AppProvider.tsx`, so it can never call `useMockRepository()`. Beds were moved to avoid the context dependency inversion.

**How to apply:**
- Pages that admit/discharge a patient must call BOTH `useAdmissions()` mutations AND `useMockRepository()` bed mutations.
- Discharge/transfer → call `repo.startBedCleaning(bedId, ctx)` after `discharge(...)`.
- Cancel → call `repo.freeBed(bedId, ctx)` after `cancel(...)`.
- New admission with bed → call `repo.assignBed(bedId, {...}, ctx)` after `addAdmission(...)`.
- `BedSelector` reads `useMockRepository().beds` (OccupancyBed[], status `disponible`) — NOT the old `Bed` type from admission.ts.

## Types
- `OccupancyBed` — ward beds, status: disponible/occupe/reserve/nettoyage/maintenance/hors_service
- `OccupancyICUBed` — ICU beds, same status minus nettoyage/maintenance
- `OperatingRoom` + `OperatingRoomSlot` — OR scheduling with slot conflict detection
- `OperatingRoomStatus` — libre/reserve/en_preparation/en_intervention/nettoyage/hors_service/maintenance
- `StaffStatus` (EmergencyDoctor/Nurse) — actif/pause/intervention_urgente (NOT disponible/occupe)

## Mock data
- `src/mock/occupancy.ts` exports `MOCK_OCCUPANCY_BEDS` (36 beds), `MOCK_ICU_BEDS` (8), `MOCK_OPERATING_ROOMS` (4)
- Re-exported from `src/mock/index.ts`

## Pages wired (Phase 6b)
- `/hospitalization` → `Hospitalization.tsx` — bed board grouped by building/floor/room
- `/resuscitation` → `Resuscitation.tsx` — ICU board by unit
- `/operating-room` → `OperatingRoom.tsx` — OR scheduling board
- `/doctors` → `Personnel.tsx` — ER staff workload (erDoctors/erNurses from repo)
- `/ambulances` → `Ambulances.tsx` — dispatch board (AmbulanceStatus full set)

## 90% occupancy threshold
`checkOccupancyThreshold()` fires a warning notification when (occupe+reserve)/total ≥ 0.9 after any `assignBed` call.
