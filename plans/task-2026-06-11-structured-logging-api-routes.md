# Task Spec: Replace console.\* with createLogger in app/api and lib, and enforce it

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ea65d95..HEAD -- app/api/ lib/ eslint.config.mjs`
> Large drift in `app/api/` is EXPECTED if
> `plans/task-2026-06-11-sanitize-api-error-responses.md` already landed
> (it removes some console.error sites). Re-run the Step 1 inventory rather
> than trusting counts below; treat other mismatches as STOP.

## Metadata

- Date: 2026-06-11
- Owner: agent (advisor plan 003)
- Status: Draft
- Branch: `refactor/structured-logging-api-routes`
- Planned at: commit `ea65d95`
- Priority: P2 · Effort: M · Risk: LOW · Category: dx
- Depends on: plans/task-2026-06-11-sanitize-api-error-responses.md

## Goal

Migrate every `console.log/warn/error` in `app/api/` and `lib/` to the
repo's structured logger, then tighten the ESLint rule so the convention is
actually enforced instead of merely documented.

## Why this matters

AGENTS.md states "No `console.log` in `app/api/`, `lib/`. Use `createLogger`"
— but the ESLint rule at `eslint.config.mjs:25` is
`"no-console": ["warn", { allow: ["warn", "error", "info", "debug"] }]`,
which **allows** `console.error`/`console.warn` entirely and only _warns_ on
`console.log` (and `pnpm lint` runs `--quiet`, hiding warnings; lint-staged
also runs `--quiet`). Result: ~180 unstructured `console.*` calls across ~54
files in `app/api/` + `lib/` (measured at `ea65d95`), producing logs with no
module name, no JSON structure, and no level filtering — while a structured
logger (`lib/logger.ts`) sits right there, already used by the newer code.
The convention is real; the enforcement is a no-op. Fix both.

## Current state

- `lib/logger.ts` — the logger. API:
  ```ts
  import { createLogger } from "@/lib/logger";
  const log = createLogger("module-name");
  log.info("event_name", { key: "value" }); // also .debug/.warn/.error
  ```
  Internally it calls `console.debug/info/warn/error` with a JSON payload —
  so the ESLint enforcement needs an exception for this one file.
- `lib/observability/logger.ts` — `createRequestLogger` for request-scoped
  API logging (per AGENTS.md). Use it where a route already threads request
  context; otherwise plain `createLogger` is fine.
- Exemplar of the target style: `app/api/evidence/route.ts` (top of file
  creates a logger; line 70 `logger.error("evidence.get.fetch_failed", { message: error.message })`).
- Typical offenders (verified): `app/api/assessments/route.ts:234, 251, 270, 281`
  (`console.error`/`console.warn`), `lib/websocket/progress-tracker.ts:77, 96, 117, 211`
  (`console.warn`/`console.error`).
- ESLint config: `eslint.config.mjs` — line 25 has the permissive rule;
  line 68 has `"no-console": "off"` in a later block (check which files that
  block targets before editing — likely `scripts/**`, which must stay
  allowed: seeders print to stdout by design).

## Commands you will need

| Purpose   | Command                                                                                                         | Expected on success                           |
| --------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Inventory | `grep -rn "console\.\(log\|error\|warn\|info\|debug\)" app/api lib --include="*.ts" \| grep -v "lib/logger.ts"` | shrinking list                                |
| Typecheck | `pnpm typecheck`                                                                                                | exit 0                                        |
| Lint      | `pnpm lint`                                                                                                     | exit 0 (rule now error-level for these paths) |
| Tests     | `pnpm test:integration && pnpm test:scf`                                                                        | all pass                                      |

## Scope

### In scope (Context Files)

- [ ] All `*.ts` files under `app/api/` and `lib/` containing `console.*`
      calls (inventory in Step 1; ~54 files at planning time)
- [ ] `eslint.config.mjs` (rule tightening only)
- [ ] `plans/README.md` (status row only)

### Out of scope

- `scripts/**` — CLI output via console is intentional there.
- `components/`, `hooks/`, `app/(pages)` — client-side console usage is a
  different policy question; do not touch (e.g.
  `hooks/use-progress-tracker.ts` keeps its `console.error`).
- `lib/logger.ts` internals — it legitimately calls console; exempt it in
  lint, don't rewrite it.
- Any behavioral change: this is a logging-call swap, not error-handling
  redesign (that was the previous plan).

## Constraints

- ≤15 files per commit — with ~54 files this is roughly 4+ commits; batch by
  directory (`app/api/evidence`, `app/api/assessments`, `lib/compliance`, …).
- Each batch independently passes `pnpm lint && pnpm typecheck`.
- Log _event names_ follow the existing dot convention seen in the codebase
  (`"inbox_generator.gap_fetch_error"`, `"evidence.get.fetch_failed"`):
  `<module>.<event>` in snake_case. Error objects go in the data payload as
  `{ detail: error instanceof Error ? error.message : String(error) }` —
  NOT under a `message` key: `lib/logger.ts` formatMessage spreads `data`
  after setting `message`, so a `message` data key silently overwrites the
  event name (bug found during plan 002 review). Existing log calls with a
  `message` data key (e.g. `app/api/evidence/route.ts`) have this collision
  today — rename them to `detail` as you touch those files.

## Steps

### Step 1: Inventory

Run the inventory grep (Commands table). Save the list. Group by directory
into commit batches of ≤15 files.

### Step 2: Migrate, batch by batch

Per file: add `const log = createLogger("<module-name>")` once at module
scope (name = file's purpose, kebab/snake matching neighbors), convert each
`console.error(msg, err)` → `log.error("<module>.<event>", { message: ... })`,
`console.warn` → `log.warn`, `console.log` → `log.info` or `log.debug`
(judgment: developer-trace noise → debug; operational events → info). Where a
route already imports `createRequestLogger`, extend that usage instead of
adding a second logger.

Commit per batch:
`refactor(logging): structured logger in <area> routes` +
`Implements: plans/task-2026-06-11-structured-logging-api-routes.md`.

**Verify per batch**: `pnpm typecheck && pnpm lint` → exit 0.

### Step 3: Tighten ESLint

In `eslint.config.mjs`, add a config block scoped to
`["app/api/**/*.ts", "lib/**/*.ts"]` with:

```js
"no-console": "error",
```

and a following block scoped to `["lib/logger.ts", "lib/observability/logger.ts"]`
with `"no-console": "off"` (check whether `lib/observability/logger.ts` also
calls console before exempting it — only exempt what needs it). Confirm the
existing line-68 `"no-console": "off"` block's `files` globs don't overlap
`app/api`/`lib`; if they do, STOP and report.

**Verify**: `pnpm lint` → exit 0. Then prove the gate works: temporarily add
`console.log("x")` to any `app/api` route, run `pnpm lint`, expect a hard
error; remove it.

### Step 4: Full validation

**Verify**: inventory grep returns only `lib/logger.ts` (+ the exempted
observability logger, if applicable); `pnpm test:integration && pnpm test:scf`
green.

## Test Plan

- [ ] No new unit tests required (mechanical swap); existing suites must stay
      green — they are the regression net.
- [ ] The lint-gate proof in Step 3 (add/remove a console.log) is the
      enforcement test.

## Acceptance Criteria / Done criteria (all must hold)

- [ ] Inventory grep: zero hits in `app/api/` and `lib/` outside exempted
      logger files
- [ ] `pnpm lint` exits 0 AND errors on an injected `console.log` in app/api
- [ ] `pnpm typecheck`, `pnpm test:integration`, `pnpm test:scf` exit 0
- [ ] No commit touched >15 files
- [ ] `plans/README.md` status row updated

## STOP conditions

- The line-68 `no-console: off` block in `eslint.config.mjs` targets files
  that overlap this plan's scope in a way you can't cleanly separate.
- A `console.*` call turns out to be load-bearing output parsed by a script
  or test (search the string in `scripts/` and `playwright/` first if a call
  looks odd).
- `pnpm lint` reports pre-existing unrelated errors after the rule change
  (means the rule caught files outside your migration list — re-inventory
  rather than mass-suppressing).

## Maintenance notes

- After this lands, the AGENTS.md statement is true _and enforced_; future
  agents can't regress it silently.
- Reviewers: spot-check event names for the `<module>.<event>` convention and
  that no log call dropped error context that the old console call had.
- Deferred: client-side (`components/`, `hooks/`) logging policy.

## Approval Gate

- [ ] Goal is clear
- [ ] Context files listed
- [ ] Constraints explicit
- [ ] Test plan defined
- [ ] Acceptance criteria measurable
- [ ] Human approved
