---
name: lib/db composite dist rebuild
description: After editing lib/db schema source, api-server typecheck reads stale dist/*.d.ts unless lib/db is rebuilt
---

# lib/db — projet composite : rebuild obligatoire après édition du schéma

**Règle :** après toute modification de `lib/db/src/schema/*.ts`, exécuter `npx tsc -b lib/db` (racine du workspace) avant de faire confiance à `npx tsc --noEmit` dans api-server.

**Why:** `lib/db/tsconfig.json` est `composite: true` + `emitDeclarationOnly` → `dist/*.d.ts`. api-server référence ce projet (`references`), donc son tsc redirige les imports `@workspace/db/*` vers les déclarations `dist/` — PAS vers la source. Une colonne ajoutée dans la source reste invisible au typecheck (TS2339 « Property does not exist ») tant que dist n'est pas régénéré. Le runtime (tsx) lit la source directement, donc le serveur marche pendant que tsc ment — piège déjà rencontré avec api-client-react côté ERP.

**How to apply:** symptôme = TS2339 sur une colonne fraîchement ajoutée au schéma alors que `grep` la trouve dans la source. Réflexe : `npx tsc -b lib/db` puis relancer le typecheck (supprimer `.tsbuildinfo` de api-server au besoin). Même logique pour `lib/api-zod` (aussi référencé en composite).

Note connexe : le schéma drizzle peut être en retard sur la vraie DB (ex. colonnes `service_id`/`service_name` de la migration 046 absentes du TS jusqu'en 2026-08) — aligner le schéma TS est autorisé sans nouvelle migration quand les colonnes existent déjà en base.
