# ─────────────────────────────────────────────────────────────────────────────
# IRISSAM Hospital ERP — API Server
# Multi-stage build: build stage → minimal runtime stage
# Non-root user; storage volumes mounted at runtime via docker-compose
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

# Build-time deps
RUN apk add --no-cache python3 make g++

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /workspace

# Copy workspace manifests first (layer cache optimisation)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY artifacts/api-server/package.json         ./artifacts/api-server/
COPY lib/db/package.json                        ./lib/db/
COPY lib/api-zod/package.json                   ./lib/api-zod/
# api-client-react and api-spec may or may not exist — copy conditionally via glob
COPY lib/                                       ./lib/

# Install all workspace dependencies (frozen for reproducibility)
RUN pnpm install --frozen-lockfile

# Copy full source
COPY artifacts/api-server/ ./artifacts/api-server/

# Build api-server (esbuild bundles everything into dist/)
RUN pnpm --filter @workspace/api-server run build

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

LABEL org.opencontainers.image.title="IRISSAM API Server"
LABEL org.opencontainers.image.description="Hospital ERP — Backend API (VPS edition)"

RUN apk add --no-cache tini

WORKDIR /workspace

# Copy built artifact and its runtime dependencies
COPY --from=builder /workspace/artifacts/api-server/dist/ ./artifacts/api-server/dist/
COPY --from=builder /workspace/node_modules/             ./node_modules/
COPY --from=builder /workspace/artifacts/api-server/node_modules/ ./artifacts/api-server/node_modules/
COPY --from=builder /workspace/lib/                      ./lib/

# ── Non-root user ─────────────────────────────────────────────────────────────
# The built-in "node" user (uid 1000) is used; we only need to own the dirs.
# Storage directories are created here so the volume mount inherits ownership.
# On VPS, these are bind-mounted from /data/irissam/* — the host dirs must also
# be owned by uid 1000 or chown'd after the first run.
RUN mkdir -p \
      /app/storage/uploads \
      /app/storage/documents \
      /app/storage/pdfs \
      /app/storage/backups \
    && chown -R node:node /app/storage \
    && chmod 750 /app/storage /app/storage/uploads /app/storage/documents \
                 /app/storage/pdfs /app/storage/backups

USER node

# ── Startup ───────────────────────────────────────────────────────────────────
ENV NODE_ENV=production
ENV LOCAL_STORAGE_ROOT=/app/storage
ENV DOCUMENTS_DIR=/app/storage/documents
ENV UPLOADS_DIR=/app/storage/uploads
ENV PDF_DIR=/app/storage/pdfs
ENV BACKUP_DIR=/app/storage/backups
ENV STORAGE_PROVIDER=local

EXPOSE 3001

# tini handles PID 1 / signal forwarding properly
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
