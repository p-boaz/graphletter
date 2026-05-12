# Seeding graphletter

This guide walks through standing up a freshly-cloned graphletter checkout
against a clean Supabase project.

## Prerequisites

- Node 22, pnpm
- A Supabase project (free tier is fine; postgres-17 release channel works)
- The project's `URL` and `service_role` key from Project Settings → API

## Environment

Create `.env.local` (already in `.gitignore`):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role key>
# Direct Postgres URI — only needed for `pnpm seed:reset`.
# Settings → Database → Connection string → URI (port 5432 / session pooler).
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

## One-shot bring-up

```bash
pnpm install
pnpm dlx supabase link --project-ref <your-project-ref>
pnpm dlx supabase db push   # applies every migration in supabase/migrations/
pnpm seed                   # writes ≈ 1265 controls + risks/threats/maturity/ERL/AO/CEM
pnpm seed:verify            # asserts every table's row count is within ±1 %
```

`pnpm seed` is idempotent: running it again wipes the seed-owned rows and re-inserts them.

## Upgrading SCF version (or: nuke & repave)

When a new SCF release lands, the canonical procedure is:

1. Vendor the new XLSX and re-run `pnpm extract:scf` (Phase 1 flow).
2. Take a Supabase point-in-time snapshot of any database you care about.
3. Run `pnpm seed:reset`. The orchestrator:
   - loads `.env.local` (override with `--env-file <path>`),
   - prints the wipe plan and asks you to type `wipe <project-hostname>` to confirm
     (skip with `--yes` for unattended runs; `--dry-run` exits before any writes),
   - shells out to `psql "$DATABASE_URL" -f scripts/wipe-scf-data.sql`,
   - re-runs `pnpm seed` and then `pnpm seed:verify`.

The wipe SQL is also dashboard-pasteable — open Supabase Dashboard → SQL Editor
and paste `scripts/wipe-scf-data.sql` if you don't have `psql` locally.

If the wipe succeeds but seed/verify fails, just re-run `pnpm seed:reset` —
`TRUNCATE … RESTART IDENTITY` makes the wipe idempotent and the seeders are
already idempotent.

## What's inside

| Script                       | What it does                                                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `pnpm seed`                  | Orchestrator. Runs core SCF write + legacy importer + 3 new seeders.                                                  |
| `pnpm seed:reset`            | Wipe + reseed + verify. The standard "upgrade SCF version" path. Requires `DATABASE_URL` and typed confirmation.      |
| `pnpm seed:verify`           | Asserts every table is within ±1 % of `data/seed/expected_row_counts.json`.                                           |
| `pnpm seed:snapshot`         | One-shot. Captures the current row counts to the snapshot JSON. Only used when re-baselining (e.g. SCF version bump). |
| `pnpm verify:scf-extraction` | Asserts every CSV matches a fresh extraction from the vendored XLSX (license posture check).                          |

## Safety

- `seed-all` refuses to run if `NEXT_PUBLIC_SUPABASE_URL` points at production (gbnxwsntyzyrpwmjaaqa)
  unless `ALLOW_PROD_SEED=1` is set. Only `pnpm seed:reset` sets that flag, and only after the
  operator has typed the hostname confirmation token.
- The service-role key is read from env only; it is NEVER committed.
- Seed writes are scoped to `scf_version='2026.1.1' AND import_id IS NULL` to leave any app-uploaded
  rows alone — but `pnpm seed:reset` deliberately wipes everything, since `TRUNCATE … CASCADE`
  recursively clears any customer rows that FK into `scf_*` tables. Always take a Supabase
  point-in-time snapshot before running `seed:reset` against a database that holds real data.

## Troubleshooting

- **"Missing NEXT_PUBLIC_SUPABASE_URL"** — set the env or source the right `.env*` file.
- **`pnpm seed:verify` reports mismatches** — re-run `pnpm seed`; the seeders are idempotent. If a
  mismatch persists, check `supabase/migrations/` is in sync (`pnpm dlx supabase db push`).
- **"refusing to run against the production graphletter Supabase project"** — you pointed at prod
  by accident. Switch env files. (If you genuinely intend to reseed prod, use `pnpm seed:reset` —
  it sets `ALLOW_PROD_SEED=1` only after a hostname-confirmation prompt.)
- **`pnpm seed:reset` says "stdin is not a TTY"** — re-run with `--yes` for unattended execution
  (CI, piped invocations).
- **`psql: command not found`** — install via `brew install libpq && brew link --force libpq`, or
  open Supabase Dashboard → SQL Editor and paste `scripts/wipe-scf-data.sql` manually, then re-run
  `pnpm seed && pnpm seed:verify`.
