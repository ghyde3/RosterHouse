# RosterHouse

Shift management for hourly, blue-collar-first teams — restaurants, retail,
warehouses. Managers build a weekly schedule on the web; employees view
shifts, set availability, swap shifts, and clock in from a mobile-web app.

## Stack

- **Next.js** (App Router, TypeScript, no Tailwind — the design system ships
  its own CSS tokens in `src/styles/tokens/`)
- **PostgreSQL** via **Prisma 7** (`prisma/schema.prisma`, pg driver adapter)
- **Railway** for deployment (`railway.json`; Postgres runs as a Railway
  service, `DATABASE_URL` is injected)

## Local development

```bash
docker compose up -d      # local Postgres on :5432
npm install
npx prisma migrate dev    # apply migrations
npm run dev               # http://localhost:3000
```

`GET /api/health` reports app + DB status (used as the Railway healthcheck).

## Design system

The Claude Design export lives in `RosterHouse Design System/` — treat it as
the design source of truth (tokens, component primitives, and click-through
UI kits for the manager web app and employee mobile app). Tokens are ported
to `src/styles/tokens/`; Figtree is self-hosted via `next/font`.

## Deploying to Railway

1. Create a Railway project with two services: this repo + Postgres.
2. Set `DATABASE_URL` on the app service to `${{Postgres.DATABASE_URL}}`.
3. Deploys run `npx prisma migrate deploy` before start
   (see `railway.json`).
