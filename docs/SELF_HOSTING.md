# Deploy your own Graphletter

A step-by-step path from a fresh clone to a running instance on infrastructure you control. Your evidence documents never leave it.

If anything here is unclear or out of date, please [open an issue](https://github.com/p-boaz/graphletter/issues) — keeping this guide accurate is itself a welcome contribution.

## 1. Prerequisites

- **Node.js 20+** and **pnpm 10+** (`corepack enable` will provide pnpm)
- A **[Supabase](https://supabase.com) project** — the free tier is enough to evaluate
- **At least one AI provider key**: OpenAI, Anthropic, or both

## 2. Clone and install

```sh
git clone https://github.com/p-boaz/graphletter.git
cd graphletter
pnpm install
```

## 3. Configure environment

```sh
cp .env.example .env.local
```

`.env.local` is gitignored — never commit it. Fill in the values below.

### Required

| Variable                                        | Where to get it                | Notes                                                                                            |
| ----------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`                      | Supabase → Settings → API      | Your project URL                                                                                 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                 | Supabase → Settings → API Keys | Publishable key (safe in the browser)                                                            |
| `SUPABASE_SERVICE_ROLE_KEY`                     | Supabase → Settings → API Keys | Secret — server-only                                                                             |
| `OPENAI_API_KEY` **and/or** `ANTHROPIC_API_KEY` | Provider dashboard             | **At least one** is required; the app routes to whichever is configured (see `lib/ai-config.ts`) |

### Optional

| Variable                          | Default                | Purpose                                                                                                                              |
| --------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                    | —                      | Direct Postgres URI. Only needed for `pnpm seed:reset` (shells out to `psql`). Use the session-pooler (port 5432) connection string. |
| `ADMIN_USER_IDS` / `ADMIN_EMAILS` | empty (admin disabled) | Comma-separated allowlists that gate `/admin/*`. Accepts UUIDs, emails, or both.                                                     |
| `LOG_LEVEL`                       | `info`                 | `debug` \| `info` \| `warn` \| `error`                                                                                               |

## 4. Set up the database

Schema migrations live in `supabase/migrations/`. Apply them with the Supabase CLI:

```sh
pnpm dlx supabase login
pnpm dlx supabase link --project-ref <your-project-ref>
pnpm dlx supabase db push
```

Then load the Secure Controls Framework reference data. `pnpm seed` is the orchestrator; see [SEEDING.md](../SEEDING.md) for the full picture (and `pnpm seed:reset` for the wipe-and-reseed path used on SCF version bumps).

```sh
pnpm seed
```

## 5. Run it

```sh
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). You should be able to create an account, upload an evidence document, and run an assessment end to end.

## 6. (Optional) Verify your setup

```sh
pnpm typecheck        # TypeScript strict check
pnpm lint             # ESLint
pnpm test:scf         # SCF parser unit tests
pnpm test:integration # Node integration tests
pnpm build            # Production build
```

## Deploying to production

The reference deployment target is **Vercel** (serverless). Connect the repository, set the same environment variables in the Vercel project, and deploy. Because environment variables live on the Vercel project (not in Git), the same backend survives source changes.

Any platform that can run a Next.js 16 app (Node 20+) and reach your Supabase project will work; a container-based `docker compose` path is tracked in [issue #11](https://github.com/p-boaz/graphletter/issues/11).

## Troubleshooting

- **"Missing Supabase environment variables"** — `.env.local` isn't populated, or you started `pnpm dev` from a different directory. Confirm the three `*_SUPABASE_*` values are set.
- **Assessments fail immediately** — no AI provider key is configured, or the key is invalid. At least one of `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` must be present.
- **`supabase db push` reports migration drift** — the local migration history is ahead of or behind the remote ledger. Use `pnpm dlx supabase migration list` to compare, then `supabase migration repair` to reconcile (metadata-only; no schema or data impact).
- **Empty control/framework lists** — the SCF reference data hasn't been seeded yet. Run `pnpm seed` (see [SEEDING.md](../SEEDING.md)).
