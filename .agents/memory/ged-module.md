---
name: GED Module (Gestion Électronique des Documents)
description: Migrations 022+023, 17 DB tables, Object Storage (GCS), 8 backend sub-routes, full frontend with folder tree, uploader, viewer, dashboard
---

## What was built
- **Migration 022** (`022_ged_module.sql`): 17 tables (document_folders, document_records, document_versions, document_tags, document_links, document_access_rules, document_workflows, document_workflow_steps, document_approvals, document_signatures, document_retention_rules, document_archive_jobs, document_shares, document_download_logs, document_watermarks, document_comments, document_notifications, document_templates). Seeded 12 retention rules + 16 system folders.
- **Migration 023** (`023_ged_permissions.sql`): 20 `documents.*` permissions, role-permission grants for 11 roles.
- **Object Storage**: provisioned GCS bucket; `objectStorage.ts` + `objectAcl.ts` + `storage.ts` copied from skill template. storage.ts patched to avoid @workspace/api-zod dependency (inline safeParse helper).
- **Backend** (`artifacts/api-server/src/routes/documents/`): hub index.ts + records.ts, folders.ts, versions.ts, workflows.ts, shares.ts, dashboard.ts, audit.ts.
- **Frontend** (`artifacts/irissam-erp/src/pages/Documents.tsx` + `src/components/documents/`): DocFolderTree, DocList (grid/list/table), DocUploader (drag-drop, progress), DocViewer (8-tab drawer), DocDashboard (KPIs + charts), DocStatusBadge, DocStatusBadge utilities.
- **Sidebar** group `nav.group.documents` with `FolderArchive` icon at `/documents`.
- **i18n** keys: `nav.documents`, `nav.group.documents` in fr/en/ar.

## Critical fixes during build
1. **`requirePermission` named export** (same rule as exec dashboard — always `import { requirePermission }`)
2. **`permissions` table schema** has columns `(id, name, description, module, created_at)` — NO `display_name` column. Migration 023 must NOT include `display_name`.
3. **storage.ts** imports `RequestUploadUrlBody` from `@workspace/api-zod` — this schema doesn't exist in the project's api-zod. Fix: replace with inline `safeParse` helper (no zod import since zod isn't bundled by esbuild externals).
4. **Preact hooks**: all components must import from `"react"` not `"preact/hooks"`.

## Storage architecture
- Upload flow: `POST /api/documents/records/upload-url` → presigned GCS PUT → `POST /api/documents/records` (store storageKey)
- Download/Preview: server proxies file from GCS (storageKey never sent to frontend)
- `Cache-Control: no-store` on all medical file responses (PWA security requirement)

## Confidentiality enforcement
Direction-only: admin, directeur_general/medical/financier/rh/soins
HR confidential: admin, responsable_rh, directeur_rh
Finance confidential: admin, responsable_facturation, directeur_financier, directeur_general

## Duplicate detection
Checksum (SHA-256) check at both document creation and version creation. Returns 409 with duplicate doc id if found.
