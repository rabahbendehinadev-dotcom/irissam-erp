---
name: Biomedical Module
description: Architecture, build fixes, and integration notes for the biomedical management module (migrations 017+018).
---

## Architecture
- **22 tables** in `017_biomedical.sql`: equipment, categories, manufacturers, models, locations, installations, maintenance plans, work orders, work order tasks, preventive/corrective maintenance, calibrations, calibration certificates, spare parts, spare part movements, failures, documents, contracts, suppliers, incidents, inspections, disposals.
- **2 views**: `v_biomed_equipment_overview`, `v_biomed_dashboard_kpis`
- **20 permissions** + `technicien_biomed` role in `018_biomedical_permissions.sql`
- **12 sub-routers** in `artifacts/api-server/src/routes/biomedical/`
- **12 lazy tabs** in `artifacts/irissam-erp/src/pages/Biomedical.tsx`

## Critical build fix — import paths
The biomedical route files were originally written with wrong import paths:
- ❌ `from "../../lib/db.js"` → ✅ `from "@workspace/db"`
- ❌ `from "../../middleware/rbac.js"` → ✅ `from "../../middleware/requirePermission"`
- ❌ `from "../../types/auth.js"` → ✅ `from "../../middleware/requireAuth"`

**Why:** esbuild cannot resolve bare `.js` relative paths that don't exist; the monorepo uses `@workspace/db` package alias.

## MIGRATIONS array is hardcoded
`artifacts/api-server/src/lib/migrations.ts` contains a hardcoded `MIGRATIONS` string array. Every new migration file MUST be added to this array manually — the runner does NOT auto-discover files in the directory.

**How to apply:** Append the new filename to the `MIGRATIONS` array, then restart the API server workflow.

## Frontend integration
- Route `/biomedical` registered in `App.tsx` as lazy `BiomedicalPage`
- Sidebar entry at `artifacts/irissam-erp/src/components/layout/Sidebar.tsx` line ~112
- i18n keys: `nav.biomedical` in fr/en/ar
