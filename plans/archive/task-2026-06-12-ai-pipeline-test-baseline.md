# Task Spec: Test baseline for the AI assessment pipeline (mocked model)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
>
> **Drift check (run first)**:
> `git diff --stat 1545606..HEAD -- lib/ai/ lib/ai-client.ts lib/ai-config.ts`
> On logic-level mismatch with "Current state", STOP.

## Metadata

- Date: 2026-06-12
- Owner: agent (advisor plan 007)
- Status: Done (2026-06-12)
- Branch: `test/ai-pipeline-baseline`
- Planned at: commit `1545606`
- Priority: P1 · Effort: L · Risk: LOW · Category: tests
- Depends on: none

## Goal

The AI assessment pipeline — the product's core — has zero tests. Add a
deterministic test seam (AI SDK `MockLanguageModelV2` injected through the
existing `getModel` factory) and a unit-test baseline covering the pipeline's
parsing, verdict handling, retry, timeout, and circuit-breaker logic. No
real AI calls anywhere; tests must pass with no API keys set.

## Why this matters

Changes to prompts, schemas, providers, or fallback logic currently ship
with zero regression protection — a confidence=NaN or a silently-swallowed
provider outage reaches users unnoticed (the 2026-06-11 audit found exactly
such fallback-masking). Mocking strategy decision (made by the maintainer,
2026-06-12): tests pin **code** behavior with a mock model; model **quality**
stays in the existing eval lane (`pnpm eval:artifact-classifier`). Do not
add tests that call real providers.

## Current state (verified at `1545606`)

- `lib/ai-client.ts:23` — `export function getModel(provider, model)`:
  central factory returning `anthropic(...)`/`openai(...)` SDK model
  instances; throws "No AI providers available" when no API keys are
  configured (i.e. in any test environment — the seam must short-circuit
  BEFORE that check). Also exports `generateObject`-based helpers (read the
  file).
- `lib/ai/assessment-engine.ts` — exports `extractEvidenceContent`,
  `assessEvidenceAgainstObjectives` (line 90; `generateObject` at 149 with
  `model: getModel(COMPLIANCE_AI_CONFIG.controlMapping...)` and a Zod schema
  with `result: z.enum(["pass","fail","partial","not_applicable"])`,
  `confidence: z.number().min(0).max(1)`), `generateAssessmentSummary`
  (line 199, second `generateObject` at 231), `assessEvidence` (line 271).
- `lib/ai/assess-evidence/utils.ts:111` — `generateObjectWithRetry(params,
logContext, call)`: checks `checkCircuitBreaker(provider)` (throws
  `ProviderTrippedError` when tripped; comment says "fail-open if health
  table unreachable"), then loops `attempt <= MAX_AI_CALL_ATTEMPTS` calling
  `withTimeout(generateObject(params), AI_CALL_TIMEOUT_MS, ...)`. The model
  arrives inside `params.model` (callers build params with `getModel`), so
  a mock model flows through without touching this function.
- Callers of the retry wrapper: `lib/ai/assess-evidence/basic-assessment.ts`
  (call at ~line 87), `objective-assessment.ts` (`assessAgainstObjectives`,
  line 19), `maturity-assessment.ts`. Also `control-assessment.ts` — read it.
- `lib/ai/circuit-breaker.ts` — `checkCircuitBreaker` implementation; NOT yet
  read by the advisor. Step 1 investigates how it gets its Supabase client
  and what happens with no/unreachable Supabase env.
- AI SDK: `ai@5.0.115` (pinned). Its package exports include `./test` —
  `MockLanguageModelV2` etc. Vercel AI SDK v5 docs cover the mock-provider
  testing pattern.
- Test conventions: colocated `lib/**/*.test.ts`, plain `node:test` +
  `node:assert`, run by `pnpm test:integration`
  (`node --import tsx --test tests/**/*.test.ts lib/**/*.test.ts`).
  Exemplars: `lib/database/paged-select.test.ts`,
  `lib/progress/progress-store.test.ts`. Currently 99 tests pass with no
  `.env.local` required — your new tests must preserve that property.
- Existing shallow coverage: `tests/assessment-quality.test.ts` tests
  `validateObjectiveAssessmentQuality` only — leave it; don't duplicate.

## Commands you will need

| Purpose        | Command                                                  | Expected               |
| -------------- | -------------------------------------------------------- | ---------------------- |
| Typecheck      | `pnpm typecheck`                                         | exit 0                 |
| Lint           | `pnpm lint`                                              | exit 0                 |
| Unit tests     | `pnpm test:integration`                                  | all pass               |
| Hermetic check | `env -i PATH="$PATH" HOME="$HOME" pnpm test:integration` | all pass (no env vars) |

## Scope

### In scope (Context Files — the only files you may modify)

- [ ] `lib/ai-client.ts` (test seam only — see Step 2; ≤10 added lines)
- [ ] `lib/ai/circuit-breaker.ts` (ONLY if Step 1 finds a test seam is
      unavoidable; ≤20 lines, no behavior change in production paths)
- [ ] `lib/ai/testing/mock-model.ts` (create — shared test helper)
- [ ] `lib/ai/assessment-engine.test.ts` (create)
- [ ] `lib/ai/assess-evidence/utils.test.ts` (create)
- [ ] `lib/ai/assess-evidence/objective-assessment.test.ts` (create)
- [ ] `plans/task-2026-06-12-ai-pipeline-test-baseline.md` (Status line only)

### Out of scope

- Any change to prompts, schemas, thresholds, retry counts, or other
  production behavior — this plan ADDS TESTS; the only prod-file edits are
  the two narrowly-defined seams above.
- `lib/compliance/**` characterization tests (separate future plan — they
  need no AI mocking).
- API route tests (`app/api/**`).
- The eval lane (`scripts/eval-artifact-classifier.ts`).
- Adding test frameworks/dependencies — `ai/test` is already installed;
  `node:test` is the runner.

## Constraints

- ≤15 files per commit; lint/typecheck clean per commit.
- Tests MUST pass with zero AI/Supabase env vars (the hermetic check above
  is a done criterion). No network in tests.
- ESLint `no-console` is error in `lib/` — use `createLogger` if the helper
  needs logging (it shouldn't); test files are exempt via the existing
  `lib/**/*.test.ts` override.
- Mock-data realism: derive canned model outputs from the Zod schemas in
  the code under test, not invented shapes.

## Steps

### Step 1: Investigate the two impure dependencies (no edits yet)

Read `lib/ai/circuit-breaker.ts` and `lib/ai/assessment-logging.ts` and
answer in your notes:

a. Does `checkCircuitBreaker` create its Supabase client at module load or
per call? With `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`
unset, does importing + calling it throw, hang, or fail open quickly?
Prove it: `node --import tsx -e 'import("./lib/ai/circuit-breaker.ts").then(m => m.checkCircuitBreaker("anthropic")).then(console.log, console.error)'`
with a clean env.
b. Same question for any logging side effects inside
`generateObjectWithRetry` (does a failed log write break the call path?).

Decision rule: if both fail open fast (<~2s) with no env, NO seam is needed
in circuit-breaker.ts — tests just exercise the fail-open path, plus inject
trip-state via whatever explicit API the module exposes (look for a
setter/reset used by `app/api/admin/ai-provider-health`). If calling with no
env throws at import time or hangs, add the minimal seam:
`setCircuitBreakerOverrideForTesting(result | null)` consulted at the top of
`checkCircuitBreaker` — ≤20 lines, no production behavior change.

**Verify**: the proof command above, output recorded.

### Step 2: The model seam in `lib/ai-client.ts`

At the top of `getModel`, before any provider-availability logic:

```ts
let testModelFactory: ((provider: AIProvider, model: AIModel) => unknown) | null = null;

/** Test-only: install a factory returning a mock LanguageModel (ai/test). */
export function setModelFactoryForTesting(factory: typeof testModelFactory): void {
  testModelFactory = factory;
}

// inside getModel, first line:
if (testModelFactory) return testModelFactory(provider, model) as <existing return type>;
```

Match the file's existing style/types — read the real signature and use its
return type rather than `unknown` casts where possible (`as any` needs a
justifying comment; prefer the SDK's `LanguageModel` type).

**Verify**: `pnpm typecheck && pnpm lint` → exit 0; `pnpm test:integration`
still green (no behavior change).

### Step 3: Shared mock helper

`lib/ai/testing/mock-model.ts` exporting:

- `mockObjectModel(objects: unknown[] | (() => unknown))` — returns a
  `MockLanguageModelV2` (from `ai/test`) whose `doGenerate` yields each
  canned object in sequence (as the JSON text the SDK parses against the
  caller's Zod schema); after the list is exhausted, throws.
- `failingModel(error: Error, failCount: number, then: unknown)` — fails
  `failCount` times, then succeeds with `then` (drives retry tests).
- `hangingModel(signal?: AbortSignal)` — never resolves (drives timeout
  tests).
- `installMockModel(model)` / `resetMockModel()` — thin wrappers around
  `setModelFactoryForTesting`, used in test `beforeEach`/`afterEach`.

Consult the AI SDK v5 testing docs/types in
`node_modules/ai/dist` for the exact `MockLanguageModelV2` constructor shape
(`doGenerate` result needs `content`/`finishReason`/`usage` fields in v5) —
get it from the installed types, not memory.

**Verify**: `pnpm typecheck` → exit 0.

### Step 4: `assessment-engine.test.ts`

Cover `assessEvidenceAgainstObjectives` and `generateAssessmentSummary`:

1. Happy path: mock returns a valid `{ assessments: [...] }` per the inline
   Zod schema → returned structure matches (verdicts, confidence preserved).
2. All four `result` enum values round-trip.
3. Schema-violating model output (e.g. `confidence: 1.5` or missing
   `objective_id`) → assert the function's ACTUAL behavior (read the catch
   block first — if it falls back or throws, pin that exact behavior with a
   comment naming it as characterization).
4. Empty `assessments` array → pinned behavior.
5. Whatever `assessEvidence` (line 271) orchestrates — read it; if it's a
   thin composition of the above, one happy-path test suffices.

### Step 5: `utils.test.ts` (retry wrapper) + `objective-assessment.test.ts`

`generateObjectWithRetry`:

1. Succeeds first try → one model call.
2. Fails once then succeeds → exactly 2 calls, returns the success.
3. Fails `MAX_AI_CALL_ATTEMPTS` times → throws the last error.
4. Circuit breaker tripped → `ProviderTrippedError` and ZERO model calls
   (use the Step 1 mechanism to trip it).
5. Timeout: only if `AI_CALL_TIMEOUT_MS` is reachable in test time or
   overridable WITHOUT changing production code; otherwise skip with a
   `// not covered:` comment explaining why — do NOT add a prod knob for it.

`assessAgainstObjectives` (objective-assessment.ts): happy path + one
malformed-output path, mirroring Step 4's approach. If `basic-assessment`
and `maturity-assessment` share all logic through the wrapper, note that
instead of duplicating tests.

**Verify (steps 4–5)**: `pnpm test:integration` → all pass including new
files; then the hermetic check from the Commands table → all pass.

### Step 6: Commits

Two commits on `test/ai-pipeline-baseline` (≤15 files each):

```
test(ai): add model seam and mock helpers for the assessment pipeline
test(ai): baseline tests for assessment engine, retry wrapper, objective assessment

Implements: plans/task-2026-06-12-ai-pipeline-test-baseline.md
```

Final commit includes this spec with `- Status: Done (2026-06-12)`.

## Test Plan

This plan IS a test plan; meta-criteria for the tests themselves:

- Every test imports the real module under test (no logic copies — a prior
  executor inlined a copy of the code under test and it was rejected in
  review; don't repeat that).
- Error-path tests assert specific observable behavior (return shape,
  thrown type, call counts), not just "doesn't crash".
- No test depends on env vars, network, or wall-clock sleeps >100ms.

## Acceptance Criteria / Done criteria (all must hold)

- [ ] `pnpm typecheck`, `pnpm lint` exit 0
- [ ] `pnpm test:integration` exits 0 with ≥15 new tests across the three new test files
- [ ] Hermetic: `env -i PATH="$PATH" HOME="$HOME" pnpm test:integration` exits 0
- [ ] `git diff` on `lib/ai-client.ts` (and `circuit-breaker.ts` if touched) shows only the described seam(s)
- [ ] No new dependencies in `package.json`
- [ ] Zero real-provider imports in test files (`grep -l "@ai-sdk/anthropic\|@ai-sdk/openai" lib/ai/**/*.test.ts` → empty)

## STOP conditions

- `MockLanguageModelV2` (or equivalent) is absent from the installed
  `ai@5.0.115` `./test` export — report what IS exported; do not hand-roll
  a LanguageModel implementation without reporting first.
- Step 1 shows `checkCircuitBreaker` cannot be made test-safe within the
  ≤20-line seam budget.
- Pinning current behavior in Step 4.3/4.4 would require changing
  production code to make it testable beyond the two approved seams.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The seam (`setModelFactoryForTesting`) is the ONLY sanctioned way to fake
  AI in tests — future tests should use `lib/ai/testing/mock-model.ts`, not
  ad-hoc stubs.
- When prompts/schemas change, these tests pin the parsing contract — update
  canned objects alongside schema changes.
- Model-quality regressions are NOT covered here by design — that's the
  eval lane.
- Deferred: `lib/compliance/**` characterization tests (no AI mocking
  needed); API route tests.

## Approval Gate

- [ ] Goal is clear
- [ ] Context files listed
- [ ] Constraints explicit
- [ ] Test plan defined
- [ ] Acceptance criteria measurable
- [ ] Human approved (user: "Let's do 1", strategy confirmed 2026-06-12)
