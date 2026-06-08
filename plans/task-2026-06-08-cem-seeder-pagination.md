# Task Spec: Paginate CEM seeder past the PostgREST 1000-row cap

## Metadata

- Date: 2026-06-08
- Owner: agent-claude
- Status: Done
- Branch: main
- Related issue/PR: n/a (direct commit)

## Goal

Fix the control-evidence-mapping (CEM) seeder so it reads every row of
`scf_controls` and `scf_evidence_request_list`, not just the first PostgREST
page, so no valid mappings are silently dropped.

## Context Files

- [x] scripts/seed-control-evidence-mappings.ts
- [x] tests/scripts/seed-control-evidence-mappings.test.ts
- [x] data/seed/expected_row_counts.json

## Constraints

- PostgREST caps an unbounded `select()` at 1000 rows; reads must page.
- Seeders stay idempotent.
- `pnpm seed:verify` must pass against the recaptured expected counts.

## Scope

### In scope

- Add a paginated `selectAll()` helper and route both table reads through it.
- Recapture `expected_row_counts.json` (CEM 481 -> 774).
- Regression test asserting a >1000-row control set triggers a second page read.
- Local-dev docs + config: SEEDING.md Colima/Docker workflow, SELF_HOSTING.md
  Node 22 floor, supabase/config.toml local auto-seed + analytics off,
  gitignore `.env*.local`.

### Out of scope

- Changes to other seeders.
- docs/ENV_RECOVERY.md (kept local; internal ops runbook, not committed).

## Implementation Plan

1. Add `selectAll<T>()` that loops `.range(from, from + 1000 - 1)` until a short page.
2. Replace the single-shot `select()` calls for ERL and controls with `selectAll`.
3. Re-run `pnpm seed` + `pnpm seed:snapshot` to recapture expected counts.
4. Add the >1000-control regression test.

## Test Plan

- [x] `node --import tsx --test tests/scripts/seed-control-evidence-mappings.test.ts`
- [x] `tsc --noEmit`
- [x] `eslint` on changed files

## Acceptance Criteria

- [x] Controls beyond row 1000 are read (test asserts 2 paged reads).
- [x] CEM expected count reflects the true 774 rows.
- [x] Typecheck and lint clean.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved
