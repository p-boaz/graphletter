# Task Spec: Remove unused imports and unused local bindings flagged by no-unused-vars

## Metadata

- Date: 2026-07-11
- Owner: maintainer-loop (agent)
- Status: Done
- Branch: chore/maintainer-loop/20260711-remove-unused-imports-and-unused-local-bindings-flagged-by-no-unused-vars
- Related issue/PR: PR to be opened by maintainer-loop

## Goal

Delete dead code flagged by `@typescript-eslint/no-unused-vars`: six pure unused imports/type aliases and one unused logger binding. Pure deletion — no runtime behavior change.

## Context Files

- [x] app/api/controls/build-coverage/route.ts
- [x] app/api/evidence/reindex-content/route.ts
- [x] components/assessment-results-display/control-row.tsx
- [x] components/demo-smart-evidence-upload.tsx
- [x] components/smart-evidence-upload/upload-form.tsx
- [x] hooks/use-toast.ts

## Constraints

- Deletions only; no refactors, no renames, no logic changes.
- Verify gate must pass before commit.

## Scope

### In scope

- Removing unused imports, unused type aliases, and one unused local logger binding flagged by no-unused-vars.

### Out of scope

- The remaining no-unused-vars warnings (35 of 42) that are not pure deletions.
- Any other lint categories.

## Implementation Plan

1. Run `pnpm lint`, collect no-unused-vars warnings.
2. Delete only bindings that are provably unreferenced.
3. Verify with `pnpm typecheck`.

## Test Plan

- [x] `pnpm typecheck` passes.
- [x] Lint warning count for no-unused-vars drops from 42 to 35.

## Acceptance Criteria

- [x] Only deletions in the diff (2 insertions are import-line reflows).
- [x] Typecheck passes.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [ ] Human approved (PR review is the approval gate — do NOT auto-merge)
