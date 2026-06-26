# Task Spec: Durable Demo Quotas

## Metadata

- Date: 2026-06-26
- Owner: Codex
- Status: Done
- Branch: main
- Related issue/PR: https://github.com/p-boaz/graphletter/issues/24

## Goal

Move unauthenticated `/try` demo quota tracking from per-process memory to Supabase so quota enforcement is shared across serverless instances and atomic under concurrent requests.

## Context Files

- [x] `lib/demo/demo-quota.ts`
- [x] `lib/demo/demo-quota.test.ts`
- [x] `app/api/try-it-out/demo/route.ts`
- [x] `app/api/try-it-out/demo/quota/route.ts`
- [x] `supabase/migrations/20260626170000_create_demo_quota_hits.sql`
- [x] `plans/README.md`
- [x] `plans/archive/task-2026-06-26-durable-demo-quotas.md`

## Constraints

- Keep the public API response shape unchanged.
- Do not expose raw IP addresses in the quota table.
- Use service-role server-side access only; no client-visible Supabase access.
- Keep consumption atomic inside the database.

## Scope

### In scope

- Add a durable quota-hit table with cleanup indexes.
- Add an atomic `consume_demo_quota` database function.
- Update `getDemoQuota` and `consumeDemoQuota` to use Supabase.
- Add hermetic integration tests for peek, consume, limit, and error behavior.
- Run migration checks.

### Out of scope

- Changing the quota limit or window.
- User-account quota behavior.
- Production dashboard configuration.

## Implementation Plan

1. Add an idempotent migration for `demo_quota_hits` and `consume_demo_quota`.
2. Replace the in-memory map with a service-role Supabase implementation.
3. Hash IP-derived quota keys before persistence.
4. Add fake-client tests covering peek, successful consume, limit rejection, cleanup calls, and database errors.
5. Update plan index and validation proof.

## Validation Notes

- `pnpm schema:drift:check` exited successfully in non-strict mode, but skipped the local shadow database because Docker is not running in this environment.

## Test Plan

- [x] `pnpm test:integration`
- [x] `pnpm schema:migrations:check`
- [x] `pnpm schema:drift:check`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm check:spec`

## Acceptance Criteria

- [x] Quota state uses shared Supabase storage instead of process memory.
- [x] Demo run consumption is atomic under concurrent requests.
- [x] Expired quota rows are cleaned up.
- [x] Existing demo quota behavior has integration coverage.
- [x] GitHub issue #24 is closed after validated changes are pushed.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (active goal: resolve the 21 open GitHub issues one by one)
