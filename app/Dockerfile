# syntax=docker/dockerfile:1
# =============================================================================
# Dockerfile multi-stage — Gladi LMS
# Target "app"    : Next.js production server (default)
# Target "worker" : BullMQ background worker (satu image, entrypoint berbeda)
# Image di-build di GitHub Actions (CI), VPS hanya pull. Lihat plan §3.
# =============================================================================

# ---- Stage 1: deps — install dependensi dengan cache mount ----
FROM node:20-alpine AS deps
WORKDIR /app

# libc6-compat untuk kompatibilitas sebagian native module di alpine
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ---- Stage 2: builder — build Next.js standalone ----
FROM node:20-alpine AS builder
WORKDIR /app

# BUILD_SHA berubah tiap commit (diisi CI). ARG dideklarasikan SEBELUM COPY . .
# agar layer context tidak tersaji dari cache basi yang tidak memuat file terbaru
# (penyebab image CI sebelumnya kehilangan folder drizzle/).
ARG BUILD_SHA=dev
ENV BUILD_SHA=$BUILD_SHA

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# Build membutuhkan placeholder env (nilai asli di-inject saat runtime)
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder

RUN --mount=type=cache,target=/app/.next/cache \
    npm run build \
    && npm run build:worker \
    && npm run build:migrate

# ---- Stage 3: base — runtime minimal bersama ----
FROM node:20-alpine AS base
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache wget \
    && addgroup -S nodejs -g 1001 \
    && adduser -S nextjs -u 1001

# ---- Target: app — Next.js standalone server ----
FROM base AS app

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Migrasi dijalankan dari image ini oleh scripts/deploy.sh (step sebelum restart).
# migrate.mjs adalah BUNDLE ESM mandiri (esbuild, tanpa dependensi eksternal) —
# tidak bergantung pada node_modules yang tidak disertakan di output standalone.
COPY --from=builder --chown=nextjs:nodejs /app/dist/migrate.mjs ./migrate.mjs
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.ts ./drizzle.config.ts

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

# server.js dihasilkan oleh output: "standalone"
CMD ["node", "server.js"]

# ---- Target: worker — BullMQ background worker ----
FROM base AS worker

# Worker butuh node_modules penuh (tidak pakai standalone) untuk BullMQ + ioredis
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/dist/worker.js ./worker.js
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

USER nextjs

CMD ["node", "worker.js"]
