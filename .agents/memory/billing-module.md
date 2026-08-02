---
name: Billing Module (Facturation)
description: Phase 1 billing module — DB migration, routes, hook, frontend page + wizard + payment modal
---

## Architecture

**Backend (api-server):**
- `artifacts/api-server/src/routes/invoices.ts` — CRUD, issue, cancel, credit-note
- `artifacts/api-server/src/routes/payments.ts` — list, create (auto-updates invoice status), refund
- `artifacts/api-server/src/routes/insurance.ts` — policies CRUD, claims CRUD, status transitions
- Routes registered in `routes/index.ts` as `router.use("/invoices", requireAuth, invoicesRouter)` etc.
- `routes/encounters.ts` has `GET /:encounterId/billable-events` using `pool.query` directly

**DB (migration 008):**
- 4 new sequences (invoice_number, payment_number, claim_number, credit_note_number)
- ALTERs on invoices, invoice_items, payments tables
- New tables: insurance_policies, insurance_claims, credit_notes, billable_events
- 16 billing permissions seeded + granted to relevant roles

**Frontend (irissam-erp):**
- `src/hooks/useBillingApi.ts` — all billing operations; apiClient throws on error (NO ok/data wrapper)
- `src/pages/Facturation.tsx` — main page: 6 stats cards, filter bar, invoice table, slide-over detail
- `src/components/billing/InvoiceWizard.tsx` — 6-step wizard (patient→services→review→coverage→calc→summary)
- `src/components/billing/PaymentModal.tsx` — payment dialog (7 methods)
- Wired in `App.tsx` as `<Route path="/finance" component={FacturationPage} />`
- i18n keys added to fr.ts, ar.ts, en.ts (38 keys each under "billing.*")

## Key patterns
- `apiClient.get/post/patch<T>()` returns `T` directly (throws on error) — never `{ ok, data }`. Fixed this after first attempt.
- Cancel with payments triggers `PAID_INVOICE_REQUIRES_CREDIT_NOTE` error code — caught in UI to show credit-note flow
- Coverage types: cnas/casnos/mutuelle/militaire/gratuite/payant → coverage % applied server-side via patientShare/insurerShare columns
- Stats endpoint: `GET /invoices/stats` → `{ ca_today, ca_month, unpaid_count, payments_month, total_remaining, insurance_pending }`

**Why:** The billing module needed full RBAC (requirePermission per route), optimistic locking (version column), and a credit-note guard to prevent direct cancellation of paid invoices.
