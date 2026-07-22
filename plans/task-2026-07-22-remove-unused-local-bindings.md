# Task Spec: Remove unused local bindings flagged by no-unused-vars

## Metadata

- Date: 2026-07-22
- Owner: maintainer-loop (agent)
- Status: Done
- Branch: chore/maintainer-loop/20260722-remove-unused-local-bindings-flagged-by-no-unused-vars-39-warning-lint-debt-continuation-of-pr-47
- Related issue/PR: continuation of PR #47

## Goal

Delete dead local bindings that `pnpm lint:full` flags via `@typescript-eslint/no-unused-vars`, continuing the 39-warning lint-debt paydown started in PR #47.

## Context Files

- [x] app/api/reports/compliance/route.ts
- [x] lib/ai/testing/mock-model.ts
- [x] lib/compliance/impact-previewer.ts
- [x] lib/database/paged-select.test.ts
- [x] lib/reports/compliance-report-generator.ts

## Constraints

- Pure deletions of unused bindings only — no behavior changes.
- Same shape as already-merged PR #47.

## Scope

### In scope

- Removing unused bindings: `_opts`/`_provider`/`_model` (mock-model), `_err` (impact-previewer), `frameworkId` (report generator), `_from`/`_to` (paged-select test), unused binding in compliance report route.

### Out of scope

- Any other lint categories or refactors.

## Implementation Plan

1. Delete each unused binding flagged by `no-unused-vars` in the files above.
2. Run the verify gate.

## Test Plan

- [x] `pnpm lint` passes.

## Acceptance Criteria

- [x] Flagged `no-unused-vars` warnings for the listed bindings are gone.
- [x] No behavior change (deletions only).

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [ ] Human approved (PR review is the approval gate — do NOT auto-merge)
