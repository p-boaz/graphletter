# Task Spec: Frontend tone cleanup — truthful Research, drop framework-request CTA, de-prominence hello@ email

## Metadata

- Date: 2026-05-13
- Owner: peter (with claude)
- Status: Done
- Branch: main
- Related issue/PR: n/a (direct commit; small follow-up to PR #9 OSS repositioning)

## Goal

Pull three outlier-tone items in line with the post-#9 OSS positioning: vet the Research page for truthfulness, delete the "Don't see your framework?" CTA, and route public contact through GitHub instead of an exposed `hello@graphletter.com` mailto.

## Context Files

- [x] app/research/page.tsx
- [x] lib/research/research-topics.ts
- [x] app/frameworks/page.tsx
- [x] components/footer.tsx
- [x] app/privacy/page.tsx
- [x] app/terms/page.tsx
- [x] lib/auth/actions.ts
- [x] playwright/tests/onboarding-funnel.spec.ts
- [x] lib/ai-config.ts (verification: actual temperature values)
- [x] lib/ai/assess-evidence/utils.ts (verification: actual confidence rubric)

## Constraints

- Don't invent new specifics on the Research page. If a claim has no code backing it, drop it rather than rephrase it.
- Reuse `GITHUB_URL` from `lib/config/links.ts` for every GitHub link (extracted in PR #9 / commit 7ee6114). No hardcoded repo URLs.
- Update playwright assertions in the same commit as the UI changes; don't leave the test suite asserting removed elements.
- Legal pages (privacy, terms) still need a contact path — swap mailto for GitHub Issues, don't delete the line.

## Scope

### In scope

- Fix factual claims on the Research page.
- Remove the framework-request mailto CTA from `/frameworks`.
- Remove the inline `hello@graphletter.com` mailto from the footer.
- Swap the research contact CTA to GitHub Discussions.
- Swap privacy/terms contact line to GitHub Issues.
- Drop the email from the signup error string in `lib/auth/actions.ts`.
- Update playwright tests in lockstep.

### Out of scope

- Historical/plan docs (`plans/task-2026-05-12-oss-repositioning.md`, `docs/superpowers/...`) — those record past state and shouldn't be rewritten.
- Re-seeding test DB / fixing the pre-existing `family filter narrows the list` test (failing on main before this change due to unseeded fixtures).
- Any change to the Github repo settings or organisation profile.

## Implementation Plan

1. Edit `lib/research/research-topics.ts`:
   - SCF version `2025.1.15` → `2026.1.1` (the actual seeded version).
   - Drop fabricated bullets ("Clause 4.7…", "SME 5-of-5 by-mapping consistency").
   - Replace invented Strong/Moderate/Weak/Insufficient rubric with the actual `0.0–1.0 → low|medium|high` model from `lib/ai/assess-evidence/utils.ts:63-64`.
   - Narrow temperature claim to the actual values in `lib/ai-config.ts` (0.1, 0.2).
2. Edit `app/research/page.tsx`: import `GITHUB_URL`, swap contact CTA to `${GITHUB_URL}/discussions`.
3. Edit `app/frameworks/page.tsx`: delete the `frameworks-missing-cta` section in full.
4. Edit `components/footer.tsx`: delete the inline `hello@graphletter.com` link (GitHub link already present).
5. Edit `app/privacy/page.tsx` and `app/terms/page.tsx`: import `GITHUB_URL`, swap mailto for `${GITHUB_URL}/issues`.
6. Edit `lib/auth/actions.ts`: drop the email from the signup-failure error string.
7. Edit `playwright/tests/onboarding-funnel.spec.ts`: rewrite the three assertions that referenced removed/swapped UI.

## Test Plan

- [x] `pnpm lint` clean.
- [x] `pnpm typecheck` clean.
- [x] Playwright assertions directly exercised by these changes pass (footer lean link row, frameworks no-mailto CTA, research GitHub-discussion CTA, research statuses).
- [x] One pre-existing playwright failure (`family filter narrows the list`) confirmed to fail on main before this change too — out of scope.

## Acceptance Criteria

- [x] Zero `hello@graphletter.com` references in app source code (only the negative-assertion in the playwright test remains, verifying it's absent from the footer).
- [x] Research page bullets are either verifiable against the codebase or framed as open questions.
- [x] `/frameworks` no longer renders a `frameworks-missing-cta` section.
- [x] Footer, research, privacy, terms each point to GitHub (Discussions for research, Issues for legal pages, repo root for the footer link).
- [x] `pnpm lint` + `pnpm typecheck` pass.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (Peter requested the cleanup pass and approved "Point to GitHub issues" for privacy/terms; commit to follow on main)
