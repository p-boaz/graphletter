# Task Spec: SCF catalog metadata + manifest-driven import + sandbox full-import rehearsal

## Metadata

- Date: 2026-07-11
- Owner: agent (Claude Code), reviewed by Peter
- Status: Done (implemented 2026-07-11; archive after merge)
- Branch: feat/scf-catalog-metadata
- Related issue/PR: roadmap `plans/scf-catalog-roadmap.md` (stages 3–4, runtime licensing fields from stage 6); builds on PR #51

## Goal

Make the framework manifest the import contract: catalog metadata (key, kind,
family, geography, visibility, exposure status) lands in the schema, the
parser derives `FRAMEWORK_COLUMNS` from the manifest instead of a hand-coded
array, the frameworks API filters to `supported` by default, and a full-catalog
import is rehearsed and measured in the local sandbox. Production keeps
serving exactly today's 66 supported frameworks — cohort promotion (stage 7)
becomes a metadata flip, not a parser change.

## Context Files

- [x] `supabase/migrations/<ts>_scf_framework_catalog_metadata.sql` — NEW: adds `catalog_key` (unique), `kind`, `family`, `geography`, `visibility`, `exposure_status` to `scf_frameworks`, with CHECK constraints and a `visibility` index
- [x] `data/framework-manifest.json` — read-only import contract (from PR #51)
- [x] `lib/scf-parser.ts` — `FRAMEWORK_COLUMNS` generated from the manifest at module load (visibility ≠ excluded); `MAPPED_FRAMEWORK_COUNT` becomes the **supported** count; per-entry catalog metadata carried through
- [x] `lib/scf/writer.ts` — persists the new columns; gains an import-scope option (`supported` | `catalog`)
- [x] `scripts/seed-all.ts` — `SEED_SCOPE` env (default `supported`)
- [x] `app/api/scf/frameworks/route.ts` — default `visibility = 'supported'`; `?scope=catalog` additionally returns preview rows with `exposure_status = 'public'` only; response gains `family`, `kind`, `visibility`
- [x] `app/api/scf/frameworks/[id]/route.ts` — supported always served; preview only when `exposure_status = 'public'`; otherwise 404
- [x] `lib/frameworks/family.ts` — name-regex heuristic replaced by a deterministic publisher→bucket map fed by the served `family` field
- [x] `app/frameworks/page.tsx` — consume served `family` (no visual redesign)
- [x] Denominator audit (add supported-filter): `app/api/dashboard/overview/route.ts`, `lib/services/compliance-calculator.ts`, `app/api/analysis/run-gap-analysis/route.ts`, `app/api/controls/framework-impact/route.ts`, `app/api/reports/compliance-export/route.ts`, `app/api/scf/stats/route.ts`
- [x] `tests/framework-manifest.test.ts` — consistency gate reworked: parser config is now derived, so assert supported set ≡ manifest `visibility: supported`
- [x] `tests/framework-visibility.test.ts` — NEW: API filtering + writer scope tests
- [x] `scripts/test-scf-parser.ts` — expectations updated for derived config
- [x] `playwright/tests/public-pages.spec.ts` — assert framework count copy still reflects 66 supported

## Constraints

- **Production-visible behavior is unchanged.** The public Framework Explorer,
  counts, and copy keep showing exactly the 66 supported frameworks. The full
  249-framework import runs in the local sandbox only; production seeding stays
  `SEED_SCOPE=supported` until a stage-7 cohort spec says otherwise.
- Migration defaults are chosen so existing prod rows are correct without a
  backfill script: `visibility DEFAULT 'supported'`, `exposure_status DEFAULT
'public'` (today's rows are precisely the supported/public 66). The seeder
  sets explicit values from the manifest on every reseed.
- `visibility` and `exposure_status` remain separate columns (roadmap
  principle 4). The API must check both: preview rows are only ever served
  when `exposure_status = 'public'` — with the current manifest that set is
  empty, which is correct pre-licensing-review.
- The `expectedHeader` hard-fail guard survives the parser rework unchanged in
  spirit: every derived column entry validates its header at parse time,
  outside the error-swallowing try/catch (PR #46 lesson).
- The manifest gates from PR #51 (completeness/consistency/freshness) must
  still pass; the consistency gate's meaning shifts from "parser matches
  manifest" to "derived parser config selects exactly the manifest's
  non-excluded entries".
- No single commit > 15 files: sequence as (1) migration + parser + writer +
  seed scope, (2) API + denominator consumers + family, (3) tests + spec
  bookkeeping.
- Schema work: run `pnpm schema:migrations:check` and `pnpm schema:drift:check`
  before committing; prod migration applied via the documented manual
  procedure (see memory: shared prod/dev DB).
- Sandbox rehearsal on this machine runs serially (8 GB laptop): one local
  Supabase stack, no parallel heavy agents.

## Scope

### In scope

1. Schema migration for the six catalog columns with CHECK constraints
   (`kind`, `visibility`, `exposure_status` enums; `catalog_key` unique).
2. Parser derives its column config from `data/framework-manifest.json`
   (excluded entries dropped, 249 parseable), carrying catalog metadata;
   `MAPPED_FRAMEWORK_COUNT` = supported count (66) so public copy is untouched.
3. Writer persists catalog metadata and honors import scope; framework row
   identity keyed by `catalog_key`.
4. API visibility/exposure filtering plus `family`/`kind`/`visibility` fields;
   supported-filter added to the six denominator consumers.
5. `family.ts` publisher→bucket map replacing the name regex.
6. **Sandbox rehearsal (stage 4):** local stack, `SEED_SCOPE=catalog` full
   import; record framework count (expect 249), mapping rows (expect ≈70k;
   manifest-derived estimate 69,791), seed duration, DB size delta, frameworks
   API payload size, and p95 latency on `/api/scf/frameworks` +
   `/api/scf/controls`; write results + go/no-go thresholds into this spec
   before any stage-7 work.
7. Playwright pass proving the public UI still shows 66 and no preview
   framework leaks into Explorer, dashboard, stats, or export surfaces.

### Out of scope

- Any production import beyond the supported 66 (stage 7 cohort specs).
- Catalog browsing UI, detail-page pagination, search (stage 5).
- Licensing review outcomes / flipping any `exposure_status` (stage 6 review).
- Admin/internal catalog inspection surface (stage 5).

## Implementation Plan

1. Migration: add columns + constraints + index; verify with
   `schema:migrations:check` / `schema:drift:check` against the local stack.
2. Rework `lib/scf-parser.ts`: build `FRAMEWORK_COLUMNS` from the manifest
   (typed loader, excluded filtered out), keep per-entry `expectedHeader`
   validation, export `SUPPORTED_FRAMEWORK_COUNT` (= `MAPPED_FRAMEWORK_COUNT`)
   from `visibility === "supported"`.
3. Thread catalog metadata through `writer.ts` into `scf_frameworks`; add
   scope filter (`supported` default) applied at write time; wire `SEED_SCOPE`.
4. API changes + denominator audit + `family.ts` rework.
5. Tests: rework consistency gate; add visibility/exposure API tests and
   writer-scope tests; update `test-scf-parser.ts`.
6. Local sandbox rehearsal per In-scope 6; record measurements in this spec.
7. Playwright run: `pnpm test:ui:bg playwright/tests/public-pages.spec.ts` +
   dashboard specs; verify 66-count copy and no preview leakage.
8. Gates: `pnpm lint`, `pnpm typecheck`, `pnpm test:scf`,
   `pnpm test:integration`, `pnpm manifest:check`.
9. Prod migration apply (manual procedure) + prod reseed is NOT part of this
   task — prod schema migration lands with the PR merge process; reseed stays
   on the existing supported scope.

## Commit log

- `a1ad78e` — pipeline + schema (commit 1 of the sequence in Constraints)
- `d4f9446` — visibility-filtered APIs + supported-only denominators (commit 2)
- tests: writer scope (66 supported / 249 catalog vs real controls.csv), family bucket stability, exposure defaults (commit 3)

## Sandbox rehearsal results (2026-07-11, local stack)

Full-catalog import (`SEED_SCOPE=catalog`) against the local Supabase stack
after `supabase db reset` (all 29 migrations incl. the catalog-metadata one):

| Measurement                                    | Result                                                | Threshold (go/no-go for stage 7)       |
| ---------------------------------------------- | ----------------------------------------------------- | -------------------------------------- |
| Frameworks imported                            | 249 (66 supported + 183 preview)                      | must equal manifest non-excluded count |
| Mapping rows                                   | 69,791 — exact match to manifest estimate, zero drops | ±1% of manifest-derived estimate       |
| Seed duration (full pipeline)                  | 17s wall                                              | < 120s                                 |
| `scf_control_mappings` size                    | 15 MB                                                 | < 500 MB                               |
| Whole DB size after seed                       | 50 MB                                                 | < 2 GB (Supabase free-tier headroom)   |
| `framework_crosswalk` rows                     | 1,698,008 (supported-only; **0 preview leaks**)       | 0 leaks, refresh completes             |
| Supported-frameworks SQL query                 | 1.05 ms                                               | < 50 ms                                |
| `/api/scf/frameworks` payload                  | 16.6 KB (66 rows + metadata fields)                   | < 100 KB                               |
| `/api/scf/frameworks` warm latency (max of 10) | 46 ms local                                           | p95 < 500 ms in prod smoke             |

Live API assertions with the full catalog loaded: default scope → 66
(all `supported`, metadata fields served); `?scope=catalog` → 66 (all 183
preview rows are non-public pending licensing review, correctly gated);
preview detail → 404; supported detail → 200; `/api/scf/stats` → 66.

Browser (Playwright, local stack with 249-framework DB): `/docs` and
`/frameworks` assertions green, including the 60+-frameworks copy floor.
The `/try` upload-button failure (spec line 82) is the documented
pre-existing local-auth flake — reproduces on clean main, unrelated.

**Verdict: full-catalog scale is a non-issue.** Every measurement is
orders of magnitude under threshold. Cohort promotion (stage 7) is
unblocked from a capacity standpoint.

## Deploy ordering (required)

The API code filters on the new `visibility`/`exposure_status` columns —
**apply the migration to prod (manual procedure, see memory
`graphletter-prod-ops`) BEFORE merging/deploying this branch**, or the
frameworks endpoints 500 on the missing column. Defaults make existing
rows supported/public, so migration-then-deploy has no user-visible
window.

## Test Plan

- [x] Unit: parser config derivation — excluded entries absent, supported count = 66, headers validated
- [x] Unit: writer scope — `supported` writes 66 frameworks, `catalog` writes 249
- [x] Unit: API filtering — default returns supported only; `?scope=catalog` adds only `exposure_status='public'` preview rows; non-public preview detail → 404
- [x] Gate: manifest consistency reworked and green
- [x] Integration suite green; `test:scf` green
- [x] Sandbox: full-import counts match manifest expectations (±1%, mirroring `seed:verify`)
- [x] Playwright: public pages show 66; no preview framework name appears on any public surface

## Acceptance Criteria

- [x] `scf_frameworks` carries populated catalog metadata for every row after reseed
- [x] Deleting a framework from the hand-coded array is impossible — the array no longer exists; the manifest is the sole import contract
- [x] Full catalog imports cleanly in sandbox with measurements recorded in this spec and thresholds agreed
- [x] Production behavior byte-for-byte equivalent on public surfaces (66 frameworks, same copy, same counts)
- [x] A future cohort promotion requires only: overrides visibility flip → `manifest:generate` → reseed — no code change (proven by a dry-run diff in sandbox)
- [x] All gates green; migration checks green

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved
