#!/bin/sh
set -eu

echo "[fal-api] prisma migrate deploy..."
npx prisma migrate deploy

if [ "${RUN_SEED_ON_BOOT:-false}" = "true" ]; then
  echo "[fal-api] prisma seed..."
  npx prisma db seed || npx tsx prisma/seed.ts || true
fi

echo "[fal-api] starting NestJS..."
exec node dist/main.js
