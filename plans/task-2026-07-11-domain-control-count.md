# Task Spec: Populate scf_domains.control_count (currently 0 for every domain)

## Metadata

- Date: 2026-07-11
- Owner: agent (Claude), pending Peter's approval
- Status: Draft
- Branch: fix/domain-control-count
- Related issue/PR: surfaced during PR #46 live-proof (see PR comment thread)

## Goal

`scf_domains.control_count` is 0 for all domains in prod — and was 0 before the
2026.2 reseed too (verified against the pre-reseed pg_dump). Make the column
carry real per-domain control counts, or consciously remove it.

## Root cause

Two parser paths create domain objects:

- `lib/scf-parser.ts:657` (controls-CSV path) computes real counts:
  `domain.controlCount = controls.filter((c) => c.domain === domain.name).length`
- `lib/scf-parser.ts:1065` (Domains-and-Principles-CSV path) hardcodes
  `controlCount: 0`

The seeder writes domains from the **principles path** (writer upserts
`parseResult.domains`, sourced from `Domains and Principles.csv`), so the
hardcoded 0 is what lands in the database. The computed counts from the
controls path never reach the writer. No app code currently reads
`control_count` (repo-wide grep: only the writer's camelCase→snake_case
mapping at `lib/scf/writer.ts:85` touches it).

## Decision required

- **Option A (recommended): populate it.** Before the domain upsert in the
  seed flow, set each domain's `controlCount` from the parsed controls. Match
  on domain **id** (`extractDomainId`), not display name — the two CSVs are
  not guaranteed to agree on name spelling/casing.
- **Option B: drop it.** Remove the column via migration plus the writer
  field. Only right if we're sure no UI will ever want per-domain counts
  (domain cards on the frameworks/docs surfaces are a natural consumer, which
  is why A is recommended).

## Context Files

- [ ] lib/scf/writer.ts
- [ ] lib/scf-parser.ts
- [ ] lib/scf/writer.test.ts
- [ ] scripts/seed-all.ts (only if the count-injection point lands there)

## Constraints

- No schema change under Option A.
- Prod values fix themselves on the next reseed; until then run the one-off
  backfill (below) if the column gains a consumer.
- Commit gates per AGENTS.md (lint, typecheck, ≤15 files).

## Scope

### In scope

1. Compute per-domain control counts from parsed controls keyed by domain id.
2. Inject counts into the domain objects the writer upserts.
3. Writer test asserting a known domain upserts with `control_count > 0`.
4. One-off prod backfill (run after merge, or wait for next reseed):

   ```sql
   update scf_domains d set control_count = c.n
   from (select domain_id, count(*) n from scf_controls group by domain_id) c
   where c.domain_id = d.id;
   ```

### Out of scope

- Any UI consuming the count (separate task once data is honest).
- Backfilling historical imports.

## Implementation Plan

1. Create branch; get spec approved.
2. Implement count injection at the seed-flow seam (prefer `writer.ts` where
   both `parseResult.controls` and `parseResult.domains` are in hand).
3. Extend `writer.test.ts`.
4. `pnpm test:scf && pnpm typecheck && pnpm lint`.
5. Local rehearsal: `pnpm seed && pnpm seed:verify`, then
   `select name, control_count from scf_domains order by 1` shows real counts.
6. PR; after merge run the backfill SQL against prod (or note that the next
   reseed covers it).

## Test Plan

- [ ] `writer.test.ts`: domain upsert carries computed `control_count`
- [ ] Local seed: all 23 domains have `control_count > 0`; sum equals
      `select count(*) from scf_controls`
- [ ] `pnpm test:scf` / `typecheck` / `lint` green

## Acceptance Criteria

- [ ] Local (and after backfill, prod) `scf_domains.control_count` sums to the
      `scf_controls` row count; Quantum Security shows 34
- [ ] No remaining hardcoded `controlCount: 0` that reaches the writer

## Approval Gate

- [ ] Goal is clear
- [ ] Context files listed
- [ ] Constraints explicit
- [ ] Test plan defined
- [ ] Acceptance criteria measurable
- [ ] Human approved
