# Task Spec: Repair the 10 pre-existing Playwright failures

## Metadata

- Date: 2026-06-12
- Owner: agent (Claude Code), approved by Peter
- Status: Done (2026-06-12)
- Branch: fix/playwright-spec-repair
- Related issue/PR: plans/README.md backlog ("9 pre-existing Playwright
  failures" — fresh full-suite run on 2026-06-12 shows 10 failed / 38 passed)

## Goal

Make the full Playwright suite green by repairing the failures classified
during plan 006 and re-confirmed today. All 10 are test-infrastructure or
spec-drift issues — none require app code changes.

## Diagnosis (from today's full-suite + focused re-runs, error text captured)

| Failure                 | Root cause                                                                                                                                                                                                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| analytics.spec          | Copy drift: card now reads "Controls with any evidence", spec asserts "Controls with Evidence"                                                                                                                                                                                    |
| compliance-autopilot ×4 | Navigation-abort noise: `placeholder-user.jpg` and supabase `auth/v1/user` requests aborted mid-flight (`net::ERR_ABORTED`) + the paired "TypeError: Failed to fetch" console error from the auth-js chunk; observer counts them as failures                                      |
| dashboard-navigation    | Lean-nav redesign (PR #9) removed "Frameworks" from the header; spec clicks a header link that no longer exists → 30s timeout. Once fixed, the unmocked `gap-remediation` 500 (mock framework id `fw-nist-csf` is not a UUID) would fail the observer next                        |
| evidence-errors ×4      | `waitForEvent("filechooser")` + `.click()` on react-dropzone's hidden input never fires; the passing critical-path helper uses `setInputFiles` directly                                                                                                                           |
| evidence.spec           | Same abort noise (supabase `getUser` aborted by the post-login navigation); evidence page also fetches unmocked `/api/compliance/freshness`                                                                                                                                       |
| public-pages            | Stale assertion: expects `active` class on the "Frameworks" nav link; lean-nav moved that link to the footer, which has no active styling by design. A second drift behind it: `/try` summary copy was rewritten ("Uses the same Smart Evidence Upload flow the product runs on") |

### Found during the double-run acceptance gate (not in the original 10)

| Failure                                               | Root cause                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| upload.spec (flaked on warm runs)                     | `/api/controls/framework-impact` unmocked; the real endpoint is rate-limited, so repeated suite runs start returning 429s → observer failure. Mocked in `mockUploadWorkflowApis`.                                                                                                        |
| artifact-classifier (raced once the suite got faster) | With every API mocked, upload completes almost instantly and the dialog auto-advances past the artifact form, unmounting the `artifact-ai-suggested` badge before its visibility assertion. Fixed by gating `extract-content` (deferred `route.fallback()`) until the badge is asserted. |
| auth.spec (flaked under load)                         | Next dev streaming briefly mounts a second hidden `auth-form` node → strict-mode violation. Screenshot confirms a single rendered form (not an app bug). `toHaveCount(1)` first — retries past the transient, still catches a persistent duplicate.                                      |
| assessments.spec (flaked under load)                  | Explainer click lost when it lands before hydration; the spec's existing single re-click hack wasn't enough. Replaced with an `expect().toPass()` toggle-retry loop.                                                                                                                     |

## Context Files

- [ ] `playwright/helpers/observability.ts` — ignore `net::ERR_ABORTED`
      failed requests globally (browser-canceled ≠ server failure) and the
      abort-induced "TypeError: Failed to fetch" console error from the
      supabase auth-js chunk.
- [ ] `playwright/helpers/mocks.ts` — add `gap-remediation` → `{ remediations: [] }`
      to `mockDashboardApis` (dashboard always POSTs it; the mock framework id
      is not a UUID so the real API 500s); add a minimal `freshness` mock to
      `mockEvidencePageApis` (evidence page always fetches it; the autopilot
      spec's later-registered richer mock still wins via route LIFO).
- [ ] `playwright/tests/analytics.spec.ts` — update card copy assertion.
- [ ] `playwright/tests/dashboard-navigation.spec.ts` — drive the public-nav
      transition via the "Try" link (the one public header link that exists);
      drop the per-spec ERR_ABORTED filter (now global).
- [ ] `playwright/tests/public-pages.spec.ts` — delete the stale active-class
      assertion; drop the per-spec ERR_ABORTED filter (now global).
- [ ] `playwright/tests/evidence-errors.spec.ts` — replace the filechooser
      dance with `setInputFiles` (the critical-path pattern) in all 4 tests.
- [ ] `playwright/tests/artifact-classifier.spec.ts` — extraction gate for
      the badge race (scope expansion from the acceptance gate; see above).
- [ ] `playwright/tests/auth.spec.ts`, `playwright/tests/assessments.spec.ts` —
      load-flake hardening (scope expansion from the acceptance gate; see above).
- [ ] `plans/README.md` — status row + backlog cleanup.

## Constraints

- **No app code changes.** Every failure is test-side; if a repair turns out
  to require an app change, STOP and report.
- Don't weaken the observer beyond the two documented noise classes:
  ERR_ABORTED requests and the abort-induced auth-js fetch error. Real
  console errors, page errors, and non-2xx API responses still fail tests.
- Keep assertions meaningful: where a stale assertion is deleted, the
  surrounding test must still verify the page actually rendered.
- ≤15 files per commit; lint + typecheck clean before each commit.

## Scope

### In scope

The 6 spec/helper files above. Repairs only — no new test coverage.

### Out of scope

- App-side fixes (none needed per diagnosis).
- New specs for uncovered flows.
- DialogContent accessibility warnings (logged by Radix, not test failures).

## Implementation Plan

1. Branch `fix/playwright-spec-repair` from main.
2. Observer noise filters (observability.ts).
3. Mock additions (mocks.ts).
4. Spec repairs (4 spec files).
5. Run the 6 affected specs until green, then the full suite ×2 (flake check).
6. Commit, update plans/README.md.

## Test Plan

- [x] `pnpm test:ui:bg` on the 6 affected specs — all pass.
- [x] Full suite `pnpm test:ui:bg` — 0 failed (48 passed + setup).
- [x] Second full-suite run — still 0 failed. (The gate caught three more
      latent issues across rounds — framework-impact 429s, the classifier
      badge race, and two load flakes — all fixed; final two consecutive
      runs both 48/48.)
- [x] `pnpm lint`, `pnpm typecheck` exit 0.

## Acceptance Criteria

- [x] Full Playwright suite green twice in a row (48/48 ×2; suite time
      dropped from ~12 min to ~1 min once the timeout cascades were gone).
- [x] No app source files changed (`git diff --stat` touches only
      `playwright/` and `plans/`).
- [x] Observer still fails tests on genuine console errors and non-2xx API
      responses (filters are narrowly scoped, with comments stating why).

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved — Peter, 2026-06-12 ("go for it" on the spec-repair plan)
