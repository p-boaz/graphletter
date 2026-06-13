# Task Spec: Reconcile backlog and task-plan hygiene

## Metadata

- Date: 2026-06-13
- Owner: codex
- Status: Done (2026-06-13)
- Branch: main
- Related issue/PR: repository maintenance

## Goal

Make the repository's backlog trustworthy: completed work is closed and
archived, active work has a GitHub issue, source TODOs reference an issue, and
`plans/README.md` reflects current state.

## Context Files

- [x] `plans/README.md`
- [x] `plans/task-*.md`
- [x] `plans/archive/`
- [x] `lib/evidence-classification/evidence-classifier.ts`
- [x] `lib/compliance/impact-previewer.ts`
- [x] `app/admin/artifacts/page.tsx`
- [x] GitHub issues in `p-boaz/graphletter`

## Constraints

- Do not change runtime behavior.
- Preserve completed task specs as an audit trail under `plans/archive/`.
- Do not close an issue unless its acceptance criteria are present on `main`.
- Every remaining source TODO must use `TODO(#123)` syntax.
- Avoid duplicate issues by checking the current open backlog first.

## Scope

### In scope

- Correct stale task-spec statuses and archive completed/superseded specs.
- Close completed GitHub issues #12 and #13.
- File issues for untracked items in the audited backlog and source TODOs.
- Replace free-form source TODOs with issue-linked TODOs.
- Rewrite the plan index around current active work and linked backlog.

### Out of scope

- Implementing any newly filed backlog item.
- Changing product behavior, dependencies, schema, or deployment settings.

## Implementation Plan

1. Verify completed work against `main`.
2. Reconcile spec statuses and move completed specs to `plans/archive/`.
3. Close completed issues and file missing issues.
4. Link source TODOs to their issues and refresh `plans/README.md`.
5. Run formatting, lint, typecheck, and targeted consistency scans.

## Test Plan

- [x] No unqualified `TODO`/`FIXME` remains in application source.
- [x] No stale completed plan remains active; this unmerged task is the only
      completed spec still in `plans/`.
- [x] Every previously merged completed or superseded plan is under
      `plans/archive/`.
- [x] `plans/README.md` links the current plan and backlog issues.
- [x] `pnpm lint` and `pnpm typecheck` pass.

## Acceptance Criteria

- [x] GitHub issues #12 and #13 are closed as completed.
- [x] Every previously untracked backlog item has a GitHub issue.
- [x] Stale completed specs no longer report `In Progress` or `Approved`.
- [x] The root `plans/` directory contains only the current unmerged spec, the
      template, and README.
- [x] Repository validation passes.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (user: "fix backlog hygiene", 2026-06-13)
