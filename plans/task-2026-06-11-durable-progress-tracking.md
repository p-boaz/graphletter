# Task Spec: Make upload-progress tracking durable across serverless instances

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ea65d95..HEAD -- lib/websocket/ app/api/ws/ app/api/progress/ hooks/use-progress-tracker.ts supabase/migrations/`
> Compare "Current state" excerpts against the live code; on a mismatch,
> treat it as a STOP condition.

## Metadata

- Date: 2026-06-11
- Owner: agent (advisor plan 005)
- Status: Draft
- Branch: `fix/durable-progress-tracking`
- Planned at: commit `ea65d95`
- Priority: P2 · Effort: L · Risk: MED · Category: bug/architecture
- Depends on: none (independent of plans 001–004)

## Goal

Progress tracking for evidence-upload/assessment workflows lives in
per-process memory (`lib/websocket/progress-tracker.ts`), but the app deploys
to Vercel serverless where the session-creating request, the
progress-writing request, and the SSE-reading request can land on different
instances. Back progress sessions with a Supabase table so progress survives
instance boundaries; keep the existing client API working.

## Why this matters

`progressTracker` stores sessions and subscribers in module-level `Map`s. On
Vercel, three separate HTTP requests collaborate on one progress session:
`POST /api/progress/session` (creates it), the worker route
(`evidence/upload-only`, `evidence/extract-content`,
`evidence/assess-uploaded` — writes updates), and
`GET /api/ws/progress` (SSE reader). Whenever two of these land on different
instances, the reader 404s with "Progress session not found" or silently
never receives updates — the UI progress bar stalls at 0% while work
completes fine. Fluid Compute instance reuse makes this work _often_, which
is worse than never: it's an intermittent, environment-dependent failure that
can't be reproduced locally (single dev process = always same "instance").

## Current state

Verified at `ea65d95`:

- `lib/websocket/progress-tracker.ts` — class with
  `sessions: Map<string, ProgressSession>` and
  `subscribers: Map<string, Set<callback>>`; singleton on `globalThis`;
  30s post-completion cleanup via `setTimeout` (lines 106–108, 131–133);
  10-minute expiry sweep `setInterval` (lines 260–271).
  Exposes: `createSession`, `updateProgress`, `completeSession`,
  `errorSession`, `subscribe`, `getSession`, `getUserSessions`.
- `app/api/progress/session/route.ts` — POST: auth via `getCurrentUser`,
  `crypto.randomUUID()` session id, `progressTracker.createSession(...)`.
- `app/api/progress/session/[sessionId]/route.ts` — per-session GET (reads
  from the in-memory tracker).
- `app/api/ws/progress/route.ts` — SSE (`runtime = "nodejs"`): auths the
  user, `progressTracker.getSession(sessionId)` → 404 if absent, 403 if
  `session.userId !== user.id`, then `progressTracker.subscribe(...)` pushes
  updates into a `ReadableStream` with a 30s heartbeat; closes 2s after a
  `completed`/`error` stage.
- Writers (`grep -rln progressTracker app/api`):
  `app/api/evidence/assess-uploaded/route.ts`,
  `app/api/evidence/extract-content/route.ts`,
  `app/api/evidence/upload-only/route.ts`.
  IMPORTANT: in these routes the create/update/SSE-read happen within
  _different requests_, not the same one.
- Client: `hooks/use-progress-tracker.ts` — `new EventSource("/api/ws/progress?sessionId=...")`
  (line 105–106); expects SSE events of shape
  `{ type: "connected" | "progressUpdate" | "heartbeat", ... }`.
- Migration conventions: `supabase/migrations/YYYYMMDDHHMMSS_<name>.sql`,
  idempotent guards; RLS policy style exemplar:
  `supabase/migrations/20260512160000_advisor_rls_hardening.sql`.
- Logging convention: `createLogger` from `@/lib/logger`.

### Design decision (made by the advisor — implement as specified)

Store sessions in a `progress_sessions` table; the SSE route polls the row
every 1.5s and emits an event when `updated_at`/`progress` changed. Polling
(vs Supabase Realtime) is chosen deliberately: no realtime subscription
lifecycle inside a serverless stream, no new client library surface, and a
1.5s cadence is fine for a progress bar. The in-memory tracker remains as a
same-instance fast path is **not** kept — single source of truth is the DB;
that's what makes the behavior deterministic.

## Commands you will need

| Purpose                               | Command                                           | Expected on success |
| ------------------------------------- | ------------------------------------------------- | ------------------- |
| Typecheck / lint                      | `pnpm typecheck && pnpm lint`                     | exit 0              |
| Migration check                       | `pnpm schema:migrations:check`                    | passes              |
| Tests                                 | `pnpm test:integration`                           | all pass            |
| E2E (needs .env QA creds + dev stack) | `pnpm test:ui:bg playwright/tests/upload.spec.ts` | green               |

## Scope

### In scope (Context Files)

- [ ] `supabase/migrations/<timestamp>_progress_sessions_table.sql` (create)
- [ ] `lib/progress/progress-store.ts` (create — DB-backed replacement)
- [ ] `lib/progress/progress-store.test.ts` (create)
- [ ] `lib/websocket/progress-tracker.ts` (delete at the end, or reduce to a
      re-export shim — see Step 5)
- [ ] `app/api/progress/session/route.ts`
- [ ] `app/api/progress/session/[sessionId]/route.ts`
- [ ] `app/api/ws/progress/route.ts`
- [ ] `app/api/evidence/assess-uploaded/route.ts` (call-site swap only)
- [ ] `app/api/evidence/extract-content/route.ts` (call-site swap only)
- [ ] `app/api/evidence/upload-only/route.ts` (call-site swap only)
- [ ] `plans/README.md` (status row only)

### Out of scope

- `hooks/use-progress-tracker.ts` — the SSE event contract
  (`connected`/`progressUpdate`/`heartbeat`) is preserved; the client must
  not need changes. If you find you must change it, STOP.
- `lib/demo/demo-quota.ts` — same in-memory-on-serverless smell, different
  feature; listed in the backlog, not here.
- Supabase Realtime configuration.

## Constraints

- ≤15 files per commit (this plan is near the cap — split into
  migration+store commit, then routes commit).
- The evidence routes update progress with a **user-scoped** Supabase client
  (they already create one for auth); RLS below is designed for that — no
  service-role client may be introduced for progress writes.
- Poll interval 1500ms; SSE heartbeat every 30s (unchanged); hard stream
  timeout of 10 minutes (new — serverless functions shouldn't stream
  forever; the client EventSource auto-reconnects).

## Steps

### Step 1: Migration

`supabase/migrations/<timestamp>_progress_sessions_table.sql` (UTC timestamp
later than all existing migrations):

```sql
CREATE TABLE IF NOT EXISTS public.progress_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation text NOT NULL,
  current_stage text NOT NULL DEFAULT 'initializing',
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','error')),
  message text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.progress_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own progress sessions"
  ON public.progress_sessions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS progress_sessions_user_id_idx
  ON public.progress_sessions (user_id);
```

Match the repo's idempotent `DO $$` guard style if the convention check
demands it (read the two `advisor_*.sql` exemplars first).

**Verify**: `pnpm schema:migrations:check` → passes.

### Step 2: DB-backed store

`lib/progress/progress-store.ts` — same function surface the call sites use,
each taking the caller's `SupabaseClient` as first argument:

- `createProgressSession(supabase, { sessionId, userId, operation })` —
  INSERT row.
- `updateProgress(supabase, sessionId, stage, progress, message, metadata?)` —
  UPDATE clamped progress (`Math.min(100, Math.max(0, p))` — preserve the
  old tracker's clamping, lines 81–82), `updated_at = now`. A missing row
  logs a warn (old behavior: `console.warn("Progress session ... not found")`)
  and returns without throwing.
- `completeProgressSession(supabase, sessionId, message?)` /
  `errorProgressSession(supabase, sessionId, errorText)` — set status,
  progress 100 for complete, message.
- `getProgressSession(supabase, sessionId)` — SELECT single row mapped to
  the existing `ProgressSession` shape (`sessionId, userId, operation,
startTime, currentStage, progress, status`) so route responses don't
  change.

No cleanup timers — add `expires_at`-style cleanup later if needed; rows are
small and user-scoped (note this in the module doc comment).

**Verify**: `pnpm typecheck` → exit 0; unit tests in Step 3.

### Step 3: Unit tests

`lib/progress/progress-store.test.ts` (`node:test`, stub Supabase client
object with recorded calls — see `lib/assessments/export.test.ts` for file
structure): clamping (-5→0, 150→100), missing-row update is a no-op warn not
a throw, row→`ProgressSession` field mapping.

**Verify**: `pnpm test:integration` → all pass.

### Step 4: Swap the routes and writers

- `app/api/progress/session/route.ts` — call
  `createProgressSession(supabase, ...)`; response shape unchanged
  (`{ sessionId, session }`).
- `app/api/progress/session/[sessionId]/route.ts` — read via
  `getProgressSession`; keep the existing not-found/forbidden semantics.
- `app/api/ws/progress/route.ts` — keep auth, 404/403 checks (now via
  `getProgressSession`), the initial `connected` event, and the 30s
  heartbeat. Replace `progressTracker.subscribe` with a 1500ms
  `setInterval` poll: fetch the row; if `updated_at` or `progress` differs
  from the last emitted state, emit a `progressUpdate` event whose `update`
  payload keeps the old field names (`sessionId, stage, progress, message,
timestamp, metadata`). When status becomes `completed`/`error`, emit the
  final update, then close after 2s (matching today's behavior, line 96–98).
  Clear the poll interval and heartbeat in `close()` and on
  `request.signal` abort (`{ once: true }` on the listener). Add the
  10-minute hard timeout from Constraints.
- Evidence routes — swap `progressTracker.X(...)` calls for the new store
  functions, passing the route's existing user-scoped `supabase` client.

**Verify**: `pnpm typecheck && pnpm lint` → exit 0;
`grep -rn "progressTracker" app/` → no hits.

### Step 5: Retire the old tracker

If `grep -rn "progress-tracker" app lib components hooks --include="*.ts*"`
shows no remaining importers, `git rm lib/websocket/progress-tracker.ts`. If
something still imports it, STOP and report the importer instead of leaving
both systems alive. If `lib/websocket/` is then empty, remove the directory.

**Verify**: `pnpm typecheck && pnpm lint && pnpm test:integration` → green.

### Step 6: E2E + commit

If `.env` QA creds and a dev stack exist: run
`pnpm test:ui:bg playwright/tests/upload.spec.ts` and watch
`playwright/helpers/observability.ts` output for failed `/api/ws/progress`
or `/api/progress/session` requests. Otherwise state the E2E was skipped and
why.

Two commits on `fix/durable-progress-tracking` (≤15 files each):

```
feat(progress): add DB-backed progress session store
fix(progress): serve progress SSE and writers from progress_sessions table

Implements: plans/task-2026-06-11-durable-progress-tracking.md
```

## Test Plan

- [ ] Store unit tests (clamping, missing-row no-op, shape mapping).
- [ ] Existing integration + SCF suites green.
- [ ] Playwright upload spec green when environment allows; the SSE contract
      (`connected`/`progressUpdate` event names) unchanged is the key assert.

## Acceptance Criteria / Done criteria (all must hold)

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test:integration`,
      `pnpm schema:migrations:check` all exit 0
- [ ] `grep -rn "progressTracker\|progress-tracker" app lib hooks components --include="*.ts*"` → zero hits
- [ ] `hooks/use-progress-tracker.ts` untouched (`git diff --stat` confirms)
- [ ] RLS policy present on `progress_sessions` (in the migration file)
- [ ] No commit touched >15 files
- [ ] `plans/README.md` status row updated

## STOP conditions

- The SSE event contract can't be preserved without editing
  `hooks/use-progress-tracker.ts` — stop; the client file is out of scope by
  design and a human should approve widening it.
- An evidence route writes progress from a context with **no authenticated
  Supabase client** (e.g. a background continuation after the response) —
  RLS would reject the write; report which route and line.
- The migration cannot be applied to the live DB before code deploy
  (sequencing risk identical to the dashboard plan).
- Drift: cited lines don't match the excerpts.

## Maintenance notes

- Deploy ordering: migration first (`pnpm dlx supabase db push`), then code.
- Reviewers should scrutinize: interval cleanup on every stream-exit path
  (abort, cancel, complete, timeout) — leaked intervals on serverless waste
  the instance until recycle.
- Row cleanup is deliberately deferred: add a `pg_cron` sweep or
  `expires_at` TTL if `progress_sessions` ever grows meaningfully.
- `lib/demo/demo-quota.ts` has the same in-memory-on-serverless limitation
  (documented in its header comment); if that's ever fixed, this table/RLS
  pattern is the template.

## Approval Gate

- [ ] Goal is clear
- [ ] Context files listed
- [ ] Constraints explicit
- [ ] Test plan defined
- [ ] Acceptance criteria measurable
- [ ] Human approved
