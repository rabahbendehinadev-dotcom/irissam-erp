# IRISSAM HOSPITAL ERP

Tableau de bord professionnel pour la gestion hospitalière IRISSAM — statistiques en temps réel, alertes critiques, patients récents et rendez-vous à venir.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/irissam-erp/src/i18n/` — système i18n (fr/ar/en) avec support RTL automatique
- `artifacts/irissam-erp/src/components/layout/` — Sidebar, Topbar, DashboardLayout
- `artifacts/irissam-erp/src/components/dashboard/` — StatsCard, charts (recharts), widgets
- `artifacts/irissam-erp/src/pages/Dashboard.tsx` — page principale
- `attached_assets/` — logo + screenshot de référence du design
- `lib/api-spec/openapi.yaml` — contrat API (à étendre pour les vrais modules)

## Architecture decisions

- Toutes les données sont mock (arrays statiques) — aucun appel API pour cette v1 dashboard
- i18n maison (useLanguage hook) supportant fr/ar/en avec RTL dynamique sur `document.documentElement.dir`
- Sidebar collapsible (220px → 64px) avec gestion locale de l'état
- Recharts pour tous les graphiques (LineChart, BarChart, PieChart donut)
- Palette stricte depuis la maquette : sidebar #1B2A4A, background #F1F5F9, accents bleu/vert/orange/violet/rouge

## Product

Dashboard ERP hospitalier avec :
- 12 cartes de statistiques (patients, consultations, lits, CA, etc.)
- 3 graphiques (évolution consultations, admissions/sorties, répartition par service)
- Alertes critiques, patients récents, rendez-vous à venir
- 6 mini-widgets (occupation lits, réanimation, bloc, banque de sang, ambulances, stock faible)
- Sélecteurs multi-sites (site, bâtiment, étage, service)
- Commutateur de langue (FR / AR RTL / EN) en temps réel

## User preferences

- Reproduire la maquette fournie en screenshot avec une fidélité maximale
- Pas de texte hardcodé — tout passe par le système i18n
- Données mock uniquement pour cette première version
- Pas d'emojis dans l'UI

## Gotchas

- `src/i18n/index.tsx` doit rester en `.tsx` (contient du JSX) — ne pas renommer en `.ts`
- Le logo est importé via `@assets/9e2f711d-...png` (chemin résolu par vite.config.ts alias `@assets`)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
