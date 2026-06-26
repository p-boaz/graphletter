# Task Spec: Expose custom-control mapping method metadata

## Metadata

- Date: 2026-06-26
- Owner: codex
- Status: In Progress
- Branch: main
- Related issue/PR: https://github.com/p-boaz/graphletter/issues/28

## Goal

Make `/api/ai/custom-control-mapping` responses explicitly distinguish AI model
success from keyword fallback behavior with stable structured metadata.

## Context Files

- [x] `app/api/ai/custom-control-mapping/route.ts`
- [x] `tests/`
- [x] `plans/README.md`

## Constraints

- Keep the existing response shape compatible by adding fields, not removing or
  renaming current fields.
- Do not require live Supabase, auth, rate-limit, or AI provider calls in tests.
- Keep logging through the existing logger.

## Scope

### In scope

- Add stable `method` and `source` metadata to successful route responses.
- Ensure logs can distinguish model success from keyword fallback.
- Add route-level tests for both AI success and fallback paths through an
  injectable route handler core.
- Update the plan index while active.

### Out of scope

- Changing matching quality or prompt behavior.
- Refactoring other AI routes.
- Adding UI display for the metadata.

## Implementation Plan

1. Extract a small dependency-injected handler core for the route.
2. Add additive method/source fields to the response data for AI and fallback paths.
3. Include method/source in success and fallback logs.
4. Add hermetic tests for both route branches.
5. Run integration tests, lint, typecheck, and spec checks.

## Test Plan

- [x] `pnpm test:integration`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm check:spec`

## Acceptance Criteria

- [x] AI-success responses include stable structured method/source metadata.
- [x] Keyword-fallback responses include stable structured method/source metadata.
- [x] Logging and monitoring can distinguish model success from fallback behavior.
- [x] Existing clients remain compatible through additive response fields.
- [ ] GitHub issue #28 is closed after validation passes.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (active goal: resolve the 21 open GitHub issues one by one)
