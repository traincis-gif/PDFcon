#!/bin/sh
set -e

echo "=== PDFlow Combined Startup ==="

# Run Prisma DB push
echo "=== Syncing database schema ==="
cd /app/backend
npx prisma db push --skip-generate 2>&1 || echo "Warning: DB push failed"

# Seed plans
echo "=== Seeding database ==="
node prisma/seed.js 2>&1 || echo "Warning: Seed failed"
cd /app

# Start backend API on internal port 9090 (not exposed)
echo "=== Starting backend API on :9090 ==="
cd /app/backend
NODE_ENV=production PORT=9090 node dist/src/server.js &
BACKEND_PID=$!
cd /app

# Wait for backend to be ready
echo "=== Waiting for backend ==="
for i in 1 2 3 4 5 6 7 8 9 10; do
  if wget -q -O /dev/null http://localhost:9090/health 2>/dev/null; then
    echo "=== Backend ready ==="
    break
  fi
  echo "Waiting... ($i)"
  sleep 1
done

# Start Next.js frontend on the Railway PORT (exposed to Railway)
FRONTEND_PORT="${PORT:-3000}"
echo "=== Starting frontend on :${FRONTEND_PORT} ==="
cd /app/frontend
HOSTNAME="0.0.0.0" PORT="${FRONTEND_PORT}" exec node server.js
