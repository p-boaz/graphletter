# Task Spec: Analytics page — remove duplication with Posture, fix level-distribution bars, retire the purpose box

## Metadata

- Date: 2026-07-09
- Owner: agent
- Status: Draft
- Branch: fix/analytics-dedup
- Related issue/PR: Frontend-design vetting pass, 2026-07-09

## Goal

Analytics currently re-renders the Compliance Posture domain breakdown with full multi-sentence SCF description paragraphs per row — the longest text wall in the app — while its "Purpose of this page" box (plus the Overview's mirrored "Use this page for… / Use Analytics for…" copy) papers over the unclear split between the two pages. Additionally, the Control Maturity "Level Distribution" bars render near-full width for every level regardless of count, which reads as a data bug. Make Analytics earn its tab: drill-down and exports, no duplicated tables, honest charts.

## Context Files

- [ ] app/dashboard/analytics/page.tsx
- [ ] app/dashboard/compliance-posture/page.tsx
- [ ] app/dashboard/page.tsx

## Constraints

- No loss of information: SCF domain descriptions remain reachable (tooltip/expand), just not rendered as always-open paragraphs.
- Chart fixes follow the dataviz skill guidance (read it before touching chart code).
- Keep CSV/JSON export features intact.

## Scope

### In scope

- SCF Domain Coverage table: collapse the per-domain description paragraphs to a single-line truncation with expand-on-demand (or an info tooltip); keep the numeric columns. Where the table duplicates the Posture page's domain breakdown, differentiate: Analytics keeps the full numeric drill-down (fully/partially/no-evidence/conflicting columns), Posture keeps the scored summary — and each page links to the other instead of repeating it.
- Level Distribution chart: bar length must be proportional to count (0 renders as empty track, not a full bar); add count labels; verify against real data where counts are 0/1/4.
- Remove the "Purpose of this page" box; fold any load-bearing sentence into the page subtitle. Remove the Overview's mirrored "Use Analytics for…" meta-copy in the same pass (one subtitle each is enough).
- Zero-heavy cells: render zeros in muted ink so non-zero values stand out (consistent with posture-early-state-tone spec).

### Out of scope

- The posture page's own row styling/sort (posture-early-state-tone spec).
- New analytics features or metrics.
- Export format changes.

## Implementation Plan

1. Audit which columns/facts appear on both Analytics and Posture; assign each fact one home per Scope.
2. Implement description truncation/expand in the domain table.
3. Fix the level-distribution bar width computation; add labels.
4. Delete the purpose box and the Overview meta-copy paragraphs; add cross-links.

## Test Plan

- [ ] `pnpm lint`, `pnpm typecheck` clean.
- [ ] `pnpm test:ui:bg` analytics/dashboard specs updated and green.
- [ ] Manual dogfood: Analytics page height drops substantially; level bars visibly differ for counts 0 vs 1 vs 4; no paragraph walls.

## Acceptance Criteria

- [ ] No SCF domain description renders fully expanded by default.
- [ ] Each domain-coverage fact has exactly one home (Analytics or Posture), with cross-links.
- [ ] Level-distribution bars are proportional to their counts.
- [ ] No "Purpose of this page" box; no duplicated page-routing meta-copy on Overview.

## Approval Gate

- [ ] Goal is clear
- [ ] Context files listed
- [ ] Constraints explicit
- [ ] Test plan defined
- [ ] Acceptance criteria measurable
- [ ] Human approved
