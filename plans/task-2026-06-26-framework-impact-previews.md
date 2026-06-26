# Task Spec: Multi-Framework Impact Previews

## Metadata

- Date: 2026-06-26
- Owner: Codex
- Status: Done
- Branch: main
- Related issue/PR: https://github.com/p-boaz/graphletter/issues/35

## Goal

Populate remediation impact previews with per-framework score changes for affected controls instead of returning an empty `frameworkImpacts` array.

## Context Files

- [x] `lib/compliance/impact-previewer.ts`
- [x] `lib/compliance/impact-previewer.test.ts`
- [x] `plans/README.md`
- [x] `plans/task-2026-06-26-framework-impact-previews.md`

## Constraints

- Keep the public route response shape stable: `preview.frameworkImpacts` remains an array of score objects.
- Use existing SCF mapping tables (`scf_control_mappings`, `scf_frameworks`) and existing posture scoring semantics.
- Do not add dependencies or schema changes.
- Keep DB reads paginated where result sets can exceed Supabase's default row limit.

## Scope

### In scope

- Fetch framework mappings for controls present in the current preview.
- Calculate current/projected/improvement scores per framework.
- Document the `frameworkImpacts` response contract in source.
- Add focused unit tests for controls mapped to one framework and multiple frameworks.

### Out of scope

- UI changes to render the framework breakdown.
- Persistence of preview results.
- Changes to baseline posture scoring behavior.

## Implementation Plan

1. Add typed mapping/framework rows and helper logic in `impact-previewer`.
2. Compute per-framework subsets from the same current and projected gap rows.
3. Return sorted, non-empty `frameworkImpacts` for frameworks touched by simulated controls.
4. Add test doubles for Supabase query chains and verify one-framework and multi-framework behavior.

## Test Plan

- [x] `pnpm test:integration`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm check:spec`

## Acceptance Criteria

- [x] Impact previews calculate per-framework score changes for affected controls.
- [x] The response contract is documented.
- [x] Tests cover controls mapped to one and multiple frameworks.
- [ ] GitHub issue #35 is closed after validated changes are pushed.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (active goal: resolve the 21 open GitHub issues one by one)
