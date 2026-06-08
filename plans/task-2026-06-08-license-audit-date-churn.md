# Task Spec: Stop LICENSE_AUDIT/README date-stamp churn

## Metadata

- Date: 2026-06-08
- Owner: agent-claude
- Status: Done
- Branch: main
- Related issue/PR: n/a (direct commit)

## Goal

Stop `verify-scf-extraction.ts` from rewriting `data/LICENSE_AUDIT.json` and
`data/README.md` with today's date on every run. The verifier runs in the
pre-commit hook, so the date-only diff dirtied the working tree on every commit.

## Context Files

- [x] scripts/verify-scf-extraction.ts
- [x] data/LICENSE_AUDIT.json
- [x] data/README.md

## Constraints

- `generatedAt` must reflect when the audit content last changed, not when the
  script last ran.
- The JSON stamp and the README's embedded date must stay consistent (resolve
  the date once, feed both).
- Output must remain prettier-stable so lint-staged is a no-op at commit.

## Scope

### In scope

- Split the audit into a dateless body plus a separately-resolved stamp.
- Add `resolveGeneratedAt()`: reuse the prior date when the existing audit is
  byte-identical except for its date; otherwise stamp today.

### Out of scope

- Any change to the verification/byte-comparison logic itself.

## Implementation Plan

1. Extract `auditBody` (everything but `generatedAt`).
2. Add `resolveGeneratedAt(auditPath, body)` comparing prior file body
   (date stripped) against the fresh body.
3. Compose `audit = { generatedAt, ...auditBody }` and pass the resolved date
   into the README template.

## Test Plan

- [x] `tsc --noEmit` clean
- [x] `eslint` clean
- [x] Run verifier twice → working tree stays clean (idempotent)
- [x] Set prior date to 2026-01-01 with unchanged body → date preserved
- [x] Mutate a body field → date bumps to today

## Acceptance Criteria

- [x] Repeated verifier runs produce no working-tree diff.
- [x] Date advances only when audit content changes.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved
