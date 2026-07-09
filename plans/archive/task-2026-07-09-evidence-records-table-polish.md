# Task Spec: Evidence Records table polish — explain the dot, retire the dead Type column

## Metadata

- Date: 2026-07-09
- Owner: agent
- Status: Done
- Branch: fix/evidence-records-table-polish
- Related issue/PR: Frontend-design vetting pass, 2026-07-09

## Goal

Small clarity fixes on the Evidence Records table: an unexplained green dot precedes every file name; the "Type" column reads "document" on every row (zero information as long as only documents exist); and the row's only action is an unlabeled eye icon.

## Context Files

- [ ] app/dashboard/evidence/page.tsx

## Constraints

- Keep the table dense; no redesign — remove/annotate, don't add.
- The status-pill iconography itself (Approved/Under Review) is owned by task-2026-07-09-status-color-system; don't double-touch.

## Scope

### In scope

- Green dot: determine what it encodes (likely upload/processing health). If it duplicates the Status column, remove it; if it encodes something distinct, give it an accessible label (`sr-only` text + tooltip) and a legend.
- Type column: remove while all values are "document"; reintroduce only when a second evidence type ships. If the column is load-bearing for future types, replace the value with the human artifact-derived type.
- Eye action: add an accessible name ("View evidence details") and a tooltip; confirm the whole row is clickable if that's the intent.

### Out of scope

- Bulk import flow, search/filter behavior.
- Status colors/icons (status-color-system spec).

## Implementation Plan

1. Trace the green dot's data source in `app/dashboard/evidence/page.tsx`; decide remove vs label per Scope.
2. Drop the Type column; adjust column widths.
3. Label the eye action; verify keyboard focus and row-click behavior.
4. Update Playwright specs touching the table structure.

## Test Plan

- [ ] `pnpm lint`, `pnpm typecheck` clean.
- [ ] `pnpm test:ui:bg` evidence-page specs green.
- [ ] Manual dogfood: table communicates file, artifact, controls, status, date, action — nothing unexplained.

## Acceptance Criteria

- [ ] No visual element in the table lacks an accessible name or discernible meaning.
- [ ] No column where every cell holds the same constant value.

## Approval Gate

- [ ] Goal is clear
- [ ] Context files listed
- [ ] Constraints explicit
- [ ] Test plan defined
- [ ] Acceptance criteria measurable
- [ ] Human approved
