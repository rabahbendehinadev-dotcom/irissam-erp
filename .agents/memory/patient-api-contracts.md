---
name: Patient API contracts
description: Non-obvious contracts of the patients API — PUT nulls omitted fields, JWT has no names, insurance key mismatch
---

# Patient API contracts (api-server)

## PUT /patients/:id NULLs every omitted optional field
The update handler maps `body.field ?? null` for all optional columns — an omitted field is **erased**, not preserved.
**Why:** partial updates from tabs (e.g. allergy manager) silently wiped phone/insurance/history fields until the frontend was fixed.
**How to apply:** never save a single aspect of the patient through the full PUT — add a narrow PATCH endpoint scoped to that field instead (pattern: PATCH /patients/:id/allergies). If PUT is unavoidable, the payload must be complete AND freshly fetched.

## JWT payload carries NO display name
Access-token payload = `userId/role/permissions/siteId/iat/exp` only. `req.auth.firstName` does not exist.
**Why:** vaccination "administered by" and audit userName came out null/UUID.
**How to apply:** resolve display names server-side — `LEFT JOIN users u ON u.id = a.user_id` on read, or a `resolveUserName(req)` lookup on write. Never trust `actor()`-style helpers to contain a human name.

## Insurance key mismatch (pre-existing, NOT fixed)
`PatientForm` sends `insurance.organizationName` but the backend reads `insurance.orgName` → insurer org name is nulled on every patient-form save. Reported to user 2026-08-06; fix belongs in PatientForm (rename key) or backend (accept both).

## Financial aggregates boundary
GET /patients/:id/stats returns billed/paid = null unless the JWT carries billing.view (super_admin bypasses). Financial sums must never ship under patients.view alone — same boundary as /patients/:id/financial-summary (architect flagged the initial version as an authorization bypass). The frontend hides the two money cards when null.
