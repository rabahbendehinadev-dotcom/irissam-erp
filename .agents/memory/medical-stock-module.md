---
name: Medical Stock Module
description: Full enterprise medical stock management module — architecture, patterns, and known issues
---

## Structure
- **Migrations**: 015_medical_stock.sql (17 tables, 6 enums, triggers, views), 016_medical_stock_permissions.sql (31 permissions)
- **Backend**: `artifacts/api-server/src/routes/medical-stock/` — 12 sub-routers + index.ts
  - Registered in routes/index.ts as `/medical-stock` with `requireAuth`
- **Frontend**: `artifacts/irissam-erp/src/pages/MedicalStock.tsx` + 11 tab components in `src/components/medical-stock/`
- **API service**: `artifacts/irissam-erp/src/services/api/medical-stock.ts`
- **Route**: `/medical-stock` in App.tsx (lazy-loaded)

## Key patterns used
- FEFO (First Expired First Out) in consumptions route
- Weighted average cost update on every stock entry
- Transactional stock mutations (pool.connect → BEGIN/COMMIT)
- `requirePermission("stock.x.y")` on every route
- Movement log auto-created on every stock change

## Known issue fixed
- `gin_trgm_ops` failed if `pg_trgm` extension not loaded — fixed with `CREATE EXTENSION IF NOT EXISTS pg_trgm` wrapped in DO $$ BEGIN...EXCEPTION WHEN OTHERS THEN fallback to btree END $$

## Movement types enum
entree, sortie, transfert_in, transfert_out, consommation, ajustement_plus, ajustement_moins, retour_fournisseur, retour_patient, perte, peremption, inventaire_plus, inventaire_moins

## Adjustment reasons enum
inventaire, perte, casse, vol, peremption, don, correction, reception_non_conforme, retour_patient, autre
