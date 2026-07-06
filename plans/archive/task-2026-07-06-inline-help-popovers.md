# Task Spec: Convert dialog helper-text links to in-place help popovers

## Metadata

- Date: 2026-07-06
- Owner: agent (Claude Code), approved by Peter
- Status: Done
- Branch: fix/inline-help-popovers
- Related issue/PR: TBD (PR on completion)

## Goal

Helper-text links inside open dialogs (e.g. "See how artifacts map to controls" in the upload
dialog) currently navigate to `/docs#...`, closing the dialog and destroying in-progress work.
Replace them with in-place popovers that show the same explainer content without navigation.

## Context Files

- [ ] `components/inline-help.tsx` (NEW — shared popover component)
- [ ] `components/smart-evidence-upload/upload-form.tsx` (1 link)
- [ ] `components/assessment-results-display/control-row.tsx` (3 links + 1 tooltip-nested link)
- [ ] `components/assessment-review-dialog/detailed-view.tsx` (3 links)
- [ ] `components/auth/auth-form.tsx` (Terms / Privacy links)
- [ ] `playwright/tests/upload.spec.ts` (asserts old navigation behavior)
- [ ] `playwright/helpers/selectors.ts` (if selector rename needed)
- [ ] `lib/compliance/inbox-generator.ts` (SPEC EXPANSION 2026-07-06: pre-existing
      duplicate-inbox-item bug — gap rows can repeat a control id, producing duplicate
      React keys (`missing-AAT-01`) and duplicate visible inbox cards. Surfaced by the
      updated upload spec's browser-failure gate because the test now stays on the
      dashboard instead of navigating away. Fixed by deduplicating gaps per control id.)

## Constraints

- No copy changes: popover content comes from the existing glossary entries in
  `lib/content/compliance-explainer.ts` (ids `artifacts-and-controls`, `assessment-objectives`,
  `result-states` — the same ids as the docs anchors), so there is a single source of truth.
- Trigger text stays identical to the current link text; visual style stays link-like.
- Keep existing `data-testid`s stable where tests reference them.
- Popover (click-to-open), not hover tooltip: works on touch, holds still while reading,
  and can contain the escape-hatch docs link.
- Escape-hatch "Full docs" link inside each popover opens `/docs#<id>` in a new tab.
- Page-level helper links (dashboard, empty states, analytics) are explicitly untouched —
  navigating from a page is expected behavior.

## Scope

### In scope

1. New `InlineHelp` component (`components/inline-help.tsx`).
2. The 7 glossary-backed dialog links listed in Context Files.
3. `control-row.tsx:445` "How It Works" link (nested inside the maturity tooltip):
   add `target="_blank"` — the tooltip already contains the in-place summary; nesting a
   popover inside a tooltip is fragile.
4. `auth-form.tsx` Terms/Privacy: add `target="_blank" rel="noopener noreferrer"` — legal
   pages must remain real pages; new tab preserves the half-completed signup form.
5. Playwright spec updates for the changed behavior.

### Out of scope

- All page-level (non-dialog) helper links.
- Any copy or docs-page changes.
- `FieldHelpTooltip` (existing icon-trigger tooltip) stays as-is.

## Implementation Plan

1. Build `InlineHelp`: client component, `Popover` from `components/ui/popover`;
   props `termId` + `children` (+ optional `data-testid`); looks up the glossary entry by id,
   renders term, plain definition, "In Graphletter" definition, and a new-tab "Full docs" link.
2. Replace the 7 links in the three dialog components; drop unused `Link` imports.
3. `target="_blank"` for the maturity-tooltip link and the auth Terms/Privacy links.
4. Update `upload.spec.ts` "artifact mapping link" test: click now opens a popover with the
   glossary content and does NOT navigate; dialog remains open.
5. Run validation: `pnpm lint`, `pnpm typecheck`, `pnpm test:ui:bg` for affected specs.

## Test Plan

- [ ] `pnpm lint` clean
- [ ] `pnpm typecheck` clean
- [ ] `playwright/tests/upload.spec.ts` updated and green: clicking the artifact-mapping
      trigger opens a popover (content visible), URL unchanged, dialog still open
- [ ] Full `pnpm test:ui:bg` pass (no regressions in other specs)
- [ ] Browser dogfood: exercise upload dialog + assessment review dialog popovers in dev

## Acceptance Criteria

- [ ] No `<Link href="/docs#...">` remains inside dialog-rendered components
      (`upload-form.tsx`, `control-row.tsx`, `detailed-view.tsx`) except new-tab escape hatches
- [ ] Clicking any converted trigger keeps the dialog open and URL unchanged
- [ ] Popover shows the same definitions the docs page renders for that term
- [ ] Signup form content survives clicking Terms/Privacy (new tab)
- [ ] All validation commands pass; commit ≤ 15 files

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved ("go ahead", 2026-07-06)
