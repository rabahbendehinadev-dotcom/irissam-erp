---
name: Consultation de-mock (UAT)
description: How the consultation path stays 100% PostgreSQL-backed; vitals scoping; UI persistence patterns
---
- Consultation UI persistence pattern: every editable clinical field (notes, diagnosis) is an explicit-save panel calling PATCH /consultations/:id with ONLY that field; the page owns state, the child gets `{ value, onSave → Promise<boolean>, saving, readOnly }`.
- **Why:** fake auto-save indicators and session-side copies were UAT-rejected as demo behavior; narrow PATCH avoids full-record wipes and keeps the server audit (old/new values) meaningful.
- Vitals: the ONLY vitals store is `emergency_vitals`, scoped to an OPEN emergency visit (encounterId derived from the visit). Consultation/admission encounters cannot reuse it without schema changes → the consultation vitals tab is an honest empty state pointing to Urgences. Do not rebuild a vitals backend without explicit request.
- Non-persisting demo UI (prescription/lab/imaging/exam/documents/follow-up builders, vitals wizard step) is REMOVED, not hidden — files deleted; restore from git history only when those modules get real backends.
- Patient-detail diagnosis visibility relies on two spots: the overview "Dernières consultations" widget and a truncated "Dx :" secondary line in ConsultationTable's motif cell.
- Route contract: /consultations/:id accepts ONLY raw UUIDs (legacy `db-` prefix normalization removed).
- **How to apply:** new clinical fields on consultations follow the notes/diagnosis PATCH-panel pattern; the summary-modal checklist lists only fields that actually persist.
