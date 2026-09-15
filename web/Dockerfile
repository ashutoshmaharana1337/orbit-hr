# syntax=docker/dockerfile:1
# Multi-stage build for the Orbit HR Next.js web app (standalone output).
#
#   docker build -t orbit-web --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api .
#
# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so the
# API URL must be supplied as a build argument, not at `docker run`.
FROM node:22-alpine AS deps

WORKDIR /app

RUN npm install -g npm@11.17.0

COPY package.json package-lock.json ./
RUN npm ci

# Stage 2 (builder): compile the app.
FROM node:22-alpine AS builder

WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api
ARG NEXT_PUBLIC_SENTRY_DSN=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# Stage 3 (production): minimal runtime with only the standalone server output.
FROM node:22-alpine AS production

WORKDIR /app

RUN addgroup -g 1001 -S nodejs \
 && adduser -S nextjs -u 1001 -G nodejs

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/" || exit 1

CMD ["node", "server.js"]
