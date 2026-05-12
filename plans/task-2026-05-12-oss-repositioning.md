# Task Spec: OSS Repositioning

## Metadata

- Date: 2026-05-12
- Owner: agent
- Status: In Progress
- Branch: chore/oss-repositioning
- Related design: docs/superpowers/specs/2026-05-12-oss-repositioning-design.md
- Related plan: docs/superpowers/plans/2026-05-12-oss-repositioning.md

## Goal

Shift the public-facing surface from SaaS-marketing tone to OSS-project tone. Keep hosted product and in-app docs functional.

## Context Files

- [x] `docs/superpowers/specs/2026-05-12-oss-repositioning-design.md` — design decisions
- [x] `docs/superpowers/plans/2026-05-12-oss-repositioning.md` — task-by-task plan (Tasks 1–7)
- [x] `app/page.tsx` — landing page (rewritten in Task 3)
- [x] `components/navigation.tsx` — top nav (slimmed in Task 4)
- [x] `components/footer.tsx` — footer (rewritten in Task 5)
- [x] `app/how-it-works/page.tsx`, `app/try-it-out/page.tsx` — replaced with redirect stubs in Task 1
- [x] `app/docs/page.tsx`, `app/try/page.tsx` — new homes for the renamed routes (Task 1)
- [x] `app/contact/page.tsx` — deleted in Task 6
- [x] `playwright/helpers/selectors.ts` — obsolete selectors removed in Tasks 5–6
- [x] `playwright/tests/onboarding-funnel.spec.ts`, `public-pages.spec.ts`, `upload.spec.ts` — assertion updates in Tasks 1, 2, 3, 5, 6

## Constraints

- No README rewrite
- No visual redesign (typography/color palette unchanged)
- No anti-SaaS copy ("no per-seat fees" etc.)
- API surface (`/api/try-it-out/*`) stays stable
- Authenticated product UI unchanged
- Husky pre-commit: blast radius ≤ 15 staged files; `check:spec` requires this spec to be staged in any commit that touches implementation files
- No `--no-verify`, no `SKIP_SPEC_CHECK=1`

## Scope

### In scope

- Five-section landing rewrite (Hero / Example output / Built in the open / Closing CTA / Footer)
- GitHub external link in nav + hero + footer
- `/how-it-works` → `/docs` (rename + strip marketing, keep doc anchors)
- `/try-it-out` → `/try` (rename + soften heading)
- `/demo` and `/architecture` redirect targets updated to `/docs`
- `/contact` page deleted; footer mailto replaces it
- Footer collapsed to single light row
- In-app help link anchors point at `/docs#...`
- Playwright selectors/assertions updated to match

### Out of scope

- README, AGENTS.md, CHANGELOG, license files
- Authenticated product UI (`/dashboard`, `/assessments`, `/evidence`, `/reports`, `/profile`, `/admin`, `/auth/*`)
- `/api/try-it-out/*` route paths (deliberately kept stable)
- Visual redesign (Tailwind palette / serif typography)
- Hero imagery / new logos
- Pricing page (none exists)
- `status.graphletter.com` (external)

## Implementation Plan

See `docs/superpowers/plans/2026-05-12-oss-repositioning.md` for the verbatim per-step plan. Summary:

1. Task 0 — Create branch + this task spec.
2. Task 1 — Stand up `/docs` and `/try`; redirect `/how-it-works`, `/try-it-out`, `/demo`, `/architecture`.
3. Task 2 — Update 8 in-app help links from `/how-it-works#...` to `/docs#...`.
4. Task 3 — Rewrite `app/page.tsx` to the five-section landing.
5. Task 4 — Slim top nav: `Try` only, plus external GitHub link.
6. Task 5 — Collapse footer to a single light row.
7. Task 6 — Delete `/contact`; remove its selectors and assertions.
8. Task 7 — Sweep, smoke test, full validation, push branch, open PR.

## Test Plan

- [ ] `pnpm typecheck` — passes
- [ ] `pnpm lint` — passes
- [ ] `pnpm build` — passes
- [ ] `pnpm audit --audit-level=high` — no high-severity findings introduced
- [ ] `pnpm exec playwright test playwright/tests/public-pages.spec.ts` — passes
- [ ] `pnpm exec playwright test playwright/tests/onboarding-funnel.spec.ts` — passes
- [ ] `pnpm exec playwright test playwright/tests/upload.spec.ts` — passes
- [ ] Manual smoke: `/`, `/try`, `/docs` render; `/how-it-works`, `/try-it-out`, `/demo`, `/architecture` redirect; `/contact` 404s

## Acceptance Criteria

- [ ] Landing page has five sections (Hero, Example output, Built in the open, Closing CTA, Footer) and no Pipeline/Stats sections
- [ ] Hero has two CTAs: `Try with a sample doc` → `/try` and `GitHub →` → external repo
- [ ] Top nav contains only `Try` + `GitHub` external link (plus auth controls)
- [ ] Footer is one row on a light background; includes Docs, Frameworks, Research, Privacy, Terms, Security, GitHub, hello@graphletter.com mailto
- [ ] `/how-it-works`, `/try-it-out`, `/demo`, `/architecture` all redirect to `/docs` or `/try` (no marketing landing remains)
- [ ] `/contact` is gone (404)
- [ ] All 8 in-app help links target `/docs#...` instead of `/how-it-works#...`
- [ ] Playwright suites (`public-pages`, `onboarding-funnel`, `upload`) pass on the branch
- [ ] PR opened against `main` with the validation checklist filled

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [ ] Human approved

## Progress Log

- 2026-05-12: Task spec created.
- 2026-05-12: Expanded task spec to match repo template (Context Files / Scope / Implementation Plan / Test Plan / Acceptance Criteria / Approval Gate sections added).
- 2026-05-12: Stood up /docs and /try; redirected /how-it-works, /try-it-out, /demo, /architecture.
- 2026-05-12: Fixed Task 1 review issues — removed dead GlossaryTooltip, repositioned metadata export, retargeted three try-it-out test gotos to /try.
- 2026-05-12: Updated 9 in-app help links from /how-it-works to /docs (8 from plan + 1 missed at control-row.tsx:413). Non-anchored references in app/page.tsx, navigation.tsx, footer.tsx remain for Tasks 3-5.
- 2026-05-12: Renamed stale upload.spec.ts test name from "...how-it-works anchor" to "...docs anchor".
- 2026-05-12: Rewrote landing page to five-section layout with GitHub CTA and 'Built in the open' block.
- 2026-05-12: fix(a11y): add sr-only new-tab indicator to external GitHub links
- 2026-05-12 Task 4: slim top navigation; drop marketing links, add Try + GitHub
