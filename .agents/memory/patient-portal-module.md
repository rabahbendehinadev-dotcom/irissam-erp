---
name: Patient Portal Module
description: Architecture, auth, API routes, and frontend for the IRISSAM patient self-service portal.
---

## Auth system (separate from staff)
- Cookie: `irissam_pt` (HttpOnly, 30-day refresh); access token 30min, role `"patient"`.
- Middleware: `requirePatientAuth` — never mix with staff `requireAuth`.
- Every endpoint IDOR-checks `req.patient.patientId` against the queried record.
- Patient activation: token-from-email OR MRN+DOB+phone+OTP.

## Migrations applied
- `028_patient_portal_tables.sql` — 8 new tables + `published_to_patient` columns added to `lab_orders`, `imaging_orders`, `prescriptions`, and `document_records`.
- `029_patient_portal_permissions.sql` — 11 `patient_portal.*` permissions.

## Backend routes (all under /api/patient-portal)
17 sub-routers assembled in `artifacts/api-server/src/routes/patient-portal/index.ts`:
auth, dashboard, profile, appointments, appointment-requests, lab-results, imaging, prescriptions, documents, invoices, payments, insurance, hospitalizations, notifications, messages, consents, sessions, privacy.

## Key column fixes (real DB schema)
- `insurance_policies` (NOT `patient_insurances`): `coverage_percent`, `valid_until`, `is_active`, `ceiling_amount`, `numero_adherent` / `subscriber_number`.
- `document_records` (NOT `documents`): uses `published_to_patient` boolean (added by mig 028); no `confidentiality='patient'` enum value.
- `invoices`: `paid_amount`, `due_amount`, `patient_share` (NOT `amount_paid`/`insurance_share`).
- `insurance_claims`: `patient_id` directly (no join to invoices needed); `amount_requested`/`amount_approved`.

## Frontend (artifacts/patient-portal)
- Custom API client: `src/lib/api.ts` — `api.get/post/patch/delete()` + auto-refresh on 401.
- Auth context: `src/contexts/AuthContext.tsx` — `useAuth()`.
- Types: `src/lib/types.ts` — all API response shapes.
- Does NOT use `@workspace/api-client-react` — entirely custom hooks wrapping the portal API.
- Mobile-first: bottom nav (5 tabs) on mobile, sticky sidebar on desktop.
- Teal/blue palette, FR primary language, RTL support for Arabic.

**Why:** Patient portal is a completely separate product from the staff ERP — different auth, different token/cookie, different trust level, different UX paradigm.
