# siam/server

Phase 1 output: the new Postgres schema, migrations, and permission-catalog seed for the
Siam Suits rewrite. See `../REWRITE_ARCHITECTURE.md` and `../PHASE_1_TASKS.md` at the repo
root for the design this implements — this README is just "how to run it."

## Setup

```bash
cp .env.example .env      # fill in DATABASE_URL if not using the default docker-compose values
npm install
docker compose up -d      # starts local Postgres on localhost:5432
npm run db:migrate        # applies drizzle/0000_*.sql
npm run db:seed           # seeds the permission catalog + default tenant + Owner role
```

No Docker? Point `DATABASE_URL` in `.env` at any Postgres 14+ instance (a native local
install, or a free Neon/Supabase dev database) — `db:migrate`/`db:seed` don't care where
Postgres is running.

## Commands

- `npm run db:generate` — regenerate a migration after editing `src/db/schema/*`.
- `npm run db:migrate` — apply pending migrations.
- `npm run db:seed` — idempotent; safe to re-run.
- `npm run db:studio` — Drizzle Studio, a browser GUI for the current database.
- `npm test` — runs the Vitest suite (currently just the DB-connection smoke test; real
  coverage starts in Phase 2 once there's business logic to test).
- `npm run lint` / `npm run format` — ESLint / Prettier.

## Status

**Phase 1 complete and verified**, against a local PostgreSQL 17 instance (Docker was
never actually needed — see notes below):

- `tsc --noEmit` — zero type errors.
- `drizzle-kit generate` — 37 tables, all FKs resolved.
- `npm run db:migrate` — applied cleanly (verified via `\dt`: all 37 tables present).
- `npm run db:seed` — 28 permissions seeded, default "Siam Suits" tenant created, "Owner"
  role created with all 28 permissions attached.
- `npm test` — passing (DB-connection smoke test).

Phase 2 (backend foundation: auth, RBAC middleware, catalog APIs, ETL) starts next.

### Local dev DB note

Connection string uses a locally-installed PostgreSQL 17 Windows service, not Docker —
Docker Desktop installation hit a stuck WSL2 kernel download, and a pre-existing local
Postgres install was the faster unblock. `docker-compose.yml` is still here and correct
if Docker ever gets installed later; nothing about the schema/migrations cares which
Postgres they run against.
