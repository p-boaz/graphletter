# Task Spec: CI Workflow Failures

## Metadata

- Date: 2026-06-26
- Owner: Codex
- Status: Done
- Branch: main
- Related issue/PR: GitHub Actions run https://github.com/p-boaz/graphletter/actions/runs/28258449942

## Goal

Fix the two persistent GitHub Actions CI failures: Next.js production build route validation and the production dependency audit gate.

## Context Files

- [x] app/api/admin/artifacts/route.ts
- [x] lib/admin/artifacts-route-handlers.ts
- [x] tests/admin-artifacts-route.test.ts
- [x] package.json
- [x] pnpm-lock.yaml

## Constraints

- Keep App Router route files exporting only valid Next.js route fields.
- Preserve the existing admin artifacts route behavior and tests.
- Fix the `ws` advisory with the smallest safe dependency change.
- Prove the same gates that failed in CI: `pnpm build` and `pnpm audit --audit-level=high --prod`.

## Scope

### In scope

- Move the admin artifacts testable handler factory out of the route module.
- Update tests to import the non-route helper module.
- Add a targeted production dependency override for patched `ws`.
- Refresh the pnpm lockfile.

### Out of scope

- Supabase SDK major/broad upgrade.
- CI workflow restructuring.
- Unrelated dependency advisory cleanup below the CI threshold.

## Implementation Plan

1. Extract admin artifacts handler factory/types into `lib/admin/artifacts-route-handlers.ts`.
2. Update `app/api/admin/artifacts/route.ts` to import the factory and export only route handlers.
3. Update route unit tests to import from the new lib module.
4. Add a pnpm override for vulnerable `ws` ranges and refresh the lockfile.
5. Run focused and CI-equivalent validation.

## Test Plan

- [x] `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=test SUPABASE_SERVICE_ROLE_KEY=test pnpm test:integration tests/admin-artifacts-route.test.ts`
- [x] `pnpm audit --audit-level=high --prod`
- [x] `pnpm build`
- [x] `pnpm check:spec`
- [x] `pnpm lint`
- [x] `rm -rf .next/types && pnpm typecheck`

## Acceptance Criteria

- [x] `pnpm build` no longer fails on invalid route exports.
- [x] `pnpm audit --audit-level=high --prod` passes.
- [x] Admin artifacts route tests still pass.
- [x] CI-equivalent quality gates pass locally.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved
