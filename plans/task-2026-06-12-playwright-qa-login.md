# Task Spec: Restore a real QA login for Playwright (storage-state auth)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
>
> **Drift check (run first)**:
> `git diff --stat b2f8c24..HEAD -- playwright/ playwright.config.ts scripts/ AGENTS.md`
> On logic-level mismatch with "Current state", STOP.

## Metadata

- Date: 2026-06-12
- Owner: agent (advisor plan 006)
- Status: In Progress (dispatched 2026-06-12)
- Branch: `fix/playwright-qa-login`
- Planned at: commit `b2f8c24`
- Priority: P1 · Effort: M · Risk: MED · Category: tests/dx
- Depends on: none (plans 001–005 merged)

## Goal

Playwright's `login_test_user` sets a dead `x-test-bypass-auth` header
instead of logging in, so API routes have no session and every unmocked
endpoint returns 500 — `dashboard.spec.ts` and `upload.spec.ts` fail by
construction. Replace the bypass with a real QA login captured once into a
Playwright storage state, formalize QA-user provisioning, and correct the
stale AGENTS.md claim.

## Why this matters

The browser suite is the repo's mandated dogfooding gate (AGENTS.md), but it
cannot pass today, so it gates nothing. A real session makes the
observability assertions (`assert_no_browser_failures`) meaningful again and
lets future plans (e.g. the durable progress flow) be smoke-tested for real.

## Current state (verified at `b2f8c24`)

- `playwright/helpers/login.ts` — `loginTestUser` sets
  `x-test-bypass-auth: 1` (lines 4, 11) and opens `/dashboard`. **No code in
  the repo honors that header** (verified by grep) — it is a vestige.
- `playwright/helpers/browser-skills.ts:3,18–20` — re-exports
  `login_test_user` which delegates to `loginTestUser`. 10 specs call it
  (assessments, analytics, dashboard-navigation, artifact-classifier,
  compliance-autopilot, critical-path, dashboard, evidence-errors, evidence,
  upload); 4 do not (admin-ai-provider-health, auth, onboarding-funnel,
  public-pages).
- Sign-in UI: `/auth` page; client-side `signInWithPassword` via
  `components/providers/auth-provider.tsx:63`. Stable testids in
  `playwright/helpers/selectors.ts`: `auth-tab-signin`, `signin-email-input`,
  `signin-password-input`, `signin-submit-button` (testid strings; access in
  specs via `selectors.auth.*`).
- `playwright.config.ts` — single `chromium` project, `workers: 1`, no
  dotenv loading, webServer `pnpm dev` with `reuseExistingServer`.
- Credentials: `.env.local` (gitignored) now contains `QA_USER_EMAIL`
  (`dogfood@local.dev`) and `QA_USER_PASSWORD`; the user exists in the
  linked Supabase project, email-confirmed, sign-in verified 2026-06-12.
  NEVER print or commit these values.
- `.gitignore:37` — `/playwright/artifacts/` is ignored → safe home for the
  storage-state file.
- `AGENTS.md` "Dogfood / QA auth" section claims `.env` holds the QA vars —
  stale (no `.env` exists).
- `dotenv` is already a dependency (`^17`).

## Commands you will need

| Purpose    | Command                               | Expected          |
| ---------- | ------------------------------------- | ----------------- |
| Typecheck  | `pnpm typecheck`                      | exit 0            |
| Lint       | `pnpm lint`                           | exit 0            |
| Unit tests | `pnpm test:integration`               | all pass          |
| E2E        | `pnpm test:ui:bg <spec>` / full suite | see done criteria |

## Scope

### In scope (Context Files — the only files you may modify)

- [ ] `scripts/qa-user-ensure.ts` (create)
- [ ] `package.json` (one script entry)
- [ ] `playwright.config.ts`
- [ ] `playwright/setup/auth.setup.ts` (create)
- [ ] `playwright/helpers/login.ts`
- [ ] Signed-out specs needing a storage-state opt-out (judgment per Step 4):
      `auth.spec.ts`, `public-pages.spec.ts`, `onboarding-funnel.spec.ts`,
      `admin-ai-provider-health.spec.ts`
- [ ] `playwright/helpers/mocks.ts` (ONLY if Step 5 verification surfaces an
      unmocked endpoint that is expensive/AI-backed — see escape hatch)
- [ ] `AGENTS.md` (QA auth section only)
- [ ] `plans/task-2026-06-12-playwright-qa-login.md` (Status line only)

### Out of scope

- The 10 login-using specs' bodies — `login_test_user`'s signature and
  call sites stay identical.
- The 401-vs-500 behavior of compliance routes (separate backlog item).
- CI config (Playwright is not in CI).
- `proxy.ts`, `lib/auth/**` — no server-side auth changes at all.

## Constraints

- ≤15 files per commit; lint/typecheck clean per commit.
- No secrets in code, logs, committed files, or your report — read creds
  from env only; fail fast with a clear message naming the missing VAR.
- ESLint `no-console` is error-level in `app/`+`lib/` — `scripts/` is exempt
  (console fine there); Playwright helpers are outside the rule's scope but
  follow existing helper style.

## Steps

### Step 1: Provisioning script

`scripts/qa-user-ensure.ts` (pattern: other `scripts/*.ts`, run via
`node --import tsx`): load `.env.local` via `dotenv`; require
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `QA_USER_EMAIL`,
`QA_USER_PASSWORD`; with a service-role client, `listUsers` → if
`QA_USER_EMAIL` exists, `updateUserById` to set the password; else
`createUser` with `email_confirm: true`. Print only
"QA user ensured: <email>" — never the password. Add package.json script:
`"qa:user:ensure": "node --import tsx scripts/qa-user-ensure.ts"`.

**Verify**: `pnpm qa:user:ensure` → "QA user ensured: dogfood@local.dev"
(idempotent; the user already exists). `pnpm typecheck && pnpm lint` → exit 0.

### Step 2: Playwright config — dotenv + setup project

In `playwright.config.ts`: load env at top
(`import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });`).
Define `const QA_STORAGE_STATE = "playwright/artifacts/.auth/qa.json";`
Projects:

```ts
projects: [
  { name: "setup", testMatch: /auth\.setup\.ts/, testDir: "./playwright/setup" },
  {
    name: "chromium",
    use: { ...devices["Desktop Chrome"], storageState: QA_STORAGE_STATE },
    dependencies: ["setup"],
  },
],
```

Export `QA_STORAGE_STATE` (or define it in a small shared module) so
`auth.setup.ts` imports the same path.

### Step 3: The setup test

`playwright/setup/auth.setup.ts`: a single `setup` test (use
`test as setup` from `@playwright/test`) that fails fast with a clear error
if `QA_USER_EMAIL`/`QA_USER_PASSWORD` are unset, then: goto `/auth`, click
`auth-tab-signin` if needed, fill `signin-email-input` /
`signin-password-input`, click `signin-submit-button`, wait for the
dashboard (URL `/dashboard` and the "Compliance Dashboard" heading — same
assertions `loginTestUser` uses today), then
`await page.context().storageState({ path: QA_STORAGE_STATE })` (ensure the
directory exists — `fs.mkdirSync(..., { recursive: true })`).

**Verify** (Steps 2+3 together): `pnpm test:ui:bg playwright/tests/dashboard.spec.ts`
→ setup project runs first and passes; the storage-state file exists;
`git status --porcelain` shows NO new tracked files from it (artifacts dir is
gitignored).

### Step 4: Rewrite the login helper + signed-out opt-outs

- `playwright/helpers/login.ts`: delete the bypass header entirely.
  `loginTestUser(page)` becomes: navigate to `/dashboard` (session already
  present from storage state) and keep the existing three post-login
  assertions (URL, heading, overviewCard). If the page lands on `/auth`
  instead, throw with a message pointing at `pnpm qa:user:ensure` and the
  setup project.
- For each of the 4 non-login specs, decide: does it assert signed-out UI
  (auth form, "Sign in" nav, public pages)? If yes, add at the top of the
  file: `test.use({ storageState: { cookies: [], origins: [] } });`
  If a spec is agnostic (works either way), leave it untouched and note it.

**Verify**: `pnpm test:ui:bg playwright/tests/auth.spec.ts playwright/tests/public-pages.spec.ts`
→ pass.

### Step 5: Full-suite verification

`PLAYWRIGHT_HEADLESS=1 pnpm test:ui:bg` (full suite, workers:1 — expect
~10–20 min). Triage results:

- `dashboard.spec.ts`, `upload.spec.ts`, `auth.spec.ts` MUST pass — these
  are the done criteria.
- Other specs that fail: classify each failure in your report
  (pre-existing vs caused by this change). A failure caused by the now-real
  session (e.g. an endpoint returning real empty-state data where the spec
  expected mock values, or a _signed-in_ nav where the spec expected
  signed-out) may be fixed ONLY by the opt-out pattern from Step 4 or a
  targeted mock in `mocks.ts`; anything needing deeper spec surgery → report,
  don't fix.
- ESCAPE HATCH (AI cost): if the suite triggers a real AI-backed endpoint
  (watch the dev-server output for provider calls — e.g. guidance
  generation), STOP the run, add a `page.route` mock for that endpoint in
  the relevant `mocks.ts` helper, and note it. Do not let tests spend AI
  tokens.

### Step 6: AGENTS.md + commits

Update the "Dogfood / QA auth" section: `.env.local` (not `.env`) holds
`QA_USER_EMAIL`/`QA_USER_PASSWORD`; `pnpm qa:user:ensure` provisions or
resets the QA user (requires service-role key); Playwright signs in once via
`playwright/setup/auth.setup.ts` and reuses the session via storage state.

Commits on `fix/playwright-qa-login` (≤15 files each), e.g.:

```
test(e2e): replace dead auth bypass with real QA login via storage state
docs: correct QA auth section in AGENTS.md

Implements: plans/task-2026-06-12-playwright-qa-login.md
```

Final commit includes this spec file with `- Status: Done (2026-06-12)`.

## Test Plan

- The setup project + dashboard/upload/auth specs ARE the test plan.
- `pnpm test:integration` and `pnpm test:scf` stay green (no app code
  changes expected — this plan touches test infra + scripts + docs only).

## Acceptance Criteria / Done criteria (all must hold)

- [ ] `grep -rn "x-test-bypass-auth" playwright/ app/ lib/ proxy.ts` → zero hits
- [ ] `pnpm test:ui:bg playwright/tests/dashboard.spec.ts playwright/tests/upload.spec.ts playwright/tests/auth.spec.ts` → all pass
- [ ] Full-suite run executed; every failing spec classified in the report
- [ ] `pnpm qa:user:ensure` idempotent (run twice, same success output)
- [ ] No secret values in any committed file or in the report
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test:integration` exit 0
- [ ] AGENTS.md QA section matches reality

## STOP conditions

- The sign-in flow requires anything beyond email+password (captcha, OTP,
  email link) — report; do not script around it.
- Supabase auth rate-limits block the setup login repeatedly.
- A full-suite failure can't be classified as pre-existing vs
  change-caused within a reasonable look.
- Fixing a signed-out spec requires changing its assertions (not just the
  storage-state opt-out).

## Maintenance notes

- The storage-state file lives under the gitignored artifacts dir and is
  recreated by the setup project every run — safe to delete anytime.
- If the QA password is rotated: update `.env.local`, run
  `pnpm qa:user:ensure`.
- Supabase access tokens expire (~1h); the setup project re-logs-in each
  run, so long-lived staleness only matters for runs exceeding token TTL.
- Future specs asserting signed-out UI must add the storage-state opt-out.

## Approval Gate

- [ ] Goal is clear
- [ ] Context files listed
- [ ] Constraints explicit
- [ ] Test plan defined
- [ ] Acceptance criteria measurable
- [ ] Human approved (user requested 2026-06-12: "let's restore a real QA login for Playwright")
