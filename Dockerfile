# Dockerfile for Asset Tracker
# Based on official Node.js image

# Stage 1: Build
FROM node:22-alpine AS builder

# Schema to bake into the Prisma client / generated SQL at build time.
# Override with --build-arg DB_SCHEMA=public for self-hosted single-tenant
# deployments (matches the developer .env default).
ARG DB_SCHEMA=assettool
ENV DB_SCHEMA=$DB_SCHEMA

WORKDIR /app

# Install bun — the project's canonical package manager (bun.lock is the
# lockfile that's actually committed; package-lock.json is gitignored, so
# `npm ci` cannot work here).
RUN npm install -g bun@1

# Install dependencies first (better caching)
COPY package.json bun.lock ./
COPY prisma ./prisma/

RUN bun install --frozen-lockfile

# Copy source files
COPY . .

# Normalize the Prisma schema name, generate the client, and build.
# No `prisma migrate deploy` here — the build stage has no DB connection;
# migrations are run separately (see docker-compose.yml's `migrate` service).
RUN node prisma/set-schema.mjs && bunx prisma generate && bunx next build

# Stage 2: Production
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Set proper ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# alpine ships busybox wget, no curl needed
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health/ready || exit 1

CMD ["node", "server.js"]
