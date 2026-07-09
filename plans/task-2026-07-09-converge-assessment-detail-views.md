# Task Spec: Converge the two assessment-detail presentations into one design

## Metadata

- Date: 2026-07-09
- Owner: agent
- Status: Done
- Branch: refactor/converge-assessment-detail-views
- Related issue/PR: Frontend-design vetting pass, 2026-07-09

## Goal

The same objective-level assessment data renders through two unrelated designs: the upload-flow detailed view (`assessment-review-dialog/detailed-view.tsx`: tinted green/blue labeled boxes, figure-wrapped quotes) and the Assessment Results detail dialog (`assessment-results-display/control-detail-dialog.tsx`: neutral cards, bold inline labels, cleaner typography). Converge on one shared presentation — the control-detail-dialog treatment is the better baseline — so a user never sees the same result restyled between surfaces.

## Context Files

- [ ] components/assessment-review-dialog/detailed-view.tsx
- [ ] components/assessment-review-dialog/index.tsx
- [ ] components/assessment-review-dialog/types.ts
- [ ] components/assessment-results-display/control-detail-dialog.tsx
- [ ] components/assessment-results-display/types.ts
- [ ] components/assessment-results-display/utils.ts

## Constraints

- One shared objective-detail component consumed by both dialogs; data-shape differences get normalized at the call sites, not by forking the view.
- The review dialog's extra affordances (approve/reject context, "Back to summary") stay in the review dialog shell — only the objective-list body is shared.
- Sequence this AFTER (or together with) status-color-system, ai-text-neutral-ink, and remove-system-jargon to avoid churn — the shared component should be born meeting those specs.
- Respect import boundaries: the shared piece lives under `components/`, importing only `lib/` and `components/ui/`.

## Scope

### In scope

- Extract an `ObjectiveAssessmentList` (working name) component: objective ID + status pill, objective text, AI reasoning, verified evidence quotes with captions.
- Both dialogs render it; delete the duplicated markup from each.
- Verified evidence quotes keep blockquote treatment (this becomes the seat for the evidence-specimen-signature spec later).
- Maturity/rationale summary blocks: if both surfaces show them, share them too; otherwise leave in the review dialog.

### Out of scope

- The evidence-specimen visual signature itself (separate spec; this one just creates the single home for it).
- The Assessment Results list rows (assessment-list-cleanup spec).
- Changing which data the API returns.

## Implementation Plan

1. Diff the data consumed by both views; define the normalized prop type.
2. Build the shared component starting from the `control-detail-dialog` presentation.
3. Swap it into both dialogs; delete dead markup and now-unused utils.
4. Reconcile `data-testid`s so existing Playwright specs keep passing (or update the specs deliberately).

## Test Plan

- [ ] `pnpm lint`, `pnpm typecheck` clean.
- [ ] `pnpm test:ui:bg` on upload/review and assessment-results specs.
- [ ] Manual dogfood: view GOV-01 detail via the upload flow and via Assessment Results → identical rendering.

## Acceptance Criteria

- [ ] Objective-level detail markup exists in exactly one component.
- [ ] Both entry points render visually identical objective lists for the same data.
- [ ] No orphaned styles/utils from the removed fork remain.

## Approval Gate

- [ ] Goal is clear
- [ ] Context files listed
- [ ] Constraints explicit
- [ ] Test plan defined
- [ ] Acceptance criteria measurable
- [ ] Human approved
