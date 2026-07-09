# Task Spec: State each fact once — remove duplicated banners and contradictory counters in the upload/review flow

## Metadata

- Date: 2026-07-09
- Owner: agent
- Status: Draft
- Branch: fix/dedupe-repeated-statements
- Related issue/PR: Frontend-design vetting pass, 2026-07-09

## Goal

Remove the double- and triple-statements of the same fact within single viewports of the upload → assess → review flow, including one pair of counters that actively contradict each other during assessment progress ("Assessing GOV-01… (1/1)" beside "0/1").

## Context Files

- [ ] components/smart-evidence-upload/index.tsx
- [ ] components/smart-evidence-upload/upload-results-view.tsx
- [ ] components/smart-evidence-upload/assessment-progress-view.tsx
- [ ] components/assessment-review-dialog/index.tsx
- [ ] components/assessment-review-dialog/summary-view.tsx

## Constraints

- Pure removal/consolidation; no new UI elements. Each removed element's information must remain present exactly once on the same surface.
- Keep `data-testid` hooks used by Playwright; move them to the surviving element where needed.

## Scope

### In scope

- Upload dialog: title "Smart Evidence Upload & Assessment" is immediately followed by a brain-icon hero banner restating "Upload evidence / Select the type of document…". Remove the hero banner; keep the one-line instruction as the dialog description under the title.
- Progress view: progress is stated three times with conflicting numbers — header "Assessing GOV-01… (1/1)", right-side counter "0/1", footer "0 of 1 controls complete" plus a duplicate "Assessing GOV-01… (1/1)" line. Keep ONE progress statement (bar + "0 of 1 controls complete") and one current-item line; make the numerator semantics consistent (in-progress item is not "1/1" complete).
- Post-approve view: green banner "This upload advanced 43 frameworks" (with chips) sits directly above a purple box "43 frameworks advanced" (same chips). Keep one — recommend folding the chips into the green success banner and deleting the purple box.
- Review dialog: title "Assessment Review Required" + amber banner "Review Required" + sub-line "Please review the AI assessment results before finalizing" say one thing three times. Keep the title and one instruction line; delete the banner.
- Confidence stated as both a pill ("90% Confidence") and prose ("…passed with 90% average confidence") in the same card: keep the pill, drop the prose repetition ("12/22 objectives passed" stays).

### Out of scope

- The plural/spacing string fixes (dashboard-copy-plural-spacing spec) — coordinate merge order to avoid conflicts.
- Toast-vs-banner double confirmation on upload success (keep the toast; if the banner also announces success, that is in scope to consolidate here).

## Implementation Plan

1. For each surface, list current statements of each fact and choose the survivor (per Scope).
2. Delete duplicates; migrate any `data-testid` and aria labels to survivors.
3. Fix the progress numerator logic in `assessment-progress-view.tsx` (current item index vs completed count).
4. Update Playwright specs asserting on removed elements.

## Test Plan

- [ ] `pnpm lint`, `pnpm typecheck` clean.
- [ ] `pnpm test:ui:bg` upload + review specs green.
- [ ] Manual dogfood of the full upload → assess → approve loop: at no point do two elements on screen state the same fact, and progress numbers never contradict.

## Acceptance Criteria

- [ ] Upload dialog shows the instruction once.
- [ ] During assessment, exactly one progress indicator is visible and its numbers are internally consistent.
- [ ] The frameworks-impact fact appears exactly once post-approve.
- [ ] The review dialog states "review required" once.

## Approval Gate

- [ ] Goal is clear
- [ ] Context files listed
- [ ] Constraints explicit
- [ ] Test plan defined
- [ ] Acceptance criteria measurable
- [ ] Human approved
