---
name: Quality Module
description: Migrations 019+020, 11 backend sub-routers, 12 frontend tabs, RBAC quality.* permissions, responsable_qualite role
---

## What was built
- **Migration 019** (`lib/db/migrations/019_quality_module.sql`): 23 tables, 8 sequences, 16 enums, auto-updated_at triggers, `v_quality_dashboard_kpis` + `v_quality_risk_heatmap` views, seed data (3 committees, 5 indicators).
- **Migration 020** (`lib/db/migrations/020_quality_permissions.sql`): 20 `quality.*` permissions, new `responsable_qualite` role, grants to relevant roles.
- **Backend** (`artifacts/api-server/src/routes/quality/`): hub `index.ts` + 11 sub-routers: `dashboard`, `incidents`, `non-conformities`, `capa`, `risks`, `audits`, `documents`, `indicators`, `meetings`, `checklists`, `improvements`.
- **Frontend** (`artifacts/irissam-erp/src/pages/Quality.tsx`): 12 lazy-loaded tabs; components in `src/components/quality/`; API client at `src/services/api/quality.ts`.
- **Route** `/quality` in App.tsx; **Sidebar** group `nav.group.quality` with `ShieldCheck` icon; **i18n** keys in fr/en/ar.

## Key bug fixed during integration
Migration 020 originally had `INSERT INTO roles (name, description, is_active)` — but the `roles` table has no `is_active` column. Correct columns are `(name, display_name, description)`.

**Why:** The `roles` table schema (migration 004/005) uses `display_name` not `is_active`. Any future role inserts must use `(name, display_name, description)`.

## CAPA table routing
The `capa.ts` router serves both corrective and preventive actions from the same `quality_corrective_actions` table, distinguished by a `capa_type` column. The route path is `/quality/capa` and type is passed as a query param.
