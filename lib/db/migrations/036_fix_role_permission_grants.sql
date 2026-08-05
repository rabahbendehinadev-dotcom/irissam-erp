-- ============================================================================
-- Migration 036 — Fix role-permission grants across modules
--
-- Root cause: migrations 018 (biomedical), 020 (quality), 023 (GED), 025
-- (payroll) referenced role names that do not exist in the roles table:
--   - 'admin'            → correct name is 'administrator'
--   - 'directeur'        → correct name is 'director'
--   - 'directeur_general'→ correct name is 'director'
--
-- As a result, administrator and director users were never granted any
-- permissions for those modules. This migration backfills all missing grants.
-- Safe to run multiple times (ON CONFLICT DO NOTHING).
-- ============================================================================

BEGIN;

-- ── Biomedical (module = 'biomedical') ────────────────────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name IN ('administrator', 'director')
  AND p.module = 'biomedical'
ON CONFLICT DO NOTHING;

-- ── Quality (module = 'quality') ──────────────────────────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name IN ('administrator', 'director')
  AND p.module = 'quality'
ON CONFLICT DO NOTHING;

-- ── GED / Documents (module = 'ged' or name LIKE 'documents.%') ───────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name IN ('administrator', 'director')
  AND (p.module = 'ged' OR p.name LIKE 'documents.%')
ON CONFLICT DO NOTHING;

-- ── Payroll (module = 'payroll') ──────────────────────────────────────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name IN ('administrator', 'director')
  AND p.module = 'payroll'
ON CONFLICT DO NOTHING;

-- ── Executive dashboard — also grant to administrator if missing ──────────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name IN ('administrator', 'director')
  AND p.module IN ('executive', 'dashboard')
ON CONFLICT DO NOTHING;

COMMIT;
