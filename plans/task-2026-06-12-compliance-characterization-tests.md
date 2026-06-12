# Task Spec: Characterization tests for the compliance engine

## Metadata

- Date: 2026-06-12
- Owner: agent (Claude Code), approved by Peter
- Status: Done (2026-06-12)
- Branch: test/compliance-characterization
- Related issue/PR: plans/README.md backlog item 3 (follow-on to plan 007)

## Goal

Pin the current behavior of `posture-scorer.ts`, `inbox-generator.ts`, and
`guidance-generator.ts` with deterministic, hermetic tests — zero env vars,
zero network, zero new dependencies — using the seams plan 007 already built
(`setModelFactoryForTesting`, `setCircuitBreakerOverrideForTesting`) plus one
new reusable fake-Supabase helper.

## Context Files

- [ ] `lib/testing/fake-supabase.ts` — new. Chainable, thenable query-builder
      stub: every chain method returns the builder, `await` resolves the
      configured per-table response, and all calls are captured for
      assertions. Unknown tables resolve to an error response (which the
      modules under test treat as their documented degraded paths).
- [ ] `lib/compliance/posture-scorer.test.ts` — new.
- [ ] `lib/compliance/inbox-generator.test.ts` — new.
- [ ] `lib/compliance/guidance-generator.test.ts` — new.
- [ ] `plans/README.md` — status row + backlog cleanup.

## Why this is tractable without new seams

- All three modules take `supabase: SupabaseClient` as a parameter — the
  fake client injects there.
- `generateGuidance`'s AI path goes through `getModel` (mockable via
  `lib/ai/testing/mock-model.ts`) and `checkCircuitBreaker` (overridable via
  `setCircuitBreakerOverrideForTesting`).
- `selectAllRows` only calls `.range()` on the builder (`paged-select.ts`),
  `generateGuidance`'s cache check ends in `.maybeSingle()`, and the
  fire-and-forget upsert just needs a thenable — all covered by the
  generic chainable stub.
- `generateInbox`'s internal calls (`scanEvidenceFreshness`,
  `calculatePostureScore`, `resolveGapToErl`) all flow through the same
  injected client; their tables (`evidence`, `evidence_freshness_rules`,
  `evidence_expiry_overrides`, `domain_tier_weights`,
  `control_gap_analysis`, `scf_controls`, `scf_control_evidence_mappings`,
  `scf_evidence_request_list`) are stubbed or left to the error default to
  exercise the degraded paths the code explicitly handles.

## Constraints

- **Characterization only: no production code changes.** If a test reveals a
  bug, pin the current behavior with a `// CHARACTERIZATION:` comment naming
  the suspect behavior and report it — do not fix it in this branch.
- Hermetic: `env -i PATH HOME pnpm test:integration` must pass.
- No new dependencies. Reuse `lib/ai/testing/mock-model.ts`.
- `generateInbox` has a module-level 5-minute cache — every test uses a
  unique userId except the tests that assert the cache behavior itself.
- ≤15 files per commit.

## Test Plan (≈21 tests)

### posture-scorer (~8)

- Weighted multi-domain scoring: exact `overallScore`, per-domain
  `rawScore`/`weightedScore` rounding, compliant=1.0 / partial=0.5 /
  missing=conflicting=0.
- Domain sort: critical tier first, then ascending rawScore.
- Weight fallback when tier table is empty AND when it errors
  (`weightFallback: true`, weight 1.0, tier "standard").
- Gap-query error → `null`; zero gap rows → `null`.
- Control missing from catalog → bucketed under "Unknown" domain.
- `savePostureSnapshot`: captured insert payload shape.
- `getPostureHistory`: row mapping + `Number()` coercion; error → `[]`.

### guidance-generator (~7)

- Cache hit → `cached: true`, values from the row, invalid effort defaults
  to "medium".
- Circuit breaker denied → template fallback (exact sections list).
- `estimateEffort` boundaries via template path: 2→low, 6→medium, 7→high.
- AI success with valid JSON (mocked model) → parsed result; cache upsert
  captured with `erl_id` + `control_ids_hash`.
- Malformed AI response (no JSON braces) → template fallback.
- AI throws → template fallback.
- `hashControlIds` is order-insensitive (observable via the captured
  `control_ids_hash` filter across two permuted calls).

### inbox-generator (~6)

- Degraded path (freshness/posture/ERL tables erroring, gap data present):
  missing→high and partial→low items generated, no postureSummary, no
  leverage items.
- Full path with freshness fixtures: stale→critical "Expired:" item and
  expiring→high item with exact titles.
- Caps: >10 missing gaps → 10 items; >5 partial → 5 items.
- Priority sort (critical < high < medium < low; title tiebreak).
- Cache: second call returns the cached result; `invalidateInboxCache`
  forces regeneration.

### Gates

- [x] `pnpm test:integration` green — 160/160 (136 existing + 24 new).
- [x] Hermetic run green — 160/160.
- [x] `pnpm lint`, `pnpm typecheck` exit 0.
- [x] `git diff` touches only the four new files + plans docs.

## Acceptance Criteria

- [x] ≥20 new tests across the three modules, all passing (24: 8 posture,
      10 guidance, 6 inbox).
- [x] Zero production-code diffs.
- [x] No env vars read by any new test (hermetic run proves it).
- [x] Fake-supabase helper documented and reusable for future route tests.

## Review revisions

- Dropped a dead conditional in the guidance cache-upsert test handler
  (both branches returned the same value) — found in the pre-merge review.

## Findings (pinned, not fixed)

- `generateGuidance` cache-read path does not validate `estimated_effort` —
  `(row.estimated_effort as ...) || "medium"` lets any truthy garbage value
  through; only ""/null default to "medium". The AI path does validate.
  Pinned in `guidance-generator.test.ts` with a CHARACTERIZATION comment.
  Low severity (the column is only ever written with validated values), but
  worth a one-line `isValidEffort()` guard in a future pass.

## STOP conditions

- A module turns out to be untestable without a production-code seam →
  report the needed seam, don't add it unilaterally.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved — Peter, 2026-06-12 ("go with the compliance tests")
