# Task Spec: Artifact Classifier Eval CI

## Metadata

- Date: 2026-06-26
- Owner: Codex
- Status: Done
- Branch: main
- Related issue/PR: https://github.com/p-boaz/graphletter/issues/14

## Goal

Run the artifact classifier evaluation harness in CI and publish the current headline score so classifier quality is visible and regressions fail builds.

## Context Files

- [x] `scripts/eval-artifact-classifier.ts`
- [x] `.github/workflows/ci.yml`
- [x] `docs/EVAL.md`
- [x] `README.md`
- [x] `fixtures/README.md`
- [x] `plans/README.md`
- [x] `plans/task-2026-06-26-artifact-classifier-eval-ci.md`

## Constraints

- CI evaluation must not depend on live Supabase or AI providers.
- Keep the existing Supabase-backed catalog path available for local broader evals.
- Use the existing `fixtures/classifier-mapping.csv` as the committed baseline.
- Do not add dependencies.

## Scope

### In scope

- Add a fixture-catalog mode to the eval harness for hermetic CI.
- Run the eval in GitHub Actions on PRs and pushes.
- Set a regression floor that fails CI if the committed deterministic fixture baseline drops.
- Publish the current score in `docs/EVAL.md` and link it from README/fixtures docs.

### Out of scope

- Expanding the fixture corpus.
- Changing classifier behavior.
- Adding external eval dashboards or badges.

## Implementation Plan

1. Add `EVAL_CATALOG_SOURCE=fixture` support that builds the catalog from expected fixture rows.
2. Add a CI step running `pnpm eval:artifact-classifier` with fixture catalog and current baseline floor.
3. Document the current score, command, floor, fixture scope, and how to run the broader Supabase-backed eval.
4. Update plan index.

## Test Plan

- [x] `EVAL_CATALOG_SOURCE=fixture EVAL_ACCURACY_FLOOR=1 pnpm eval:artifact-classifier`
- [x] `pnpm test:integration`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm check:spec`

## Acceptance Criteria

- [x] CI runs the classifier eval on PRs.
- [x] The current score is visible in `docs/EVAL.md`.
- [x] A regression threshold fails the build.
- [x] GitHub issue #14 is closed after validated changes are pushed.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (active goal: resolve the 21 open GitHub issues one by one)
