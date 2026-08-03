---
name: Insurance Module
description: Full insurance/tiers-payant module — backend (Task #119) + frontend (Task #120) architecture and key decisions
---

## Backend (Task #119)
- Migrations: `010_insurance_module.sql` (10 tables, 4 sequences) + `011_insurance_permissions.sql` (22 permissions, insurance_agent role)
- Route hub: `artifacts/api-server/src/routes/insurance.ts` mounts 7 sub-routers under `/insurance`
- Sub-routers: insurance-orgs, insurance-policies, insurance-coverage-requests, insurance-claims, insurance-bordereaux, insurance-payments, insurance-dashboard
- Coverage engine: `artifacts/api-server/src/services/insuranceCoverageEngine.ts`
- `insurer_name` on insurance_policies is NULLABLE (route passes null when org is canonical source)
- Plans require explicit `coverageType` field (no DB default relied upon)
- All req.params cast with String() due to Express 5 type strictness
- `module: "system"` in audit log entries (not "insurance")
- Bordereau add claims: `POST /bordereaux/:id/add-claims` (not /claims)
- Plans: `POST /insurance/plans` (not nested under /organizations/:id/plans)

## Frontend (Task #120)
- Route: `/insurance` → `src/pages/InsurancePage.tsx` (ProtectedRoute, lazy)
- Sidebar: "ASSURANCE / TIERS PAYANT" group with Shield icon
- Types: `src/types/insurance.ts` — all insurance TS types
- API service: `src/services/api/insurance.ts` — raw calls through apiClient singleton
- React Query hooks: `src/hooks/useInsuranceApi.ts` — full CRUD + workflow mutations
- i18n: all 3 files (fr/en/ar) have `insurance.*` keys

### Components
- `src/pages/InsurancePage.tsx` — 5-tab page (Dashboard | Organismes | Sinistres | Bordereaux | Paiements)
- `src/components/insurance/InsuranceDashboard.tsx` — KPI cards + Recharts bar/pie + alert widgets
- `src/components/insurance/InsuranceOrganizations.tsx` — CRUD orgs + plans in drawer
- `src/components/insurance/InsuranceClaims.tsx` — claims table + action modals
- `src/components/insurance/ClaimDetail.tsx` — 10-tab slide-over (patient/police/facture/couverture/items/chrono/docs/audit/messages/actions)
- `src/components/insurance/InsuranceBordereaux.tsx` — master-detail bordereau management
- `src/components/insurance/InsurancePayments.tsx` — payments list + register form
- `src/components/patients/PatientInsuranceDetail.tsx` — REPLACED mock with real API (useInsurancePolicies + useInsuranceClaims); named export PatientInsuranceDetail + default export

**Why:** PatientInsuranceDetail has both named and default export for backward compat with existing import sites.

### Key patterns
- Bottom-sheet modals: `items-end sm:items-center` + `rounded-t-2xl sm:rounded-2xl` on the panel
- Amount formatting: `Number(n).toLocaleString('fr-DZ', {minimumFractionDigits:2, maximumFractionDigits:2})`
- Query keys namespace: `['insurance', ...]` — see `insKeys` in useInsuranceApi.ts
- 0 TypeScript errors (excluding pre-existing MockRepository/EmergencyPatientDetail errors)
