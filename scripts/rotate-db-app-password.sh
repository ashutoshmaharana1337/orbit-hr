#!/usr/bin/env bash
# Rotate the password of the restricted, non-superuser Postgres role the API
# connects as at runtime (orbit_app — see api/prisma/migrations/
# 20260907112910_enable_row_level_security, which creates it with a public
# development password that must never be used outside local dev).
#
# Run this once against any new environment right after the first
# `prisma migrate deploy`, and periodically thereafter. It does NOT touch
# migration history — ALTER ROLE PASSWORD is not a schema change, so this is
# safe to run any number of times against a database Prisma already manages.
#
# Required env:
#   DIRECT_DATABASE_URL   Owner-role connection string (the role that ran
#                          `prisma migrate deploy`; NOT orbit_app itself —
#                          a role cannot ALTER its own password over a
#                          connection authenticated as that same role in a
#                          way that survives the rotation cleanly).
#
# Optional env:
#   DB_APP_ROLE            Role to rotate (default: orbit_app)
#   NEW_DB_APP_PASSWORD     Password to set; a strong random one is
#                          generated when omitted.
#
# Usage:
#   DIRECT_DATABASE_URL=postgresql://orbit:...@host:5432/orbit_hr scripts/rotate-db-app-password.sh
#
# On success, prints the new password once and the DATABASE_URL to store in
# the environment's secret manager. Nothing is written to disk or logged
# anywhere else — copy it immediately.
set -euo pipefail

: "${DIRECT_DATABASE_URL:?DIRECT_DATABASE_URL is required (owner role connection string)}"

DB_APP_ROLE="${DB_APP_ROLE:-orbit_app}"

if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql is required (install the PostgreSQL client)" >&2
  exit 1
fi

# Prisma connection strings carry a `?schema=` query parameter that plain
# libpq/psql does not understand ("invalid URI query parameter"); strip any
# query string for the psql calls below, but keep the full original URL for
# building the new DATABASE_URL at the end.
psql_url="${DIRECT_DATABASE_URL%%\?*}"

if [ -n "${NEW_DB_APP_PASSWORD:-}" ]; then
  new_password="$NEW_DB_APP_PASSWORD"
elif command -v openssl >/dev/null 2>&1; then
  new_password="$(openssl rand -base64 32 | tr -d '/+=\n' | cut -c1-32)"
elif [ -r /dev/urandom ] && command -v base64 >/dev/null 2>&1; then
  new_password="$(head -c 48 /dev/urandom | base64 | tr -d '/+=\n' | cut -c1-32)"
else
  echo "ERROR: neither openssl nor /dev/urandom+base64 is available to generate a password; set NEW_DB_APP_PASSWORD instead" >&2
  exit 1
fi

# Strip characters that need escaping in a connection-string password even
# after the above (e.g. a caller-supplied NEW_DB_APP_PASSWORD), and make sure
# something usable is left.
if [ "${#new_password}" -lt 16 ]; then
  echo "ERROR: password is shorter than 16 characters after generation/sanitizing" >&2
  exit 1
fi

# Validate the role exists before altering it, and fail loudly on a typo'd
# DB_APP_ROLE rather than silently creating nothing.
role_exists="$(psql "$psql_url" -tAc "SELECT 1 FROM pg_roles WHERE rolname = '${DB_APP_ROLE}'")"
if [ "$role_exists" != "1" ]; then
  echo "ERROR: role '${DB_APP_ROLE}' does not exist on this database. Run 'prisma migrate deploy' first." >&2
  exit 1
fi

# ALTER ROLE takes the password as a SQL literal, not a bind parameter —
# quote it for SQL (double any single quotes; the generated password never
# contains one, but a caller-supplied NEW_DB_APP_PASSWORD might).
escaped_password="${new_password//\'/\'\'}"
psql "$psql_url" -v ON_ERROR_STOP=1 -c "ALTER ROLE ${DB_APP_ROLE} PASSWORD '${escaped_password}';" >/dev/null

# Rebuild DATABASE_URL with the new password for convenience: reuse
# everything after the role's current password in DIRECT_DATABASE_URL's own
# host/port/db, since both roles point at the same server and database.
host_and_after="$(echo "$DIRECT_DATABASE_URL" | sed -E 's#^[a-zA-Z]+://[^:]+:[^@]+@##')"
new_database_url="postgresql://${DB_APP_ROLE}:${new_password}@${host_and_after}"

echo "Rotated password for role '${DB_APP_ROLE}'." >&2
echo "" >&2
echo "New DATABASE_URL (store this in the environment's secret manager, then redeploy):" >&2
echo "$new_database_url"
