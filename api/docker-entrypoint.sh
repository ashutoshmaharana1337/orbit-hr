#!/bin/sh
# Container entrypoint for the Orbit HR API.
#
#   RUN_MIGRATIONS=true  -> run `prisma migrate deploy` before starting.
#
# The seed is never run here; run it manually (`npm run db:seed`) if needed.
set -eu

echo "Starting Orbit HR API..."

for var in DATABASE_URL JWT_SECRET; do
  eval "value=\${$var:-}"
  if [ -z "$value" ]; then
    echo "ERROR: required environment variable $var is not set" >&2
    exit 1
  fi
done

echo "NODE_ENV=${NODE_ENV:-production} PORT=${PORT:-3001} WEB_ORIGIN=${WEB_ORIGIN:-<unset>} TZ=${TZ:-UTC}"

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  if [ -z "${DIRECT_DATABASE_URL:-}" ]; then
    echo "ERROR: RUN_MIGRATIONS=true requires DIRECT_DATABASE_URL (owner role) to be set" >&2
    exit 1
  fi
  echo "Applying database migrations (prisma migrate deploy)..."
  npx prisma migrate deploy
fi

echo "Starting application..."
exec node dist/main
