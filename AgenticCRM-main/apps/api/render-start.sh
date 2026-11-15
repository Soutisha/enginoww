#!/bin/sh
set -eu

cd /app
export DIRECT_DATABASE_URL="${DIRECT_DATABASE_URL:-${DATABASE_URL:-}}"
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${DIRECT_DATABASE_URL:?DIRECT_DATABASE_URL is required}"

echo "[startup] Checking PostgreSQL schema"
TABLE_EXISTS="$(psql "$DIRECT_DATABASE_URL" -tAc "SELECT to_regclass('public.\"Company\"') IS NOT NULL" | tr -d '[:space:]')"

if [ "$TABLE_EXISTS" = "t" ]; then
  prisma db push --config=packages/database/prisma/prisma.config.ts
else
  echo "[startup] Initializing the empty demo database"
  prisma db push --accept-data-loss --config=packages/database/prisma/prisma.config.ts
fi

psql "$DIRECT_DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/database/prisma/migrations/pre_push.sql || {
  echo "[startup] Pre-push compatibility SQL reported a warning; continuing"
}
prisma db push --config=packages/database/prisma/prisma.config.ts

psql "$DIRECT_DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/database/prisma/migrations/manual_pgvector.sql || {
  echo "[startup] pgvector unavailable; semantic memory features may be limited"
}

echo "[startup] Starting BizPilot API"
exec node apps/api/dist/apps/api/src/main.js
