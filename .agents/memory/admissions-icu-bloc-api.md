---
name: Admissions / ICU / Bloc API
description: Full REST API for admissions, ICU, surgical requests, occupancy beds, notifications SSE — plus frontend hooks.
---

## Key rules

### Admissions
- `POST /admissions` now accepts optional `encounterId` in body — if provided, reuses existing encounter (no new encounter created). `admissionService.admit()` has `encounterId?` in `AdmitInput`.
- `POST /admissions/:id/transfer` — atomic: frees old bed + occupies new bed.
- `POST /admissions/:id/cancel` — sets status=cancelled.
- `POST /admissions/:id/discharge` — dischargeType enum: `domicile | transfert_interne | transfert_externe | deces | fugue | contre_avis` (NOT "guerison" — that was wrong).

### Occupancy Beds (individual beds)
- Route: `/occupancy-beds` (not `/beds` — that's the legacy aggregate table).
- Default siteId: `9747c84b-cedd-428a-b8ba-cf5f0b3b31ee`
- Cleaning cycle: start-cleaning → nettoyage, complete-cleaning → disponible.
- `OccupancyBedRepository` is already in repos — no new repo needed.

### ICU
- ICU beds in `icu_beds` table; status enum: `disponible | occupe | reserve | nettoyage | hors_service`
- `IcuAdmissionRepository` handles `icu_admissions` + `icu_beds` lifecycle.
- 409 if requested bed is not disponible (concurrency safe).

### Bloc opératoire
- `SurgicalRequestRepository` handles `surgical_requests` + `operating_rooms`.
- `isRoomAvailable()` checks `lte(scheduledAt, endAt)` with a 2h window.
- Conflict is 409 only when a DIFFERENT request tries the same OR/time (same request is excluded via `excludeRequestId`).
- OR status: `libre → reserve (schedule) → en_intervention (start) → nettoyage (complete)`.
- `/operating-rooms` route uses a SEPARATE `routes/operating-rooms.ts` — NOT mounted via surgicalRequestsRouter (that caused only 1 room to show).

### Notifications + SSE
- SSE at `GET /notifications/stream` — no auth needed (EventSource can't set headers).
- `broadcast(siteId, eventType, data)` exported from `routes/notifications.ts` — imported by icu.ts and surgical-requests.ts.
- `NotificationsContext.tsx` uses EventSource with auto-reconnect + deduplication via `seenIds` Set.

### Frontend hooks (real API)
- `useAdmissionsApi` — replaces `useAdmissions()` context, same interface.
- `useICUApi` — replaces `useMockRepository()` for Resuscitation page.
- `useOperatingRoomApi` — replaces `useMockRepository()` for OperatingRoom page.
- Admissions.tsx: `useAdmissions` → `useAdmissionsApi`, DEMO badge → Live badge.
- Resuscitation.tsx + OperatingRoom.tsx: fully rewritten to use real API hooks.

## What still uses MockRepository
- All clinical modules inside EmergencyDossierContext still use MockRepository as a fallback for occupancy stats (bed counting, ICU stats).
- Admissions BedSelector still uses `useMockRepository().beds` for the UI selector — it needs occupancy_beds data, but the real data is loaded via `/occupancy-beds/available`.
