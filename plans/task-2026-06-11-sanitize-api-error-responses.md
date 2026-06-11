# Task Spec: Stop leaking internal error details in API responses

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ea65d95..HEAD -- app/api/ lib/api/`
> If in-scope files changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Metadata

- Date: 2026-06-11
- Owner: agent (advisor plan 002)
- Status: Draft
- Branch: `fix/sanitize-api-error-responses`
- Planned at: commit `ea65d95`
- Priority: P1 · Effort: M · Risk: LOW · Category: security
- Depends on: none

## Goal

API routes return raw `error.message` (Supabase/Postgres errors, exception
text) in JSON error bodies. Introduce one small helper that logs the detail
server-side and returns a generic message to the client, then sweep every
route handler under `app/api/` onto it.

## Why this matters

Raw database and exception messages disclose schema names, constraint names,
file paths, and provider internals to any caller who can trigger a 4xx/5xx —
including the unauthenticated `/api/try-it-out/demo` path. That is classic
reconnaissance material. The information belongs in server logs (where the
repo already has a structured logger), not in HTTP responses.

## Current state

Verified leak sites at commit `ea65d95` (raw detail inside the **response
body**, not just logs):

- `app/api/assessments/route.ts:236` —
  `{ error: \`Failed to create assessment: ${assessmentError.message}\` }`and`:284–288`— catch-all returns`error.message`as the`error` field.
- `app/api/documents/route.ts:71` —
  `return NextResponse.json({ error: error.message }, { status: 500 });`
- `app/api/progress/session/route.ts:30–37` and
  `app/api/progress/session/[sessionId]/route.ts:98` — 500 body includes
  `message: error instanceof Error ? error.message : "Unknown error"`.
- `app/api/evidence/route.ts:106, 458, 464, 580, 679` — response bodies with
  `message: error instanceof Error ? error.message : "unknown"`.
- `app/api/evidence/upload-only/route.ts:584, 590`,
  `app/api/evidence/reindex-content/route.ts:199, 237, 293`,
  `app/api/evidence/assess-uploaded/route.ts:424`,
  `app/api/try-it-out/demo/route.ts:290` — same pattern.
- More exist; Step 3 sweeps by grep rather than trusting this list to be
  exhaustive.

Note the distinction: `app/api/evidence/route.ts:70` passes `error.message`
to `logger.error(...)` — **that is fine and stays**. Only response bodies
change.

Conventions that apply:

- Logger: `import { createLogger } from "@/lib/logger"`; request-scoped
  variant `createRequestLogger` in `lib/observability/logger.ts`. Exemplar
  usage: top of `app/api/evidence/route.ts`.
- `app/api/` may import `lib/` (AGENTS.md import table); a helper in
  `lib/api/` is the right home — `lib/api/rate-limit-config.ts` already
  exists as precedent.
- Error-body shape used across routes is `{ error: string }` (sometimes plus
  `message`). Clients (`lib/client/smart-evidence-workflow.ts:153–155`) read
  `payload.error ?? payload.message` — keep `{ error: string }` working.

## Commands you will need

| Purpose    | Command                                           | Expected on success                                         |
| ---------- | ------------------------------------------------- | ----------------------------------------------------------- |
| Typecheck  | `pnpm typecheck`                                  | exit 0                                                      |
| Lint       | `pnpm lint`                                       | exit 0                                                      |
| Unit tests | `pnpm test:integration`                           | all pass                                                    |
| Leak scan  | see Done criteria grep                            | no response-body hits                                       |
| E2E smoke  | `pnpm test:ui:bg playwright/tests/upload.spec.ts` | green (requires `.env` QA creds; skip if absent and say so) |

## Scope

### In scope (Context Files)

- [ ] `lib/api/error-response.ts` (create)
- [ ] `lib/api/error-response.test.ts` (create)
- [ ] Files under `app/api/**/route.ts` whose **response bodies** embed
      `error.message` / exception text (the verified list above plus grep
      results from Step 3)
- [ ] `plans/README.md` (status row only)

### Out of scope

- Log statements that include `error.message` — correct as-is (a later plan,
  `task-2026-06-11-structured-logging-api-routes.md`, migrates `console.*`
  to the logger; don't do that work here beyond the lines you already touch).
- Changing response **shapes** beyond removing detail text — keep
  `{ error: string }` and HTTP status codes exactly as they are.
- `lib/client/**` — client error display copes with generic messages already.
- Validation-error messages built from _request_ data (e.g. "Assessment ID is
  required") — those are intentional and stay.

## Constraints

- ≤15 files per commit (repo rule): batch the sweep into multiple commits
  grouped by route family (evidence, assessments, progress, misc).
- `pnpm lint` and `pnpm typecheck` must be clean before each commit.

## Steps

### Step 1: Create the helper

`lib/api/error-response.ts`:

```ts
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("api-error");

/**
 * Log full error detail server-side; return only a generic, caller-safe
 * message. `context` is a stable event name like "assessments.create_failed".
 */
export function apiError(
  context: string,
  publicMessage: string,
  status: number,
  error?: unknown
): NextResponse {
  log.error(context, {
    status,
    message: error instanceof Error ? error.message : String(error ?? ""),
  });
  return NextResponse.json({ error: publicMessage }, { status });
}
```

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Unit-test the helper

`lib/api/error-response.test.ts` (pattern: `lib/assessments/export.test.ts`,
`node:test`): asserts (a) returned status matches, (b) body is exactly
`{ error: publicMessage }`, (c) body JSON does NOT contain the underlying
error text.

**Verify**: `pnpm test:integration` → all pass.

### Step 3: Enumerate the real site list

```sh
grep -rn "error.message" app/api --include="*.ts" | grep -v "log\.\|logger\."
```

Every hit where the value flows into a `NextResponse.json(...)` body (or
`new Response(JSON.stringify(...))`) is in scope. Record the list in your
progress notes. Expect roughly 15–25 sites across ~10 files.

### Step 4: Sweep, in batches

For each site, replace the response with `apiError(...)`, choosing:

- `context`: `"<area>.<operation>_failed"` (e.g. `"evidence.upload_failed"`).
- `publicMessage`: the route's existing generic prefix without the appended
  detail — e.g. `"Failed to create assessment"` instead of
  ``\`Failed to create assessment: ${assessmentError.message}\``.
- Keep the original status code.
- Where a `console.error(...)` immediately precedes the response and exists
  only to dump the same error, delete it (apiError logs it); leave any other
  logging alone.

Commit per route family (conventional commits, e.g.
`fix(api): sanitize evidence route error responses`, body line
`Implements: plans/task-2026-06-11-sanitize-api-error-responses.md`).

**Verify after each batch**: `pnpm typecheck && pnpm lint` → exit 0.

### Step 5: Final scan + tests

**Verify**:
`grep -rn "error.message" app/api --include="*.ts" | grep -v "log\.\|logger\.\|apiError"`
→ remaining hits (if any) are NOT inside response bodies — list each and why
it stays. Then `pnpm test:integration` → green; run the E2E smoke if `.env`
QA creds exist.

## Test Plan

- [ ] Helper unit tests (status, body shape, no-detail assertion).
- [ ] Existing integration suite green.
- [ ] Optional: `pnpm test:ui:bg playwright/tests/upload.spec.ts` —
      `playwright/helpers/observability.ts` surfaces non-2xx responses;
      confirm no new failures.

## Acceptance Criteria / Done criteria (all must hold)

- [ ] `pnpm typecheck` exits 0; `pnpm lint` exits 0
- [ ] `pnpm test:integration` exits 0 incl. new helper tests
- [ ] The Step 5 grep shows zero response-body leaks
- [ ] All listed verified sites use `apiError`
- [ ] Response shapes still `{ error: string }` with unchanged status codes
- [ ] No commit touched >15 files (`git log --stat`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- A Playwright spec or integration test asserts on the _detailed_ error text
  of a response you're sanitizing — stop and report which test, don't weaken
  the test yourself.
- You find a route whose client demonstrably branches on detailed error text
  (search `lib/client/` for the string before changing it).
- Drift: cited lines don't match the excerpts.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- New routes should use `apiError` from day one — worth a line in AGENTS.md's
  code-quality rules in a future docs pass (deliberately not in this plan's
  scope to keep the diff reviewable).
- Reviewers should scrutinize: no status-code changes, no removed
  user-actionable validation messages.
- Follow-up deferred: migrating remaining `console.*` to `createLogger`
  (separate plan, depends on this one).

## Approval Gate

- [ ] Goal is clear
- [ ] Context files listed
- [ ] Constraints explicit
- [ ] Test plan defined
- [ ] Acceptance criteria measurable
- [ ] Human approved
