# Task Spec: Enhanced Analytics API Product Surface

## Metadata

- Date: 2026-06-26
- Owner: Codex
- Status: Done
- Branch: main
- Related issue/PR: https://github.com/p-boaz/graphletter/issues/32

## Goal

Resolve the enhanced analytics product-surface decision by preserving the actively used enhanced search API and removing unsupported enhanced analytics GET actions that have no UI consumer.

## Context Files

- [x] `app/api/enhanced/search/route.ts`
- [x] `lib/services/enhanced-database-service.ts`
- [x] `lib/types.ts`
- [x] `plans/README.md`
- [x] `plans/task-2026-06-26-enhanced-analytics-surface.md`

## Constraints

- Preserve `POST /api/enhanced/search`, which is used by `components/framework-crosswalk.tsx`.
- Do not add a replacement dashboard or analytics UI in this task.
- Remove unsupported API actions rather than leaving dormant product surface.
- Keep the decision documented in this spec and plan index.

## Scope

### In scope

- Remove unused `GET /api/enhanced/search` actions for dashboard, heatmap, refresh, and analytics.
- Remove now-unused enhanced analytics service methods and related types.
- Confirm no active consumers remain for removed actions.
- Update plan index.

### Out of scope

- New analytics dashboard UI.
- Changes to framework crosswalk/search POST behavior.
- Schema changes.

## Implementation Plan

1. Remove the unused GET handler from `app/api/enhanced/search/route.ts`.
2. Remove unreferenced enhanced dashboard, heatmap, refresh, and analytics methods from `EnhancedDatabaseService`.
3. Remove unreferenced enhanced analytics types from `lib/types.ts`.
4. Verify search still finds no active consumers for removed actions.
5. Run integration, lint, typecheck, build, and spec checks.

## Decision

The supported product surface remains `POST /api/enhanced/search` for controls, crosswalk, and benchmarks. The unused enhanced analytics GET actions are removed instead of shipped, because there is no active UI consumer and issue #27 already removed the dead heatmap component.

## Test Plan

- [x] `pnpm test:integration`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm build`
- [x] `pnpm check:spec`

## Acceptance Criteria

- [x] Unsupported enhanced analytics GET actions are removed.
- [x] Dead enhanced analytics service methods and types are removed.
- [x] Active enhanced POST search behavior remains intact.
- [x] The product-surface decision is documented.
- [ ] GitHub issue #32 is closed after validated changes are pushed.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (active goal: resolve the 21 open GitHub issues one by one)
