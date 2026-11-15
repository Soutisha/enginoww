#!/bin/sh
set -eu

cd /app
export DIRECT_DATABASE_URL="${DIRECT_DATABASE_URL:-${DATABASE_URL:-}}"
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${DIRECT_DATABASE_URL:?DIRECT_DATABASE_URL is required}"

echo "[startup] Enabling pgvector before Prisma schema sync"
psql "$DIRECT_DATABASE_URL" -v ON_ERROR_STOP=1 -c 'CREATE EXTENSION IF NOT EXISTS vector;'

USER_TABLE_EXISTS="$(psql "$DIRECT_DATABASE_URL" -tAc "SELECT to_regclass('public.\"User\"') IS NOT NULL" | tr -d '[:space:]')"
USER_COUNT="0"
if [ "$USER_TABLE_EXISTS" = "t" ]; then
  USER_COUNT="$(psql "$DIRECT_DATABASE_URL" -tAc 'SELECT COUNT(*) FROM "User"' | tr -d '[:space:]')"
fi

if [ "$USER_COUNT" = "0" ]; then
  echo "[startup] Initializing the empty demo database (no registered users)"
  prisma db push --accept-data-loss --config=packages/database/prisma/prisma.config.ts
else
  echo "[startup] Existing users detected; applying schema without data-loss override"
  prisma db push --config=packages/database/prisma/prisma.config.ts
fi

# Prisma has synchronized the complete current schema. Avoid replaying the
# legacy pre_push backfill on every free-tier restart.
psql "$DIRECT_DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/database/prisma/migrations/manual_pgvector.sql || {
  echo "[startup] pgvector indexes unavailable; semantic memory may be limited"
}

API_ENTRY=""
for candidate in \
  apps/api/dist/main.js \
  apps/api/dist/src/main.js \
  apps/api/dist/apps/api/src/main.js
do
  if [ -f "$candidate" ]; then
    API_ENTRY="$candidate"
    break
  fi
done

if [ -z "$API_ENTRY" ]; then
  API_ENTRY="$(find apps/api/dist -maxdepth 6 -type f -name main.js -print -quit 2>/dev/null || true)"
fi

if [ -z "$API_ENTRY" ]; then
  echo "[startup] ERROR: NestJS entrypoint not found under apps/api/dist"
  find apps/api/dist -maxdepth 5 -type f -print 2>/dev/null | head -50 || true
  exit 1
fi

echo "[startup] Starting BizPilot API from $API_ENTRY"
exec node "$API_ENTRY"
