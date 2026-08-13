---
name: Admission detail de-mock
description: AdmissionDetail page is API-backed; legacy AdmissionsContext is a mock-era localStorage store — never wire pages to it
---

# Admission detail page — API-backed (2026-08-13)

**Rule:** `/admissions/:id` (AdmissionDetail.tsx) fetches `GET /admissions/:id` directly (mapApiAdmission), with distinct states: loading spinner / server-confirmed 404 → « Admission introuvable » / other error → « Réessayer ». Its actions hit the real endpoints: sortie → `POST /admissions/:id/discharge` (modal has busy+error), transfert → shared `TransferBedModal` + `POST /admissions/:id/transfer`, édition → AdmissionForm PATCH puis refetch.

**Why:** In prod, every real admission showed « Admission introuvable »: the page still read the legacy `@/store/AdmissionsContext` — a mock-era store seeded from MOCK_ADMISSIONS and persisted to localStorage — while the list page had been migrated to `useAdmissionsApi`. Worse, its Sortie/Transfert buttons only mutated that local store: silent no-ops against PostgreSQL that faked success.

**How to apply:**
- `AdmissionsContext` (localStorage + MOCK_ADMISSIONS) is a mock-era leftover. Its ONLY remaining consumer is `Settings.tsx` `resetToDefaults` (itself mock-era). NEVER wire new pages/components to it; use `useAdmissionsApi` or direct `apiClient` calls.
- When de-mocking a module, grep ALL consumers of the legacy store — URL-routed detail pages are easy to miss because they're reached by navigation, not imports from the list page.
- A "not found" UI must be reserved for a server-confirmed 404; store-miss or network failure shown as "introuvable" sends testers chasing phantom data bugs.
- NotesTab/DocumentsTab in that page remain local-demo (inert for real UUIDs, gated on `adm-1`); no backend exists for admission notes/documents yet.
