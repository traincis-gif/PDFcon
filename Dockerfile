FROM node:20-slim AS base
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ========== BACKEND ==========
FROM base AS backend-deps
COPY backend/node/package.json ./
RUN npm install --omit=dev

FROM base AS backend-build
COPY backend/node/package.json ./
RUN npm install
COPY backend/node/tsconfig.json ./
COPY backend/node/prisma ./prisma/
RUN npx prisma generate
COPY backend/node/src ./src/
RUN npm run build

# ========== FRONTEND ==========
FROM node:20-alpine AS frontend-deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY frontend/package.json ./
RUN npm install

FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY --from=frontend-deps /app/node_modules ./node_modules
COPY frontend/ .
ENV NEXT_PUBLIC_API_URL=""
RUN npm run build

# ========== PRODUCTION ==========
FROM base AS production
ENV NODE_ENV=production

# Backend files
COPY --from=backend-deps /app/node_modules ./backend/node_modules
COPY --from=backend-build /app/dist ./backend/dist
COPY --from=backend-build /app/node_modules/.prisma ./backend/node_modules/.prisma
COPY backend/node/prisma ./backend/prisma/
COPY backend/node/package.json ./backend/

# Frontend files
COPY --from=frontend-build /app/public ./frontend/public
COPY --from=frontend-build /app/.next/standalone ./frontend/
COPY --from=frontend-build /app/.next/static ./frontend/.next/static

# Start script
COPY start-combined.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 3000
ENV PORT=3000

CMD ["./start.sh"]
