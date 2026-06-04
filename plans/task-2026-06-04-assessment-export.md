# Task Spec: Assessment export serializers (CSV/JSON)

## Metadata

- Date: 2026-06-04
- Owner: agent
- Status: In Progress
- Branch: feat/assessment-export
- Related issue/PR: https://github.com/p-boaz/graphletter/issues/12

## Goal

Provide pure, reusable serializers that turn assessment results into CSV and JSON so users can export verdicts for auditors, archival, or posture tracking. This is the testable core of #12; the UI download wiring is a separate follow-up.

## Context Files

- [x] lib/assessments/export.ts
- [x] lib/assessments/export.test.ts

## Constraints

- `lib/` may only import other `lib/` — no UI/I-O dependencies.
- Reuse the existing `OverallVerdict` taxonomy from `lib/assessments/summary.ts`; do not redefine it.
- No `console.log`, no unjustified `as any`.

## Scope

### In scope

- A lossless indented-JSON serializer over the export records.
- A flat, one-row-per-control, RFC 4180-compliant CSV serializer.
- Unit coverage for happy path, empty input, CSV escaping, optional-field handling, confidence clamping, and objective counts.

### Out of scope

- UI download buttons on the results page (tracked on #12).
- Loading/transforming live assessment rows from the database into the export shape.

## Implementation Plan

1. Define `AssessmentExportRecord` / `AssessmentExportObjective` types aligned to the assessment-engine result shape.
2. Implement `assessmentsToJson` (indented) and `assessmentsToCsv` (RFC 4180 escaping, CRLF, header-only on empty input).
3. Add `node:test` unit coverage matching the `summary.test.ts` style.

## Test Plan

- [x] `pnpm typecheck` clean
- [x] `pnpm lint` clean
- [x] `pnpm test:integration` green (new tests picked up via `lib/**/*.test.ts`)

## Acceptance Criteria

- [x] JSON export round-trips losslessly and is indented.
- [x] CSV is one row per control with a stable header.
- [x] CSV escapes commas, quotes, and newlines; clamps non-finite/out-of-range confidence.
- [x] Empty input yields `[]` (JSON) and a header-only CSV.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [ ] Human approved
