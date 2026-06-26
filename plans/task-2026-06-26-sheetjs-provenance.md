# Task Spec: SheetJS Dependency Provenance

## Metadata

- Date: 2026-06-26
- Owner: Codex
- Status: Done
- Branch: main
- Related issue/PR: https://github.com/p-boaz/graphletter/issues/25

## Goal

Keep the SheetJS CDN tarball dependency while making its provenance, integrity pin, license rationale, and update verification deterministic and documented.

## Context Files

- [x] `package.json`
- [x] `pnpm-lock.yaml`
- [x] `scripts/verify-sheetjs-provenance.js`
- [x] `tests/scripts/verify-sheetjs-provenance.test.ts`
- [x] `docs/DEPENDENCY_PROVENANCE.md`
- [x] `README.md`
- [x] `plans/README.md`
- [x] `plans/task-2026-06-26-sheetjs-provenance.md`

## Constraints

- Keep `xlsx` pinned to the existing SheetJS CDN tarball unless verification proves a better registry-published replacement is available.
- Do not add dependencies.
- Verification must be offline and deterministic against committed files.
- Document the rationale and update procedure clearly enough for future maintainers.

## Scope

### In scope

- Add a SheetJS provenance verifier for package and lockfile pins.
- Add tests for passing and failing verifier cases.
- Add npm/pnpm script entry for the verifier.
- Document SheetJS provenance, license rationale, audit gap, and update procedure.
- Link dependency provenance from the main README validation section.

### Out of scope

- Migrating away from SheetJS.
- Changing SCF extraction behavior.
- Adding a general-purpose dependency policy framework.

## Implementation Plan

1. Add a narrow verifier script that checks the `xlsx` package specifier, lockfile tarball URL, version, and sha512 integrity.
2. Add integration tests using temporary package/lockfile fixtures.
3. Add `pnpm verify:sheetjs-provenance`.
4. Add dependency provenance documentation with the keep-CDN decision, Apache-2.0 license rationale, and deterministic update steps.
5. Update README validation commands and plan index.

## Test Plan

- [x] `pnpm verify:sheetjs-provenance`
- [x] `pnpm test:integration`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm check:spec`

## Acceptance Criteria

- [x] SheetJS CDN artifact decision is documented.
- [x] Lockfile integrity and exact tarball provenance are verified deterministically.
- [x] License rationale and update procedure are documented.
- [x] Tests cover verifier success and failure.
- [ ] GitHub issue #25 is closed after validated changes are pushed.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (active goal: resolve the 21 open GitHub issues one by one)
