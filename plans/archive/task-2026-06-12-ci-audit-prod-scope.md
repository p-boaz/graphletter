# Task Spec: Scope CI audit gate to production dependencies

## Metadata

- Date: 2026-06-12
- Owner: agent-claude
- Status: Done (2026-06-13)
- Branch: main
- Related issue/PR: GHSA-gv7w-rqvm-qjhr (esbuild advisory)

## Goal

Stop dev-only dependency advisories from failing the CI `audit` job, which has
been blocking every push to `main` since 2026-06-11.

## Context Files

- [x] .github/workflows/ci.yml

## Constraints

- The supply-chain cooldown in `.npmrc` (`minimum-release-age=4320`) intentionally
  blocks installing the freshly-published esbuild patch (`0.28.1`), so bumping the
  dependency now is not an option until the release matures (~2026-06-14).
- No change to production runtime behavior.

## Scope

### In scope

- Add `--prod` to the `pnpm audit --audit-level=high` step so the gate reflects
  only dependencies that ship to production.

### Out of scope

- Bumping `tsx`/`esbuild` (blocked by the release-age cooldown; will resolve on
  its own once `esbuild@0.28.1` matures).
- Changing the dev-dependency audit policy (Dependabot/manual review still covers it).

## Implementation Plan

1. Change the audit step in `.github/workflows/ci.yml` to
   `pnpm audit --audit-level=high --prod`, with an explanatory comment.

## Test Plan

- [x] `pnpm audit --audit-level=high --prod` exits 0 locally (only low/moderate in
      production deps; no high).

## Acceptance Criteria

- [x] CI `audit` job passes on `main`.
- [x] `quality` and `test` jobs unaffected.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved
