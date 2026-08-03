---
name: Executive Dashboard / BI Module
description: Migration 021, 11 backend sub-routes, 9 frontend tabs, 10+ RBAC executive.* permissions, polling 30s, drill-down drawer
---

## What was built
- **Migration 021** (`lib/db/migrations/021_executive_dashboard.sql`): 11 `executive.*` permissions, 5 new roles (directeur_general/medical/financier/rh/soins), role-permission grants, performance indexes.
- **Backend** (`artifacts/api-server/src/routes/executive-dashboard/`): hub `index.ts` + 11 sub-routes: `overview`, `medical`, `capacity`, `finance`, `hr`, `stock`, `biomedical`, `quality`, `alerts`, `drilldown/:metric`, `export/pdf`, `export/excel`.
- **Overview** uses `Promise.allSettled` with 29 parallel queries — partial failures return 0 silently (no white screen).
- **Frontend** (`artifacts/irissam-erp/src/pages/ExecutiveDashboard.tsx`): 9-tab page, live clock, polling every 30s, pause/resume, PDF/Excel export buttons, fullscreen mode.
- **Sidebar** group `nav.group.executive` with `BarChart2` icon at `/executive-dashboard`.
- **i18n** keys: `exec.*` and `nav.executive` in fr/en/ar.

## Critical fix during build
All 11 executive sub-routes imported `requirePermission` as default — it is a **named export**: `import { requirePermission } from '...'`. Fixed with sed batch replace.

**Why:** The `requirePermission.ts` middleware exports `requirePermission`, `requireAnyPermission`, `requireAllPermissions` as named exports only — no default export.

## Schema names (differ from intuitive names)
- Beds: `occupancy_beds` (not `beds`)
- Emergency patients: `emergency_visits` (not `emergency_patients`)
- HR employees: `employees`, `attendance_records`, `employee_contracts`
- Stock lots: `medical_batches` (not `medical_item_lots`)
- Biomedical work orders: `biomedical_work_orders` (not `maintenance_records`)

## Drill-down metrics available
urgences_waiting, reste_a_recouvrer, stock_critique, personnel_absent, equipements_en_panne, incidents_ouverts, capa_retard, creances_assurance, maintenance_retard, lots_expirant

## Export
- PDF: pdfkit, returns binary, opens in new tab
- Excel: returns structured JSON with 7 sheets (Overview/Medical/Finance/RH/Stock/Biomedical/Qualite)
