# Task Spec: Fix all findings from 2026-07-09 dashboard UI QA session

## Metadata

- Date: 2026-07-09
- Owner: agent (Claude Code), directed by Peter ("fix everything you noted")
- Status: Done
- Branch: main (sequential atomic commits, ≤15 files each)
- Related issue/PR: `.gstack/qa-reports/qa-report-graphletter-2026-07-09.md`

## Goal

Fix the 9 issues found in the interactive QA session on the dashboard UI changes
(`a1d1044`, `97e9388`): 3 high (broken control-detail route, framework-impact
request storm, coverage buckets ignoring verdicts), 3 medium (unbounded card list,
dead circuit breaker, cross-page count inconsistencies), 3 low (copy bugs, header
hydration, cosmetic/UX nits).

## Context Files

- [x] components/mapping-explorer.tsx (ISSUE-001 broken /control/ link) — fixed in a37ffb5
- [x] components/gap-remediation/leverage-badge.tsx (ISSUE-002 request storm) — module cache + in-flight dedupe
- [x] components/gap-remediation/gap-remediation-panel.tsx (ISSUE-003) — paged list, 10 per page
- [x] lib/ai/circuit-breaker.ts (ISSUE-004) — dynamic import() replaces broken require()
- [x] lib/graph/gap-analysis.ts + app/api/controls/build-coverage/route.ts (ISSUE-005) — verdict overlay, regression tests in lib/graph/gap-analysis.test.ts
- [x] ISSUE-006 — paginated resolveControlIds (shared lib), verdict overlay in run-gap-analysis, posture scope filter + paginated reads, "mappings" label
- [x] ISSUE-007 — template-literal banners (controlsfor ×2), real space before (+x%)
- [x] ISSUE-008 — auth context paints from getSession, background getUser validation, no getUser without session (kills pre-login 401); Try link hidden on app routes
- [x] ISSUE-009 — level bars share-of-total; trend renders from 2 snapshots; sticky domain-table header; muted disabled reject; total-badge only when filtered; artifact picker keyboard selection fixed (popover portaled into dialog + explicit input focus). Tab-bar scroll affordance already existed (gradient fades) — no change. aria-hidden dialog warning: Radix-internal focus timing, deferred.

## Constraints

- One commit per issue (or per tightly-coupled pair), `fix:`/`feat:` conventional format, ≤15 files.
- `pnpm lint` + `pnpm typecheck` clean before every commit.
- Minimal fixes; no refactors of surrounding code.
- Browser re-verification (headed gstack browse) per fix; regression tests where logic is pure/testable.

## Scope

### In scope

All 9 report issues, including LOW/cosmetic (Peter: "everything you noted").

### Out of scope

New features; redesigns; playwright suite overhaul; fixing the artifact-picker
keyboard question unless it reproduces (verify first, report if not).

## Implementation Plan

1. ISSUE-001: repoint/implement control detail navigation (investigate correct target first).
2. ISSUE-002+003: cap rendered gap-remediation cards; cache/dedupe LeverageBadge fetches.
3. ISSUE-005: bucket covered controls by assessment verdict (PASS/PARTIAL/FAIL); regression test.
4. ISSUE-004: replace broken lazy require with a working import path.
5. ISSUE-006: fix posture 1000-row cap; reconcile or label 384 vs 273.
6. ISSUE-007: copy fixes (shared "controlsfor" string, impact-preview spacing).
7. ISSUE-008: header account-menu hydration.
8. ISSUE-009: nits (bar scaling, trend line, reject-button style, redundant badge, sticky header, aria-hidden/inert, tab affordance).

### Round 3 (Peter: landing-page palette everywhere)

- [x] components/ui/stat-tile.tsx — shared stat tile in landing vocabulary (black serif number, orange mono eyebrow, white card, hairline border; tone colors number only)
- [x] app/dashboard/analytics/page.tsx — 10 pastel tiles → StatTile; purple bars → ft-pink on ft-grey-1; purple empty state → slate; blue spinner → ft-pink
- [x] Full sweep: overview (focus mode, walkthrough card, coverage number, links), assessments explainer, posture trend line + spinners, compliance-inbox page, and 23 components (mapping explorer, impact cascade, upload flow, assessment views, demo/try surfaces). Zero decorative cool hues remain on live surfaces; only dead control-mapping.tsx untouched. Semantic green/amber/red kept for state.

### Round 2 (Peter's follow-up findings, same day)

- [x] Duplicate evidence explanation in assessment details — objective-assessment-list rendered quote.supports twice (figcaption + trailing paragraph); paragraph removed.
- [x] Off-system gradient buttons — smart-upload trigger, start-assessment, and demo run buttons dropped the blue→indigo gradient for the standard primary token — verified solid rgb(15,23,42) in browser. (components/control-mapping.tsx also has gradients but is dead code — not imported anywhere; left for a dead-code sweep.)

## Test Plan

- [ ] pnpm lint && pnpm typecheck per commit
- [ ] pnpm test:integration for touched lib logic (coverage bucketing)
- [ ] Headed-browser re-verification of each fixed surface, screenshots before/after
- [ ] Final QA sweep across all six dashboard tabs

## Acceptance Criteria

- [ ] /control detail action no longer 404s
- [ ] Framework focus page view issues ≤ ~30 framework-impact requests, zero 429s
- [ ] Approving a mixed-verdict assessment yields verdict-correct coverage buckets
- [ ] No circuit-breaker exceptions in dev server log during an assessment
- [ ] Posture page counts agree with Overview/Analytics (or are explicitly labeled)
- [ ] All copy/UX nits from ISSUE-007/008/009 addressed or explicitly deferred with reason
