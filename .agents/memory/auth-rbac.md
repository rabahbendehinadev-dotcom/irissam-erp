---
name: Auth + RBAC Architecture
description: Production auth system — JWT, refresh tokens, brute-force, RBAC tables, permissions in JWT payload
---

## What was built
Full DB-backed auth replacing the in-memory SEED_USERS in auth.ts.

## Key decisions

**Token strategy**
- Access token: 15 min JWT, payload `{ userId, role, permissions[], siteId }` — permissions embedded to avoid per-request DB lookup
- Refresh token: 7 days, random bytes, stored as SHA-256 hash in `user_sessions` (existing table, reused)
- Refresh token delivered via HttpOnly SameSite=Strict cookie (`irissam_rt`, path `/api/auth`)
- Access token stored in localStorage as before (key `irissam_auth_token`)

**Why permissions in JWT:** avoids a DB roundtrip on every request; /auth/me always returns fresh permissions. Trade-off: stale if RBAC changes — acceptable for a hospital where RBAC changes rarely.

**Brute force**
- `users.failed_login_attempts` increments on each wrong password
- After `MAX_ATTEMPTS = 5`: `users.locked_until = now() + 15 min`, HTTP 429
- On successful login: reset both fields + update `last_login_at`

**Refresh rotation**
- Old session gets `revoked_at = now()` + `rotated_to = newSessionId`
- New session inserted; old cookie becomes immediately invalid
- Old cookie reuse → 401 (prevents refresh-token theft replay)

**RBAC tables** (migration 004)
- `roles` (11 rows seeded): super_admin, administrator, director, doctor, nurse, reception, laboratory, radiology, pharmacist, finance, hr
- `permissions` (99 rows): granular `module.action` strings
- `user_roles` (user ↔ role M:N), `role_permissions` (role ↔ permission M:N)
- Seed (migration 005) is idempotent via `ON CONFLICT DO NOTHING`

**user_role enum extended** (migration 004, outside transaction)
- Added: administrateur, directeur, medecin, infirmier, reception, laboratoire, radiologie, pharmacie, rh, super_admin
- These map to the RBAC role names via `user_roles` join

**Admin seed user**
- email: admin@irissam.dz, password: Admin@2026 (bcrypt cost 12)
- `force_password_change = true` — must reset on first login
- role enum: 'administrateur', rbac role: 'administrator'

**requirePermission middleware**
- Checks `req.auth.permissions.includes(permission)` — O(n) array search
- `super_admin` role bypasses all checks
- Denied access logged to `user_activity_logs` (best-effort, never blocks 403)

**Routes protected by requirePermission (as of this sprint)**
- POST /patients → patients.create
- PUT /patients/:id → patients.edit
- POST /medications → pharmacy.manage_stock
- PATCH /medications/:id → pharmacy.manage_stock
- DELETE /medications/:id → pharmacy.manage_stock
- POST /prescriptions/:id/dispense → pharmacy.dispense
- POST /admissions/:id/discharge → admissions.discharge
- POST /admissions/:id/transfer → admissions.transfer
- POST /admissions/:id/cancel → admissions.cancel

**MFA**
- Columns in DB: mfa_enabled (bool default false), mfa_secret_enc (text)
- Endpoints stubbed but not implemented — see follow-up task

**Frontend**
- `AuthContext` registers a refresh handler with `apiClient.registerUnauthorizedHandler()`
- On 401: tries refresh once; if it fails, dispatches `auth:logout` custom event
- `usePermission()` checks `user.permissions[]` first, falls back to static ROLE_PERMISSIONS map
- `User` type gained `permissions: Permission[]` field
- `authService.logout()` now calls POST /auth/logout (server-side session revocation)

## RBAC negative testing
Seeded E2E staff users exist with repo-known passwords (see scripts/test-doctor-portal-e2e.mjs and scripts/e2e-run.mjs): doctor.a/doctor.b@e2e.test (patients.view WITHOUT billing.view), no.access@e2e.test (receptionist, no patients.view), fintest@irissam.dz (finance), infirmier_rbac@irissam.dz. Use them to curl-test permission boundaries instead of creating users.
