---
name: Insurance Module
description: Architecture and gotchas for the Insurance/Tiers payant backend module
---

## Tables (migration 010 + 011)
- 10 new tables: insurance_organizations, insurance_plans, coverage_requests, insurance_claims, insurance_claim_items, insurance_bordereau_items, insurance_bordereaux, insurance_org_payments, insurance_payment_distributions, insurance_rejection_transfers
- Extends: insurance_policies (adds org/plan FK, num columns, statut), insurance_claims (adds amount_*_num columns)
- Sequences: bordereau_number_seq, coverage_request_seq, org_payment_number_seq, **claim_number_seq** (all 4 must exist)

## Known fixes applied post-migration
- `insurance_policies.insurer_name` was NOT NULL — changed to nullable (migration 010 now includes the ALTER)
- `claim_number_seq` added to migration 010 (was missing from initial write)
- Migration 011 did not grant insurance permissions to super_admin — fixed by inserting all `insurance.*` perms for super_admin+administrator

## Routes (sub-router pattern under /api/insurance)
- Hub: `insurance.ts` mounts 7 sub-routers
- Plans endpoint: `POST /insurance/plans` (NOT `/organizations/:id/plans`)
- Bordereaux add-claims: `POST /bordereaux/:id/add-claims` (NOT `/bordereaux/:id/claims`)
- All bodies use **camelCase**: `patientId`, `organizationId`, `planId`, `policyNumber`, `validFrom`, `validUntil`, `coverageType`, `amountRequested`, `claimIds`, etc.
- Plans require: `organizationId`, `code`, `name`, **`coverageType`** (not optional despite DB default)

## Coverage engine
- Pure TS class in `insuranceCoverageEngine.ts` — no DB calls
- Called from `insuranceService.createClaimFromInvoice()` for auto-calculation

## RBAC
- 22 new `insurance.*` permissions in migration 011
- new role: `insurance_agent`
- super_admin and administrator get all insurance.* perms via 011 grant block
- Old compat perms kept: insurance.view → insurance.claims.view etc.

**Why:** Migrations ran before super_admin grant block was added; fix was a direct DB INSERT that is now also in migration 011.
