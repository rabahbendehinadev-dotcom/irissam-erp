---
name: Clinical Schema (Task #69)
description: Full PostgreSQL schema for IRISSAM Hospital ERP — 36 tables across 13 domains, all with UUID PKs
---

## Status
Complete. Zero TypeScript errors.

## Files written
- `lib/db/src/schema/enums.ts` — 40+ pgEnum definitions
- `lib/db/src/schema/infrastructure.ts` — sites, buildings, floors, departments, services
- `lib/db/src/schema/users.ts` — users + user_sessions
- `lib/db/src/schema/patients.ts` — patients (UUID) + patient_timeline_events
- `lib/db/src/schema/encounters.ts` — encounters (central clinical entity)
- `lib/db/src/schema/emergency.ts` — emergency_rooms, emergency_visits, emergency_vitals, ambulances
- `lib/db/src/schema/occupancy.ts` — occupancy_beds, icu_beds, icu_admissions, bed_stats
- `lib/db/src/schema/admissions.ts` — admissions (full UUID schema) + admission_timeline_events
- `lib/db/src/schema/surgical.ts` — operating_rooms (UUID), surgical_requests, or_slots
- `lib/db/src/schema/lab_orders.ts` — lab_orders
- `lib/db/src/schema/imaging_orders.ts` — imaging_orders
- `lib/db/src/schema/prescriptions.ts` — prescriptions
- `lib/db/src/schema/consultations.ts` — consultations (UUID)
- `lib/db/src/schema/appointments.ts` — appointments (UUID)
- `lib/db/src/schema/medications.ts` — medications (UUID) + medication_lots
- `lib/db/src/schema/billing.ts` — invoices, invoice_items, payments
- `lib/db/src/schema/audit.ts` — audit_logs (immutable)
- `lib/db/src/schema/notifications.ts` — notifications
- `lib/db/src/schema/blood_bank.ts` — blood_bank (site-based, UUID)
- `lib/db/src/schema/alerts.ts` — alerts (UUID)
- `lib/db/src/schema/beds.ts` — LEGACY serial-PK aggregate counts, kept for /api/beds
- `lib/db/src/schema/vehicles.ts` — LEGACY serial-PK, kept for /api/vehicles
- `lib/db/src/schema/daily_stats.ts` — LEGACY serial-PK, kept for /api/daily-stats
- `lib/db/src/schema/index.ts` — single export barrel
- `lib/db/migrations/001_clinical_schema.sql` — full CREATE TABLE SQL
- `lib/db/migrations/002_seed_indexes.sql` — composite performance indexes
- `lib/db/src/seed.ts` — complete rewrite for new schema + legacy tables

## Key design decisions
- **UUID PKs everywhere** (except 3 legacy tables kept for backward compat)
- **`encounters` is the central hub** — every clinical record (lab, rx, imaging, note, prescription) links to an encounter
- **`operating_rooms.ts` (legacy) was deleted** — `surgical.ts` owns the `operatingRoomsTable` name
- **Circular FKs resolved via deferred ALTER TABLE** — icu_beds→icu_admissions, occupancy_beds→admissions, departments→users
- `bedsTable` (legacy, serial PK) = aggregate counts per service; `occupancyBedsTable` (UUID) = per-bed tracking
- `bloodBankTable` now uses `bloodType + rhesus` as separate enum columns, not old `totalBags/availableBags`
- **drizzle.config.ts** now has `out: ./migrations` and `migrations.table: __drizzle_migrations`

## Breaking changes (to be fixed in Task #71)
The following API routes use old column names that no longer exist:
- `/api/patients` — used `registeredAt`, `name`, `age`, `service` (all removed in UUID schema)
- `/api/admissions` — used `admittedAt`, `dischargedAt`, `service` (replaced by full admission schema)
- `/api/blood-bank` — used `totalBags`, `availableBags` (replaced by `unitsAvailable`, `unitsReserved`)
- Dashboard route — used `admissionsTable.dischargedAt`, `admissionsTable.admittedAt`
These will be fixed in Task #71 (REST API routes for all clinical domains).
