# Task Spec: Mobile scroll affordance for the dashboard tab bar

## Metadata

- Date: 2026-07-09
- Owner: agent
- Status: Draft
- Branch: fix/dashboard-tabs-scroll-affordance
- Related issue/PR: Frontend-design vetting pass, 2026-07-09; follows task-2026-07-09-frontend-qa-fixes.md (Done)

## Goal

The earlier QA fix correctly moved the dashboard tab bar into an internal horizontal scroller at mobile widths, but at 390px the bar now truncates mid-label ("As…") with no visual hint that more tabs exist. Add a scroll affordance so users can discover Compliance Posture, Analytics, and Framework Explorer on phones.

## Context Files

- [ ] components/dashboard-layout.tsx
- [ ] playwright/tests/dashboard-navigation.spec.ts

## Constraints

- Do not reintroduce document-level horizontal overflow (the acceptance criterion of the prior Done spec must keep holding).
- CSS-first: an edge fade/gradient mask plus visible partial next tab is sufficient; no new JS scroll libraries.
- Respect `prefers-reduced-motion` if any scroll hinting animates.

## Scope

### In scope

- Right-edge (and left-edge when scrolled) fade masks on the tab scroller indicating clipped content.
- Ensure the tab layout clips mid-tab (a partially visible next tab is itself an affordance) rather than aligning to a clean boundary that looks complete.
- Active tab scrolled into view on page load (so a user on /dashboard/analytics sees their active tab).

### Out of scope

- Tab bar redesign, icons, or ordering.
- Desktop behavior.

## Implementation Plan

1. Add the mask/fade treatment to the tab scroller in `dashboard-layout.tsx` (CSS mask-image or gradient overlay, toggled by scroll position).
2. Add scroll-into-view for the active tab on mount.
3. Extend `dashboard-navigation.spec.ts` at 390px: mask present when clipped, active tab visible on deep-link pages.

## Test Plan

- [ ] `pnpm lint`, `pnpm typecheck` clean.
- [ ] `pnpm test:ui:bg playwright/tests/dashboard-navigation.spec.ts` green, including the no-document-overflow assertions from the prior spec.
- [ ] Manual dogfood at 390px: clipped state is visually obvious; navigating to /dashboard/frameworks shows its tab active and in view.

## Acceptance Criteria

- [ ] At 390px, a first-time viewer can tell more tabs exist without interacting.
- [ ] Deep-linked dashboard pages show their active tab without manual scrolling.
- [ ] No document-level horizontal overflow regression.

## Approval Gate

- [ ] Goal is clear
- [ ] Context files listed
- [ ] Constraints explicit
- [ ] Test plan defined
- [ ] Acceptance criteria measurable
- [ ] Human approved
