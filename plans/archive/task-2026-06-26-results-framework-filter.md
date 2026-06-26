# Task Spec: Results Framework Filter

## Metadata

- Date: 2026-06-26
- Owner: Codex
- Status: Done
- Branch: main
- Related issue/PR: https://github.com/p-boaz/graphletter/issues/16

## Goal

Add a client-side framework selector to the upload assessment results view so users can scope displayed control verdicts to one mapped framework while keeping All frameworks as the default.

## Context Files

- [x] `app/api/controls/framework-impact/route.ts`
- [x] `components/smart-evidence-upload/upload-results-view.tsx`
- [x] `playwright/helpers/mocks.ts`
- [x] `playwright/tests/upload.spec.ts`
- [x] `plans/README.md`
- [x] `plans/archive/task-2026-06-26-results-framework-filter.md`

## Constraints

- Keep filtering client-side after the existing framework-impact fetch.
- Preserve the current All frameworks default.
- Avoid a new API route or heavy state abstraction.
- Keep existing upload assessment rendering behavior unchanged when no framework data is available.

## Scope

### In scope

- Include framework-mapped control IDs in the existing framework-impact API response.
- Add a compact framework selector to the upload results view.
- Filter displayed assessment cards by the selected framework's mapped control IDs.
- Add Playwright coverage for All frameworks and one framework-specific filter.
- Update plan index.

### Out of scope

- Server-side filtering of assessment results.
- Filtering other assessment history surfaces.
- Schema changes.

## Implementation Plan

1. Extend `/api/controls/framework-impact` to return sorted control IDs for each impacted framework.
2. Add framework filter state and selector in `UploadResultsView`.
3. Pass filtered assessments into `AssessmentResultsDisplay`.
4. Update upload workflow mocks to include two framework mappings.
5. Add Playwright assertions for default All frameworks and a single-framework filter.
6. Run the targeted UI spec plus lint, typecheck, and spec checks.

## Test Plan

- [x] `pnpm test:ui:bg playwright/tests/upload.spec.ts`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm check:spec`

## Acceptance Criteria

- [x] All frameworks is the default and shows all result controls.
- [x] Selecting a framework hides controls that do not map to it.
- [x] Filtering is client-side after the results view loads.
- [x] GitHub issue #16 is closed after validated changes are pushed.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (active goal: resolve the 21 open GitHub issues one by one)
