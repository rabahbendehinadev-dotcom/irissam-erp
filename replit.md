# IRISSAM HOSPITAL ERP

Système de gestion hospitalière IRISSAM — tableau de bord professionnel avec fondation architecturale complète prête pour l'ajout de modules métier.

## Run & Operate

- `pnpm --filter @workspace/irissam-erp run dev` — lancer le frontend (port auto)
- `pnpm --filter @workspace/api-server run dev` — lancer le serveur API
- `pnpm run typecheck` — vérification TypeScript complète

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite + Tailwind CSS v4
- Charts: Recharts
- Routing: Wouter
- State: React Context (multi-provider pattern)
- Icons: lucide-react
- API: Express 5 (api-server artifact)
- DB (futur): PostgreSQL + Drizzle ORM

## Structure du projet (src/)

```
src/
├── config/                     # Configuration globale
│   ├── constants.ts            # APP_NAME, STORAGE_KEYS, couleurs, etc.
│   ├── routes.ts               # Toutes les routes (ROUTES.PATIENTS, etc.)
│   └── permissions.ts          # Matrice rôle→permissions (ROLE_PERMISSIONS)
│
├── types/                      # Types TypeScript globaux
│   ├── auth.ts                 # User, UserRole, Session
│   ├── hospital.ts             # Site, Building, Floor, Department, SiteFilter
│   ├── patient.ts              # Patient, Admission, Appointment
│   ├── medical.ts              # MedicalAlert, Medication, BedOccupancy
│   ├── api.ts                  # ApiResponse<T>, PaginatedResponse<T>, ApiError
│   ├── ui.ts                   # TableColumn, BreadcrumbItem, NavItem, BadgeVariant
│   └── index.ts                # Barrel export (export * from './...')
│
├── i18n/                       # Internationalisation
│   ├── index.tsx               # I18nProvider + useLanguage() hook
│   ├── fr.ts                   # Français (langue par défaut)
│   ├── ar.ts                   # العربية (RTL auto via document.dir)
│   └── en.ts                   # English
│
├── mock/                       # Données de test centralisées et typées
│   ├── sites.ts                # MOCK_SITES, MOCK_BUILDINGS, MOCK_FLOORS, MOCK_DEPARTMENTS
│   ├── patients.ts             # MOCK_PATIENTS (6 patients typés)
│   ├── appointments.ts         # MOCK_APPOINTMENTS (5 rdv avec patients imbriqués)
│   ├── alerts.ts               # MOCK_ALERTS (5 alertes critiques/moyennes)
│   ├── dashboard.ts            # MOCK_DASHBOARD_STATS, charts data
│   ├── inventory.ts            # MOCK_MEDICATIONS_LOW_STOCK, blood bank, ambulances
│   └── index.ts                # Barrel export
│
├── services/                   # Couche service (stubs → à brancher sur API)
│   ├── api/
│   │   ├── client.ts           # ApiClient class (GET/POST/PATCH/DELETE + auth headers)
│   │   └── endpoints.ts        # API_ENDPOINTS registry (toutes les routes API)
│   ├── authService.ts          # Auth login/logout/me (stub)
│   ├── notificationService.ts  # Notifications push/in-app (stub)
│   └── auditService.ts         # Audit trail log/getLog (stub)
│
├── store/                      # State management (React Context)
│   ├── AppProvider.tsx         # Provider racine (combine tous les contexts)
│   ├── AuthContext.tsx         # Session utilisateur + login/logout
│   ├── SiteContext.tsx         # Multi-sites/bâtiments/étages/départements
│   ├── ThemeContext.tsx        # Light/Dark mode + localStorage
│   └── NotificationsContext.tsx # Notifications in-app (liste + unread count)
│
├── hooks/                      # Hooks partagés
│   ├── usePermission.ts        # can(), canAll(), canAny() → vérifie les permissions
│   ├── useOnlineStatus.ts      # isOnline, lastSync, pendingSync
│   ├── useSite.ts              # Re-export de useSite() depuis SiteContext
│   ├── useTheme.ts             # Re-export de useTheme() depuis ThemeContext
│   ├── useNotifications.ts     # Re-export de useNotifications()
│   └── useAuditLog.ts          # log(action, resource, id) → auditService
│
├── utils/                      # Utilitaires purs
│   ├── format.ts               # formatNumber, formatCurrency(DZD), formatDate,
│   │                           # formatDateTime, formatTime, formatRelativeTime,
│   │                           # calculateAge, getInitials, formatPercent
│   ├── permissions.ts          # hasPermission(), hasAllPermissions(), hasAnyPermission()
│   └── index.ts                # Barrel export
│
├── components/
│   ├── ui/                     # Composants shadcn/ui (accordéon, dialog, toast…)
│   ├── layout/                 # Layout du système
│   │   ├── Sidebar.tsx         # Sidebar navale collapsible (220px → 64px)
│   │   ├── Topbar.tsx          # Barre du haut (recherche, filtres, user, langue)
│   │   ├── DashboardLayout.tsx # Wrapper Sidebar + Topbar + contenu
│   │   ├── PageHeader.tsx      # Titre + sous-titre + fil d'Ariane + actions
│   │   └── index.ts            # Barrel export
│   ├── shared/                 # Composants réutilisables cross-modules
│   │   ├── StatusBadge.tsx     # Badge coloré (success/warning/danger/info/neutral)
│   │   ├── PatientAvatar.tsx   # Avatar initiales avec couleur déterministe
│   │   ├── EmptyState.tsx      # État vide (icône + titre + description + action)
│   │   ├── LoadingSkeleton.tsx # Skeletons (StatCard, TableRow, Card)
│   │   ├── PageWrapper.tsx     # Wrapper standard de page (padding + spacing)
│   │   └── index.ts            # Barrel export
│   └── dashboard/              # Composants spécifiques au tableau de bord
│       ├── StatsCard.tsx
│       ├── ChartConsultations.tsx
│       ├── ChartAdmissions.tsx
│       ├── ChartServices.tsx
│       ├── AlertsPanel.tsx
│       ├── RecentPatients.tsx
│       ├── UpcomingAppointments.tsx
│       └── MiniWidgets.tsx
│
└── pages/
    ├── Dashboard.tsx           # Page principale du tableau de bord
    └── not-found.tsx           # Page 404
```

## Système de permissions

Rôles définis (src/config/permissions.ts) :
- `administrateur` — accès total
- `directeur` — lecture + validation
- `medecin` — patients + consultations + ordonnances
- `infirmier` — soins + dossiers en lecture
- `reception` — patients + rdv + facturation
- `laboratoire` — analyses + banque de sang
- `radiologie` — imagerie
- `pharmacie` — stock + dispensation
- `finance` — facturation + rapports
- `rh` — personnel + médecins

Usage : `const { can } = usePermission(); if (can('patients.create')) { ... }`

## Supports futurs (stubs prêts)

- **Multi-sites** : SiteContext gère Site → Bâtiment → Étage → Département
- **Offline/Online** : useOnlineStatus() détecte navigator.onLine, stub sync prêt
- **Notifications** : NotificationsContext + notificationService stub (push/WebSocket)
- **Audit Trail** : auditService stub + useAuditLog hook (log toutes les actions)
- **Dark Mode** : ThemeContext avec toggle + localStorage + classe .dark sur <html>
- **Auth** : AuthContext + authService stub → brancher sur /api/auth quand prêt

## Architecture decisions

- **AppProvider** combine tous les contextes dans l'ordre correct (QueryClient → I18n → Theme → Auth → Site → Notifications → Tooltip)
- **Mock data centralisée** dans src/mock/ — typée, exportée en barrel, prête à remplacer par des hooks API
- **Services stubs** dans src/services/ — interface + implémentation mock, à remplacer par apiClient.get()/post() quand le backend est prêt
- **Permissions déclaratives** dans ROLE_PERMISSIONS — matrice rôle→[permissions], aucun if/else métier
- `src/i18n/index.tsx` reste en `.tsx` (contient du JSX) — ne pas renommer en .ts
- Le logo est importé via `@assets/9e2f711d-...png` (alias Vite @assets → attached_assets/)

## User preferences
- Reports/deliverables (UAT reports, summaries): ALWAYS provide inside a single fenced code block so the user can copy them in one tap (explicit user request, 2026-08-07). User is on iOS.
- Bug-fix workflow (explicit user directive, 2026-08-11 — PERMANENT, supersedes 2026-08-10 rules): Real production runs on GitHub → Dokploy → Docker → VPS; final testing happens ONLY on https://irissamhospital.com, done by the user himself after Push → Dokploy Deploy. FORBIDDEN in Replit (even after a fix, unless the user explicitly requests it): browser-agent testing, logging into the Replit copy, page navigation / UI exploration / E2E / visual testing. Per bug: analyze ONLY the files related to the bug → identify root cause from code → minimal fix only → TypeScript check only if needed → report → STOP. Also forbidden: architecture reviews, comprehensive code reviews, refactoring, hunting for additional bugs, creating tasks, unrequested improvements. Final report contains exactly: سبب المشكلة / الملف المعدل / ما الذي تغير / TypeScript PASS-FAIL / Commit Hash — inside a single fenced code block, then stop.

- Reproduire la maquette de référence avec fidélité maximale
- Pas de texte hardcodé — tout passe par useLanguage() / t()
- Données mock uniquement jusqu'à la validation des modules
- Pas d'emojis dans l'UI — lucide-react icons uniquement
- Architecture en couches : types → mock → services → store → hooks → components → pages
