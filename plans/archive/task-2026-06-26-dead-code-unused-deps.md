# Task Spec: Dead Code and Unused Dependency Cleanup

## Metadata

- Date: 2026-06-26
- Owner: Codex
- Status: Done
- Branch: main
- Related issue/PR: https://github.com/p-boaz/graphletter/issues/27

## Goal

Remove confirmed unused UI code and its unused charting dependency while keeping the active enhanced analytics API surface intact for the separate product decision tracked in issue #32.

## Context Files

- [x] `components/coverage-heatmap.tsx`
- [x] `components/ui/chart.tsx`
- [x] `next.config.mjs`
- [x] `package.json`
- [x] `pnpm-lock.yaml`
- [x] `plans/README.md`
- [x] `plans/archive/task-2026-06-26-dead-code-unused-deps.md`

## Constraints

- Do not remove API code that is still tracked by issue #32.
- Do not add a permanent audit dependency unless the repo needs it after this cleanup.
- Preserve intentionally dynamic or framework entry points.
- Keep the cleanup bounded to files proven unused by search/audit.

## Scope

### In scope

- Run a current dead-code/unused dependency audit.
- Remove `components/coverage-heatmap.tsx` if still unreferenced.
- Remove `components/ui/chart.tsx` if still unreferenced.
- Remove `recharts` and its Next.js optimize-package import if no active code imports it.
- Update the plan index.

### Out of scope

- Deciding whether enhanced heatmap API actions should ship or be removed.
- Broad unused export cleanup beyond confirmed dead files and dependency.
- UI redesign or analytics product changes.

## Implementation Plan

1. Run a current search/audit for the known unused files and `recharts`.
2. Delete confirmed unused component files.
3. Remove `recharts` from dependencies and lockfile.
4. Remove `recharts` from `next.config.mjs` optimized package imports.
5. Update plan index and validation proof.

## Audit Evidence

- `pnpm dlx knip --reporter compact` reported `components/coverage-heatmap.tsx`, `components/ui/chart.tsx`, and `recharts` as unused.
- `rg "recharts|coverage-heatmap|CoverageHeatmap|components/ui/chart|ChartContainer|ChartTooltip" -n .` found no active UI imports after cleanup; remaining `FrameworkCoverageHeatmap` references are API/service/type code tracked by issue #32.

## Test Plan

- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm build`
- [x] `pnpm test:ui:bg playwright/tests/critical-path.spec.ts`
- [x] `pnpm check:spec`

## Acceptance Criteria

- [x] Current audit/search confirms removed files and dependency are unused.
- [x] Confirmed unused files, exports, and dependency entries are removed.
- [x] Active enhanced analytics API code remains untouched for issue #32.
- [x] Lint, typecheck, build, UI, and spec checks are green.
- [x] GitHub issue #27 is closed after validated changes are pushed.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (active goal: resolve the 21 open GitHub issues one by one)
