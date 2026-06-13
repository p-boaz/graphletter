# Task Spec: Small-fix batch — 401 on missing session, partial-failure reporting, ESLint worktree ignore, mock-model comment cleanup

## Metadata

- Date: 2026-06-12
- Owner: agent (Claude Code), approved by Peter
- Status: Done (2026-06-12)
- Branch: fix/small-fix-batch
- Related issue/PR: plans/README.md backlog (2026-06-11 audit + plan 006/007 findings)

## Goal

Clear the four S-effort backlog items in one reviewable batch: unauthenticated
API requests must get 401 (not 500), assessment create/update must report
secondary-write failures instead of masking them, `pnpm lint` must not crawl
into `.claude/` agent worktrees, and `mock-model.ts` comments must not cite
`node_modules` line numbers that rot on dependency bumps.

## Context Files

- [x] `utils/auth.ts` — `getCurrentUser` throws on any `auth.getUser()` error
      (including the routine `AuthSessionMissingError`), so every route's
      `if (!user) return 401` guard is dead code and the catch-all answers 500.
- [x] `tests/auth-get-current-user.test.ts` — new; covers the null/throw split.
- [x] `app/api/assessments/route.ts` — POST (`:253`, `:272`) and PUT (`:419`)
      `log.warn` evidence-link / assignment failures and still return
      unqualified success.
- [x] `eslint.config.mjs` — `ignores` lacks `**/.claude/**`.
- [x] `lib/ai/testing/mock-model.ts` — comments cite
      `ai/dist/test/index.mjs` "lines 49-87" (twice).
- [x] `plans/README.md` — status row + backlog cleanup.
- [x] `package.json` — **scope expansion during execution**: the
      `test:integration` globs were unquoted, so `sh` expanded `**` as `*`
      and silently skipped `tests/*.test.ts` (4 files, 11 tests) — including
      the new auth test. Quoting the globs hands them to Node 24's native
      test-runner globstar; the previously-skipped tests all pass (136 total).

## Constraints

- No behavior change for authenticated happy paths.
- Assessment POST/PUT response stays backward-compatible: the sole consumer
  (`components/assessment-execution/index.tsx:120`) checks only `response.ok`,
  so the partial-failure signal is an **additive** `warnings: string[]` field.
- No new dependencies; auth-error classification uses predicates/classes
  already exported by `@supabase/supabase-js@^2.88.0`
  (`isAuthSessionMissingError`, `AuthError.status`).
- ≤15 files per commit; lint + typecheck clean before each commit.

## Scope

### In scope

1. `getCurrentUser`: return `null` (→ routes answer 401) when the session is
   missing or the token is rejected (any auth error with 4xx status, or
   `AuthSessionMissingError`); keep throwing (→ 500) for infrastructure
   failures (network/retryable errors, auth-server 5xx). Fixes all ~40
   routes that call it, including `compliance/inbox`, `gap-remediation`,
   `impact-preview`.
2. Assessment POST: collect secondary-write failures (evidence link,
   assignment insert) into `warnings[]`; include in the response with a
   message reflecting partial success. Same for PUT's evidence-link update.
3. Add `**/.claude/**` to `eslint.config.mjs` ignores.
4. Re-anchor `mock-model.ts` provenance comments to the package version
   (`ai@5.0.115`) instead of dist-file line numbers.
5. **Review revision (found during the pre-merge review):** the PUT handler's
   evidence-link block was guarded by `evidence_ids.length >= 0` — always
   true with the `evidence_ids = []` destructure default — so any PUT that
   omitted the field (which is every UI update: `handleUpdateAssessment`
   sends `Partial<UserAssessment>` and `components/` never includes
   `evidence_ids`) silently nulled the assessment's `evidence_id`.
   Pre-existing data-loss bug in a touched function; now guarded by
   `Array.isArray(body.evidence_ids)` so an omitted field is a no-op and an
   explicit `[]` still clears intentionally.

### Out of scope

- UI surfacing of the new `warnings` field (no consumer change needed).
- The 9 pre-existing Playwright failures (dedicated spec-repair plan).
- Per-route auth refactors — the single `getCurrentUser` fix covers them.

## Implementation Plan

1. Branch `fix/small-fix-batch` from main.
2. Fix `utils/auth.ts` error classification; add
   `tests/auth-get-current-user.test.ts` (node:test, stub client, real
   `@supabase/supabase-js` error classes — hermetic, no env/network).
3. Add `warnings` accumulation to assessments POST/PUT.
4. ESLint ignore + mock-model comment cleanup.
5. Validate, commit (fix commit + docs commit), update `plans/README.md`.

## Test Plan

- [x] New `tests/auth-get-current-user.test.ts`: success → user;
      `AuthSessionMissingError` → null; 4xx `AuthApiError` → null;
      `AuthRetryableFetchError` → throws; 5xx `AuthApiError` → throws.
- [x] `pnpm test:integration` fully green — 136/136 (also hermetic:
      `env -i PATH HOME` run is 136/136).
- [x] `pnpm lint`, `pnpm typecheck` exit 0.
- [x] Manual: unauthenticated curl against the dev server — 401 on
      `GET /api/compliance/inbox`, `POST /api/compliance/gap-remediation`,
      `POST /api/compliance/impact-preview`, `GET /api/assessments`
      (all were 500 before).

## Acceptance Criteria

- [x] Unauthenticated `getCurrentUser` returns `null`; routes' existing
      guards produce 401 on `compliance/inbox` et al.
- [x] Assessment POST/PUT responses include `warnings: string[]`
      (empty on full success) and a partial-failure message when non-empty.
- [x] `eslint.config.mjs` ignores `**/.claude/**`.
- [x] `mock-model.ts` contains no `node_modules` line-number references.
- [x] All validation commands exit 0.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved — Peter, 2026-06-12 ("go for it" on the small-fix-batch-first recommendation)
