# ─────────────────────────────────────────────────────────────────────────────
# IRISSAM Hospital ERP — Main Frontend (irissam-erp)
# Multi-stage: Vite build → nginx static server
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY artifacts/irissam-erp/package.json     ./artifacts/irissam-erp/
COPY lib/                                   ./lib/

RUN pnpm install --frozen-lockfile

COPY artifacts/irissam-erp/ ./artifacts/irissam-erp/

# Vite build; base URL is / (nginx rewrites handle routing)
RUN pnpm --filter @workspace/irissam-erp run build

# ── Stage 2: nginx ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

LABEL org.opencontainers.image.title="IRISSAM ERP — Frontend"

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=builder /workspace/artifacts/irissam-erp/dist/ /usr/share/nginx/html/

# nginx config: serve SPA, forward /api to backend (passed via docker-compose upstream)
COPY artifacts/irissam-erp/nginx-spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
