#!/usr/bin/env bash
# Deploy the Orbit HR API to Fly.io.
#
# Topology: API on Fly.io (this script), web on Vercel via its Git integration
# (nothing to do here — see README "Deploying").
#
# Required env:
#   FLY_API_TOKEN   Fly.io deploy token (flyctl reads it from the environment)
#   FLY_APP_API     Fly app name to deploy to (e.g. orbit-hr-api, orbit-hr-api-staging)
#
# Database migrations run via `release_command` in api/fly.toml before the new
# release is promoted; a migration failure aborts the deploy.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

: "${FLY_API_TOKEN:?FLY_API_TOKEN is required}"
: "${FLY_APP_API:?FLY_APP_API is required (Fly app name for the API)}"

if ! command -v flyctl >/dev/null 2>&1; then
  echo "ERROR: flyctl is not installed (https://fly.io/docs/flyctl/install/)" >&2
  exit 1
fi

echo "Deploying API to Fly.io app '${FLY_APP_API}' (commit ${GITHUB_SHA:-$(git -C "$ROOT_DIR" rev-parse --short HEAD)})"

flyctl deploy \
  --remote-only \
  --config "$ROOT_DIR/api/fly.toml" \
  --app "$FLY_APP_API" \
  --image-label "${GITHUB_SHA:-manual-$(date -u +%Y%m%d%H%M%S)}"

echo "Verifying /api/health on https://${FLY_APP_API}.fly.dev ..."
for attempt in 1 2 3 4 5 6; do
  if curl -fsS --max-time 10 "https://${FLY_APP_API}.fly.dev/api/health" >/dev/null; then
    echo "Deploy of '${FLY_APP_API}' succeeded."
    exit 0
  fi
  echo "Health check attempt ${attempt}/6 failed; retrying in 10s..."
  sleep 10
done

echo "ERROR: '${FLY_APP_API}' did not become healthy after deploy" >&2
exit 1
