# Task Spec: Upload And Results Accessibility

## Metadata

- Date: 2026-06-26
- Owner: Codex
- Status: Done
- Branch: main
- Related issue/PR: https://github.com/p-boaz/graphletter/issues/18

## Goal

Improve keyboard navigation, accessible naming, and non-color status semantics
for the core upload to assessment-results flow.

## Context Files

- [x] `components/smart-evidence-upload/upload-form.tsx`
- [x] `components/smart-evidence-upload/upload-results-view.tsx`
- [x] `components/assessment-results-display/control-row.tsx`
- [x] `playwright/tests/upload.spec.ts`
- [x] `playwright/tests/assessments.spec.ts`
- [x] `playwright/helpers/selectors.ts`
- [x] `plans/task-2026-06-26-upload-results-accessibility.md`

## Constraints

- Keep changes scoped to the existing upload and results UI.
- Prefer semantic labels and keyboard handlers over new dependencies.
- Preserve existing mocked Playwright flows.
- Track any residual accessibility findings as follow-up GitHub issues.

## Scope

### In scope

- Upload dialog keyboard and accessible name improvements.
- Results row keyboard behavior when rows are clickable.
- Verdict/status labels that are not color-only.
- Playwright coverage for keyboard navigation and semantic status text.

### Out of scope

- Full site-wide accessibility audit.
- Visual redesign of the upload/results surfaces.
- Adding a new accessibility scanner dependency.

## Implementation Plan

1. Add explicit accessible names and disabled state semantics to the dropzone and
   file input.
2. Add accessible labels to results filter and row action controls.
3. Make clickable assessment rows keyboard-focusable and activatable with Enter
   or Space.
4. Render visible verdict labels in result rows so status is not conveyed by
   color alone.
5. Add Playwright assertions for keyboard-opening upload, result semantics, and
   keyboard-opening assessment details.

## Test Plan

- [x] Run `pnpm test:ui:bg playwright/tests/upload.spec.ts`.
- [x] Run `pnpm test:ui:bg playwright/tests/assessments.spec.ts`.
- [x] Run `pnpm check:spec`.
- [x] Run `pnpm lint`.
- [x] Run `pnpm typecheck`.

## Acceptance Criteria

- [x] Upload dialog entry and file-drop target have keyboard and screen-reader
      semantics.
- [x] Assessment rows that open details are keyboard-focusable and open by Enter
      or Space.
- [x] Verdict status is visible as text, not only color/icon styling.
- [x] Any residual findings are tracked or explicitly recorded as none found.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved
