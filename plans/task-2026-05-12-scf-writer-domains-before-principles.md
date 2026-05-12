# Task Spec: Fix scf writer FK ordering (domains before principles)

## Metadata

- Date: 2026-05-12
- Owner: claude (peter@barplaybook.com)
- Status: In Progress
- Branch: fix/scf-writer-domains-before-principles
- Related issue/PR: follow-up to PR #3 (seed-reset); blocks prod migration to 2026.1.1

## Goal

Reorder `writeParsedSCF` so `scf_domains` is upserted before `scf_principles` is
inserted, and codify the schema drift between local baseline and prod by adding
the missing `scf_principles_domain_code_fkey` plus three drifted columns
(`scf_domains.principles`, `scf_controls.evidence_requests`,
`scf_evidence_request_list.scf_control_mappings`) to local migrations.

## Context Files

- [x] `lib/scf/writer.ts` — writer ordering bug
- [x] `lib/scf/writer.test.ts` — new ordering assertion (TDD)
- [x] `scripts/wipe-scf-data.sql` — confirms `scf_domains` is wiped by TRUNCATE
- [x] `supabase/migrations/20250731000000_create_scf_baseline.sql` — baseline
      where the FK should have been declared (line 93)
- [x] `supabase/migrations/20260512130000_add_scf_principles_domain_code_fkey.sql`
      — new forward migration, idempotent
- [x] `supabase/migrations/20260512140000_add_scf_writer_drift_columns.sql`
      — `ADD COLUMN IF NOT EXISTS` for three columns the writer/seeder send
      that prod's baseline never received. Idempotent. Applied to prod via
      Supabase MCP before commit; the local commit catches up fork-clones.

## Constraints

- No `--no-verify`, no `SKIP_SPEC_CHECK=1`.
- TDD: failing test first, fix second, green together.
- Idempotent migration: must no-op on prod (where the FK already exists).
- Blast radius ≤ 15 staged files.

## Scope

### In scope

- Reorder `writeParsedSCF` so domains upsert precedes principles insert.
- Add `tables.indexOf("scf_domains.upsert") < tables.indexOf("scf_principles.insert")`
  assertion to `writer.test.ts`.
- Add forward migration to define `scf_principles_domain_code_fkey` so
  fork-clone schemas match prod.
- Add forward migration for the three missing columns
  (`scf_domains.principles`, `scf_controls.evidence_requests`,
  `scf_evidence_request_list.scf_control_mappings`) — surfaced by the
  second prod seed:reset attempt (PGRST204) after the FK fix landed.

### Out of scope

- Auditing every other `scf_*` FK for drift (separate triage; task #50 covers
  the broader advisory cleanup).
- Restoring the prod point-in-time snapshot — wipe was intentional; we forward
  through the seed.

## Implementation Plan

1. Add failing ordering test to `writer.test.ts`. Confirm it fails against
   current writer.
2. Move the `scf_domains` upsert block above the `scf_principles` insert block
   in `writer.ts`. Add a comment pointing at the prod incident.
3. Re-run `pnpm test:integration`; expect 67/67.
4. Add `20260512130000_add_scf_principles_domain_code_fkey.sql` with idempotent
   guard.
5. Run `pnpm typecheck && pnpm lint && pnpm test:integration`.
6. Commit and push as `fix/scf-writer-domains-before-principles`.
7. Tell Peter to re-run `ALLOW_PROD_SEED=1 pnpm seed:reset --env-file .env.prod --yes`
   from his working tree.

## Test Plan

- [x] `pnpm test:integration` — 67/67 passing (includes new ordering assertion).
- [x] `pnpm typecheck` — clean.
- [x] `pnpm lint` — clean.
- [ ] Peter re-runs `pnpm seed:reset --env-file .env.prod --yes` against
      `gbnxwsntyzyrpwmjaaqa`; seed completes; verify step within ±1 %.

## Acceptance Criteria

- [x] Writer test asserts domains.upsert precedes principles.insert.
- [x] Writer reorders domains upsert above principles insert.
- [x] Forward migration adds FK idempotently.
- [x] Forward migration adds three drifted columns idempotently and is
      applied to prod via Supabase MCP.
- [ ] Prod seed:reset completes end-to-end (no FK violation, no PGRST204).

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (Peter — fix-forward green light after the FK violation report)
