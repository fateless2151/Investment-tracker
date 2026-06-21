# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:20-slim AS build
WORKDIR /workspace

# OpenSSL is required by Prisma's query engine
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Pin pnpm via corepack — the floating latest needs Node 22 (node:sqlite)
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Install against the full workspace, generate the Prisma client, build the API
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm prisma generate --schema=apps/api/prisma/schema.prisma
RUN pnpm nx build api --configuration=production

# ---- Runtime stage ----
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Carry over the built bundle, installed deps (incl. generated Prisma client),
# and the Prisma schema + migrations. No reinstall in runtime → reliable.
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/dist/apps/api ./dist
COPY --from=build /workspace/apps/api/prisma ./prisma

# Render/Cloud Run inject PORT; default to 8080 otherwise
ENV PORT=8080
EXPOSE 8080

# Apply migrations on boot, then start the server
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma && node dist/main.js"]
