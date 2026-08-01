---
name: Emergency Dossier Architecture
description: How the /emergencies/:id page is structured — context, components, mock data, routing
---

# Emergency Dossier Architecture

## Entry point
`src/pages/EmergencyPatientDetail.tsx` — thin orchestrator, wraps everything in `EmergencyDossierProvider`.

## Context
`src/contexts/EmergencyDossierContext.tsx` — single source of truth.
- Initializes from `getMockDossier(patientId)` in `src/mock/emergencyDossier.ts`
- Reads patient info from `MOCK_EMERGENCY_PATIENTS` (imported from `@/mock/emergency`)
- Auto-save: 2-second debounce → simulates API, shows saving/saved/error state
- Provides all mutations: vitals, lab, imaging, rx, procedures, notes, observation, decision, workflow transitions

**Why:** Avoids prop-drilling across 8 tabs; makes auto-save centralized; enables audit logging from any mutation.

## Components (all in src/components/emergencies/dossier/)
- `DossierHeader` — sticky, compact, all patient info + workflow buttons + save state
- `DossierAlertBanner` — collapsible, 8 alert types, critical always visible
- `DossierTimeline` — horizontal scrollable strip, click → right slide-in drawer
- `ClinicalScores` — computes NEWS2/qSOFA/Shock Index from latest VitalReading
- `TabEvaluation` — vitals grid + sparklines + Glasgow + Pain scale + ABCDE + clinical text
- `TabExamen` — 10 body system sections, provisional diagnosis, differentials, severity, ICD-10 placeholder
- `TabOrdres` — lab + imaging with add forms, status selectors, expandable results
- `TabTraitement` — prescriptions with administer button + procedures with categories
- `TabNotes` — 4 note types, pin, edit with version history, search
- `TabObservation` — start obs form, 6 SVG charts, repeated vitals table
- `TabDecision` — 7 decision cards, per-decision wizard forms, confirm button
- `TabAudit` — categorized audit log, CSV export

## Permissions
20 emergency permissions added to `src/config/permissions.ts` (emergencies.start_care, emergencies.prescribe, etc.)
Role matrix: administrateur gets all; medecin gets clinical; infirmier gets triage+nursing.

## Mock data
`getMockDossier(patientId)` — ep-01 = IDM STEMI (riche), ep-02 = Polytrauma (riche), all others = buildDefault().

## Key constraints
- Tabs are lazy-loaded via `Suspense`
- EmergencyPatient imported from `@/types/emergency` (not @/types/emergencyDossier)
- MOCK_EMERGENCY_PATIENTS from `@/mock/emergency` (not @/mock)
- User.name doesn't exist — use `user.firstName + ' ' + user.lastName`
