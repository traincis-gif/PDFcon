FROM node:20-slim AS base
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY backend/node/package.json backend/node/package-lock.json* ./
RUN npm ci --omit=dev

# Build
FROM base AS build
COPY backend/node/package.json backend/node/package-lock.json* ./
RUN npm ci
COPY backend/node/tsconfig.json ./
COPY backend/node/prisma ./prisma/
RUN npx prisma generate
COPY backend/node/src ./src/
RUN npm run build

# Production
FROM base AS production
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY backend/node/prisma ./prisma/
COPY backend/node/package.json ./

EXPOSE 8080
ENV PORT=8080

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/server.js"]
