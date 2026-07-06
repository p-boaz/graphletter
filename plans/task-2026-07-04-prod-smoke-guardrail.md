# Task Spec: Production smoke checks + migration-parity guardrail

## Metadata

- Date: 2026-07-04
- Owner: agent (Claude Code), approval: Peter (standing "keep working" directive, 2026-07-04)
- Status: In Progress
- Branch: `ci/prod-smoke-guardrail`
- Related issue/PR: follow-up to `plans/archive/task-2026-07-04-copy-dejargon.md`
  and `plans/task-2026-07-04-demo-quota-migration-repair.md`

## Goal

Make the two failure classes found today impossible to miss again:

1. **Silent prod breakage** — the `/try` demo 500'd in production with nothing
   watching (primary landing-page CTA dead for anonymous visitors).
2. **Committed-but-unapplied migrations** — `20260626170000` sat in the repo
   for 8 days without ever being pushed to the database; the non-strict drift
   check can't catch this without Docker.

A scheduled + post-deploy GitHub Actions workflow probes the live site's
critical public endpoints and verifies every repo migration file has a row in
`supabase_migrations.schema_migrations`. On failure it files (or comments on)
a GitHub issue so the breakage is visible without watching Actions.

## Context Files

- [ ] `.github/workflows/prod-smoke.yml` (new)
- [ ] this spec

Out-of-repo setup performed alongside (documented here, no repo diff):

- A least-privilege read-only Postgres role `ci_smoke` on the linked database:
  `LOGIN`, `USAGE` on schema `supabase_migrations`, `SELECT` on
  `supabase_migrations.schema_migrations` only. No access to `public`.
- Repo Actions secret `SMOKE_DATABASE_URL` with that role's pooler connection
  string.

## Constraints

- Smoke checks hit only public, unauthenticated, read-only endpoints — no AI
  spend, no quota consumption (`GET /api/try-it-out/demo/quota` reads without
  consuming).
- DB check uses the dedicated `ci_smoke` role, never the admin `DATABASE_URL`.
- Issue filing is deduped (comment on the existing open issue instead of
  filing duplicates) and skipped for `pull_request` runs.
- Workflow also triggers on `pull_request` touching its own file so the PR
  itself live-proves the checks before merge.

## Checks

1. `GET https://www.graphletter.com/` → 200, body mentions Graphletter.
2. `GET /api/try-it-out/demo/quota` → 200 with `{remaining, max}` JSON
   (regression guard for today's outage).
3. `GET /api/scf/frameworks` → 200 with a non-empty array (SCF data intact).
4. Migration parity: every `supabase/migrations/*.sql` version prefix exists
   in `supabase_migrations.schema_migrations`.

Triggers: cron every 6 hours, `workflow_dispatch`, Vercel production
`deployment_status` success events, and `pull_request` on the workflow file.

## Implementation Plan

1. Create the `ci_smoke` role (psql, generated password never echoed), verify
   it can read the ledger and cannot read `public` tables.
2. `gh secret set SMOKE_DATABASE_URL`.
3. Add `.github/workflows/prod-smoke.yml`.
4. Push branch, open PR; the `pull_request` trigger runs the full smoke suite
   as live proof.

## Test Plan

- [ ] `ci_smoke` can `SELECT` from `supabase_migrations.schema_migrations`.
- [ ] `ci_smoke` CANNOT select from `public.scf_frameworks` (least privilege).
- [ ] Migration-parity logic passes locally against the live ledger.
- [ ] Workflow's smoke job passes on the PR run (all four checks green).
- [ ] `pnpm lint` / `pnpm typecheck` clean (no app code touched; sanity only).

## Acceptance Criteria

- [ ] PR open with a green "Prod Smoke" check that exercised the real
      production endpoints and the real migration ledger.
- [ ] A future unapplied migration or a 500 on the demo-quota endpoint fails
      the scheduled run and produces a GitHub issue.
- [ ] `ci_smoke` role privileges limited to the migrations ledger.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (standing directive: autonomous work while away, PRs not
      self-merged)
