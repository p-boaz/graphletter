# Task Spec: Frontend tone cleanup — round 3 (delete dead components, fix README clone URL, restore Draft banner on legal pages)

## Metadata

- Date: 2026-05-13
- Owner: peter (with claude)
- Status: Done
- Branch: main
- Related issue/PR: follow-up to `plans/task-2026-05-13-tone-cleanup-round-2.md` (commit b5da1af)

## Goal

Three small independent cleanups bundled in one pass:

1. Delete four orphan components (~1,113 LOC of dead code) that have zero importers anywhere in the app.
2. Fix the README's clone URL — it points at the non-existent repo `graphletter-public` instead of `graphletter`.
3. Add a `Draft` badge to the `/privacy` and `/terms` page headings — honest signal that the content is placeholder text, and incidentally repairs the `legal placeholder pages` playwright test that was failing on main.

## Context Files

- [x] components/ai-status-indicator.tsx (deleted)
- [x] components/standards-overview.tsx (deleted)
- [x] components/main-navigation.tsx (deleted)
- [x] components/scf-import.tsx (deleted)
- [x] README.md
- [x] app/privacy/page.tsx
- [x] app/terms/page.tsx
- [x] playwright/tests/onboarding-funnel.spec.ts (no edits — its assertion already covers the new banner)

## Constraints

- Only delete components verified to have zero importers across `app/`, `components/`, and `lib/`. Confirmed via grep on both filename and exported symbol.
- Keep the Draft badge visually small and unobtrusive. Reuse the existing amber/yellow palette and `rounded-full` chip pattern used elsewhere on the site (e.g. status badges on `/research`).
- The legal-page descriptor sentence ("Last updated: 2026-05-09") gains one more sentence noting the draft status — so the badge isn't a meaningless decoration.

## Scope

### In scope

- Delete the four named components.
- Clone URL fix in README quickstart.
- Visible Draft badge + clarifying sentence on `/privacy` and `/terms`.

### Out of scope

- Fleshing out the privacy/terms content into real legal text (genuine legal review is a separate, larger task).
- README tone tweak ("not a checkbox survey") — Peter opted to leave that.
- Other potentially-dead code that wasn't explicitly verified in this pass.

## Implementation Plan

1. `git rm` four orphan component files.
2. Edit `README.md:54-55` — replace `graphletter-public` with `graphletter` in clone URL and `cd` line.
3. Wrap each legal-page `<h1>` in a flex row that also renders a small amber `Draft` chip with `data-testid="legal-draft-badge"`. Expand the existing one-line "Last updated" sentence with ". This is a working draft and not yet reviewed legal text."

## Test Plan

- [x] `pnpm lint` clean.
- [x] `pnpm typecheck` clean.
- [x] `pnpm exec playwright test --grep "loads with 200 and shows draft banner|per-page titles are distinct"` — 3/3 pass (legal-placeholder tests were failing on main before this change).
- [x] `grep -rn AIStatusIndicator\|StandardsOverview\|MainNavigation\|ScfImport` returns no hits in app source.

## Acceptance Criteria

- [x] Four `components/*.tsx` files gone; no remaining import of their exported symbols anywhere in app code.
- [x] README quickstart copy-paste lands at the real repo.
- [x] `/privacy` and `/terms` render a visible `Draft` chip next to the page title and an explanatory sentence.
- [x] Pre-existing `legal placeholder pages` playwright failures now pass.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (Peter: "do #1+#2+#3")
