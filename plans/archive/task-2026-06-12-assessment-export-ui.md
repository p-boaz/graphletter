# Task Spec: Wire assessment export to the UI

## Metadata

- Date: 2026-06-12
- Owner: agent (Claude Code), approved by Peter
- Status: Done (2026-06-12)
- Branch: feat/assessment-export-ui
- Related issue/PR: issue #12; finishes the feature deferred by
  `plans/task-2026-06-04-assessment-export.md`

## Goal

Finish the half-shipped export feature: the tested CSV/JSON serializers in
`lib/assessments/export.ts` have zero production callers. Add the data
loader, an export API route, and a download control on the assessments page.

## Context Files

- [ ] `lib/assessments/load-export-records.ts` — new. Loads a user's
      completed summary assessments (rows with `metadata.is_summary` or
      `metadata.basic_assessment`, written by
      `lib/ai/assess-evidence/control-assessment.ts:424` /
      `basic-assessment.ts:143`) and maps them to `AssessmentExportRecord`:
  - `objective_results` from `metadata.objective_results` (validated).
  - `overall_confidence`: mean of objective confidences when present,
    else `confidenceLevelToScore(confidence_level)` (existing helper in
    `lib/ai/assess-evidence/utils.ts`).
  - `frameworks`: distinct `scf_frameworks.framework_name` via
    `scf_control_mappings`, chunked + paginated with `paged-select`.
  - Uses `selectAllRows` so exports survive the 1000-row cap.
- [ ] `lib/assessments/load-export-records.test.ts` — new; hermetic tests
      using `lib/testing/fake-supabase.ts` (plan 010's helper).
- [ ] `app/api/assessments/export/route.ts` — new GET route: 401 via the
      `getCurrentUser` null-guard, `format=csv|json` (default csv, else
      400), `Content-Disposition: attachment` with a dated filename,
      errors via `apiError` (`lib/api/error-response.ts`).
- [ ] `components/assessment-export-menu.tsx` — new client component:
      "Export" dropdown (CSV / JSON) using the existing shadcn
      dropdown-menu; fetch → blob → anchor download; sonner toast on
      failure; `data-testid` selectors.
- [ ] `app/dashboard/assessments/page.tsx` — mount the menu in the results
      card header area; hidden/disabled when there are no records.
- [ ] `playwright/tests/assessments.spec.ts` + `playwright/helpers/selectors.ts`
      — extend the existing spec: mocked export responses, click CSV item,
      assert the `download` event fires with the expected filename
      (dogfooding rule: user-visible change exercised in a browser).
- [ ] `plans/README.md` — status row + direction-options cleanup.

## Constraints

- Serializers (`export.ts`) are not modified — they were built for this.
- Import boundaries: route imports `lib/` only; component imports `lib/` +
  `components/ui/` only.
- Export must include data the dashboard can already show (no new
  permissions surface); query is `user_id`-scoped exactly like
  `assessments/history`.
- Empty data still downloads a valid file (header-only CSV / `[]` JSON).
- ≤15 files per commit; lint + typecheck + full test suites clean.

## Scope

### In scope

Loader + route + download UI + tests, per Context Files.

### Out of scope

- Filters (framework/date-range) on the export — v1 exports everything.
- Bulk **import** (separate backlog item).
- XLSX format.

## Implementation Plan

1. Branch `feat/assessment-export-ui` from main.
2. Loader + unit tests (fake-supabase).
3. API route.
4. Export menu component + page wiring.
5. Playwright spec extension; run `pnpm test:ui:bg` on assessments spec.
6. Full validation, review, merge.

## Test Plan

- [x] Unit (fake-supabase): 6 tests — mapping with objective averaging,
      confidence-level fallback, malformed-metadata sanitizing, empty-set
      short-circuit, query-filter capture, error propagation.
- [x] `pnpm test:integration` 166/166 + hermetic run 166/166.
- [x] Playwright assessments spec: mocked-route CSV download with exact
      filename, AND an unmocked end-to-end test (real auth → real loader →
      real DB → CSV header verified from the downloaded file). Full suite
      50/50.
- [x] Manual curl: unauthenticated export → 401 (auth precedes format
      validation, so the 400 path is code-visible but only reachable
      authed).

## Acceptance Criteria

- [x] CSV and JSON downloads work from the assessments page in a real
      browser run (CSV verified end-to-end; JSON shares the same code path
      with serializers already unit-tested).
- [x] `lib/assessments/export.ts` has production callers (route), closing
      issue #12's deferred half.
- [x] All gates green; no out-of-scope file changes.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved — Peter, 2026-06-12 ("go for it on the assessment export UI")
