# Deploy your own Graphletter

A step-by-step path from a fresh clone to a running instance on infrastructure you control. Your evidence documents never leave it.

If anything here is unclear or out of date, please [open an issue](https://github.com/p-boaz/graphletter/issues) — keeping this guide accurate is itself a welcome contribution.

## 1. Prerequisites

- **Docker** with Compose v2
- **Node.js 24** and **pnpm 10+** (`corepack enable` will provide pnpm) if
  running without Docker
- A **[Supabase](https://supabase.com) project** if using hosted Supabase — the
  free tier is enough to evaluate
- **An AI provider**: OpenAI, Anthropic, or local Ollama

## 2. Clone

```sh
git clone https://github.com/p-boaz/graphletter.git
cd graphletter
```

## 3. Run locally with Docker Compose

This is the shortest self-hosted path. Compose builds Graphletter, starts the
Supabase CLI local stack, applies pending migrations, seeds SCF reference data,
verifies the seed counts, then starts the app on port 3000.

```sh
cp .env.self-host.example .env
```

Fill in at least one hosted provider key in `.env`:

```sh
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...
```

For no-data-egress assessments, run Ollama on the host and use the local
provider instead:

```sh
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://host.docker.internal:11434/v1
OLLAMA_MODEL=llama3.1:8b
```

See [AI provider configuration](./AI_PROVIDERS.md) for the provider seam,
override order, and local-provider limits.

Then start the stack:

```sh
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000). Supabase Studio is
available at [http://localhost:54323](http://localhost:54323), and local test
emails are visible in Inbucket at
[http://localhost:54324](http://localhost:54324).

The `supabase-bootstrap` service is intentionally finite. It exits after:

1. `supabase start --exclude vector`
2. `supabase migration up --local`
3. `pnpm seed`
4. `pnpm seed:verify`

The `app` service waits for that bootstrap to finish successfully before
starting. To stop everything:

```sh
docker compose down
pnpm dlx supabase@2.105.0 stop
```

The local Supabase database is preserved by the Supabase CLI Docker volumes.
Reset it deliberately with:

```sh
pnpm dlx supabase@2.105.0 db reset --local
```

## 4. Hosted Supabase setup

Use this path when you want the app pointed at a hosted Supabase project instead
of the local Supabase CLI stack.

Install dependencies:

```sh
pnpm install
```

Configure environment:

```sh
cp .env.example .env.local
```

`.env.local` is gitignored — never commit it. Fill in the values below.

### Required

| Variable                                        | Where to get it                | Notes                                                                                                                |
| ----------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                      | Supabase → Settings → API      | Your project URL                                                                                                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                 | Supabase → Settings → API Keys | Publishable key (safe in the browser)                                                                                |
| `SUPABASE_SERVICE_ROLE_KEY`                     | Supabase → Settings → API Keys | Secret — server-only                                                                                                 |
| `OPENAI_API_KEY` **and/or** `ANTHROPIC_API_KEY` | Provider dashboard             | Required for hosted providers; local Ollama can be used instead (see [AI provider configuration](./AI_PROVIDERS.md)) |

### Optional

| Variable                                | Default                     | Purpose                                                                                                                              |
| --------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                          | —                           | Direct Postgres URI. Only needed for `pnpm seed:reset` (shells out to `psql`). Use the session-pooler (port 5432) connection string. |
| `SUPABASE_INTERNAL_URL`                 | `NEXT_PUBLIC_SUPABASE_URL`  | Server/container-only override for Supabase API calls when the browser URL and container URL differ.                                 |
| `ADMIN_USER_IDS` / `ADMIN_EMAILS`       | empty (admin disabled)      | Comma-separated allowlists that gate `/admin/*`. Accepts UUIDs, emails, or both.                                                     |
| `AI_PROVIDER`                           | `openai`                    | Set to `ollama` to route assessment/control-mapping calls to a local OpenAI-compatible provider.                                     |
| `CONTROL_MAPPING_AI_PROVIDER`           | `AI_PROVIDER`               | More specific override for assessment/control-mapping calls.                                                                         |
| `AI_MODEL` / `CONTROL_MAPPING_AI_MODEL` | provider default            | Optional model overrides. `CONTROL_MAPPING_AI_MODEL` wins for assessment calls.                                                      |
| `OLLAMA_BASE_URL`                       | `http://127.0.0.1:11434/v1` | OpenAI-compatible Ollama endpoint. In Compose on macOS/Docker Desktop, use `http://host.docker.internal:11434/v1`.                   |
| `OLLAMA_MODEL`                          | `llama3.1:8b`               | Local model used when assessment provider is `ollama`.                                                                               |
| `LOG_LEVEL`                             | `info`                      | `debug` \| `info` \| `warn` \| `error`                                                                                               |

## 5. Set up the hosted database

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

## 6. Run it without Docker

```sh
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). You should be able to create an account, upload an evidence document, and run an assessment end to end.

## 7. (Optional) Verify your setup

```sh
pnpm typecheck        # TypeScript strict check
pnpm lint             # ESLint
pnpm test:scf         # SCF parser unit tests
pnpm test:integration # Node integration tests
pnpm build            # Production build
```

## Deploying to production

The reference deployment target is **Vercel** (serverless). Connect the repository, set the same environment variables in the Vercel project, and deploy. Because environment variables live on the Vercel project (not in Git), the same backend survives source changes.

Any platform that can run a Next.js 16 app (Node 24) and reach your Supabase
project will work.

## Troubleshooting

- **"Missing Supabase environment variables"** — `.env.local` isn't populated, or you started `pnpm dev` from a different directory. Confirm the three `*_SUPABASE_*` values are set.
- **Assessments fail immediately** — no AI provider is configured, the hosted
  key is invalid, or `AI_PROVIDER=ollama` cannot reach `OLLAMA_BASE_URL`.
- **`supabase-bootstrap` cannot connect to Docker** — Docker Desktop or Colima is
  not running, or `/var/run/docker.sock` is unavailable to Compose. Start Docker
  and rerun `docker compose up --build`.
- **The app starts before seed data exists** — rerun `docker compose up
supabase-bootstrap`; it applies pending migrations, runs `pnpm seed`, and runs
  `pnpm seed:verify`.
- **`supabase db push` reports migration drift** — the local migration history is ahead of or behind the remote ledger. Use `pnpm dlx supabase migration list` to compare, then `supabase migration repair` to reconcile (metadata-only; no schema or data impact).
- **Empty control/framework lists** — the SCF reference data hasn't been seeded yet. Run `pnpm seed` (see [SEEDING.md](../SEEDING.md)).
