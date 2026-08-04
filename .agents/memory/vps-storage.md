---
name: VPS Local Storage Architecture
description: Replaces Replit/GCS Object Storage with local VPS filesystem; Docker volumes + security model + backup.
---

## Storage layout (VPS bind-mounts)
| Docker path           | VPS host path            | Purpose            |
|-----------------------|--------------------------|--------------------|
| /app/storage/documents | /data/irissam/documents | GED document files |
| /app/storage/uploads   | /data/irissam/uploads   | Temp/misc uploads  |
| /app/storage/pdfs      | /data/irissam/pdfs      | Generated PDFs     |
| /app/storage/backups   | /data/irissam/backups   | Backup archives    |

## Key files
- `artifacts/api-server/src/lib/localStorageService.ts` — UUID-keyed storage, path-traversal prevention
- `artifacts/api-server/src/routes/storage.ts` — POST /api/storage/upload + GET /api/storage/objects/:uuid
- `artifacts/api-server/src/routes/documents/records.ts` — GED download/preview using local stream
- `artifacts/irissam-erp/src/services/api/documents.ts` — uploadDocumentFile() uses FormData POST (no GCS)
- `docker-compose.production.yml` — full VPS stack with bind-mounts
- `scripts/backup.sh` — pg_dump + tar archives + sha256 checksums
- `scripts/test-vps-storage.mjs` — 14-test E2E persistence/security suite

## Security model
- Storage key = UUID v4 — never user-supplied paths; `resolveStoragePath()` enforces containment
- Multer in-memory storage: validate MIME + size before any disk write
- File permissions: 0o640 (owner rw, group r, world none)
- All downloads proxied through JWT-gated backend — real path never sent to client
- `Cache-Control: no-store` on all medical file responses
- nginx explicitly blocks `/app/storage` and `/data/irissam` direct access

## Upload flow change (GCS → local)
- Before: client → POST /records/upload-url → GCS presigned URL → PUT directly to GCS
- After: client → POST /api/storage/upload (multipart FormData) → backend validates + saves → returns `{ storageKey, checksum }`
- storageKey is a UUID; stored in document_records.storage_key

## Dev vs production paths
- Production (Docker): LOCAL_STORAGE_ROOT=/app/storage
- Replit dev fallback: LOCAL_STORAGE_ROOT=/tmp/irissam-storage (automatic via NODE_ENV check)
- If NODE_ENV not 'production', default root = /tmp/irissam-storage

## Multer error handling
- fileFilter cb(new Error('Type MIME...')) → returns 400 (not 500)
- Custom inline error handler wraps upload.single() to catch MulterError properly

## First-run VPS setup
```bash
sudo mkdir -p /data/irissam/{uploads,documents,pdfs,backups,postgres}
sudo chown -R 1000:1000 /data/irissam/uploads /data/irissam/documents \
                         /data/irissam/pdfs /data/irissam/backups
sudo chown -R 999:999 /data/irissam/postgres
docker compose -f docker-compose.production.yml up -d
```

## Test suite
```bash
node scripts/test-vps-storage.mjs  # 14/14 pass on dev
# On VPS: API_BASE=http://localhost:3001 node scripts/test-vps-storage.mjs
```
