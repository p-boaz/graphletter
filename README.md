# Graphletter

AI-powered compliance assessment. Upload your evidence documents — policies, procedures, screenshots, audit reports — and get control-level verdicts across 79+ frameworks (SOC 2, ISO 27001, NIST CSF, PCI DSS, HIPAA, GDPR, and more).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Built with Next.js](https://img.shields.io/badge/Built%20with-Next.js-black)](https://nextjs.org)
[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-blue)](tsconfig.json)

## What it does

Graphletter takes real compliance evidence and evaluates it against the [Secure Controls Framework (SCF)](https://securecontrolsframework.com), a unified control library that cross-maps to 79+ frameworks.

For each uploaded document, the platform:

1. **Classifies** the artifact type (e.g. "Acceptable Use Policy", "Backup Procedure")
2. **Extracts** control-relevant content
3. **Assesses** coverage across SCF controls with AI-generated confidence scores and quoted evidence
4. **Maps** findings to whichever frameworks you care about

The output is per-control verdicts grounded in your actual documents — not a checkbox survey.

## Example output

```json
{
  "control": "DCH-01.1 — Data Classification Scheme",
  "frameworks": ["SOC 2 CC6.1", "ISO 27001 A.8.2.1"],
  "verdict": "PASS",
  "confidence": 0.91,
  "reasoning": "Policy document §3.2 defines three sensitivity tiers (Public / Internal / Confidential) with handling requirements for each. Classification applies to data at rest and in transit.",
  "evidence_quote": "All data assets must be assigned a sensitivity classification... Confidential data must be encrypted at rest using AES-256..."
}
```

## Tech stack

- **Frontend / backend:** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind + shadcn/ui
- **Auth + DB:** Supabase (Postgres with Row Level Security, Storage)
- **AI:** Vercel AI SDK with OpenAI and Anthropic models; structured output via Zod schemas
- **Workflows:** Vercel Workflow (WDK) for multi-step AI pipelines
- **Testing:** Playwright (UI), Node integration tests
- **Package manager:** pnpm

## Getting started

### Prerequisites

- Node.js 20+, pnpm 10+
- A [Supabase](https://supabase.com) project (free tier works)
- An OpenAI key, an Anthropic key, or both

### Local setup

```sh
git clone https://github.com/p-boaz/graphletter.git
cd graphletter
pnpm install

cp .env.example .env.local
# Fill in your Supabase project URL and keys, plus at least one AI API key

pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Database setup

Schema migrations live in `supabase/migrations/`. Apply them via the Supabase CLI:

```sh
pnpm dlx supabase link --project-ref <your-project-ref>
pnpm dlx supabase db push
```

### Validation

```sh
pnpm typecheck       # TypeScript strict check
pnpm lint            # ESLint
pnpm test:scf        # SCF parser unit tests
pnpm test:integration  # Node integration tests
pnpm build           # Production build
```

## Project structure

```
app/         Next.js App Router pages and API routes
lib/         Core logic: AI assessment, artifact classifier, SCF mappings
components/  UI components (shadcn/ui based)
utils/       Cross-cutting helpers (auth guards, env parsing)
supabase/    Schema migrations
scripts/     CLI tools and eval harnesses
data/        SCF data files (publicly available from securecontrolsframework.com)
fixtures/    Synthetic evaluation inputs
playwright/  End-to-end browser tests
tests/       Node integration tests
```

For the full coding standard, see [AGENTS.md](AGENTS.md).

## SCF data

The repository includes Secure Controls Framework data (controls, frameworks, assessment objectives) under `data/`. SCF is publicly available from [securecontrolsframework.com](https://securecontrolsframework.com).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Short version: open an issue first, then a PR.

## License

[MIT](LICENSE) — © 2026 Peter Boaz. Created by Peter Boaz; contributions welcome.
