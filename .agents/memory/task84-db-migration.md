---
name: Task 84 DB Migration
description: Issues and fixes discovered while applying the 3 clinical schema migrations to PostgreSQL
---

# Task #84 — Migration Issues & Fixes

## What was applied
- 001_clinical_schema.sql — full 36-table UUID schema
- 002_seed_indexes.sql — 13 composite indexes
- 003_schema_additions.sql — MRN, encounterNumber, attachments, user_activity_logs

## Tracking table
`__migrations` table in public schema; 3 rows after Task #84.

## Bugs fixed in migration SQL

### `ADD CONSTRAINT IF NOT EXISTS` (not valid PostgreSQL syntax)
`ALTER TABLE t ADD CONSTRAINT IF NOT EXISTS name FK...;` fails on any PostgreSQL version.
**Fix:** Replace with `DO $$ BEGIN ALTER TABLE t ADD CONSTRAINT name FK...; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
8 occurrences in 001_clinical_schema.sql were auto-fixed by Python script; backup saved as `.sql.bak`.

### `daily_stats` legacy table schema mismatch
Old table had: `date, rendez_vous, admissions, sorties, analyses, imaging, invoices, revenue_da`.
New Drizzle schema uses: `stat_date, new_admissions, discharges, emergency_visits, surgeries, icu_occupancy, bed_occupancy_rate, total_patients`.
**Fix:** Applied via separate ALTER TABLE (rename columns + drop old + add new).

## Seed script fix
`db.delete(patientsTable)` at line 221 was called before `db.delete(consultationsTable)` at line 513 → FK violation.
**Fix:** Added `TRUNCATE TABLE ... CASCADE;` block at start of seed() using raw pool.query(). Individual db.delete() calls left in place (now harmless — delete 0 rows).

## Enum values (corrected in smoke tests)
- `urgency_level`: `STAT | urgent | routine` (not "normal")
- `lab_status`: `demandee | prelevee | en_cours | validee | critique | annulee` (not "demande")
- `imaging_status`: `demandee | planifiee | realisee | interpretee | annulee`
- `prescription_status`: `prescrit | prepare | delivre | annule`
- `lab_orders.category`: required NOT NULL (no default)
- `lab_orders.patient_name`: required NOT NULL
- `imaging_orders.patient_name, requested_by_name, source_module`: required NOT NULL
- `prescriptions.drug, dosage, route, frequency, prescribed_by_name, source_module`: required NOT NULL
- `prescriptions`: NO `medication_id` column; use `drug` TEXT column

## audit_logs column names
Actual columns: id, timestamp, module, action, old_value, new_value, user_id, user_name, user_role, patient_id, encounter_id, resource_id, resource_type, ip, site_id, severity
NO `entity_type` column — use `resource_type` and `resource_id` instead.

## safeUuid() helper (new — in repositories/types.ts)
All repositories passed `ctx.userId` directly as UUID FK columns (`created_by`, `updated_by`, `deleted_by`).
In-memory auth uses non-UUID IDs ("user-1", "user-2") → FK violation.
**Fix:** `safeUuid(id)` returns the string only if it matches UUID regex, otherwise `undefined`.
Applied to all 10 write repositories via Python sed script.

**Why:** Auth still uses in-memory SEED_USERS (Task #12 will migrate to DB). Until then, createdBy/updatedBy are NULL for in-memory auth sessions.

## Missing route added
`routes/admissions.ts` did not exist — created full CRUD + discharge endpoint.
Registered in routes/index.ts as `router.use("/admissions", requireAuth, admissionsRouter)`.

## blood-bank root alias
`routes/blood-bank.ts` only had GET `/summary`. Added `["/", "/summary"]` alias.

## Final DB state after Task #84
- 42 tables total (38 new schema + 4 legacy: beds, vehicles, patients_legacy, bed_stats)
- 99 custom indexes (idx_*)
- Seed: 15 patients, 13 users, 10 encounters, 10 admissions, 24 ICU beds, 100+ occupancy beds, 8 blood bank groups, 8 alerts, 12 appointments, 6 consultations, 10 medications, 12 vehicles, 7 days daily stats
