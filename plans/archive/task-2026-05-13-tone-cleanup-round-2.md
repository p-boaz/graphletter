# Task Spec: Frontend tone cleanup — round 2 (accurate numbers, drop "free", soften auth error, rename stale component)

## Metadata

- Date: 2026-05-13
- Owner: peter (with claude)
- Status: Done
- Branch: main
- Related issue/PR: follow-up to `plans/task-2026-05-13-tone-cleanup.md` (commit 0fe6ce4)

## Goal

Continue the post-#9 OSS-tone cleanup. Four small, independent fixes shipped together: (1) replace stale marketing counts on the landing/docs/glossary with the actual seeded counts from `data/seed/expected_row_counts.json`; (2) drop the "free" SaaS-trial qualifier from sign-up CTAs (everything is free in an MIT-licensed self-hostable project); (3) soften the signup-error string we just changed in round 1 — "open a GitHub issue if it persists" was rough UX in a flow where most failures are typos; (4) rename `components/CampaignSuccessCard.tsx` to match the exported `EvidenceSummaryCard` name and the kebab-case convention used by every other component file.

## Context Files

- [x] app/page.tsx
- [x] app/docs/page.tsx
- [x] lib/how-it-works/glossary.ts
- [x] components/navigation.tsx
- [x] components/demo-smart-evidence-upload.tsx
- [x] lib/auth/actions.ts
- [x] components/CampaignSuccessCard.tsx → components/evidence-summary-card.tsx
- [x] components/dashboard-layout.tsx (import update)
- [x] playwright/tests/onboarding-funnel.spec.ts (test name update)
- [x] data/seed/expected_row_counts.json (source of truth for stat numbers)

## Constraints

- Numbers come from the snapshot in `data/seed/expected_row_counts.json`. If SCF version is bumped, these will drift again — accept the drift; alternative (deriving from the snapshot at build time) is YAGNI for now.
- Don't break any playwright assertion. The mobile-nav test only checked test-ids + href, so the visible text change is safe; the test name had "free" in it and is updated for clarity.
- Filename rename uses `git mv` to preserve history.

## Scope

### In scope

- Stale numbers in landing hero prose, hero stat strip, docs schema table, glossary SCF definition.
- "free" qualifier on three CTAs (landing closing, mobile nav, demo upload CTA).
- Auth signup error string: drop the "or open a GitHub issue" tail.
- Rename `CampaignSuccessCard.tsx` → `evidence-summary-card.tsx`; update single import in `dashboard-layout.tsx`.
- Update playwright test name "Sign up free" → "Sign up".

### Out of scope

- Re-seeding test DB / fixing pre-existing `family filter narrows the list` and "draft banner" playwright failures.
- README, GitHub repo metadata, organisation profile.
- Visual / styling (e.g. `ft-pink` accent usage).
- Building a derive-numbers-from-snapshot script.

## Implementation Plan

1. Replace `1,200+ SCF controls` → `1,468 SCF controls` in `app/page.tsx:26`; replace stat strip in `app/page.tsx:40` with `79 frameworks · 1,468 controls · 34,619 cross-framework mappings · SCF 2026.1.1`.
2. Replace `1,200+` → `1,468` in `app/docs/page.tsx:497` (schema table row).
3. Replace `~1,200 controls` → `~1,500 controls` in `lib/how-it-works/glossary.ts:4` (definitional copy stays approximate).
4. `Create a free account` → `Create an account` in `app/page.tsx:195`.
5. `Sign up free` → `Sign up` in `components/navigation.tsx:235`.
6. `Sign Up Free` → `Sign up` in `components/demo-smart-evidence-upload.tsx:423`.
7. Update test name in `playwright/tests/onboarding-funnel.spec.ts:254`.
8. Replace error string in `lib/auth/actions.ts:36`: drop the "or open a GitHub issue if it persists" tail; final text is `We could not create your account. Please try again.`
9. `git mv components/CampaignSuccessCard.tsx components/evidence-summary-card.tsx`; update the single import in `components/dashboard-layout.tsx:13`.

## Test Plan

- [x] `pnpm lint` clean.
- [x] `pnpm typecheck` clean.
- [x] Targeted playwright run (landing hero CTAs, footer lean row, mobile nav) — 4/4 pass.
- [x] `grep -rEn "1,200|25,000|CampaignSuccessCard|Sign up free|Sign Up Free|Create a free account"` in app source = empty.

## Acceptance Criteria

- [x] Landing hero, stat strip, docs schema row, and glossary all use the seeded counts (1,468 controls, 34,619 mappings) or honest approximations of them (~1,500 in definitional copy).
- [x] No "free" qualifier on any sign-up CTA across nav, landing, demo.
- [x] Signup-failure error message is a single short sentence; no GitHub-issue mention.
- [x] `components/CampaignSuccessCard.tsx` does not exist; `components/evidence-summary-card.tsx` does; `dashboard-layout.tsx` imports from the new path.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (Peter: "all of those are great - pls proceed")
