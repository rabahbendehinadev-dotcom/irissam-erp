---
name: Payroll Module
description: Architecture and key decisions for the PAIE/PAYROLL module (migrations 024+025, 11 sub-routers, 10 frontend tabs)
---

## Architecture
- **Migrations**: 024_payroll_module.sql (22 tables, sequences, seed data), 025_payroll_permissions.sql (27 payroll.* permissions, 2 roles)
- **API sub-routers**: engine.ts, periods, runs, components, advances, loans, payslips, payment-orders, bank-export, dashboard, reports, settings
- **Frontend tabs (Payroll.tsx)**: dashboard, periods, runs, payslips, advances, loans, components, orders, reports, settings
- **Route**: /payroll (lazy-loaded PayrollPage, ProtectedRoute)

## Key decisions

### Sequence ordering bug
`payroll_loan_seq` must be created BEFORE `payroll_loans` table (DEFAULT clause references the sequence). 
**Why:** PostgreSQL validates sequence existence at CREATE TABLE time if used in DEFAULT.
**How to apply:** Always place `CREATE SEQUENCE` before the table that references it in DEFAULT.

### Import paths
All payroll routes use `from '@workspace/db'` (not relative `../../lib/db.js`).
Middleware: `from '../../middleware/requirePermission'` and `from '../../middleware/requireAuth'` (no .js extension).

### Financial math
All calculations in PostgreSQL via parameterized queries with NUMERIC(12,2) — zero JS float arithmetic in engine.ts.

### Employee self-service
Role `employee` filtered to own data on payslips, advances, loans endpoints (auth.userId check in WHERE clause).

### PDF payslips
PDFKit (already installed for billing module). Import: `import PDFDocument from 'pdfkit'`. Served inline with `Cache-Control: no-store`.

### Bank export
CSV with UTF-8 BOM (\uFEFF) for French Excel compatibility. Never claims official bank format.

### Loan deduplication
Before inserting installment: `SELECT FROM payroll_loan_installments WHERE loan_id AND run_id` — prevents double-deduction per run.

### Double-payment guard
Before marking run paid: checks for another `paid` run in same period (`payroll_periods` join).

### Net < 0 anomaly
Critical anomaly; blocks HR approval if unresolved critical anomalies exist (`payroll_anomalies` table).
