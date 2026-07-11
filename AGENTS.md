# AGENTS.md

Single source of truth for all AI coding agents working on Graphletter (Claude Code, Codex, Cursor, Copilot, etc).

## What this project is

**Graphletter** — AI-powered compliance validation. Evidence documents → Secure Controls Framework (SCF; 66 mapped frameworks, see `MAPPED_FRAMEWORK_COUNT` in `lib/scf-parser.ts`) → automated compliance reports.

Stack: Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind + shadcn/ui · Supabase (Postgres + RLS + Storage) · Vercel AI SDK · pnpm.

Deploy: Vercel (serverless). Auth: Supabase SSR — see `lib/supabase/server.ts` and `lib/auth/supabase-auth.ts`.

## Commands

```sh
pnpm dev              # localhost:3000
pnpm build            # production build
pnpm lint             # ESLint (quiet)
pnpm typecheck        # tsc --noEmit
pnpm test:scf         # SCF parser unit tests
pnpm test:integration # Node integration tests
pnpm test:ui:bg       # Playwright headless (default for agents)
pnpm test:ui:critical # Critical path only (headed)
pnpm schema:migrations:check  # Migration naming/ordering
pnpm schema:drift:check       # Schema drift (non-strict; strict variant requires Supabase CLI + Docker)
```

Full script list lives in `package.json`. Do not duplicate it here — it rots.

## Commit conventions (enforced by commitlint)

- Format: `type: description` (Conventional Commits)
- Types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `perf`, `ci`, `build`
- Reference the implementing spec when applicable: `Implements: plans/task-YYYY-MM-DD-slug.md`
- `--no-verify` is for real emergencies only; document the reason in the commit body.

## Task specs

Every task gets its own file at `plans/task-YYYY-MM-DD-<slug>.md` from `plans/task-template.md`. Implementation begins only after the spec is approved. Archive completed specs to `plans/archive/` after merge. Never append to a shared spec file.

Required sequence: (1) create spec from template → (2) get approval → (3) implement → (4) run validation commands → (5) confirm acceptance criteria.

## Scope and blast radius

- **Only modify files listed in the task spec's "Context Files" section.** Out-of-scope edits require an explicit spec expansion.
- **No single commit touches more than 15 files.** Break larger changes into sequential, reviewable commits.

<important if="you are about to commit">
Before every commit, verify: (a) `pnpm lint` clean, (b) `pnpm typecheck` clean, (c) staged file count ≤ 15. If any fail, fix the root cause — do not bypass with `--no-verify`.
</important>

## Code quality rules

- **No `console.*` in `app/api/`, `lib/`.** Use `createLogger` from `@/lib/logger`. For request-scoped API logging, use `createRequestLogger` from `@/lib/observability/logger`. ESLint enforces this (error). Put error text under a `detail` key in the log data payload — a `message` key silently overwrites the event name.
- **No `TODO`/`FIXME` without a GitHub issue:** `// TODO(#123): description`.
- **No `as any` without a justifying comment on the same line.**
- **Never use `"latest"` as a version specifier.** Pin with `^` (e.g., `"^1.2.3"`).
- **Do not add Node builtins as dependencies** (`fs`, `path`, etc.).

## Import boundaries

| From          | May import               | May NOT import                         |
| ------------- | ------------------------ | -------------------------------------- |
| `components/` | `lib/`, `components/ui/` | `app/api/`, `scripts/`                 |
| `app/api/`    | `lib/`                   | `components/`, other `app/api/` routes |
| `lib/`        | other `lib/`             | `components/`, `app/`                  |
| `app/(pages)` | `components/`, `lib/`    | `app/api/` internals                   |

ESLint enforces the `components/ ↔ app/api/` boundaries as **errors** (see `eslint.config.mjs`). The others are conventions.

## Logging

```ts
import { createLogger } from "@/lib/logger";
const log = createLogger("module-name");
log.info("message", { key: "value" });
```

Don't build logging wrappers — use this one.

## AI providers

Config lives in `lib/ai-config.ts`. That file is the source of truth — don't restate model names or temperatures here. If you change routing, update comments in that file, not this one.

## Dogfooding (UI work)

<important if="your change affects user-visible behavior">
Every user-visible change must be exercised in a browser, not just read.

1. Update or add a spec under `playwright/tests/`.
2. Prefer `data-testid` selectors (see `playwright/helpers/selectors.ts`).
3. Run `pnpm test:ui:bg <spec-path>` until green.
4. Review browser-observed failures (console errors, failed requests, non-2xx API responses) via `playwright/helpers/observability.ts`.

Artifacts land in `playwright/artifacts/`.
</important>

Key Playwright helpers: `browser-skills.ts` (agent-style wrappers), `selectors.ts`, `observability.ts`, `mocks.ts`.

When QA-ing UI, verify **state coherence**, not just function (lesson from 2026-07-09):

- Actions offered in a dialog/panel must match the record's state in the list you came from — never offer "Approve" on an already-approved record.
- No two adjacent affordances may share a glyph but differ in behavior (e.g., two chevrons, one expands and one navigates).
- Status indicators must agree across list, detail, and summary surfaces for the same record.

## Schema / migration work

<important if="you are changing the Supabase schema">
Run `pnpm schema:migrations:check` (always available) and `pnpm schema:drift:check` before committing. The strict variant of the drift check (`--strict` flag on `scripts/schema-drift-check.js`) requires a local Supabase stack on port 54322 (Supabase CLI + Docker).
</important>

For fresh local bootstrap, authenticate the Supabase CLI first: `pnpm dlx supabase login`, then `pnpm dlx supabase link --project-ref ...`, then `pnpm dlx supabase db push`.

## Dogfood / QA auth

`.env.local` (gitignored) holds `QA_USER_EMAIL` and `QA_USER_PASSWORD` for
Playwright and manual dogfooding. Never commit these values.

`pnpm qa:user:ensure` provisions or resets the QA user in the linked Supabase
project (idempotent — safe to run at any time; requires `SUPABASE_SERVICE_ROLE_KEY`).

Playwright signs in once at the start of each run via
`playwright/setup/auth.setup.ts` and stores the resulting session in
`playwright/artifacts/.auth/qa.json` (gitignored). All specs that call
`login_test_user` reuse this session via `storageState` — no browser-visible
login flow per test. Specs that need to assert the signed-out UI must opt out
at the file level: `test.use({ storageState: { cookies: [], origins: [] } });`

## What NOT to put in this file

- Package lists or dependency versions (see `package.json`).
- ESLint / Prettier config details (see `eslint.config.mjs`, `.prettierrc`).
- Model names or AI temperatures (see `lib/ai-config.ts`).
- Playwright config details (see `playwright.config.ts`).
- SCF data import details (see `SEEDING.md`; `pnpm seed` is the orchestrator, `pnpm seed:reset` is the wipe-and-reseed path for SCF version bumps, and `scripts/import-scf-data.js` is invoked as a subprocess only).

Those files are the truth. Duplicating them here guarantees drift.

## Tool interop

Claude Code, Codex, Cursor, and Copilot all read `AGENTS.md`. When adding domain-specific rules, prefer a nested `AGENTS.md` in the relevant subdirectory — agents load the nearest one to the file they're editing.
