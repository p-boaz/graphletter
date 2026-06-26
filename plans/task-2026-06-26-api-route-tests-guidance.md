# Task Spec: API Route Tests and Guidance Effort Guard

## Metadata

- Date: 2026-06-26
- Owner: Codex
- Status: Done
- Branch: main
- Related issue/PR: https://github.com/p-boaz/graphletter/issues/23

## Goal

Add representative hermetic route-level API tests and fix the guidance cache effort guard so invalid cached effort values cannot leak through the public response.

## Context Files

- [x] `app/api/compliance/gap-guidance/route.ts`
- [x] `lib/compliance/gap-guidance-route.ts`
- [x] `tests/api-gap-guidance-route.test.ts`
- [x] `lib/compliance/guidance-generator.ts`
- [x] `lib/compliance/guidance-generator.test.ts`
- [x] `plans/README.md`
- [x] `plans/task-2026-06-26-api-route-tests-guidance.md`

## Constraints

- Keep tests hermetic; no real Supabase or AI provider calls.
- Preserve the existing public route response shape.
- Keep route injection local to the tested route instead of introducing a broad route framework.
- Return sanitized errors for unexpected route failures.

## Scope

### In scope

- Add route-level tests covering authentication, validation, success, and sanitized error responses for `POST /api/compliance/gap-guidance`.
- Add the explicit `isValidEffort()` guard for guidance cache reads.
- Update the existing guidance-generator tests to assert invalid cached effort defaults safely.
- Update the plan index.

### Out of scope

- Exhaustive coverage for every `app/api` route.
- New API behavior or response fields.
- Real Supabase or AI provider integration tests.

## Implementation Plan

1. Add a small injectable handler factory for the gap-guidance route tests.
2. Add hermetic route tests using fake dependencies.
3. Add `isValidEffort()` to validate cached guidance effort before returning it.
4. Update the stale characterization test to assert the fixed behavior.
5. Run integration, lint, typecheck, and spec checks.

## Test Plan

- [x] `pnpm test:integration`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm check:spec`

## Acceptance Criteria

- [x] Representative route-level tests cover auth, validation, success, and sanitized errors.
- [x] `pnpm test:integration` runs the new route tests without real Supabase or AI calls.
- [x] Cached guidance effort is constrained to `low`, `medium`, or `high`.
- [ ] GitHub issue #23 is closed after validated changes are pushed.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (active goal: resolve the 21 open GitHub issues one by one)
