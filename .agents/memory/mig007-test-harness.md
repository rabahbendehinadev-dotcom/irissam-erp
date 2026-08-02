---
name: Migration 007 test harness
description: Lessons from building and fixing the end-to-end integer→UUID migration test
---

## Enum values (PostgreSQL names, not English guesses)

| Column context            | Wrong value used | Correct value |
|---------------------------|-----------------|---------------|
| `or_slot_status`          | `scheduled`     | `planifie`    |
| `surgical_urgency`        | `emergent`      | `emergency`   |
| `icu_admission_status`    | `admis`         | `en_cours`    |
| `imaging_status`          | `en_cours`      | `planifiee`   |
| `urgency_level`           | `stat`          | `STAT`        |

**Why:** enum labels are the exact strings from `CREATE TYPE … AS ENUM (…)` in 001_clinical_schema.sql —
French/mixed-case — not guessable from field semantics.

## SERIAL sequence naming in fresh-created tables

When you `CREATE TABLE patients_legacy (id SERIAL …)` directly (not by renaming `patients`),
the sequence is `patients_legacy_id_seq`, **not** `patients_id_seq`.
In the production DB, `patients_id_seq` exists because migration 001 renamed the old table.
Test-DB seed must use the correct sequence name for the table it actually creates.

## sites table columns

`sites` has no `country` or `timezone` column. Mandatory cols with no default: `name`, `code`.
Optional geography: `city`, `wilaya`, `postal_code`. `is_active` defaults to `true`.

## operating_rooms table

`short_name TEXT NOT NULL` is required. `status` type is `or_status` (not `or_room_status`), default `'libre'`.
No `is_active` column. `site_id` is nullable.

## set -e + command substitution

`var=$(failing_cmd)` with `set -e` active causes the script to exit **before** `$?` is captured.
Pattern fix:
```bash
set +e
OUTPUT=$(psql … 2>&1)
STATUS=$?
set -e
```

## Null-audit checks after migration COMMIT

Migration 007 drops all `_mig007_*_map` tables inside its `BEGIN…COMMIT` block.
Post-migration null-audit queries must NOT reference those tables.
Use a stable natural key join instead, e.g.:
```sql
JOIN admissions na ON na.admission_number = ol.admission_number
JOIN occupancy_beds nb ON nb.number = ol.number
```

## Test result (2026-08-02)

All 30+ assertions passed after fixes. The integer→UUID code path executed end-to-end:
- 17 tables migrated, row counts preserved
- All FK chains intact (0 orphans)
- No non-NULL FK silently NULLed
- Migration is ROLLBACK-safe (single transaction)
