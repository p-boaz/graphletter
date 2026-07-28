# Task Spec: Remove unused \_request parameter from AI-provider-health GET route

## Metadata

- Date: 2026-07-28
- Owner: maintainer-loop (agent)
- Status: Done
- Branch: chore/maintainer-loop/20260728-remove-unused-request-parameter-from-ai-provider-health-get-route
- Related issue/PR: continuation of the lint-debt paydown (PRs #47, #52)

## Goal

Delete the unused `_request: NextRequest` parameter from the AI-provider-health GET route handler — the repo's only remaining `no-unused-vars` warning.

## Context Files

- [x] app/api/admin/ai-provider-health/route.ts

## Constraints

- Pure deletion of an unused parameter (and its now-unused type import) — no behavior changes.
- Next.js route handlers accept zero-arg GET, so the deletion is purely mechanical.

## Scope

### In scope

- Removing `_request: NextRequest` from `GET` in app/api/admin/ai-provider-health/route.ts and dropping the `NextRequest` type import.

### Out of scope

- Any other lint categories or refactors.

## Implementation Plan

1. Delete the unused parameter and the now-unused `NextRequest` type import.
2. Run the verify gate.

## Test Plan

- [x] `pnpm lint` passes.

## Acceptance Criteria

- [x] The `no-unused-vars` warning for `_request` is gone.
- [x] No behavior change (deletion only).

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [ ] Human approved (PR review is the approval gate — do NOT auto-merge)
