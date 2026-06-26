# Task Spec: Add Incident Response Plan artifact classification

## Metadata

- Date: 2026-06-26
- Owner: codex
- Status: In Progress
- Branch: main
- Related issue/PR: https://github.com/p-boaz/graphletter/issues/15

## Goal

Classify clear Incident Response Plan evidence filenames as the SCF
`Incident Response Plan (IRP)` artifact and preserve the mapped `E-IRO-01`
control set used by downstream upload flows.

## Context Files

- [x] `lib/artifact-classifier/classify.ts`
- [x] `lib/artifact-classifier/`
- [x] `fixtures/classifier-mapping.csv`
- [x] `fixtures/README.md`
- [x] `data/evidence-request-list.csv`
- [x] `scripts/eval-artifact-classifier.ts`
- [x] `plans/README.md`

## Constraints

- Keep the deterministic rule narrow so IRP testing, training, updates, and RCA
  artifacts can still map to their more specific catalog entries.
- Do not add dependencies or require live AI calls in unit tests.
- Preserve existing AI classifier behavior for non-IRP filenames.

## Scope

### In scope

- Add a high-confidence deterministic classifier path for explicit IR plan
  filenames.
- Add synthetic fixture rows for Incident Response Plan examples.
- Add unit coverage for the classifier result and the `E-IRO-01` SCF mappings.
- Validate with `pnpm eval:artifact-classifier`.

### Out of scope

- Building content-based document classification.
- Refactoring the classifier prompt beyond IRP guardrails.
- Changing upload UI behavior.

## Implementation Plan

1. Add an IRP pre-match before the LLM call when the catalog contains
   `Incident Response Plan (IRP)`.
2. Teach the prompt the same IRP distinction for AI fallback behavior.
3. Add classifier fixture rows for incident response plan filenames.
4. Add tests proving classification and SCF mapping to `E-IRO-01`.
5. Run eval, integration tests, lint, typecheck, and spec checks.

## Test Plan

- [x] `pnpm eval:artifact-classifier`
- [x] `pnpm test:integration`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm check:spec`

## Acceptance Criteria

- [x] An uploaded IR plan filename is classified as `Incident Response Plan (IRP)`.
- [x] Synthetic fixture rows and unit tests cover IR plan examples.
- [x] The mapped ERL entry is `E-IRO-01` and includes relevant SCF controls.
- [ ] GitHub issue #15 is closed after validation passes.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (active goal: resolve the 21 open GitHub issues one by one)
