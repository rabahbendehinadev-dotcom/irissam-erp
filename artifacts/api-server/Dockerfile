# ─────────────────────────────────────────────────────────────────────────────
# IRISSAM Hospital ERP — Single-Container Image (Voie B)
#
# Four build stages → one runtime image:
#   erp-builder    : Vite build for artifacts/irissam-erp    (BASE_PATH=/)
#   portal-builder : Vite build for artifacts/patient-portal (BASE_PATH=/patient-portal/)
#   api-builder    : esbuild bundle for artifacts/api-server
#   runtime        : node:22-alpine, serves API + both SPAs
#
# Dokploy:
#   Dockerfile path  : artifacts/api-server/Dockerfile
#   Docker context   : . (workspace root)
#   Container port   : 3001
# ─────────────────────────────────────────────────────────────────────────────

# ── Shared base for all build stages ─────────────────────────────────────────
FROM node:22-alpine AS base
RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate
WORKDIR /workspace

# ── Stage 1: ERP Frontend ────────────────────────────────────────────────────
FROM base AS erp-builder

# Copy workspace manifests first (better layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# All artifact package.jsons so pnpm workspace resolution succeeds
COPY artifacts/api-server/package.json         ./artifacts/api-server/
COPY artifacts/irissam-erp/package.json        ./artifacts/irissam-erp/
COPY artifacts/patient-portal/package.json     ./artifacts/patient-portal/
COPY artifacts/mockup-sandbox/package.json     ./artifacts/mockup-sandbox/
COPY scripts/package.json                      ./scripts/
# lib/* — copied wholesale; api-client-react exports TS source directly
COPY lib/                                      ./lib/

RUN pnpm install --frozen-lockfile

COPY artifacts/irissam-erp/ ./artifacts/irissam-erp/

# BASE_PATH=/ so asset URLs are absolute from root: /assets/main.js
# PORT is required by vite.config.ts (used only for dev server, not build output)
ENV BASE_PATH=/ PORT=3000 NODE_ENV=production
RUN pnpm --filter @workspace/irissam-erp run build
# Output: artifacts/irissam-erp/dist/public/

# ── Stage 2: Patient Portal Frontend ─────────────────────────────────────────
FROM base AS portal-builder

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY artifacts/api-server/package.json         ./artifacts/api-server/
COPY artifacts/irissam-erp/package.json        ./artifacts/irissam-erp/
COPY artifacts/patient-portal/package.json     ./artifacts/patient-portal/
COPY artifacts/mockup-sandbox/package.json     ./artifacts/mockup-sandbox/
COPY scripts/package.json                      ./scripts/
COPY lib/                                      ./lib/

RUN pnpm install --frozen-lockfile

COPY artifacts/patient-portal/ ./artifacts/patient-portal/

# BASE_PATH=/patient-portal/ so asset URLs: /patient-portal/assets/main.js
ENV BASE_PATH=/patient-portal/ PORT=3000 NODE_ENV=production
RUN pnpm --filter @workspace/patient-portal run build
# Output: artifacts/patient-portal/dist/public/

# ── Stage 3: API Server ───────────────────────────────────────────────────────
FROM base AS api-builder

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY artifacts/api-server/package.json         ./artifacts/api-server/
COPY artifacts/irissam-erp/package.json        ./artifacts/irissam-erp/
COPY artifacts/patient-portal/package.json     ./artifacts/patient-portal/
COPY artifacts/mockup-sandbox/package.json     ./artifacts/mockup-sandbox/
COPY scripts/package.json                      ./scripts/
COPY lib/                                      ./lib/

RUN pnpm install --frozen-lockfile

COPY artifacts/api-server/ ./artifacts/api-server/

# esbuild bundles everything into dist/index.mjs
RUN pnpm --filter @workspace/api-server run build

# ── Stage 4: Runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

LABEL org.opencontainers.image.title="IRISSAM Hospital ERP (single container)"
LABEL org.opencontainers.image.description="API + ERP frontend + Patient Portal — VPS Voie B"

RUN apk add --no-cache tini

WORKDIR /workspace

# API bundle + runtime node_modules (no rebuild needed)
COPY --from=api-builder /workspace/artifacts/api-server/dist/      ./artifacts/api-server/dist/
COPY --from=api-builder /workspace/node_modules/                    ./node_modules/
COPY --from=api-builder /workspace/artifacts/api-server/node_modules/ ./artifacts/api-server/node_modules/
COPY --from=api-builder /workspace/lib/                             ./lib/

# Frontend static assets
# Express serves /workspace/public/erp/   → GET /
# Express serves /workspace/public/portal → GET /patient-portal/
COPY --from=erp-builder    /workspace/artifacts/irissam-erp/dist/public/    ./public/erp/
COPY --from=portal-builder /workspace/artifacts/patient-portal/dist/public/ ./public/portal/

# ── Non-root user ─────────────────────────────────────────────────────────────
RUN mkdir -p \
      /app/storage/uploads \
      /app/storage/documents \
      /app/storage/pdfs \
      /app/storage/backups \
    && chown -R node:node /app/storage /workspace/public \
    && chmod 750 /app/storage /app/storage/uploads /app/storage/documents \
                 /app/storage/pdfs /app/storage/backups

USER node

# ── Environment defaults ──────────────────────────────────────────────────────
ENV NODE_ENV=production
ENV PORT=3001
ENV LOCAL_STORAGE_ROOT=/app/storage
ENV DOCUMENTS_DIR=/app/storage/documents
ENV UPLOADS_DIR=/app/storage/uploads
ENV PDF_DIR=/app/storage/pdfs
ENV BACKUP_DIR=/app/storage/backups
ENV STORAGE_PROVIDER=local

EXPOSE 3001

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
