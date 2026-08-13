---
name: Fiche consommable (séjour)
description: admission_consumables étape 1 autonome; étape 2 = liaison Stock Médical/Pharmacie via ALTER TABLE
---

## Rule
The stay consumables sheet (`admission_consumables`, mig 047) is deliberately **standalone**: free-text `designation`, `item_type` in ('medicament','consommable'), integer quantity, `used_at`, note, recorded_by(+name snapshot). Routes live under `/admissions/:id/consumables` (GET admissions.view / POST admissions.edit — coarse staff perms by design). POST refuses `cancelled` and `preadmission` statuses; `used_at` may not be in the future; server stamps the responsible user from JWT (never client-supplied).

**Why:** user explicitly ordered a two-step build — step 1 = the sheet inside the stay; step 2 = link to Medical Stock & Pharmacy later. No stock decrement, no medication_id FK yet.

**How to apply (step 2):** add nullable link columns by ALTER TABLE (e.g. medication_id / stock item + batch refs) without breaking existing free-text rows; wire decrement through the FEFO consumptions chain (see medical-stock-module) and pharmacy dispense guards (see prescription-pharmacy-chain). No audit_logs duplication in step 1 — the row itself is the requested register (user + timestamp).
