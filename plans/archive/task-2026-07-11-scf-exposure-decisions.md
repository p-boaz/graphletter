# Task Spec: Apply Stage 6 Exposure Decisions

## Metadata

- Date: 2026-07-11
- Owner: claude (agent)
- Status: Done
- Branch: main
- Related issue/PR: `docs/FRAMEWORK_EXPOSURE_REVIEW.md` (review commit a1f54d2); catalog roadmap stage 6

## Goal

Apply Peter's 2026-07-11 exposure decision — "expose everything except the CAUTION (4) and NON-PUBLIC (1)" — to the framework manifest: 178 preview frameworks flip `exposureStatus` to `public` with per-publisher decision-record reasons; COBIT, CR-CMM, SACS-002, ISMAP, and Shared Assessments SIG stay `non-public`.

## Context Files

- [x] data/framework-manifest.overrides.json
- [x] data/framework-manifest.json (generated)
- [x] lib/scf/**generated**/framework-columns.ts (generated)
- [x] tests/framework-visibility.test.ts
- [x] docs/FRAMEWORK_EXPOSURE_REVIEW.md
- [x] plans/scf-catalog-roadmap.md

## Constraints

- Exposure flips only — `visibility` tiers untouched (roadmap principle 4); stage 7 promotion is a separate full-ceremony task.
- Every `exposureReason` must cite the review doc section that justifies it.
- Generated files change only via `pnpm manifest:generate`; freshness/consistency gates must pass.

## Scope

### In scope

Overrides flip + manifest regeneration; updating the framework-visibility test from the stale "preview defaults non-public" blanket assertion to per-entry manifest-driven exposure (pinning the five keeps); decision-record updates to the review doc and roadmap.

### Out of scope

Visibility promotion (stage 7), attribution-rendering UI, DB updates (preview frameworks are not imported in production; exposure lands at next catalog-scope seed).

## Implementation Plan

1. Script the overrides flip: 178 → `public` with §3/§4/§5.1/§5.3 reasons; 5 keeps → `non-public` with §5.4/§5.5 reasons; excluded 3 get a §6 no-exposure-question reason.
2. `pnpm manifest:generate` + `pnpm manifest:check`.
3. Update `tests/framework-visibility.test.ts` to assert per-entry exposure and pin the keeps.
4. Record the decision in the review doc Status line and roadmap stage 6 row.

## Test Plan

- [x] `pnpm manifest:check` — manifest and generated columns byte-fresh
- [x] `pnpm test:scf` — pass
- [x] `pnpm test:integration` — 237/237 pass
- [x] `pnpm lint` && `pnpm typecheck` — clean

## Acceptance Criteria

- [x] Manifest counts: 178 preview/public, 5 preview/non-public, 66 supported/public, 3 excluded/non-public
- [x] The five keeps are exactly: general-cobit-2019, general-cr-cmm-2026, general-shared-assessments-sig-2025, emea-sau-sacs-002-2022, apac-jpn-ismap
- [x] Every flipped entry's `exposureReason` references docs/FRAMEWORK_EXPOSURE_REVIEW.md

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved — Peter, 2026-07-11: "expose everything except the CAUTION (4) and NON-PUBLIC (1)"
