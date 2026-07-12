# Task Spec: Stage 7 — First Cohort Promotion (FedRAMP, GovRAMP, NIST profiles)

## Metadata

- Date: 2026-07-11
- Owner: agent (Claude Code), reviewed by Peter
- Status: Awaiting approval — implementation prepared on branch for PR review
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
- [ ] `tests/framework-cohort1-fixtures.test.ts` — NEW: semantic mapping fixtures (see Test Plan)
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
- **Production reseed happens only after merge**, with a fresh pg_dump backup
  first (see Production ceremony). Shared prod/dev DB — reseed is
  prod-affecting (memory `graphletter-prod-ops`).

## Scope

### In scope

1. Overrides visibility flip (15 keys) + manifest regeneration.
2. Hardcoded framework-count copy updates (glossary, research topics, CLAUDE.md).
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

## Rollback boundary

- **Before merge**: close the PR; nothing has touched production.
- **After merge, before prod reseed**: production still serves the old 66
  (DB unchanged; deployed copy strings read "81" ahead of the data — revert
  the merge commit if the reseed is postponed materially).
- **After prod reseed**: revert the merge commit → `pnpm manifest:generate` →
  backup → `pnpm seed:reset` restores exactly the prior 66/25,736 state (the
  seed pipeline is deterministic from CSVs + manifest). The pre-reseed
  pg*dump (`~/Backups/graphletter-prod-stage7-<ts>.dump`, `pg_dump -Fc`) is
  the belt-and-suspenders restore path for non-seed tables (customer rows
  FK-ing into `scf*\*`are wiped by`TRUNCATE … CASCADE` — see SEEDING.md
  Safety).

## Production ceremony (post-merge, operator: Peter or agent with release authority)

1. `pg_dump -Fc` backup to `~/Backups/graphletter-prod-stage7-<ts>.dump`
   (convention: memory `scf-data-pipeline`; psql/pg_dump via
   `PATH="/opt/homebrew/opt/libpq/bin:$PATH"`).
2. Merge deploys the copy + manifest; then `pnpm seed:reset` (reads
   `.env.local`, typed hostname confirmation) → wipe + reseed + verify.
3. Live proof on production: `/docs` truth line (81), `/frameworks` list shows
   cohort with "Supported" badges, one FedRAMP + one GovRAMP + one NIST detail
   page (range labels, two identical paginated API walks, search narrowing),
   `/api/scf/stats` → 81.
4. Prod Smoke workflow green post-deploy.

## Test Plan

- [ ] `pnpm manifest:check` — byte-fresh after regeneration
- [ ] NEW `tests/framework-cohort1-fixtures.test.ts` — hand-verified mapping triples for FedRAMP High/Low, GovRAMP Moderate/High, NIST 800-82 R3 + CSWP 39 (at minimum); plus per-column identifier-shape assertions
- [ ] `pnpm test:scf` + `pnpm test:integration` — all green (visibility/manifest suites already derive from generated columns; family-bucket stability holds for the 15 new members — verified: NIST names bucket to NIST by name, GovRAMP/FedRAMP to Other both paths)
- [ ] `pnpm lint` && `pnpm typecheck` — clean
- [ ] Sandbox rehearsal measurements within stage-4 thresholds
- [ ] `pnpm seed:verify` green against the re-baselined counts
- [ ] Playwright `public-pages.spec.ts` — count floor + no non-public leakage

## Acceptance Criteria

- [ ] Manifest summary: `imported: 81`; tier counts 81 supported/public, 163 preview/public, 5 preview/non-public, 3 excluded/non-public
- [ ] `MAPPED_FRAMEWORK_COUNT === 81` with no edit to `lib/scf-parser.ts`
- [ ] Zero diff outside: overrides, generated files, 3 copy sites, new fixture test, seed baseline, plans/docs
- [ ] Sandbox: 81 frameworks, 32,646 mapping rows (exact), seed < 120s, crosswalk refresh completes with 0 preview leaks
- [ ] Semantic fixtures pass and were verified against raw CSV cells, not parser output alone
- [ ] Production (post-merge): live proof walk complete, Prod Smoke green

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [ ] Human approved — gate = Peter's PR approval; merge and production reseed remain his calls
