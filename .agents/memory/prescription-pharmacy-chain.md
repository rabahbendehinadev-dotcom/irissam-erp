---
name: Prescription→Pharmacy chain
description: Real dispense chain design — medication link, anti-race claim pattern, RBAC gates, JWT names, and the traps hit while building it
---

# Prescription → Pharmacy → Stock chain (UAT Phase 4)

## Architecture
- `prescriptions.medication_id` (nullable FK → medications, ON DELETE SET NULL, migration 040). `drug` text stays authoritative for display; when a med is linked, med.name overwrites drug at creation.
- Dispense = `PharmacyService.dispense(rxId, medId, quantity, actor)` in ONE transaction: claim → stock check → deduct → dual audit (rx `dispensed` with stockBefore/After + medication `updated`).
- Statuses are FRENCH enums end-to-end: `prescrit | prepare | delivre | annule`. Any frontend STATUS_MAP with English keys ('dispensed') silently falls through — patient tab had this bug.
- "Dispense ID" = the `dispensed` audit_logs row id; there is no separate dispenses table.

## Anti-race claim pattern (rule)
Single-shot state transitions (dispense, and any future "only once" op) must put the state guard IN the UPDATE's WHERE:
`UPDATE ... SET status='delivre', ... WHERE id=$1 AND status IN ('prescrit','prepare') AND deleted_at IS NULL RETURNING *` → 0 rows = concurrent loser = 409.
**Why:** read-then-update inside a tx does NOT prevent double dispense under READ COMMITTED — two txs both pass the read check; verified by parallel-curl test (stock deducted once only after fix).
**How to apply:** repo method `claimForDispense`; stock deduction AFTER the claim in the same tx so rollback reverts the claim.

## RBAC
- Reads (`GET /prescriptions`, `/:id`) gated by `pharmacy.view` (roles: administrator, director, doctor, nurse, pharmacist, super_admin — NOT reception). Writes: create = consultations.create_prescription|emergencies.prescribe; prepare/annule = pharmacy.prepare; dispense = pharmacy.dispense.
- Per-encounter prescriber binding deliberately NOT enforced (coarse perms by design — any credentialed doctor can prescribe for any patient, matches urgences workflow). Site/patient scoping is a known follow-up.
- Frontend `Permission` union in config/permissions.ts must track DB permission names — TS error is the tripwire.

## Traps hit (durable)
- SQL-created users get NO permissions: `loadPermissions()` joins the `user_roles` table, not users.role enum. Always insert a user_roles row.
- JWT now carries firstName/lastName (both sign sites in routes/auth.ts: login + refresh). Anything reading actor names from JWT depends on this.
- `safeUuid()` returns `string | undefined` — use `?? null` for nullable DB columns.
- lib/db is a composite TS project: after ANY schema edit run `pnpm exec tsc --build lib/db --force` or api-server tsc reads stale dist/*.d.ts.
- Codegen types medication `id` as number but runtime is UUID string — compare with `String(m.id)`.
