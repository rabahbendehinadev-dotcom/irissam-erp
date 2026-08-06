---
name: Atomic MRN counter + pool deadlock rule
description: Per-year patient_mrn_counters table pattern and the in-transaction pool deadlock rule for all services
---

# Atomic patient number generation (migration 037)

`patient_mrn_counters(year PK, last_value)` — one row per year. Acquire the next
number INSIDE the patient-create transaction with:

```sql
INSERT INTO patient_mrn_counters (year, last_value) VALUES ($year, 1)
ON CONFLICT (year) DO UPDATE SET last_value = patient_mrn_counters.last_value + 1
RETURNING last_value;
```

Row lock serializes concurrent creates; rollback leaves a gap (accepted).
`mrn` (MRN-YYYY-NNNNN), `mpiId` (MPI-YYYY-NNNNN), `fileNumber` (YYYY-NNNNN) all
derive from the SAME returned value. Seeded from max existing `MRN-YYYY-NNNNN`
per year; new year auto-restarts at 1 via the INSERT branch. Never COUNT(*)+1 /
MAX()+1 / random / timestamps for medical IDs. UNIQUE constraints on
mrn/mpi_id/file_number existed since the base schema.

**Verified:** 20 parallel HTTP creates → 20 distinct MRNs, contiguous sequence, 0 failures.

# Pool deadlock rule (applies to EVERY service)

**Rule:** never call a repository read that uses its own pool connection
(`this.db.select()` without ctx) from INSIDE `db.transaction()`.

**Why:** pg Pool default max = 10. N parallel transactions hold N connections;
each in-tx pool read waits for one more connection that only another tx's
commit can free → total deadlock (observed: 20 parallel creates hung forever,
0 rows written). Symptom: requests hang, no errors, `disabled` states in
pg_stat_activity.

**How to apply:** run pre-checks (duplicate detection, lookups) BEFORE opening
the transaction, or pass ctx so the read runs on the tx connection via
`qb(this.db, ctx)`. Audit/markX helpers already accept ctx — always pass it.

# Tiered duplicate detection

`findDuplicateCandidates` in the patient repository: SQL pre-filter
(normalized name OR phone digits OR id-doc) + TS tier assignment. Tiers:
`very_strong` (id_document_number) > `strong_phone` > `strong_name_dob` >
`possible_name` (never blocks a save). Normalization identical on both sides:
trim + lower + collapse whitespace; phone compared digits-only
(`regexp_replace(..., '[^0-9]', '', 'g')`). Use POSIX classes
(`[[:space:]]`, `[^0-9]`) in drizzle sql`` templates — avoids backslash-escape
ambiguity. Frontend blocks save only on strong/very_strong candidates not yet
acknowledged via the modal (ackIds set + pendingSaveRef pattern).
