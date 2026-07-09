# Task Spec: One status color system for assessment and evidence states

## Metadata

- Date: 2026-07-09
- Owner: agent
- Status: Draft
- Branch: feat/status-color-system
- Related issue/PR: Frontend-design vetting pass, 2026-07-09

## Goal

Define a single semantic color scale for assessment/evidence states and apply it everywhere, ending the current drift: PARTIAL renders amber in the review dialog but red in the detailed view, PASS is a black pill while green decorates info boxes, FAIL and PARTIAL are visually identical in the detailed view, and the "Approved" evidence pill carries a clock (pending-semantics) icon.

## Context Files

- [ ] components/assessment-review-dialog/utils.ts
- [ ] components/assessment-review-dialog/summary-view.tsx
- [ ] components/assessment-review-dialog/detailed-view.tsx
- [ ] components/assessment-results-display/utils.ts
- [ ] components/assessment-results-display/control-row.tsx
- [ ] components/assessment-results-display/control-detail-dialog.tsx
- [ ] components/assessment-results-display/index.tsx
- [ ] app/dashboard/evidence/page.tsx
- [ ] components/ui/badge.tsx (variant additions, if used)

## Constraints

- One source of truth: a `statusBadge(status)` map (label, icon, classes) exported from a single module — proposed `lib/ui/status-styles.ts` is NOT allowed by import boundaries if it must import components; keep it a pure class-name/token map in `lib/` or colocate in `components/ui/status-badge.tsx`.
- Semantic colors are reserved for status after this change: green = pass/approved, amber = partial/under review, red = fail/missing, slate = neutral/pending. Decorative use of these hues in adjacent info boxes must not be introduced here (removal of existing decorative green/blue is the neutral-ink spec).
- No new dependencies.

## Scope

### In scope

- PASS: green pill (currently black in both detail views).
- PARTIAL: amber pill everywhere (currently amber in review dialog, red in detailed view).
- FAIL: red pill (must be visually distinct from PARTIAL).
- Evidence statuses: "Approved" gets a check icon and green treatment (currently gray pill with clock icon); "Under Review" keeps amber with clock.
- Confidence percentage pills: neutral (outline/slate), so they stop competing with status colors (currently solid black, the strongest element in every row).
- The unexplained badge stack on control rows (e.g. "90%" black + "L3" outline + "PARTIAL" amber): order and style them by one rule — status pill first (semantic color), then confidence (neutral), then maturity level (neutral); add `title`/tooltip text naming each ("Confidence", "Maturity level").

### Out of scope

- Copy changes to status labels.
- The amber-rail + clock icon on Assessment Results list rows regardless of approval state (covered by assessment-list-cleanup spec).
- Recoloring long-form text (neutral-ink spec).

## Implementation Plan

1. Inventory every status→class mapping in the context files (grep `PARTIAL`, `PASS`, `FAIL`, `Approved`, `Under Review`, `confidence`).
2. Create the shared status-badge component/map with the four semantic states + neutral variants for confidence and maturity.
3. Replace all local mappings with the shared one; delete dead local color logic.
4. Verify no remaining hard-coded `bg-red|amber|green` tied to status in the context files.

## Test Plan

- [ ] `pnpm lint`, `pnpm typecheck` clean.
- [ ] Playwright: update/extend an existing assessment-results spec to assert the PARTIAL badge carries the amber class token in BOTH the review dialog and the detailed view (regression against re-drift).
- [ ] Manual dogfood: run one assessment; view the same GOV-01 result in (a) review dialog, (b) upload-flow detailed view, (c) Assessment Results detail dialog, (d) Evidence Records; confirm identical status colors in all four.

## Acceptance Criteria

- [ ] A given status renders the same color, icon, and casing on every surface.
- [ ] PASS is green; FAIL and PARTIAL are visually distinguishable at a glance.
- [ ] "Approved" no longer shows a clock icon.
- [ ] Exactly one module defines status→style mapping; no component defines its own.

## Approval Gate

- [ ] Goal is clear
- [ ] Context files listed
- [ ] Constraints explicit
- [ ] Test plan defined
- [ ] Acceptance criteria measurable
- [ ] Human approved
