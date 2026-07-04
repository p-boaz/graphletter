# Task Spec: Apply missing demo-quota migration (prod demo broken)

## Metadata

- Date: 2026-07-04
- Owner: agent (Claude Code), approval: Peter ("spec and fix the demo-quota bug")
- Status: Done
- Branch: main (no code change — database repair + spec record)
- Related issue/PR: found during PR #38 dogfooding (see
  `plans/task-2026-07-04-copy-dejargon.md`)

## Goal

Restore the public `/try` demo, which 500s in production and locally because
migration `20260626170000_create_demo_quota_hits.sql` was never applied to the
linked Supabase database.

## Diagnosis (2026-07-04)

- `POST /api/try-it-out/demo` and `GET /api/try-it-out/demo/quota` return 500
  in prod (`www.graphletter.com`) and local dev.
- Direct Postgres check via `DATABASE_URL`:
  `to_regclass('public.demo_quota_hits')` → NULL; `consume_demo_quota` absent
  from `pg_proc`. **Neither the table nor the function exists.**
- `supabase_migrations.schema_migrations` shows the last applied migration is
  `20260611210000_progress_sessions_table`. `20260626170000` is the only
  repo migration missing from the ledger — it was committed on June 26 but
  never pushed to the database. (An earlier PostgREST probe suggesting the
  table existed was a false negative from a HEAD request.)

## Context Files

- [x] `supabase/migrations/20260626170000_create_demo_quota_hits.sql`
      (already in repo — applied verbatim, not modified)
- [x] this spec (only repo change)

## Constraints

- No code or migration-file changes; the fix is applying the existing
  migration exactly as written and recording it in
  `supabase_migrations.schema_migrations` so `supabase db push` / drift checks
  stay consistent.
- Apply inside a single transaction.
- The migration is idempotent (`IF NOT EXISTS` / `CREATE OR REPLACE`).

## Implementation Plan

1. Apply `20260626170000_create_demo_quota_hits.sql` via `psql "$DATABASE_URL"`
   in one transaction.
2. Insert the ledger row: version `20260626170000`, name
   `create_demo_quota_hits`.
3. Verify: table + function exist; `consume_demo_quota` RPC returns
   `{ok: true, remaining: 2}` for a probe key; delete probe rows.
4. `pnpm schema:migrations:check` and `pnpm schema:drift:check`.
5. Live-proof: `GET /api/try-it-out/demo/quota` returns 200 in prod; run one
   real demo end-to-end on local `/try` (the dogfood step that was blocked).
6. Commit this spec to main.

## Test Plan

- [x] `to_regclass('public.demo_quota_hits')` non-null; function present.
- [x] RPC probe consumes and reports quota correctly (`{ok:true,remaining:2}`
      then `{ok:true,remaining:1}`); probe rows cleaned up.
- [x] `pnpm schema:migrations:check` passes (27 files, ordering OK).
- [x] `pnpm schema:drift:check` — non-strict variant warns "Docker
      unavailable; schema drift check skipped" (expected on this machine per
      CLAUDE.md; strict variant needs Supabase CLI + Docker).
- [x] Prod `GET https://www.graphletter.com/api/try-it-out/demo/quota` → 200
      `{"remaining":3,"max":3}` (was 500 before the fix).
- [x] Full demo run on local `/try` reached "Assessment Complete: 9/22
      objectives passed with 84% average confidence" — real AI output.

## Acceptance Criteria

- [x] Public demo works end-to-end for an anonymous visitor.
- [x] Migration ledger matches the repo's migration files exactly
      (`20260626170000` recorded; applied 2026-07-04 via psql in one
      transaction).
- [x] No repo changes beyond this spec.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (Peter, 2026-07-04: "spec and fix the demo-quota bug")
