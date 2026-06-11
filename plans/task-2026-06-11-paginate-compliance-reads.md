# Task Spec: Paginate compliance-engine Supabase reads past the PostgREST 1000-row cap

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ea65d95..HEAD -- lib/compliance/ lib/database/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts below against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Metadata

- Date: 2026-06-11
- Owner: agent (advisor plan 001)
- Status: Draft
- Branch: `fix/paginate-compliance-reads`
- Planned at: commit `ea65d95`
- Priority: P1 · Effort: M · Risk: MED · Category: bug/perf
- Depends on: none

## Goal

Compliance-engine reads (`lib/compliance/`) silently truncate at PostgREST's
default 1000-row cap. Add a shared pagination helper and use it at the three
affected sites so gap inboxes, ERL remediation, and posture-impact previews
compute over complete data.

## Why this matters

Supabase's PostgREST API returns at most 1000 rows per request unless the
caller paginates with `.range()`. The seeders already hit this (commit
`3849e83` "paginate CEM seeder reads past PostgREST 1000-row cap"), proving
the relevant tables exceed 1000 rows. The app-side compliance engine has the
same bug: `impact-previewer.ts` fetches the **entire `scf_controls` catalog**
(SCF 2026 has >1000 controls) in one unpaginated select, so posture-impact
math already runs on a truncated catalog today. The inbox generator and
gap→ERL resolver truncate for users with >1000 gap controls or mappings. The
product's core output is compliance verdicts — silently-partial data here is
silently-wrong compliance reporting.

## Current state

Files and the exact unpaginated reads (verified at commit `ea65d95`):

- `lib/compliance/inbox-generator.ts` — builds the gap inbox.
  - ~line 323: `const { data: gaps, error: gapError } = await gapQuery;` — the
    gap query for a user has no `.range()`; >1000 gap rows truncate.
  - ~lines 337–340:
    ```ts
    const { data: controls } = await supabase
      .from("scf_controls")
      .select("id, title, domain_id")
      .in("id", controlIds);
    ```
    `controlIds` is unbounded; both the `.in()` list length and the result
    rows can exceed limits.
- `lib/compliance/gap-erl-resolver.ts:46–50`:
  ```ts
  const { data: mappings, error: mappingError } = await supabase
    .from("scf_control_evidence_mappings")
    .select("scf_control_id, evidence_request_id")
    .in("scf_control_id", gapControlIds)
    .or("is_active.is.null,is_active.eq.true");
  ```
  `scf_control_evidence_mappings` is the exact table the seeder pagination
  fix was for — it has >1000 rows.
- `lib/compliance/impact-previewer.ts:102–106`:
  ```ts
  const [gapResult, tierResult, catalogResult] = await Promise.all([
    gapQuery,
    supabase.from("domain_tier_weights").select("domain_id, tier, weight"),
    supabase.from("scf_controls").select("id, domain_id"),
  ]);
  ```
  The `scf_controls` full-catalog read truncates **today**. The `gapQuery`
  (defined just above, ~line 93) is also unpaginated. `domain_tier_weights`
  is small (per-domain) — leave it alone.

Conventions that apply:

- `lib/` may import other `lib/` modules only (see AGENTS.md import table).
- Logging: `import { createLogger } from "@/lib/logger"` — see the existing
  usage at the top of `lib/compliance/inbox-generator.ts`. Match it.
- Unit tests are colocated `lib/**/*.test.ts` files run by `node --test` via
  `pnpm test:integration`. Use `lib/assessments/export.test.ts` as the
  structural pattern (plain `node:test` + `node:assert`).
- Tabs for indentation in `lib/compliance/` files (match surrounding code).

## Commands you will need

| Purpose     | Command                 | Expected on success            |
| ----------- | ----------------------- | ------------------------------ |
| Install     | `pnpm install`          | exit 0                         |
| Typecheck   | `pnpm typecheck`        | exit 0, no errors              |
| Lint        | `pnpm lint`             | exit 0                         |
| Unit/integ. | `pnpm test:integration` | all pass, incl. new tests      |
| Spec gate   | `pnpm check:spec`       | passes (this file is the spec) |

## Scope

### In scope (Context Files — the only files you may modify)

- [ ] `lib/database/paged-select.ts` (create)
- [ ] `lib/database/paged-select.test.ts` (create)
- [ ] `lib/compliance/inbox-generator.ts`
- [ ] `lib/compliance/gap-erl-resolver.ts`
- [ ] `lib/compliance/impact-previewer.ts`
- [ ] `plans/README.md` (status row only)

### Out of scope (do NOT touch, even though they look related)

- `scripts/seed-*.ts` — seeders already paginate; their helper is
  script-local and not importable from `lib/`.
- `app/api/dashboard/overview/route.ts` — has the same class of bug; it is
  covered by `plans/task-2026-06-11-dashboard-framework-counts.md`, which
  reuses the helper you create here.
- `lib/compliance/freshness-engine.ts`, `posture-scorer.ts` — reads there are
  bounded by per-user evidence; flagged LOW-confidence, not in this plan.
- Any Supabase schema change.

## Constraints

- No single commit may touch more than 15 files (repo rule; this plan fits in
  one or two commits regardless).
- Keep return types of the three changed functions identical — callers must
  not need changes.

## Steps

### Step 1: Create the pagination helper

Create `lib/database/paged-select.ts` with two exported functions:

```ts
import { createLogger } from "@/lib/logger";

const log = createLogger("paged-select");

export const PAGE_SIZE = 1000;
export const IN_CHUNK_SIZE = 200;

export function chunkArray<T>(items: T[], size: number): T[][] { ... }

/**
 * Drain a PostgREST query past the 1000-row cap. `buildQuery` must return a
 * FRESH builder each call (PostgREST builders are single-use), already
 * filtered/ordered; this function appends .range() and loops until a short
 * page comes back.
 */
export async function selectAllRows<Row>(
  buildQuery: () => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> & {
    range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
  },
): Promise<Row[]> { ... }
```

Implementation notes (load-bearing):

- `selectAllRows` loops: `const { data, error } = await buildQuery().range(offset, offset + PAGE_SIZE - 1)`;
  on error, throw `new Error(error.message)`; accumulate; stop when
  `data.length < PAGE_SIZE`. Add a hard safety stop at 100 pages with a
  `log.warn`.
- Don't over-engineer the generic typing — if the builder typing fights you,
  type `buildQuery` as returning the Supabase builder (`any` is NOT allowed
  without a justifying comment; prefer a minimal structural type as above).
- A NOTE in the doc comment: results across pages are only stable if the
  query has a deterministic order — callers should `.order()` a unique
  column. Add `.order("id")` at call sites where the table has an `id` pk.

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Unit-test the helper

Create `lib/database/paged-select.test.ts` (pattern:
`lib/assessments/export.test.ts`, plain `node:test`). Cases:

1. `chunkArray` — empty input → `[]`; exact multiple; remainder chunk.
2. `selectAllRows` with a stub builder returning 2 full pages + 1 short page
   → concatenated rows, 3 calls, correct ranges (`0–999`, `1000–1999`, …).
3. `selectAllRows` propagates an error from page 2 as a thrown Error.

**Verify**: `pnpm test:integration` → all pass, including the new file.

### Step 3: Fix `impact-previewer.ts` (the already-broken site)

In `loadImpactInputs` (~lines 93–106):

- Replace the bare `supabase.from("scf_controls").select("id, domain_id")`
  entry in the `Promise.all` with
  `selectAllRows<ControlCatalogRow>(() => supabase.from("scf_controls").select("id, domain_id").order("id"))`.
- Paginate `gapQuery` the same way (preserve its existing `.eq` filters by
  building them inside the factory closure).
- `domain_tier_weights` stays as-is.
- Note `selectAllRows` throws where the old code inspected `result.error`;
  wrap to preserve the function's existing null-return-on-error behavior
  (keep the `log.info("impact_previewer.no_gap_data", ...)` path intact).

**Verify**: `pnpm typecheck && pnpm lint` → exit 0.

### Step 4: Fix `inbox-generator.ts`

In `fetchGapData` (~lines 310–345):

- Paginate the gap query via `selectAllRows` (keep the conditional
  `.eq("framework_id", frameworkId)` inside the factory).
- For the control-details fetch, chunk `controlIds` with
  `chunkArray(controlIds, IN_CHUNK_SIZE)` and run `selectAllRows` per chunk
  (`.in("id", chunk).order("id")`), concatenating into the existing
  `controlDetails` Map. Preserve the existing "errors are logged via
  `log.warn` and return null" contract of `fetchGapData`.

**Verify**: `pnpm typecheck && pnpm lint` → exit 0.

### Step 5: Fix `gap-erl-resolver.ts`

In `resolveGapToErl` (~lines 43–55): chunk `gapControlIds`
(`IN_CHUNK_SIZE`) and paginate each chunk's query (preserving the
`.or("is_active.is.null,is_active.eq.true")` filter). This function throws on
error today — keep that behavior.

**Verify**: `pnpm typecheck && pnpm lint && pnpm test:integration` → all green.

### Step 6: Commit

Conventional commit on branch `fix/paginate-compliance-reads`, e.g.:

```
fix(compliance): paginate engine reads past PostgREST 1000-row cap

Implements: plans/task-2026-06-11-paginate-compliance-reads.md
```

Before committing: `pnpm lint`, `pnpm typecheck` clean; staged files ≤ 15.
Do NOT push or open a PR unless the operator asked for it.

## Test Plan

- [ ] `lib/database/paged-select.test.ts`: chunking (3 cases), multi-page
      drain, range arithmetic, error propagation, short-page termination.
- [ ] Existing suites stay green: `pnpm test:integration`, `pnpm test:scf`.
- (No live-database test — integration tests in this repo run without a
  Supabase stack; the stub-builder unit tests are the coverage here.)

## Acceptance Criteria / Done criteria (all must hold)

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test:integration` exits 0 with the new test file included
- [ ] `grep -n 'from("scf_controls").select("id, domain_id")' lib/compliance/impact-previewer.ts` shows the call only inside a `selectAllRows` factory
- [ ] No `.in(` call in the three fixed functions receives an unchunked unbounded id list
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

- The "Current state" excerpts don't match the live code (drift).
- The Supabase query-builder typing cannot express the factory pattern
  without `as any` — stop and report rather than scattering casts.
- You find call sites that depend on the truncated (≤1000) behavior, e.g.
  tests asserting exact row counts.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Any new `lib/` read against `scf_controls`, `scf_control_mappings`, or
  `scf_control_evidence_mappings` should use `selectAllRows` — reviewers
  should flag bare `.select()` reads on those tables.
- `plans/task-2026-06-11-dashboard-framework-counts.md` reuses this helper —
  land this plan first.
- If Supabase's `db.max-rows` setting is ever raised, the helper still works
  (it terminates on short pages, not on the constant).

## Approval Gate

- [ ] Goal is clear
- [ ] Context files listed
- [ ] Constraints explicit
- [ ] Test plan defined
- [ ] Acceptance criteria measurable
- [ ] Human approved
