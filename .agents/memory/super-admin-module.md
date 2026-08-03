---
name: Super Admin / System Control Center
description: Full-stack super-admin module — DB migrations, backend routes, frontend tabs, security architecture, and test outcomes.
---

## Architecture
- **DB**: migrations 026 (14 tables) + 027 (32 permissions) applied to production DB
- **Backend**: 20 route files under `artifacts/api-server/src/routes/system/` + 2 middleware files
- **Frontend**: 17 lazy tab components under `artifacts/irissam-erp/src/components/super-admin/`, page at `src/pages/SuperAdmin.tsx`
- **Route mount**: `router.use("/system", maintenanceGuard, systemRouter)` in `routes/index.ts`
- **Frontend route**: `/super-admin` in App.tsx, sidebar entry with `roleRequired: ["super_admin","system_administrator"]`

## Key Rules
- `user_activity_logs` uses `timestamp` (NOT `created_at`) — always use `l.timestamp` in queries
- Step-up tokens are **single-use** — consumed on first use, reject replay. 15-min expiry.
- API keys returned raw (`irk_` prefix + 64 hex) only at creation; stored as SHA-256 hash
- `maintenanceGuard` exempts `/auth/*`, `/healthz`, `/system/health`; caches DB state 30s
- Secrets (SMTP password, webhook secret, integration tokens) never returned plain — masked as `****`
- `StepUpDialog` is exported both named AND default (both import styles work)
- `nav.superAdmin` i18n key added to fr/en/ar locales

## Test Super Admin User
- Email: `superadmin@irissam.dz`, Password: `SuperAdmin@2024!`, role: `super_admin`
- Created via psql seed during development — NOT from seed migrations

## Test Results (19/19 endpoints 200)
- A–S: All GET endpoints → 200
- T: No-auth → 401 ✓
- U: No step-up on protected operation → 403 ✓
- V: Apply migrations with step-up → 200 ✓
- W: Step-up token single-use correctly rejected on replay ✓
- Maintenance mode: enabled=false (correct default) ✓

**Why:** Single-use step-up tokens prevent replay attacks. The token must be re-requested for each protected operation in the frontend.
