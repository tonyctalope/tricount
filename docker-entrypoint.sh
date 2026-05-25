#!/bin/sh
set -e

echo "→ Installing dependencies..."
bun install --frozen-lockfile

echo "→ Generating Prisma client..."
bunx prisma generate

echo "→ Applying database migrations..."
bunx prisma migrate deploy

echo "→ Starting Next.js dev server..."
exec bun dev --hostname 0.0.0.0
