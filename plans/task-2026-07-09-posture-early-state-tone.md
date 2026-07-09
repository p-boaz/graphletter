# Task Spec: Early-state tone for Compliance Posture — starting line, not report card

## Metadata

- Date: 2026-07-09
- Owner: agent
- Status: Draft
- Branch: feat/posture-early-state-tone
- Related issue/PR: Frontend-design vetting pass, 2026-07-09

## Goal

Stop punishing new accounts with walls of red. A user two uploads in currently sees ~25 identical rows of red "0.0%", "997 Missing" in red, a red "0.3%" score, and an Overview that says "3 Fully Covered" directly above "0% Coverage". Reframe the zero/near-zero state as a starting line with a next action, fix the floor-rounding contradiction, sort progress to the top, and make the sparse trend chart read as "early days" instead of broken.

## Context Files

- [ ] app/dashboard/compliance-posture/page.tsx
- [ ] app/dashboard/page.tsx
- [ ] components/dashboard/first-run-hero.tsx
- [ ] components/dashboard/empty-tab-state.tsx
- [ ] components/next-upload-suggestion.tsx

## Constraints

- Do not fake progress or hide true numbers — the counts stay; the framing, color spend, and ordering change.
- Red is reserved for regressions and failures after this change, not for "not started yet". "No evidence yet" is neutral (slate), not red.
- Reuse the existing next-best-action machinery (`next-upload-suggestion`) rather than building a new recommendation source.

## Scope

### In scope

- Coverage percentage floor-rounding: anywhere a non-zero covered count would display "0%", display "<1%" instead (Overview "0% Coverage" under "3/1468", posture score displays). One shared formatter.
- Domain Breakdown rows at 0%: neutral styling (slate percentage, empty progress track), red only for domains that have failing evidence. Sort rows by coverage descending so the user's actual progress is visible first, then alphabetical.
- The "standard" chip on every domain row: the page subtitle claims "Critical areas count more toward your overall score than routine ones", yet every row is tagged "standard" — either surface real weight tiers with distinct labels, or remove the chip and the claim until weights differ.
- Top stat cards: "997 Missing / No evidence" becomes neutral informational, not red; pair the number with the single highest-impact next upload (from next-upload-suggestion) so the page always offers an action.
- Posture Trend chart sparse state: with <3 points, replace the floating-dash line rendering with an explicit early state ("2 snapshots so far — the trend fills in as assessments complete") and give the chart a visible baseline/axis so it doesn't read as broken.
- Dashboard Coverage Breakdown "1465 No Evidence" red tile: same neutral treatment.

### Out of scope

- Changing the posture-score formula or weights.
- The Analytics page's duplicate domain table (analytics-dedup spec).
- Status colors on assessment results (status-color-system spec).

## Implementation Plan

1. Add a shared `formatCoveragePercent(covered, total)` that returns "<1%" for 0 < x < 1, used by Overview and Posture.
2. Restyle domain rows: neutral zero-state, semantic red only on actual failures; implement coverage-desc sort.
3. Resolve the "standard" chip contradiction (surface real tiers or remove; check `lib/services/compliance-calculator.ts` for whether weight tiers exist in data).
4. Rework top stat cards with neutral palette + embedded next-action.
5. Add the sparse-data branch to the trend chart.
6. Screenshot before/after; verify against the dataviz skill's guidance if charts change materially.

## Test Plan

- [ ] `pnpm lint`, `pnpm typecheck` clean.
- [ ] Playwright: posture page renders with a fresh QA account (near-zero data) without any element carrying a red/danger class for zero-progress rows; "<1%" appears when covered > 0.
- [ ] Manual dogfood on the QA account: posture page reads as actionable; trend chart shows early state; Overview no longer contradicts itself.

## Acceptance Criteria

- [ ] "3 Fully Covered" never coexists with "0% Coverage" (shows "<1%").
- [ ] Zero-progress domains render without red; the only red on the page marks true failures/regressions.
- [ ] Domains with any progress sort above untouched domains.
- [ ] The "standard" chip either shows real differentiated tiers or is gone.
- [ ] Trend chart with <3 points shows a deliberate early state, not disconnected marks.

## Approval Gate

- [ ] Goal is clear
- [ ] Context files listed
- [ ] Constraints explicit
- [ ] Test plan defined
- [ ] Acceptance criteria measurable
- [ ] Human approved
