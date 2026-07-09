# Task Spec: Assessment Results list — one affordance per row, real state indicators, drop chip noise

## Metadata

- Date: 2026-07-09
- Owner: agent
- Status: Done
- Branch: fix/assessment-list-cleanup
- Related issue/PR: Frontend-design vetting pass, 2026-07-09

## Goal

Clean the Assessment Results list rows: every row currently carries both a "View details" button and a chevron for the same action, shows an amber left rail + clock icon regardless of whether the assessment was approved, and repeats an "AI Generated" chip on every row (pure noise when every assessment is AI-generated).

## Context Files

- [ ] components/assessment-results-display/index.tsx
- [ ] components/assessment-results-display/control-row.tsx
- [ ] components/assessment-results-display/utils.ts
- [ ] app/dashboard/assessments/page.tsx

## Constraints

- Row click target should not shrink: make the whole row clickable with one visible affordance (the chevron), or keep the button — not both.
- Review-state must come from real data (approved / awaiting review); if the list doesn't receive that field today, plumb it from the existing assessment records rather than inventing a display-only state.
- Keep `data-testid`s for existing Playwright specs or update the specs in the same change.

## Scope

### In scope

- Remove the duplicate detail affordance; standardize on whole-row click + chevron.
- Left rail + icon reflect review state: awaiting review = amber + clock; approved = green + check (consume the shared status styles from the status-color-system spec).
- Remove the per-row "AI Generated" chip. If provenance matters, state it once in the page subtitle (it already says "View AI assessment results…").
- Row metadata line (date, evidence-file count, maturity level): keep, but confirm each element earns its place — drop the redundant clock icon next to the date if the rail already encodes state.

### Out of scope

- Detail dialog contents (converge-assessment-detail-views spec).
- The explainer banner at the top of the page (fine as is).
- Export button behavior.

## Implementation Plan

1. Determine where review/approval state lives in the fetched assessment data; expose it to `control-row.tsx`.
2. Rework the row: single affordance, state-driven rail/icon, chip removed.
3. Update Playwright specs that clicked "View details".

## Test Plan

- [ ] `pnpm lint`, `pnpm typecheck` clean.
- [ ] `pnpm test:ui:bg` assessment-results specs green.
- [ ] Manual dogfood: approve one assessment, leave another unapproved; the two rows are visually distinguishable and each row has exactly one way to open details.

## Acceptance Criteria

- [ ] One detail affordance per row.
- [ ] Approved and awaiting-review rows render different rails/icons driven by real data.
- [ ] No "AI Generated" chip on rows.

## Approval Gate

- [ ] Goal is clear
- [ ] Context files listed
- [ ] Constraints explicit
- [ ] Test plan defined
- [ ] Acceptance criteria measurable
- [ ] Human approved
