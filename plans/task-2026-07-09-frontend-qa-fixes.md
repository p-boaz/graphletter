# Task Spec: Frontend QA mobile overflow and analytics CSP fixes

## Metadata

- Date: 2026-07-09
- Owner: codex
- Status: Done
- Branch: main
- Related issue/PR: User-requested frontend QA pass

## Goal

Fix design and browser issues found during authenticated QA: signed-in dashboard pages must not create document-level horizontal overflow on mobile, and Vercel Analytics must not be blocked by the app CSP.

## Context Files

- [x] components/dashboard-layout.tsx
- [x] components/navigation.tsx
- [x] next.config.mjs
- [x] playwright/tests/dashboard-navigation.spec.ts

## Constraints

- Keep the fix narrow and production-friendly.
- Do not change dashboard data behavior or route structure.
- Preserve internal horizontal scrolling for dense dashboard navigation and tables.

## Scope

### In scope

- Dashboard shell responsive layout.
- CSP script source for Vercel Analytics.
- Focused Playwright regression coverage.

### Out of scope

- Redesigning dashboard cards, tables, or navigation IA.
- Changing analytics provider behavior beyond allowing the existing script host.

## Implementation Plan

1. Make the dashboard header stack on mobile and wrap actions.
2. Keep dashboard tabs inside an internal horizontal scroller instead of widening the document.
3. Add the Vercel Analytics script origin to the existing CSP.
4. Mark the above-the-fold navigation logo as priority-loaded.
5. Add Playwright coverage for mobile document overflow and the CSP header.

## Test Plan

- [x] Browser QA signed in with QA user.
- [x] `pnpm test:ui:bg playwright/tests/dashboard-navigation.spec.ts`
- [x] `pnpm lint`
- [x] `pnpm typecheck`

## Acceptance Criteria

- [x] `/dashboard`, `/dashboard/evidence`, `/dashboard/assessments`, `/dashboard/analytics`, and `/dashboard/compliance-inbox` report no document-level horizontal overflow at 390px width.
- [x] Fresh browser console on `/dashboard` has no CSP error for Vercel Analytics.
- [x] Dev server no longer warns that the above-the-fold logo image should load eagerly.
- [x] Focused Playwright regression is green.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved
