#!/bin/sh
set -e

echo "=== PDFlow Startup ==="
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"

echo "=== Running Prisma DB Push ==="
npx prisma db push --skip-generate 2>&1 || echo "Prisma db push failed with exit code $?"

echo "=== Checking dist ==="
ls -la dist/src/server.js 2>&1 || echo "server.js NOT FOUND"

echo "=== Starting Node Server ==="
exec node dist/src/server.js 2>&1
