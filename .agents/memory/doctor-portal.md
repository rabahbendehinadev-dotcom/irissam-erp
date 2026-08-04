---
name: Doctor Portal
description: Full doctor-facing portal inside irissam-erp; backend routes + frontend pages + DB migrations.
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

## Key column name gotchas
- `lab_orders`: `test` (not test_name), `urgency` (not priority), `requested_by_id` (not ordered_by), `result_at` (not resulted_at), status enum: demandee/prelevee/en_cours/validee/critique/annulee
- `imaging_orders`: `exam` (not exam_type), `region` (not anatomical_zone), `requested_by_id`, `report` (not report_summary), `reported_at`, status: demandee/planifiee/realisee/interpretee/annulee
- `consultations`: `reason` (not chief_complaint), required notNull: number/patient_name/patient_mpi/doctor_name/specialty/service_name, status: en_attente/en_cours/terminee/planifiee/annulee
- `prescriptions`: `drug` (not medication_name), `dosage` (not dose), `prescribed_by_id`, status: prescrit/prepare/delivre/annule
- `appointments` status: confirmed/pending/cancelled/completed/no_show/in_progress (no 'arrived' value)
- `emergency_patient_status`: hospitalise/bloque/reanimation/transfere/sorti/decede

## JwtPayload fix
Added `firstName?: string; lastName?: string;` to JwtPayload interface in auth.ts (they are set in the JWT at login time but were missing from the TypeScript interface).

**Why:** JWT tokens carry first/last name but the interface only declared userId/role/permissions/siteId — caused TS errors in all doctor-portal routes that build doctor name strings.
