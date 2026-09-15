# syntax=docker/dockerfile:1
# Multi-stage build for the Orbit HR NestJS API.
#
#   docker build -t orbit-api --target production .
#
# Stage 1 (builder): full install (devDependencies are needed for `nest build`
# and `prisma generate`), generate the Prisma client, compile to dist/.
FROM node:22-alpine AS builder

WORKDIR /app

# npm 11 is required to resolve this lockfile (same pin as .github/workflows).
RUN npm install -g npm@11.17.0

# Registry fetches over a slow/unreliable link (e.g. some CI/sandbox
# networks) can hit ECONNRESET well before npm's own defaults would give
# up; raise the retry budget so a transient blip doesn't fail the whole
# install.
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set fetch-timeout 300000

# package*.json only, so the dependency layer is cached across source changes.
# .npmrc (ignore-scripts=true) is intentionally NOT copied here: the Prisma
# postinstall hooks must run so the engines are downloaded at build time.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npx prisma generate \
 && npm run build

# Stage 2 (production): minimal runtime image.
FROM node:22-alpine AS production

WORKDIR /app

RUN apk add --no-cache dumb-init \
 && addgroup -g 1001 -S nodejs \
 && adduser -S nodejs -u 1001 -G nodejs

ENV NODE_ENV=production \
    NODE_OPTIONS=--enable-source-maps \
    TZ=UTC \
    PORT=3001

RUN npm install -g npm@11.17.0
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set fetch-timeout 300000

# Production dependencies only. The `prisma` CLI is a devDependency but is
# required at runtime for `prisma migrate deploy`, so it is added on top
# (pinned to the exact version from package-lock.json). This is far smaller
# than shipping the whole devDependency tree (typescript, vitest, nest cli...).
COPY package.json package-lock.json ./
# Split into separate layers (rather than one chained RUN) so a registry
# hiccup on the small follow-up prisma install doesn't force redoing the
# much larger `npm ci` above it on retry.
RUN npm ci --omit=dev --ignore-scripts
RUN npm install --no-save --omit=dev --ignore-scripts \
      "prisma@$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version")" \
 && npm cache clean --force

# Generated Prisma client + engines (downloaded/generated in the builder).
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Compiled app + Prisma schema/migrations (needed by `prisma migrate deploy`).
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=builder --chown=nodejs:nodejs /app/prisma/migrations ./prisma/migrations

COPY --chown=nodejs:nodejs docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/api/health" || exit 1

USER nodejs

# dumb-init forwards signals so SIGTERM reaches node for a graceful shutdown.
ENTRYPOINT ["dumb-init", "--", "/app/docker-entrypoint.sh"]
