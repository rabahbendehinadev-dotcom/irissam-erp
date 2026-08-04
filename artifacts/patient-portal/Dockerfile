# ─────────────────────────────────────────────────────────────────────────────
# IRISSAM — Patient Portal Frontend
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY artifacts/patient-portal/package.json  ./artifacts/patient-portal/
COPY lib/                                   ./lib/

RUN pnpm install --frozen-lockfile

COPY artifacts/patient-portal/ ./artifacts/patient-portal/

RUN pnpm --filter @workspace/patient-portal run build

# ── nginx ─────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

LABEL org.opencontainers.image.title="IRISSAM — Patient Portal Frontend"

RUN rm /etc/nginx/conf.d/default.conf

COPY --from=builder /workspace/artifacts/patient-portal/dist/ /usr/share/nginx/html/

COPY artifacts/patient-portal/nginx-spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
