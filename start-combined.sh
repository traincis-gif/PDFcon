#!/bin/sh
set -e

echo "=== PDFlow Combined Startup ==="

# Run Prisma DB push
echo "=== Syncing database schema ==="
cd /app/backend
DATABASE_URL="$DATABASE_URL" npx prisma db push --skip-generate 2>&1 || echo "Warning: DB push failed"
cd /app

# Start backend API on port 8080 (internal)
echo "=== Starting backend API on :8080 ==="
cd /app/backend
NODE_ENV=production PORT=8080 node dist/src/server.js &
BACKEND_PID=$!
cd /app

# Wait for backend to be ready
echo "=== Waiting for backend ==="
for i in 1 2 3 4 5 6 7 8 9 10; do
  if wget -q -O /dev/null http://localhost:8080/health 2>/dev/null; then
    echo "=== Backend ready ==="
    break
  fi
  echo "Waiting... ($i)"
  sleep 1
done

# Start Next.js frontend on PORT (default 3000, exposed to Railway)
echo "=== Starting frontend on :${PORT:-3000} ==="
cd /app/frontend
HOSTNAME="0.0.0.0" PORT="${PORT:-3000}" exec node server.js
