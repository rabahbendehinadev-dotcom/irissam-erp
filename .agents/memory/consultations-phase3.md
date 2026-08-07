---
name: Consultations Phase 3 hardening
description: Shared number counter across ALL writers, TOCTOU re-check in tx, coarse-vs-ownership RBAC design, UAT Phase 3 fixtures
---

# Consultations module — Phase 3 UAT hardening (2026-08)

## Shared counter rule (the big one)
Every writer of a shared number namespace (CONS-YYYY-NNNNN) must use the same
atomic counter table. The main service was fixed first, but the doctor-portal
route still had its own `COUNT(*)+1` — a second writer the architect review
caught. Mixed concurrent creates (portal + staff) then produced collisions.
**Why:** COUNT(*)+1 ignores soft-deleted rows and races under concurrency;
two code paths inserting into the same table WILL collide eventually.
**How to apply:** before declaring a numbering fix done, `grep` the whole
API for other INSERTs into that table (incl. portals/sub-routers). A
single-statement `INSERT..ON CONFLICT..RETURNING` on the counter is atomic
even on a pool connection (no explicit transaction needed for the portal path).
Counter increment goes AFTER validations inside the tx so failed creates
don't burn numbers (gaps are harmless, but avoidable ones confuse auditors).

## TOCTOU invariant re-check
Route-level validations run on the pool BEFORE the service transaction; state
can change in between (e.g. encounter closes). Re-check the invariant INSIDE
the tx with `SELECT ... FOR SHARE`, throw a named error class
(`EncounterStateError`), and map it to 400 in the route catch — never let it
surface as 500.

## RBAC design: coarse staff modules vs ownership-scoped portal
Staff ERP modules (consultations, admissions, …) use coarse permissions by
design: anyone with `consultations.view` sees ALL consultations (reception
needs this). Record-level ownership (`WHERE doctor_id=$actor`) exists ONLY in
the doctor-portal routes. Architect reviews flag this as BOLA/IDOR.
**Why:** it is the established module-wide design; changing it silently would
break reception/nurse workflows.
**How to apply:** treat per-record scoping of staff modules as a product
decision — surface it to the user, don't "fix" it unilaterally.

## Environment gotchas
- ERP `vite build` requires PORT and BASE_PATH env vars at config-load time
  (dev workflow provides them). Shell builds: `PORT=3000 BASE_PATH=/ pnpm build`.
- api-server has ~200 pre-existing tsc errors in older modules (storage,
  biomedical, …). Never judge by project-wide tsc; filter for the files you
  touched. ERP tsc is fully clean now (the old "14 pre-existing errors" note
  is obsolete).
- `encounters` has no `created_at` column (memory: schema names differ).

## UAT fixtures worth remembering
- Seed doctor k.martin has users.role=doctor but NO user_roles row → cannot
  access the doctor portal himself; use doctor.a@e2e.test for portal tests.
- The consultation wizard has no DB-wired diagnosis field; diagnosis edits go
  through PATCH /consultations/:id (UI notes panel covers `notes` only).
- Wizard step-3 vitals are a mock overlay, intentionally not persisted.
