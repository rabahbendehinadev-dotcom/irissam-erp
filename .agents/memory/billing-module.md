---
name: Billing Module
description: Phase 1+2 facturation — DB schema, API routes, frontend, PDF, double-billing guards, service catalog, billable-events aggregation
---

## Architecture

### DB migrations
- **008_billing.sql** — invoices, invoice_items, payments, insurance_policies, insurance_claims, billable_events, credit_notes tables; invoice_number_seq / payment_number_seq sequences
- **009_billing_hardening.sql** — adds `status`/`billed_invoice_item_id` to billable_events; partial UNIQUE index `(source_module, source_entity_id) WHERE status != 'cancelled'`; `service_catalog` table (15 seeded entries); `receipt_number_seq`; partial UNIQUE index on `invoices(encounter_id)` for double-billing guard; 3 new permissions

### API routes (artifacts/api-server/src/routes/)
- **invoices.ts** — POST /invoices (double-billing guard → 409 ENCOUNTER_ALREADY_INVOICED; reserves billable_events → status='reserved'); POST /:id/issue (9-step transaction: lock → validate → no-zero-price → double-billing recheck → recalc → status=issued → mark billed events → audit); GET /:id/pdf; cancel/credit-note
- **payments.ts** — receipt_number from receipt_number_seq alongside payment_number; FOR UPDATE lock on invoice; overpayment guard; GET /:id/receipt-pdf; refund endpoint
- **insurance.ts** — claims, policies, approval/rejection
- **service-catalog.ts** — GET /service-catalog (list active), GET /:code, POST (billing.manual_price), PATCH /:id
- **encounters.ts** — GET /:encounterId/billable-events: UNION query across consultations (terminee), lab_orders (validee/critique), imaging_orders (interpretee/realisee), prescriptions (delivre), admissions; joins service_catalog for unit_price; returns billingStatus/billedInvoiceId/billedInvoiceNumber
- Registered in index.ts: serviceCatalogRouter at /service-catalog

### Frontend (artifacts/irissam-erp/src/)
- **hooks/useBillingApi.ts** — all API calls; exports: getStats, listInvoices, getInvoice, createInvoice, updateInvoice, issueInvoice, cancelInvoice, createCreditNote, createPayment, listPayments, createClaim, listClaims, listPolicies, createPolicy, updateClaimStatus, **getServiceCatalog**, **openInvoicePdf**, **openReceiptPdf**
- **pages/Facturation.tsx** — stats cards, invoice list, slide-over detail, InvoiceWizard, PaymentModal; "PDF facture" button (issued/paid invoices); receipt PDF per payment row
- **components/billing/InvoiceWizard.tsx** — Step 2 auto-fetches /encounters/:id/billable-events; checkbox list grouped by category; disabled billed/reserved rows with previous invoice number; "Tout sélectionner" / "Désélectionner"; zero-price warning badge; manual line items addable on top
- **components/billing/PaymentModal.tsx** — payment entry with method selection
- **services/api/client.ts** — added public `get baseUrl()` getter (internal private field renamed to `_baseUrl`)

### PDF generation
- **artifacts/api-server/src/lib/pdfGenerator.ts** — generateInvoicePdf() (A4 layout) and generateReceiptPdf() (thermal 300×420pt) using pdfkit
- **Critical**: pdfkit MUST be in the `external` list in build.mjs — if bundled by esbuild, __dirname points to dist/ and AFM font files are not found (ENOENT Helvetica.afm). Same for fontkit.

### Permissions
- Billing permissions in DB: billing.view, billing.create, billing.update, billing.issue, billing.cancel, billing.print, billing.export, billing.manual_price, billing.view_previous_invoice, billing.create_credit_note, credit_notes.create, financial_reports.view, insurance.*, payments.*
- Granted to: super_admin, administrator, finance roles via role_permissions table
- Admin user (admin@irissam.dz) must be in user_roles with super_admin role (role column in users table is NOT used for permissions — user_roles join table is the source of truth)

### Key bugs fixed
- **performed_at NOT NULL** in billable_events: use `new Date()` as default when item has no performedAt
- **pdfkit external**: added 'pdfkit' and 'fontkit' to external[] in build.mjs
- **auditService.log** takes two separate args `(entry, actor)` — NOT a single merged object
- **req.params.id** typed string|string[] — always cast via `String(req.params["id"])`
- **pool.connect() return type** resolves to void in this TS setup — use `any` for client param in recalcTotals

### Acceptance tests results (all ✅)
A: service-catalog → 15 entries
B: billable-events aggregation → UNION across clinical modules
C: invoices/stats → financial KPIs
D: create draft invoice with auto-imported priced events (80% CNAS coverage)
E: issue invoice (9-step transaction)
F: double-billing source entity guard → 409 DOUBLE_BILLING
G: invoice PDF → %PDF, 3.3KB
H: payment → PAY-2026-000001, receipt REC-2026-000001
I: receipt PDF → %PDF, 2.7KB

**Why:** `encounter_id` unique index blocks cashiers from issuing a second invoice for the same encounter; `source_entity_id` partial unique index blocks re-importing already-billed clinical events
