---
name: Doctor Portal
description: Full doctor-facing portal inside irissam-erp; backend routes + frontend pages + DB migrations. Full E2E suite (64/64) verified against PostgreSQL.
---

## Overview
Standalone module within the existing ERP (same JWT auth, separate layout/UX).
- Permission gate: `doctor_portal.access` — assigned to super_admin, administrator, director, doctor, radiology roles
- Backend prefix: `/api/doctor-portal/`
- Frontend prefix: `/doctor-portal/`
- All data queries scoped per doctor (appointments.doctor_id, encounters.primary_doctor_id, admissions.doctor_id, emergency_visits.assigned_doctor_id)

## Migrations
- **033** — 5 new tables: `clinical_notes`, `medical_signatures`, `clinical_tasks`, `doctor_messages`, `doctor_portal_preferences`
  + ALTER TABLE adds to existing tables: `acknowledged_at`/`acknowledged_by_id`/`clinical_note` on `lab_orders`; `acknowledged_at`/`acknowledged_by_id` on `imaging_orders`; `signed_at`/`locked_at`/`content_hash` on `consultations` and `prescriptions`
- **034** — 25 `doctor_portal.*` permissions + role assignments

## Backend routes (artifacts/api-server/src/routes/doctor-portal/)
index.ts, dashboard.ts, agenda.ts, patients.ts, consultations.ts, lab-orders.ts, imaging-orders.ts, prescriptions.ts, results.ts, hospitalized.ts, emergencies.ts, clinical-notes.ts, tasks.ts, messages.ts, profile.ts

Registered in routes/index.ts: `router.use("/doctor-portal", doctorPortalRouter)` — auth + permission guard is INSIDE the router (not at registration point).

## Frontend (artifacts/irissam-erp/src/)
- **Layout**: `src/layouts/DoctorPortalLayout.tsx` — dark blue sidebar desktop, bottom nav mobile, hamburger drawer
- **Pages**: `src/pages/doctor-portal/Doctor{Dashboard,Agenda,PatientsToday,MyPatients,PatientWorkspace,Results,Hospitalized,Emergencies,Prescriptions,Tasks,Messages,Profile,PortalIndex}.tsx`
- **Routes**: All wired in App.tsx with `DoctorProtectedRoute` + `DoctorLoadingSkeleton`

## Critical production bugs fixed during E2E
- `source_module='doctor_portal'` was invalid enum — fixed to `consultations`/`laboratoire`/`imagerie`/`pharmacie`
- `consultations` table has NO `source_module` column — removed from INSERT
- `hospitalized.ts` subquery: must SELECT `prescribed_at` in inner SELECT before using it in ORDER BY
- `emergencies.ts` vitals: column is `blood_pressure` (text), `spo2` (not `oxygen_saturation`); no systolic/diastolic
- `emergencies.ts` priority CASE: use `'P1'`/`'P2'` (uppercase, matching enum)
- `messages.ts`: `is_active` column doesn't exist — use `account_status='active' AND deleted_at IS NULL`
- `audit_logs.module` is a `source_module` enum — never use raw table names; 'emergencies' → 'urgences'
- `agenda.ts` valid statuses: added `in_progress` and `no_show` to validation list

## RBAC — critical rule
`loadPermissions` reads the `user_roles` join table (NOT `users.role` column). New users MUST have an explicit entry in `user_roles(user_id, role_id)` to get any permissions. Roles table name ≠ user_role enum value (e.g. roles.name='reception' vs users.role='receptionist' — both exist).

**Why:** JWT payload's `permissions` array is populated at login from `user_roles`. A user without a `user_roles` row gets an empty JWT and 403 on all permission-guarded endpoints.

## Auth middleware
`requireAuth` sets only: userId, role, permissions, siteId — NO firstName/lastName.
`auth.firstName` is undefined at runtime. Use `auth.userId` as fallback for user_name in audit logs.
Login response field: `accessToken` (not `token`). Logout revokes refresh-token cookie session only; JWT access token valid until 15-min expiry (stateless).

## Column name gotchas
- `lab_orders`: `test`, `urgency`, `requested_by_id`, `result_at`; status: demandee/prelevee/en_cours/validee/critique/annulee
- `imaging_orders`: `exam`, `region`, `requested_by_id`, `report`, `reported_at`; status: demandee/planifiee/realisee/interpretee/annulee
- `consultations`: `reason` (not chief_complaint), NO `source_module` column; status: en_attente/en_cours/terminee/planifiee/annulee
- `prescriptions`: `drug`, `dosage`, `prescribed_by_id`, `prescribed_at`; status: prescrit/prepare/delivre/annule
- `appointments` status: confirmed/pending/cancelled/completed/no_show/in_progress
- `emergency_patient_status`: attente_triage/en_triage/attente_soins/en_soins/observation/hospitalise/bloque/reanimation/transfere/sorti/decede
- `emergency_vitals`: blood_pressure (text), spo2, temperature, respiratory_rate, gcs, heart_rate, recorded_at — NO systolic/diastolic columns
- `patients`: phone (NOT NULL) — always include in INSERT
- `users`: account_status (not is_active), force_password_change (not must_change_password)
- `clinical_tasks`: created_by (NOT NULL FK to users)

## E2E test script
Reusable: `scripts/e2e-run.mjs` — seeds 4 patients, 2 doctors, 1 no-access user via psql, then runs 64 API tests via native fetch. Run with `node scripts/e2e-run.mjs` from workspace root.
