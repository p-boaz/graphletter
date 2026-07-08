# Task Spec: Clear mechanical lint warnings

## Metadata

- Date: 2026-07-07
- Owner: maintainer-loop (agent)
- Status: Done
- Branch: chore/maintainer-loop/20260707-clear-mechanical-lint-warnings-unused-eslint-disable-directive-and-4-unescaped-jsx-apostrophes
- Related issue/PR: PR opened by maintainer-loop (link on PR creation)

## Goal

Clear all outstanding mechanical ESLint warnings: one unused eslint-disable directive and four react/no-unescaped-entities warnings from literal apostrophes in static JSX copy.

## Context Files

- [x] lib/ai/circuit-breaker.ts
- [x] app/page.tsx
- [x] app/docs/page.tsx
- [x] app/frameworks/page.tsx
- [x] app/frameworks/[id]/page.tsx

## Constraints

- Mechanical changes only — no behavior or rendered-output changes.
- No new dependencies, no config changes.

## Scope

### In scope

- Remove the stale eslint-disable directive flagged by `--report-unused-disable-directives`.
- Replace literal `'` with `&apos;` in the four flagged static JSX strings.

### Out of scope

- Any other lint rules, refactors, or copy changes.

## Implementation Plan

1. Run `eslint --fix` to drop the unused disable directive.
2. Replace the four literal apostrophes with `&apos;` in the flagged JSX.
3. Re-run `pnpm lint` to confirm zero warnings.

## Test Plan

- [x] `pnpm lint` passes with no warnings.

## Acceptance Criteria

- [x] `pnpm lint` exits clean (0 errors, 0 warnings).
- [x] Rendered output identical (`&apos;` renders as `'`).

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [ ] Human approved (PR review is the approval gate — do NOT auto-merge)
