# Task Spec: GitHub Actions Node 24 action updates

## Metadata

- Date: 2026-06-26
- Owner: Codex
- Status: Done
- Branch: main
- Related issue/PR: https://github.com/p-boaz/graphletter/actions/runs/28259640145

## Goal

Remove the GitHub Actions Node 20 deprecation annotations by updating CI actions to current Node 24-compatible major versions.

## Context Files

- [x] `.github/workflows/ci.yml`
- [x] `plans/archive/task-2026-06-26-github-actions-node24.md`

## Constraints

- Keep the CI job structure and commands unchanged.
- Do not touch application code.
- Verify current action releases before changing versions.

## Scope

### In scope

- Update `actions/checkout`, `actions/setup-node`, and `pnpm/action-setup` versions in CI.
- Run local workflow/spec validation where available.
- Push and confirm GitHub Actions passes without the Node 20 action annotation.

### Out of scope

- Changing Node runtime version.
- Reworking CI job topology.
- Addressing unrelated dependency advisories below the configured audit threshold.

## Implementation Plan

1. Confirm latest action versions from GitHub release metadata.
2. Update `.github/workflows/ci.yml` action references.
3. Run spec/workflow validation.
4. Commit, push, and watch the resulting CI run.

## Test Plan

- [x] `pnpm check:spec`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] GitHub Actions CI passes on `main`

## Acceptance Criteria

- [x] CI passes on `main`.
- [x] The prior Node 20 action deprecation annotation is gone.
- [x] Working tree is clean after push.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved
