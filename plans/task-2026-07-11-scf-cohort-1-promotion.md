# Task Spec: Stage 7 — First Cohort Promotion (FedRAMP, GovRAMP, NIST profiles)

## Metadata

- Date: 2026-07-11
- Owner: agent (Claude Code), reviewed by Peter
- Status: Approved (Peter, 2026-07-11) — production ceremony executed; archive after merge
- Branch: feat/scf-cohort-1-promotion
- Related issue/PR: roadmap `plans/scf-catalog-roadmap.md` stage 7 (principle 6: prove the mechanism once, then expand by metadata); builds on PRs #51–#53 and the stage 6 exposure decisions (`task-2026-07-11-scf-exposure-decisions.md`)

## Goal

Promote 15 exposure-cleared frameworks from `preview` → `supported` with full
ceremony, proving the standing promotion mechanism (overrides flip →
`manifest:generate` → reseed, no code change) so every later cohort (stage 8)
is a lightweight reviewed metadata flip. Supported tier grows 66 → 81;
production mapping rows grow 25,736 → 32,646 (+6,910).

## The cohort

| Catalog key                         | Display name             | Mapped cells |
| ----------------------------------- | ------------------------ | ------------ |
| `usa-federal-gsa-fedramp-5-low`     | US FedRAMP R5 (low)      | 383          |
| `usa-federal-gsa-fedramp-5-mod`     | US FedRAMP R5 (moderate) | 491          |
| `usa-federal-gsa-fedramp-5-high`    | US FedRAMP R5 (high)     | 561          |
| `usa-federal-gsa-fedramp-5-li-saas` | US FedRAMP R5 (LI-SaaS)  | 383          |
| `general-govramp`                   | GovRAMP                  | 441          |
| `general-govramp-core`              | GovRAMP Core             | 86           |
| `general-govramp-low`               | GovRAMP Low              | 166          |
| `general-govramp-low-plus`          | GovRAMP Low+             | 230          |
| `general-govramp-mod`               | GovRAMP Moderate         | 347          |
| `general-govramp-high`              | GovRAMP High             | 441          |
| `general-nist-600-1-gen-ai-profile` | NIST AI 600-1            | 139          |
| `general-nist-800-66-r2`            | NIST SP 800-66 R2        | 112          |
| `general-nist-800-82-r3`            | NIST 800-82 R3           | 777          |
| `general-nist-800-172a-r3`          | NIST 800-172A R3         | 163          |
| `general-nist-cswp-39`              | NIST CSWP 39             | 15           |

Counts are the manifest's `mappingCount` (non-empty controls-sheet cells). One
cell can hold several identifiers, so the cohort's 4,735 cells become 6,910
`scf_control_mappings` rows after the parser's newline split.

All 15 are `exposureStatus: public` per the 2026-07-11 exposure review
(`docs/FRAMEWORK_EXPOSURE_REVIEW.md` §3/§4/§5.1) — government publications and
openly downloadable baselines whose identifiers are public-domain citations.

## Context Files

- [ ] `data/framework-manifest.overrides.json` — the only source change: `visibility: "supported"` on the 15 keys
- [ ] `data/framework-manifest.json` — regenerated (`pnpm manifest:generate`)
- [ ] `lib/scf/__generated__/framework-columns.ts` — regenerated; `SUPPORTED_FRAMEWORK_COUNT` (and thus `MAPPED_FRAMEWORK_COUNT`) derives to 81 automatically
- [ ] `lib/how-it-works/glossary.ts` — hardcoded "66" copy → 81 (client-bundle copy of the truth line)
- [ ] `lib/research/research-topics.ts` — hardcoded "66" copy → 81
- [ ] `CLAUDE.md` — "66 mapped frameworks" project blurb → 81
- [ ] `README.md` — the fourth hardcoded copy site ("across 66 frameworks", "maps 66 of them today") → 81 (caught in code review; the "update together" comment sites are: parser-derived docs page + glossary + research topics + AGENTS.md + README)
- [ ] `tests/framework-cohort1-fixtures.test.ts` — NEW: semantic mapping fixtures (see Test Plan)
- [ ] `playwright/tests/public-pages.spec.ts` — NEW stage-7 cohort test (list presence FedRAMP/GovRAMP/NIST ×5, detail badges "Supported")
- [ ] `data/seed/expected_row_counts.json` — re-baselined via `pnpm seed:snapshot` after sandbox seed (`scf_frameworks` 66→81, `scf_control_mappings` 25,736→32,646)
- [ ] `plans/scf-catalog-roadmap.md`, `plans/README.md` — status bookkeeping

## Constraints

- **Zero application-code change** beyond copy strings. If promotion requires
  touching parser/writer/API/UI logic, the stage 3–4 mechanism is broken —
  stop and report rather than patch around it. This constraint IS the point of
  full ceremony: it proves stage 8 can be pure metadata.
- Exposure statuses untouched (visibility and exposure are separate axes,
  roadmap principle 4). The 5 non-public keeps stay non-public preview.
- Generated files change only via `pnpm manifest:generate`; freshness gate
  (`pnpm manifest:check`) must pass.
- "60+" floor copy (app/layout.tsx, demo upload component, Playwright
  public-pages assertion) is still valid at 81 — no change.
- Commit rules: conventional commits, ≤15 files, lint+typecheck clean,
  `Implements: plans/task-2026-07-11-scf-cohort-1-promotion.md`.
- 8 GB machine: sandbox rehearsal runs serially — one local stack, no
  parallel heavy agents, no concurrent build/test fan-out.
- **Production reseed runs from the approved branch BEFORE merge** (ordering
  rationale in Production ceremony), with a fresh pg_dump backup first.
  Shared prod/dev DB — reseed is prod-affecting (memory
  `graphletter-prod-ops`).
- **Destructive-reseed tripwire**: `pnpm seed:reset` TRUNCATEs with CASCADE,
  wiping every row that FKs into `scf_*` tables. The ceremony's step 0 query
  must show zero non-regenerable customer rows or the ceremony ABORTS — see
  "Customer-data blast radius".

## Scope

### In scope

1. Overrides visibility flip (15 keys) + manifest regeneration.
2. Hardcoded framework-count copy updates (glossary, research topics, CLAUDE.md, README.md).
3. Semantic mapping fixtures: hand-verified (control, framework, mapping-ID)
   triples per cohort family, pinned as a regression test (2026-07-10
   scramble-incident lesson: exact cell content per column catches silent
   column shifts that count-based checks miss).
4. Sandbox rehearsal: full local reseed at default (`supported`) scope; verify
   81 frameworks / 32,646 mapping rows; measure against the stage-4 thresholds
   recorded in `plans/archive/task-2026-07-11-scf-catalog-metadata.md`.
5. Seed-verify re-baseline (`pnpm seed:snapshot` from the rehearsed sandbox).
6. PR with full gate results; production ceremony documented below and
   executed post-merge.

### Out of scope

- Promoting anything beyond the 15 (stage 8: standing rollout spec + batches).
- Exposure/licensing changes; the 5 review keeps.
- UI changes — tier badges, pagination, and search shipped in stage 5.
- The May–July wrong-mappings report remediation (separate open thread).

## Implementation Plan

1. Branch `feat/scf-cohort-1-promotion`.
2. Flip `visibility` to `supported` for the 15 keys in
   `data/framework-manifest.overrides.json` (scripted, then diff-reviewed).
3. `pnpm manifest:generate` && `pnpm manifest:check` — expect manifest summary
   `imported: 81`, generated columns byte-fresh.
4. Update the three hardcoded-count copy sites.
5. Write semantic fixtures: for each cohort family, read raw cells from
   `data/controls.csv` by manifest column index (independent of the parser),
   sanity-check the identifiers look like that framework's real citation
   scheme (FedRAMP/GovRAMP → NIST 800-53 control IDs; NIST docs → their own
   section identifiers), then pin parser-output triples in the new test.
6. Run gates: `pnpm test:scf`, `pnpm test:integration` (with `.env.local`
   sourced), `pnpm lint`, `pnpm typecheck`, `pnpm manifest:check`.
7. Sandbox rehearsal (colima + `supabase start` + `db reset` + `pnpm seed` +
   `pnpm seed:verify`): record framework count, mapping rows, seed duration,
   DB size, crosswalk rows (cohort enters the supported-only materialized
   view — expected), API payload/latency; compare to stage-4 thresholds.
   Live-check `/api/scf/frameworks` (81 rows), a cohort detail page,
   tier badge "Supported", pagination determinism (two identical API walks),
   search narrowing.
8. `pnpm seed:snapshot` re-baseline from the green sandbox; re-run
   `pnpm seed:verify` to prove the new baseline.
9. Record rehearsal results in this spec; commit sequence (≤15 files each);
   push; open PR.

## Sandbox rehearsal results (2026-07-11, local stack)

Full reseed at default `supported` scope after `supabase db reset` (all
migrations), on the branch at commit `1d9d6d3`:

| Measurement                       | Result                                          | Stage-4 threshold                   | Verdict |
| --------------------------------- | ----------------------------------------------- | ----------------------------------- | ------- |
| Frameworks imported               | 81 (all supported; 15 cohort members present)   | must equal manifest supported count | ✅      |
| Mapping rows                      | 32,646 — exact match to hand-derived prediction | ±1% of estimate                     | ✅      |
| Seed duration (full pipeline)     | 15.5s wall                                      | < 120s                              | ✅      |
| `scf_control_mappings` size       | 7 MB                                            | < 500 MB                            | ✅      |
| Whole DB size after seed          | 42 MB                                           | < 2 GB                              | ✅      |
| `framework_crosswalk` rows        | 2,729,356 (was 1,698,008 at 66 fw); 0 leaks     | 0 leaks, refresh completes          | ✅      |
| Crosswalk refresh duration        | 41.5s (plain, locking refresh — see ceremony)   | completes                           | ✅      |
| Supported-frameworks SQL query    | 1.0 ms                                          | < 50 ms                             | ✅      |
| Per-cohort DB mapping rows        | all 15 exact matches to hand-counted fixtures   | exact                               | ✅      |
| `pnpm seed:verify` (re-baselined) | 13 tables within ±1%                            | green                               | ✅      |

Old-baseline `seed:verify` failed on exactly `scf_frameworks` (66→81) and
`scf_control_mappings` (25,736→32,646) and nothing else — a clean
demonstration that the drift guard sees precisely this change.

Live API (dev server on the seeded stack): `/api/scf/frameworks` → 81 rows,
cohort served with `visibility: "supported"` + family/kind metadata;
`/api/scf/stats` → 81 frameworks / 32,646 mappings; FedRAMP High detail:
total 791, two full paginated walks byte-identical (determinism), `q=AC-2`
narrows 791 → 31.

Browser (Playwright headless, seeded stack): new stage-7 cohort spec green —
FedRAMP search ≥4 cards, GovRAMP ≥6, cohort detail badge exactly
"Supported", range label rendering; framework-detail pagination spec and
meta-description truth-line spec green. The `public-pages` dogfood test
fails identically on clean `main` against the same stack (attempt 1: dev-mode
duplicate `primary-navigation` node on /docs; retry: the documented /try
upload-button auth flake, memory `scf-data-pipeline`) — pre-existing,
unrelated to this change.

**Verdict: promotion is a pure metadata flip, proven end-to-end in sandbox.**
Zero application-code changes were needed (constraint held); stage 8 can
proceed as batched flips under a standing checklist.

## Rollback boundary

- **Before the prod reseed**: close the PR; nothing has touched production.
  Main's copy, seed baseline, and Playwright expectations all still match the
  66-framework prod state (the 81 versions live only on this branch).
- **After prod reseed, before merge**: prod DB serves 81 while deployed copy
  still reads 66/"60+" (benign undercount; no 404s — the detail API is
  DB-driven). If the merge is abandoned, reseed from `main`'s checkout to
  restore the 66/25,736 state.
- **After merge**: revert the merge commit → `pnpm manifest:generate` →
  backup → `pnpm seed:reset` restores exactly the prior 66/25,736 state (the
  seed pipeline is deterministic from CSVs + manifest). The pre-reseed
  `pg_dump` archive (`~/Backups/graphletter-prod-stage7-<ts>.dump`, taken
  with `pg_dump -Fc`) is the belt-and-suspenders restore path for non-seed
  tables — customer rows with foreign keys into the `scf_*` tables are wiped
  by `TRUNCATE … CASCADE` (see SEEDING.md, Safety).

## Customer-data blast radius (verified live against prod, 2026-07-11)

`pnpm seed:reset` → `TRUNCATE … RESTART IDENTITY CASCADE` recursively clears
every table with an inbound FK to `scf_*` (scripts/wipe-scf-data.sql;
SEEDING.md Safety). Codex review flagged this as a blocker; the live facts:

- FK-dependent customer tables and their prod row counts right now:
  `assessments` 0, `evidence` 0, `evidence_control_map` 0,
  `compliance_drift_events` 0, `control_gap_analysis` **1,534**.
- The 1,534 `control_gap_analysis` rows all belong to boaz@hey.com (dogfood
  account) and are a derived artifact — the run-gap-analysis route
  regenerates them per user on demand (delete by `user_id` + insert). No
  external account holds any FK-dependent row.
- Precedent: the identical ceremony ran against prod on 2026-07-10 for the
  2026.2 upgrade.

So for stage 7 the wipe destroys nothing irreplaceable, and the full-DB
`pg_dump -Fc` taken in step 1 contains `control_gap_analysis` regardless.
**This holds only while prod has no real user data.** Two guards:

1. Ceremony step 0 re-runs the blast-radius query; any non-zero count in a
   non-regenerable table (`assessments`, `evidence`, `evidence_control_map`,
   `compliance_drift_events`) or any `control_gap_analysis` rows owned by a
   non-dogfood user → **ABORT, do not reseed**.

   ```sql
   SELECT 'assessments' t, count(*) FROM assessments
   UNION ALL SELECT 'evidence', count(*) FROM evidence
   UNION ALL SELECT 'evidence_control_map', count(*) FROM evidence_control_map
   UNION ALL SELECT 'compliance_drift_events', count(*) FROM compliance_drift_events;
   SELECT u.email, count(*) FROM control_gap_analysis g
   JOIN auth.users u ON u.id = g.user_id GROUP BY u.email;
   ```

2. **Stage 8 hard precondition**: before any further promotion, build the
   non-destructive additive promotion path (insert missing supported
   frameworks + their mappings; no wipe — a cohort flip never needs to touch
   `scf_controls`). `seed:reset` then remains reserved for SCF version
   upgrades on an empty-of-customers DB. This is recorded in Follow-ups as
   item 3 and must land in the stage 8 spec.

## Production ceremony (operator: Peter or agent with release authority)

Ordering matters: **reseed from the approved branch BEFORE merging.** The
seeders run from the local checkout, not from the deploy, so the DB can lead
the copy. DB-first means the public site briefly undercounts (66/"60+"
alongside an 81-row catalog — benign) instead of overcounting with 404ing
detail pages; it also means `pnpm seed:verify` and the stage-7 Playwright
spec are green from the moment their 81-expectations land on main. Run the
whole ceremony in one sitting after PR approval:

0. **Blast-radius check (ABORT gate)**: run the FK-dependent row-count query
   from "Customer-data blast radius". Non-regenerable customer rows present →
   stop; the non-destructive path (Follow-ups item 3) must be built first.
1. `pg_dump -Fc` backup to `~/Backups/graphletter-prod-stage7-<ts>.dump`
   (convention: memory `scf-data-pipeline`; psql/pg_dump via
   `PATH="/opt/homebrew/opt/libpq/bin:$PATH"`). Full-DB dump — includes the
   `control_gap_analysis` rows the wipe will clear.
2. From the approved branch checkout: `pnpm seed:reset` (reads `.env.local`,
   typed hostname confirmation) → wipe + reseed + verify against the
   re-baselined counts (81 / 32,646).
3. `SELECT refresh_framework_crosswalk();` via psql — the seeder does NOT
   refresh the materialized view. Plain (locking) refresh, ~40–60s at 81
   frameworks: crosswalk reads block for the duration. Expect ~2.73M rows.
4. Merge the PR — deploys the 81 copy over the already-81 DB.
5. Live proof on production: `/docs` truth line (81), `/frameworks` list shows
   cohort with "Supported" badges, one FedRAMP + one GovRAMP + one NIST detail
   page (range labels, two identical paginated API walks, search narrowing),
   `/api/scf/stats` → 81.
6. Re-run the blast-radius query and compare to step 0: the only acceptable
   delta is `control_gap_analysis` (wiped by CASCADE). Regenerate it by
   re-running gap analysis as the dogfood user, or restore that table from
   the step-1 dump.
7. Prod Smoke workflow green post-deploy.

## Test Plan

- [x] `pnpm manifest:check` — byte-fresh after regeneration
- [x] NEW `tests/framework-cohort1-fixtures.test.ts` — hand-verified mapping triples for all 15, exact per-framework row counts, per-column identifier-shape assertions, pinned per-column content hashes (catches sibling-column swaps that triples/counts can't), and a pinned equivalence test for the two byte-identical 2026.2 pairs (FedRAMP Low ↔ LI-SaaS, GovRAMP ↔ GovRAMP High)
- [x] `pnpm test:scf` + `pnpm test:integration` (241/241) — all green (visibility/manifest suites already derive from generated columns; family-bucket stability holds for the 15 new members — verified: NIST names bucket to NIST by name, GovRAMP/FedRAMP to Other both paths)
- [x] `pnpm lint` && `pnpm typecheck` — clean
- [x] Sandbox rehearsal measurements within stage-4 thresholds (see results table)
- [x] `pnpm seed:verify` green against the re-baselined counts
- [x] Playwright `public-pages.spec.ts` — stage-7 cohort + pagination + truth-line specs green (dogfood test fails identically on clean main; pre-existing flake)

## Acceptance Criteria

- [x] Manifest summary: `imported: 81`; tier counts 81 supported/public, 163 preview/public, 5 preview/non-public, 3 excluded/non-public
- [x] `MAPPED_FRAMEWORK_COUNT === 81` with no edit to `lib/scf-parser.ts`
- [x] Zero diff outside: overrides, generated files, 4 copy sites (glossary, research topics, AGENTS.md, README), new fixture test, new Playwright cohort test, seed baseline, plans/docs
- [x] Sandbox: 81 frameworks, 32,646 mapping rows (exact), seed < 120s, crosswalk refresh completes with 0 preview leaks
- [x] Semantic fixtures pass and were verified against raw CSV cells, not parser output alone
- [ ] Production (post-merge): live proof walk complete, Prod Smoke green

## Code-review response (2026-07-11, workflow review at high effort)

10 verified findings; disposition:

- **Fixed on branch**: README.md missed copy site (66→81); merge→reseed
  window resolved by reordering the ceremony to reseed-before-merge (also
  resolves the seed:verify-baseline and Playwright-red-window findings);
  sibling-swap blindness in the fixtures (FedRAMP Low ↔ LI-SaaS and
  GovRAMP ↔ GovRAMP High are byte-identical columns in 2026.2 — no
  discriminating triple exists, so the suite now pins per-column content
  hashes plus an explicit equivalence test that fails if a future release
  differentiates a pair); NIST cohort members now asserted in the Playwright
  spec; rollback-section markdown corruption; spec Context Files omissions.
- **Recorded as follow-ups (would violate this PR's zero-code-change
  constraint)**: see Follow-ups.

## Follow-ups (out of scope here, tracked for stage 8)

1. `/frameworks` list cards render a hardcoded "Active" badge
   (`app/frameworks/page.tsx`) while detail pages render the real tier badge —
   pre-existing list/detail incoherence; fix alongside stage 8 UI touches.
2. Manual copy edits (glossary, research topics, AGENTS.md, README) recur on
   every promotion. Stage 8 spec should have `manifest:generate` emit a tiny
   client-safe count constant that the two lib copy sites import, leaving only
   the markdown blurbs manual — and add a grep-based count-consistency gate.
3. **[BLOCKING for stage 8] Non-destructive promotion path** (Codex review,
   2026-07-11): cohort promotion is purely additive (new framework rows + new
   mapping rows; `scf_controls` untouched), yet the only seeding path today is
   `seed:reset`'s TRUNCATE CASCADE — and plain `pnpm seed` fails against a DB
   with FK-dependent rows (NO ACTION FKs block the writer's
   delete-by-scf-version). Build an additive promote mode (insert missing
   supported frameworks + their mappings, verify counts, no deletes) before
   any promotion after this one; required the moment real user data exists.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved — Peter, 2026-07-11: "You're approved to carry out 1 thru 4 now" (PR approval + ceremony steps 1–4)
