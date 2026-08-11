---
name: UAT data reset script
description: scripts/reset-uat-data.sql wipes all patient/clinical/financial data, keeps system + master data
---
- Dev DB was intentionally emptied of ALL patient/demo data on 2026-08-11 (explicit user order). Empty patient/admission/invoice lists are NORMAL — do not re-seed unless asked.
- **Why:** user is preparing the VPS production for its first real patient; Replit dev mirrors that clean state.
- Script is transaction-safe, FK-ordered (children first, order derived from pg constraint graph), self-verifying: a DO-block guard raises (→ full rollback) if any patient table is non-empty or any system table got emptied. Lives in scripts/ so it can NEVER auto-run (migration runner only reads its hardcoded MIGRATIONS array).
- Partial-delete rule: audit_logs, doctor_messages, document_records (+13 GED children via temp table), medical_consumptions(+items), or_slots, quality_incidents have NULLABLE patient/encounter links → delete only linked rows, keep admin/service rows.
- Quality NC/CAPA/findings have NO patient columns → never delete; just SET incident_id=NULL for patient-linked incidents (also breaks the NC↔CAPA↔findings FK cycle).
- Master resources freed by UPDATE, not DELETE: occupancy_beds/icu_beds/emergency_rooms/operating_rooms/ambulances → status disponible/libre + patient columns NULLed; 'hors_service'/'maintenance' statuses preserved.
- Sequences reset ONLY when the owning table is fully wiped; document_number_seq and medical_cons_number_seq intentionally NOT reset (their tables are partially preserved).
- VPS production reset is the USER's job: he runs the same script via docker exec psql after a pg_dump backup (instructions in the script header). Backups go to backups/ (gitignored).
