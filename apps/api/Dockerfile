# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:20-slim AS build
WORKDIR /workspace

# OpenSSL is required by Prisma engines
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN corepack enable

# Install dependencies (full monorepo manifest for Nx)
COPY package.json pnpm-lock.yaml* ./
COPY apps/api/prisma ./apps/api/prisma
RUN pnpm install --frozen-lockfile || pnpm install

# Copy the rest of the source and build the API
COPY . .
RUN pnpm prisma generate --schema=apps/api/prisma/schema.prisma
RUN pnpm nx build api --configuration=production

# ---- Runtime stage ----
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable

# generatePackageJson emits a minimal package.json next to the bundle
COPY --from=build /workspace/dist/apps/api ./
COPY --from=build /workspace/apps/api/prisma ./prisma
RUN pnpm install --prod || npm install --omit=dev

# Cloud Run provides PORT; default to 8080
ENV PORT=8080
EXPOSE 8080

# Apply migrations on boot, then start the server
CMD ["sh", "-c", "npx prisma migrate deploy --schema=./prisma/schema.prisma && node main.js"]
