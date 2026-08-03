---
name: Payroll Module E2E Bugs
description: Root causes of test failures in the payroll E2E suite; critical for any payroll feature work or future test writing.
---

# Payroll Module — E2E Test Bug Log

**Why:** 9 distinct bugs caused 29/75 test failures. Most were silent DB errors (dbParam() never throws).

## 1. Loan status enum conflict (engine.ts s35)
`CASE WHEN $2 = 'completed'` where $2 is a boolean parameter — PostgreSQL rejects implicit cast. Fix: use `$3` (boolean) and reorder parameters.

## 2. Salary components: camelCase vs snake_case (components.ts)
Route destructures `calculationMethod`/`fixedAmount` (camelCase), but the test POSTed `calculation_method`/`fixed_amount` (snake_case). Stored `fixed_amount = 0`. Fix: accept both in the route using `body.fixedAmount ?? body.fixed_amount`.

## 3. effectiveFrom default = 'today' (components.ts)
Default `effectiveFrom = 'today'` means components created today won't apply to prior periods (today > period.end_date). Fixed to `'2000-01-01'`.

## 4. advance deduction_periodId typo (test)
Test sent `deduction_periodId` (wrong) instead of `deductionPeriodId` (camelCase the route expects). Advance was saved with `deduction_period_id = NULL`, engine couldn't find it.

## 5. overtime_records NOT NULL columns
`planned_hours` and `worked_hours` are NOT NULL without defaults. All OT `dbParam()` INSERTs failed silently.

## 6. overtime_records compensation_type enum
Valid values: `{paiement, recuperation}`. Test used `'paid'` — INSERT failed silently.

## 7. absence_records NOT NULL type column
`type` (absence_type enum) is NOT NULL without default. Test INSERT omitted it, failed silently → daysAbsent = 0 → no absence deduction.

## 8. OT tiered calculation (engine.ts)
Engine used single multiplier for ALL OT hours. Correct: split by tiers (first 8h at rate_25, next 8h at rate_50, beyond at rate_100). For 10h: 8h×1.25 + 2h×1.50 = 5000 DZD.

## 9. CSV BOM stripped by fetch().text() (test)
Node.js native fetch `TextDecoder` (ignoreBOM=false) strips UTF-8 BOM by default. Fix: use `arrayBuffer()` then `new TextDecoder('utf-8', { ignoreBOM: true }).decode(buf)`.

## How to apply
- Always check DB enums before using string literals in test INSERTs
- Always check NOT NULL columns before writing bare-minimum INSERTs
- Route body parsing: accept both camelCase and snake_case for public APIs
- Test payroll calculations: use tiered OT, not a single multiplier
