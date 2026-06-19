# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Full-stack investment tracker — React/TypeScript SPA + NestJS REST API with real-time price updates.

- **Frontend**: React + TypeScript + Tailwind CSS, Recharts, Zustand — deployed on Vercel
- **Backend**: NestJS + TypeScript, REST API + Socket.io, JWT auth — deployed on GCP Cloud Run (Dockerized)
- **Database**: PostgreSQL via Prisma ORM — GCP Cloud SQL
- **Cache**: Redis (GCP Memorystore) — price caching and rate limiting
- **Market data**: Finnhub or CoinGecko API
- **CI/CD**: GitHub Actions

## Repo structure

Nx integrated monorepo (pnpm workspaces). Shared code lives in `libs/` per Nx convention.

```
apps/
  web/       # React frontend (Vite)
  api/       # NestJS backend
libs/
  shared-types/   # TS interfaces shared by both apps (@investment-tracker/shared-types)
```

## Nx commands

Run from the repo root. Nx caches `build`/`lint`/`test`/`typecheck`.

```bash
pnpm install                 # Install all workspace deps
nx serve api                 # Run the NestJS API (watch)
nx serve web                 # Run the Vite dev server (port 4200)
nx run-many -t build         # Build all projects
nx affected -t lint test     # Lint + test only what changed vs main
nx run api:prisma-generate   # Regenerate Prisma client
nx run api:prisma-migrate    # Create + apply a dev migration
```

## Per-project targets

Every project exposes `build`, `lint`, `test`, `typecheck` via Nx (e.g. `nx test api`, `nx lint web`). The API additionally has `prisma-generate` and `prisma-migrate` targets.

Prisma (the schema lives at `apps/api/prisma/schema.prisma`):
```bash
nx run api:prisma-migrate                                    # migrate dev (local only)
prisma migrate deploy --schema=apps/api/prisma/schema.prisma # CI/prod
prisma studio --schema=apps/api/prisma/schema.prisma         # DB inspection GUI
```

## Architecture

### Backend (NestJS)
Modules are organized per domain: `auth`, `portfolios`, `positions`, `transactions`, `prices`, `websocket`.

- JWT auth via `@nestjs/passport` — `JwtAuthGuard` on protected routes
- `PrismaModule` is global — inject `PrismaService` directly into any service
- `PricesService` fetches from Finnhub/CoinGecko and caches results in Redis with TTL ~60s
- Redis also handles rate limiting via `@nestjs/throttler`
- Socket.io gateway under the `/prices` namespace pushes live price updates to subscribed clients

### Frontend (React)
- Zustand stores scoped per domain: `authStore`, `portfolioStore`, `priceStore`
- Recharts used for P&L over time and allocation breakdown charts
- Socket.io client subscribes to `/prices` for live updates

## Key conventions

- All financial calculations (P&L, cost basis, gain%) live in backend services — never in controllers or on the frontend
- Redis cache keys follow the pattern `price:{symbol}:{currency}`
- **Never run `prisma migrate dev` against Cloud SQL** — only use `migrate deploy` in production/CI
- Socket.io events are namespaced under `/prices`

## Deployment

| Layer    | Service              | Trigger                  |
|----------|----------------------|--------------------------|
| Frontend | Vercel               | Push to `main`           |
| Backend  | GCP Cloud Run        | GitHub Actions → Docker  |
| Database | GCP Cloud SQL        | —                        |
| Cache    | GCP Memorystore      | —                        |

Docker config lives at `apps/api/Dockerfile`. GitHub Actions workflows live in `.github/workflows/`.
