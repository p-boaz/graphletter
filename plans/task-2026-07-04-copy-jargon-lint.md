# Task Spec: CI lint that keeps engineering jargon out of user-facing copy

## Metadata

- Date: 2026-07-04
- Owner: agent (Claude Code), approval: Peter (standing "keep working" directive, 2026-07-04)
- Status: In Progress
- Branch: `ci/copy-jargon-lint`
- Related issue/PR: institutionalizes
  `plans/archive/task-2026-07-04-copy-dejargon.md`

## Goal

Today's de-jargon sweep (PR #38) was a one-time pass; nothing stops "evidence
atoms" or "graph-native" from creeping back into user-facing copy in a future
PR. Add a deterministic checker — same banned-term gate the sweep was verified
against — and run it in CI so the copy standard is enforced, not remembered.

## Context Files

- [ ] `scripts/check-copy-jargon.js` (new)
- [ ] `package.json` (add `check:copy` script)
- [ ] `.github/workflows/ci.yml` (run it in the quality job)
- [ ] this spec

## Constraints

- Zero new dependencies — plain Node (fs walk + regex), same style as the
  other `scripts/check-*.js` checkers.
- Scope = the user-facing surfaces from the sweep: `app/**` (excluding
  `app/api/**`), `components/**`, `lib/content/**`, `lib/how-it-works/**`.
  `lib/research/**` stays out of scope (research page is expressly for the
  technically curious).
- Banned terms (case-insensitive): "evidence atom(s)", "graph-native",
  "SCF normalization", "mapping polarity", model names (`gpt-N`,
  `claude-...`), "documentation artifact-based", "ERL documentation".
- Per-file allowlist for content that renders only inside the docs
  "Under the Hood" section (`lib/content/compliance-explainer.ts` graph data,
  `app/docs/page.tsx` pre-block). Allowlist entries name file + terms, so new
  files never inherit an exemption.
- Comment lines are still checked (copy often lives in template literals;
  cheap and safe to be strict).

## Implementation Plan

1. Write `scripts/check-copy-jargon.js` with the term list, scope, and
   allowlist; clear file:line output and a pointer to the copy standard.
2. Add `"check:copy"` to `package.json`; wire into the CI quality job after
   `pnpm lint`.
3. Validate: passes on current tree; fails correctly on a fixture directory
   containing a banned term (temp dir, not committed).

## Test Plan

- [x] `pnpm check:copy` exits 0 on the current tree.
- [x] Script exits 1 with a file:line report when run against a temp fixture
      containing "evidence atoms" (negative test, verified 2026-07-04).
- [x] Allowlisted files with non-allowlisted new terms still fail (fixture
      `compliance-explainer.ts` containing "GPT-5" → exit 1 on "AI model
      name").
- [x] `pnpm lint` / `pnpm typecheck` clean locally; CI quality job green on
      the PR (verified on the PR run).

## Acceptance Criteria

- [ ] CI fails any PR that reintroduces a banned term in user-facing surfaces.
- [ ] Current tree passes.
- [ ] No new dependencies.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (standing directive: autonomous work while away, PRs not
      self-merged)
