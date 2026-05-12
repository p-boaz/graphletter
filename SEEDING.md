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

## What's inside

| Script                       | What it does                                                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `pnpm seed`                  | Orchestrator. Runs core SCF write + legacy importer + 3 new seeders.                                                  |
| `pnpm seed:verify`           | Asserts every table is within ±1 % of `data/seed/expected_row_counts.json`.                                           |
| `pnpm seed:snapshot`         | One-shot. Captures the current row counts to the snapshot JSON. Only used when re-baselining (e.g. SCF version bump). |
| `pnpm verify:scf-extraction` | Asserts every CSV matches a fresh extraction from the vendored XLSX (license posture check).                          |

## Safety

- `seed-all` refuses to run if `NEXT_PUBLIC_SUPABASE_URL` points at production (gbnxwsntyzyrpwmjaaqa).
- The service-role key is read from env only; it is NEVER committed.
- Seed writes are scoped to `scf_version='2026.1.1' AND import_id IS NULL` to leave any app-uploaded
  rows alone.

## Troubleshooting

- **"Missing NEXT_PUBLIC_SUPABASE_URL"** — set the env or source the right `.env*` file.
- **`pnpm seed:verify` reports mismatches** — re-run `pnpm seed`; the seeders are idempotent. If a
  mismatch persists, check `supabase/migrations/` is in sync (`pnpm dlx supabase db push`).
- **"refusing to run against the production graphletter Supabase project"** — you pointed at prod
  by accident. Switch env files.
