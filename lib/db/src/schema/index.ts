/**
 * Central schema export — all 36 tables, enums, and insert schemas.
 * Import order respects FK dependency chain.
 *
 * Dependency order:
 *   enums → infrastructure → users → patients → encounters
 *   → emergency / occupancy / admissions / surgical
 *   → lab_orders / imaging_orders / prescriptions
 *   → consultations / appointments / medications / billing
 *   → audit / notifications / blood_bank / alerts
 *   → vehicles (legacy) / daily_stats (legacy)
 */

// ─── Enums ────────────────────────────────────────────────────────────────────
export * from "./enums";

// ─── Domain 1: Infrastructure ─────────────────────────────────────────────────
export * from "./infrastructure";

// ─── Domain 2: Users & Auth ───────────────────────────────────────────────────
export * from "./users";

// ─── Domain 3: Patients ───────────────────────────────────────────────────────
export * from "./patients";

// ─── Domain 4: Encounters ─────────────────────────────────────────────────────
export * from "./encounters";

// ─── Domain 5: Emergency ──────────────────────────────────────────────────────
export * from "./emergency";

// ─── Domain 6: Admissions ─────────────────────────────────────────────────────
// Note: admissions.ts imports occupancy.ts for the bed FK
export * from "./occupancy";
export * from "./admissions";

// ─── Domain 8: Surgical / OR ──────────────────────────────────────────────────
export * from "./surgical";

// ─── Domain 9: Clinical Orders ────────────────────────────────────────────────
export * from "./lab_orders";
export * from "./imaging_orders";
export * from "./prescriptions";

// ─── Domain 10: Pharmacy Stock ────────────────────────────────────────────────
export * from "./medications";

// ─── Domain 11: Consultations & Appointments ──────────────────────────────────
export * from "./consultations";
export * from "./appointments";

// ─── Domain 12: Billing ───────────────────────────────────────────────────────
export * from "./billing";

// ─── Domain 13: Audit & Notifications ────────────────────────────────────────
export * from "./audit";
export * from "./notifications";

// ─── Domain 14: Blood Bank ────────────────────────────────────────────────────
export * from "./blood_bank";

// ─── System: Alerts ───────────────────────────────────────────────────────────
export * from "./alerts";

// ─── Legacy (backward-compat, do not use in new code) ────────────────────────
// beds.ts: serial-PK aggregate counts — used by /api/beds until Task #71
export * from "./beds";
export * from "./vehicles";
export * from "./daily_stats";
