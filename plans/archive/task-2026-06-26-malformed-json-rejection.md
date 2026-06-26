# Task Spec: Reject malformed JSON request bodies consistently

## Metadata

- Date: 2026-06-26
- Owner: codex
- Status: Done (2026-06-26)
- Branch: main
- Related issue/PR: https://github.com/p-boaz/graphletter/issues/29

## Goal

Return an explicit 400 response when JSON API routes receive malformed request
bodies, while preserving route-specific validation for valid empty objects.

## Context Files

- [x] `app/api/analysis/run-gap-analysis/route.ts`
- [x] `app/api/compliance/gap-remediation/route.ts`
- [x] `app/api/controls/build-coverage/route.ts`
- [x] `app/api/documents/[id]/extract-evidence/route.ts`
- [x] `app/api/progress/session/route.ts`
- [x] `app/api/progress/session/[sessionId]/route.ts`
- [x] `lib/api/`
- [x] `tests/`
- [x] `plans/README.md`

## Constraints

- Do not change successful request behavior.
- Do not treat valid empty JSON objects as malformed.
- Keep error responses sanitized and consistent with existing API error helpers.
- Do not introduce new runtime dependencies.

## Scope

### In scope

- Add a small shared request-body parser for JSON API routes.
- Replace current `request.json().catch(() => ({}))` behavior in critical API routes.
- Add integration tests proving malformed JSON returns 400 before route work.
- Update the plan index to include this active task.

### Out of scope

- Refactoring all API route validation.
- Changing client response parsing.
- Adding UI behavior.

## Implementation Plan

1. Add a shared helper that parses JSON and returns a consistent 400 response
   for malformed bodies.
2. Update affected routes to use the helper and preserve existing validation for
   valid empty objects.
3. Add integration tests for malformed and empty-object request bodies.
4. Run targeted tests plus lint and typecheck.

## Test Plan

- [x] `pnpm test:integration`
- [x] `pnpm lint`
- [x] `pnpm typecheck`

## Acceptance Criteria

- [x] Malformed JSON returns a consistent 400 response.
- [x] Empty but valid objects retain route-specific validation behavior.
- [x] Critical routes have tests proving malformed bodies cannot trigger work.
- [x] GitHub issue #29 is closed after validation passes.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (active goal: resolve the 21 open GitHub issues one by one)
