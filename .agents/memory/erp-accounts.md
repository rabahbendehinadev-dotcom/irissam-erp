---
name: ERP Accounts (RH ↔ users)
description: Contract linking employee records to ERP user accounts — lifecycle rules, DPI governance, admin console gotchas
---

# Comptes ERP liés aux employés

**Rule:** RH is the master source of people. An ERP account is optional, linked via `employees.linked_user_id` (1‑1 enforced by partial unique index `uq_employees_linked_user` WHERE linked_user_id IS NOT NULL AND deleted_at IS NULL; created defensively — DO block downgrades duplicates to WARNING).

**Why:** accounts must map to real staff identities so every clinical/admin action is traceable to a person; shared/anonymous accounts were the previous failure mode.

**How to apply:**
- Deactivating (suspendu) or archiving an employee MUST auto-suspend the linked account (and revoke `user_sessions`). Reactivation of the account is always MANUAL — reactivating the employee does not reactivate the account.
- Doctor role has NO `patients.create` (removed in mig 045): the DPI/patient record is created only by reception/admissions; doctors work on existing patients. Frontend static fallbacks in `config/permissions.ts` must mirror this.
- Admin console lives under `/system/users`, gated `admin.users`; role change replaces `user_roles` AND updates the legacy enum column via `legacyEnumForRole()` (fallback 'reception'); guard last super admin (legacy enum OR RBAC role) before demote/suspend.
- Account creation paths: wizard step "Accès ERP" at employee creation (403 without `admin.users`), or later from the employee record (POST /hr/employees/:id/account). Response of GET /hr/employees/:id includes `account`.

**Schema gotchas (verified in dev):**
- `permissions` columns = id, name, module, description, created_at — permission key column is `name` (NOT `code`, NOT display_name).
- Only role `doctor` exists in DB — there is no `medecin` role (medecin appears only in frontend static fallback blocks).
- `user_activity_logs` action enum lacks account-management values → audit account ops via `system_logs` (module 'security') + `hr_audit_events`, not user_activity_logs.
