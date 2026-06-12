# Task Spec: Batch the dashboard's per-framework count queries (N+1) and complete its mappings read

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 7c95049..HEAD -- app/api/dashboard/overview/route.ts supabase/migrations/`
> Compare "Current state" excerpts against the live code; on a mismatch,
> treat it as a STOP condition.

## Metadata

- Date: 2026-06-11
- Owner: agent (advisor plan 004)
- Status: In Progress (dispatched 2026-06-11)
- Branch: `perf/dashboard-framework-counts`
- Planned at: commit `7c95049`
- Priority: P2 · Effort: M · Risk: MED · Category: perf
- Depends on: plans/task-2026-06-11-paginate-compliance-reads.md (reuses
  `lib/database/paged-select.ts`)

## Goal

The dashboard-overview fallback path issues one count query per framework
(up to 79+ queries per request) and reads `scf_control_mappings` unpaginated
(1000-row cap). Replace the per-framework counts with a single SQL function
call and paginate the mappings read.

## Why this matters

`GET /api/dashboard/overview` falls back to direct queries whenever its
materialized view path doesn't produce data. In that fallback,
`fetchFrameworkComplianceFallback` runs a `count` query **per framework id**
inside `Promise.all` — a user mapped across the full 79+ framework catalog
triggers 79+ database round-trips per dashboard load. Separately, the
mappings read that feeds the same computation caps at 1000 rows, so heavy
users get a silently incomplete compliance breakdown on their dashboard.

## Current state

`app/api/dashboard/overview/route.ts` (verified at `7c95049`):

- Lines 326–329 — unpaginated mappings read:
  ```ts
  const { data: controlMappings } = await supabase
    .from("scf_control_mappings")
    .select("control_id, framework_id, framework_control_id, confidence_score")
    .in("control_id", scfControlIds);
  ```
- Lines 361–370 — the N+1:
  ```ts
  const frameworkTotals = await Promise.all(
    frameworkIds.map(async (frameworkId) => {
      const { count } = await supabase
        .from("scf_control_mappings")
        .select("*", { count: "exact", head: true })
        .eq("framework_id", frameworkId);
      return { frameworkId, total: count || 0 };
    })
  );
  ```
- Schema facts: `scf_frameworks.id` is `uuid`
  (`supabase/migrations/20250731000000_create_scf_baseline.sql:69`);
  `scf_control_mappings.framework_id` references it. SCF reference tables
  have public-read RLS policies (see
  `supabase/migrations/20260512160000_advisor_rls_hardening.sql` for the
  policy style used in this repo).
- Migration conventions: timestamped files
  `supabase/migrations/YYYYMMDDHHMMSS_<snake_name>.sql`; idempotent
  `DO $$ ... IF EXISTS` guards (see the two `advisor_*.sql` migrations as
  exemplars). `pnpm schema:migrations:check` validates naming/ordering.
- Pagination helper (from the dependency plan):
  `lib/database/paged-select.ts` exporting `selectAllRows`, `chunkArray`,
  `IN_CHUNK_SIZE`. If that file does not exist, the dependency hasn't landed
  — STOP.

## Commands you will need

| Purpose          | Command                        | Expected on success |
| ---------------- | ------------------------------ | ------------------- |
| Typecheck / lint | `pnpm typecheck && pnpm lint`  | exit 0              |
| Migration checks | `pnpm schema:migrations:check` | passes              |
| Drift check      | `pnpm schema:drift:check`      | passes (non-strict) |
| Tests            | `pnpm test:integration`        | all pass            |

## Scope

### In scope (Context Files)

- [ ] `app/api/dashboard/overview/route.ts`
- [ ] `supabase/migrations/<timestamp>_framework_mapping_counts_fn.sql` (create)
- [ ] `plans/README.md` (status row only)

### Out of scope

- The materialized-view primary path in the same route — working as designed;
  this plan only touches the fallback.
- `lib/compliance/**` — covered by the dependency plan.
- Any change to the route's response shape — the dashboard UI consumes it.
- Seeding scripts.

## Constraints

- ≤15 files per commit; lint/typecheck clean before commit.
- The SQL function must be `STABLE`, `SECURITY INVOKER`, and granted to
  `authenticated` and `anon` (matching the public-read posture of
  `scf_control_mappings`).

## Steps

### Step 1: Migration — grouped-count function

Create `supabase/migrations/<timestamp>_framework_mapping_counts_fn.sql`
(generate `<timestamp>` as UTC `YYYYMMDDHHMMSS`, later than every existing
migration):

```sql
CREATE OR REPLACE FUNCTION public.framework_mapping_counts(p_framework_ids uuid[])
RETURNS TABLE (framework_id uuid, total bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT m.framework_id, count(*)::bigint AS total
  FROM public.scf_control_mappings m
  WHERE m.framework_id = ANY (p_framework_ids)
  GROUP BY m.framework_id;
$$;

GRANT EXECUTE ON FUNCTION public.framework_mapping_counts(uuid[]) TO authenticated, anon;
```

**Verify**: `pnpm schema:migrations:check` → passes. If a local Supabase
stack is available (port 54322), also `pnpm schema:drift:check`; otherwise
run the non-strict default and note it.

### Step 2: Replace the N+1

In `app/api/dashboard/overview/route.ts:361–370`, replace the
`Promise.all` count loop with:

```ts
const { data: totalsRows, error: totalsError } = await supabase.rpc("framework_mapping_counts", {
  p_framework_ids: frameworkIds,
});
```

Build `frameworkTotalsMap` from `totalsRows` (`framework_id` → `total`,
defaulting missing ids to 0). On `totalsError`, preserve current resilience:
log and fall back to zero-totals rather than failing the route (today a
failed count silently becomes `count || 0` — match that spirit, with a log).

**Verify**: `pnpm typecheck && pnpm lint` → exit 0.

### Step 3: Paginate the mappings read

Replace lines 326–329 with a chunked + paginated read using
`chunkArray(scfControlIds, IN_CHUNK_SIZE)` and `selectAllRows` from
`@/lib/database/paged-select` (same pattern as in
`lib/compliance/inbox-generator.ts` after the dependency plan). Keep the
selected columns and downstream `typedControlMappings` handling identical.

**Verify**: `pnpm typecheck && pnpm lint` → exit 0.

### Step 4: Validate and commit

**Verify**: `pnpm test:integration` → green. Manual smoke if a dev stack is
configured: `pnpm dev`, log in with `.env` QA creds, load `/dashboard`,
confirm framework compliance renders (and server logs show no
`framework_mapping_counts` errors). If no local stack, state that the smoke
was skipped.

Commit on `perf/dashboard-framework-counts`:

```
perf(dashboard): batch framework counts via SQL function, paginate mappings read

Implements: plans/task-2026-06-11-dashboard-framework-counts.md
```

## Test Plan

- [ ] Existing integration suite green (no live-DB unit test exists for this
      route — see STOP conditions for the consequence).
- [ ] Migration file passes `pnpm schema:migrations:check`.
- [ ] Manual dashboard smoke against a real stack when available; the
      deploy-time risk is the RPC not existing in the remote DB —
      see Maintenance notes.

## Acceptance Criteria / Done criteria (all must hold)

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test:integration`,
      `pnpm schema:migrations:check` all exit 0
- [ ] `grep -n "framework_mapping_counts" app/api/dashboard/overview/route.ts`
      → 1+ hit; the per-framework `Promise.all` count loop is gone
- [ ] The mappings read goes through `selectAllRows`
- [ ] Response shape unchanged (same keys in the route's JSON)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `lib/database/paged-select.ts` doesn't exist (dependency not landed).
- The remote/live database cannot receive the migration before this code
  deploys (RPC-missing would break the fallback) — report the sequencing
  problem instead of inventing a feature flag.
- `scf_control_mappings` turns out not to be readable by `authenticated`
  (RPC returns empty/permission error in smoke) — report; the fix may need
  `SECURITY DEFINER`, which is a human decision.
- Drift: cited lines don't match the excerpts.

## Maintenance notes

- **Deploy ordering**: migration must be applied (`pnpm dlx supabase db push`
  or CI pipeline) before or with the code deploy. Reviewer should confirm.
- If the materialized-view path is later made authoritative, this fallback
  (and the RPC) can be retired — leave a pointer in that future PR.
- The RPC is reusable anywhere per-framework mapping counts are needed;
  prefer it over new count loops.

## Approval Gate

- [ ] Goal is clear
- [ ] Context files listed
- [ ] Constraints explicit
- [ ] Test plan defined
- [ ] Acceptance criteria measurable
- [ ] Human approved
