# ---- base ----
FROM node:20-alpine AS base
RUN corepack enable && apk add --no-cache openssl
WORKDIR /repo
COPY package.json turbo.json tsconfig.base.json .
COPY packages ./packages
COPY apps ./apps
COPY prisma ./prisma
COPY docker ./docker
RUN corepack prepare pnpm@9.0.0 --activate
RUN pnpm install --ignore-scripts

# ---- api ----
FROM base AS api
RUN pnpm --filter @flowforge/api build || true

# ---- worker ----
FROM base AS worker
RUN pnpm --filter @flowforge/worker build || true

# ---- web ----
FROM base AS web
RUN pnpm --filter @flowforge/web build || true
