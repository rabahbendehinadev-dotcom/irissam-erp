---
name: HR Module Architecture
description: Key decisions and gotchas for the RH (Ressources Humaines) module
---

## Database
- Migrations 013 (26 tables, 17 enums) + 014 (30 permissions, 4 new roles) applied.
- Migration 013 requires `CREATE EXTENSION IF NOT EXISTS btree_gist` before the `EXCLUDE USING gist` on `employee_shifts`.
- run-migrations.mjs has a hardcoded MIGRATIONS array — always add new files to it.

## Backend
- 9 sub-routers under `artifacts/api-server/src/routes/hr/` mounted at `/api/hr`.
- Registered in `artifacts/api-server/src/routes/index.ts` with `requireAuth` guard.

## Frontend
- Main page: `artifacts/irissam-erp/src/pages/HR.tsx` (lazy sub-routes for all 11 tabs).
- App.tsx routes: `/hr/employees/:id`, `/hr/:tab`, `/hr` — all point to HRPage.
- `ScrollableTabBar` is at `@/components/ui/ScrollableTabBar` (NOT `@/components/shared/`).
  - API: `tabs=[{id, label, icon}]`, `activeTab`, `onTabChange(id: string)`.
- `apiClient` canonical path: `@/services/api/client` — `@/lib/api-client` re-exports it.
- `useQuery` hook: `artifacts/irissam-erp/src/hooks/useQuery.ts` — generic fetch hook with `{ data, loading, error, refetch }`.

## RBAC
- Roles: hr_manager, hr_officer, manager, employee (added in migration 014).
- 30 granular `hr.*` permissions (hr.employees.read, hr.planning.write, etc.).

**Why btree_gist is needed:** PostgreSQL's EXCLUDE USING gist on UUID columns requires the btree_gist extension because gist doesn't natively index scalar types — btree_gist adds that capability.
