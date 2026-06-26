# Task Spec: Azure and GCP Evidence Classifiers

## Metadata

- Date: 2026-06-26
- Owner: Codex
- Status: Done
- Branch: main
- Related issue/PR: https://github.com/p-boaz/graphletter/issues/34

## Goal

Implement explicit Azure and GCP evidence classification rules so provider evidence degrades to structured classifications instead of throwing unimplemented errors.

## Context Files

- [x] `lib/evidence-classification/evidence-classifier.ts`
- [x] `lib/evidence-classification/evidence-classifier.test.ts`
- [x] `lib/evidence-classification/README.md`
- [x] `plans/README.md`
- [x] `plans/task-2026-06-26-cloud-provider-evidence-classifiers.md`

## Constraints

- Do not change the `EvidenceClassification` response shape.
- Keep classification deterministic and schema/check-type based, matching the existing AWS style.
- Unknown Azure/GCP check types must return a documented fallback instead of throwing.
- Do not add dependencies.

## Scope

### In scope

- Add representative Azure classification rules.
- Add representative GCP classification rules.
- Add fallback behavior for unknown Azure/GCP check types.
- Add unit tests for successful Azure/GCP classification and fallback behavior.
- Update evidence-classification docs to reflect implemented provider support.

### Out of scope

- ERL mapping changes.
- New provider integrations or collection jobs.
- UI changes.

## Implementation Plan

1. Add object-shape helpers and provider-specific classification rules to `EvidenceClassifier`.
2. Return provider-scoped fallback classifications for unknown or mismatched check types.
3. Add unit tests covering representative Azure and GCP evidence plus fallback behavior.
4. Update the evidence classification README implementation status.

## Test Plan

- [x] `pnpm test:integration`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm check:spec`

## Acceptance Criteria

- [x] Azure check types have explicit classification rules.
- [x] GCP check types have explicit classification rules.
- [x] Unknown Azure/GCP check types return structured fallback classifications.
- [x] Unit tests cover representative evidence for both providers.
- [x] GitHub issue #34 is closed after validated changes are pushed.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (active goal: resolve the 21 open GitHub issues one by one)
