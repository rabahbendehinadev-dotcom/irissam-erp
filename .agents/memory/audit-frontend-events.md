---
name: Frontend audit events pipeline
description: POST /audit-logs normalizes frontend module names to the source_module enum; write failures must be explicit
---
**Rule:** The frontend sends its resource name ("patient", "consultation"…) as `module`; POST /audit-logs normalizes it via an alias map to the source_module PG enum (patient→system, consultation→consultations…), unknown values→"system" + server warning. AuditService.log returns a boolean; the route answers 500 when the write fails — never a fake 201.

**Why:** the enum rejected "patient" and frontend audit events were silently dropped while the route answered 201 (found during UAT: the write failed in logs yet the client saw success).

**How to apply:** When adding frontend audit calls, either send a valid enum value or extend MODULE_ALIASES in the audit-logs route. The frontend auditService is fire-and-forget (catches everything), so a 500 never breaks the UI.
