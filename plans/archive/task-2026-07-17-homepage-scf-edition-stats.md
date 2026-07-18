# Task Spec: Homepage hero derives SCF edition + catalog stats from seed snapshot

## Metadata

- Date: 2026-07-17
- Owner: agent (Claude Code), executing under Peter's blanket "fix end to end, merge to prod" grant (2026-07-17)
- Status: Approved
- Branch: fix/homepage-scf-edition-stats
- Related issue/PR: follow-up to the SCF 2026.2 migration (PRs #46, #51–#54)

## Goal

The prod homepage still announces "SCF 2026.1.1", "79 frameworks", "1,468 controls", and
"34,619 cross-framework links" — all pre-migration hardcoded literals in `app/page.tsx` —
even though the deployed backend serves the 2026.2 catalog (81 supported frameworks,
1,534 controls, 32,646 mappings). Replace the literals with values derived from the
committed seed snapshot so this class of drift cannot recur.

## Context Files

- [x] app/page.tsx — three stale spots: HERO_STATS block, "Edition 2026.1.1" eyebrow, hero paragraph ("1,468 controls … 76 more"), specimen header "SCF 2026.1.1"
- [x] data/seed/expected_row_counts.json — canonical committed snapshot (scfVersion 2026.2; scf_frameworks 81; scf_controls 1534; scf_control_mappings 32646), regenerated+committed on every SCF bump via scripts/snapshot-row-counts.ts
- [x] lib/scf/catalog-stats.ts — NEW: exports SCF_EDITION / FRAMEWORK_COUNT / CONTROL_COUNT / CROSSWALK_COUNT + formatter, sourced from the snapshot
- [x] lib/scf/catalog-stats.test.ts — NEW: drift tripwires (snapshot ↔ generated framework columns ↔ framework manifest)
- [x] playwright/helpers/selectors.ts — add public.heroStats testid
- [x] playwright/tests/public-pages.spec.ts — new landing-hero test

## Constraints

- Public copy states only what the serving path actually has (the PR #49 truth-line rule).
- `lib/` must not import `components/` or `app/`; page imports lib — allowed.
- Homepage is a server component, so importing the snapshot JSON does not grow client bundles.
- Number formatting pinned to en-US so server locale can never change rendered copy.

## Scope

### In scope

The four files above plus this spec. All user-facing 2026.1.1 / stale-count strings on the homepage.

### Out of scope

- Historical comments citing "1,468" in lib/graph/control-id-resolver.ts and
  lib/compliance/posture-scorer.ts — accurate records of the QA 2026-07-09 bug at the
  then-current catalog size; code already paginates correctly.
- app/layout.tsx meta description ("60+" durable floor — intentionally version-proof).
- lib/research/research-topics.ts + lib/how-it-works/glossary.ts hardcoded 81s (client
  bundles; already correct; each carries a source comment).

## Implementation Plan

1. Add `lib/scf/catalog-stats.ts` deriving the four values from `data/seed/expected_row_counts.json`.
2. Add `lib/scf/catalog-stats.test.ts`: FRAMEWORK_COUNT === SUPPORTED_FRAMEWORK_COUNT
   (generated columns) === framework-manifest `summary.imported`; SCF_EDITION ===
   manifest `provenance.scfVersion`; formatter output shape.
3. Rewrite the stale spots in `app/page.tsx` to render from the module; add
   `data-testid="hero-stats"` to the stats rail.
4. Add Playwright coverage: hero shows the derived edition + framework count; the string
   "2026.1.1" appears nowhere on the landing page.

## Test Plan

- [x] `pnpm lint` clean
- [x] `pnpm typecheck` clean
- [x] `pnpm test:scf` green
- [x] `pnpm test:integration` green (picks up the new lib test)
- [x] `pnpm test:ui:bg playwright/tests/public-pages.spec.ts` green
- [x] `pnpm build` green

## Acceptance Criteria

- [x] Landing page renders "2026.2", "81", "1,534", "32,646" — no "2026.1.1" anywhere.
- [x] All four hero values + eyebrow + hero paragraph + specimen header come from the
      snapshot-derived module; zero hardcoded catalog numbers remain in app/page.tsx.
- [x] A future SCF bump that regenerates the manifest without re-snapshotting row counts
      (or vice versa) fails `pnpm test:integration`.
- [x] Live prod homepage shows the 2026.2 stats after merge + deploy.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved — Peter, 2026-07-17: "do the whole fix end to end … get into prod without any delay or asking me. go all the way to the end"
