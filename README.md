# Graphletter

AI-powered compliance assessment. Upload your evidence documents — policies, procedures, screenshots, audit reports — and get control-level verdicts across 79+ frameworks (SOC 2, ISO 27001, NIST CSF, PCI DSS, HIPAA, GDPR, and more).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Built with Next.js](https://img.shields.io/badge/Built%20with-Next.js-black)](https://nextjs.org)
[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-blue)](tsconfig.json)

## Why this matters

Compliance assessment today is dominated by closed SaaS — Vanta, Drata, Secureframe, OneTrust. They work, but they share three properties that leave large parts of the ecosystem unserved:

- **They're expensive and seat-priced.** Early-stage startups, open-source projects, nonprofits, and student teams that need SOC 2 / ISO 27001 / HIPAA readiness are routinely priced out of the tools meant to help them get there.
- **They're black boxes.** You upload evidence and receive a verdict, with little visibility into _why_ a control passed or failed. For a domain whose entire purpose is auditability, "trust the score" is the wrong default.
- **Your evidence lives on their servers.** Compliance evidence is some of the most sensitive material an organization holds — security policies, architecture docs, incident records. Handing it to a third-party SaaS to get a readiness score is its own risk.

Graphletter is the open alternative to all three:

- **MIT-licensed and self-hostable.** Clone it, bring your own Supabase project and AI keys, and run the whole assessment pipeline on infrastructure you control. Your evidence never has to leave it.
- **Grounded, not black-box.** Every verdict ships with a confidence score, plain-language reasoning, and the **quoted sentence from your own document** that supports it. The reasoning is the product, not a byproduct.
- **Open control data.** Assessment runs against the [Secure Controls Framework](https://securecontrolsframework.com) — a publicly available, openly cross-mapped control library spanning 79+ frameworks — so the mapping layer is inspectable rather than proprietary.

The goal is to make "see roughly where you stand against a control framework" a thing any team can do for the cost of an API call, with full transparency into how the answer was reached — and to give the GRC ecosystem a reference implementation it can read, fork, and improve.

> **Status & scope.** Graphletter is an early-stage, actively developed project. It's a **readiness and gap-analysis aid**, not a substitute for a formal audit or a licensed assessor. See the [open issues](https://github.com/p-boaz/graphletter/issues) for the current roadmap, and [CONTRIBUTING.md](CONTRIBUTING.md) to get involved.

## What it does

Graphletter takes real compliance evidence and evaluates it against the [Secure Controls Framework (SCF)](https://securecontrolsframework.com), a unified control library that cross-maps to 79+ frameworks.

For each uploaded document, the platform:

1. **Classifies** the artifact type (e.g. "Acceptable Use Policy", "Backup Procedure")
2. **Extracts** control-relevant content
3. **Assesses** coverage across SCF controls with AI-generated confidence scores and quoted evidence
4. **Maps** findings to whichever frameworks you care about

The output is per-control verdicts grounded in your actual documents — not a checkbox survey. For the full field-by-field result schema and how to read confidence scores, see [docs/VERDICTS.md](docs/VERDICTS.md).

Classifier quality gates are published in [docs/EVAL.md](docs/EVAL.md).

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
- **Testing:** Playwright (UI), Node integration tests
- **Package manager:** pnpm

## Getting started

### Prerequisites

- Node.js 24, pnpm 10+
- A [Supabase](https://supabase.com) project (free tier works)
- An OpenAI key, an Anthropic key, or both

> For a full deploy-your-own walkthrough (env vars, database seeding, production deploy, troubleshooting), see [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).

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
pnpm dlx supabase login
pnpm dlx supabase link --project-ref <your-project-ref>
pnpm dlx supabase db push
```

### Validation

```sh
pnpm audit --audit-level=high
pnpm verify:sheetjs-provenance
pnpm typecheck       # TypeScript strict check
pnpm lint            # ESLint
pnpm test:scf        # SCF parser unit tests
pnpm test:integration  # Node integration tests
EVAL_CATALOG_SOURCE=fixture EVAL_ACCURACY_FLOOR=1 pnpm eval:artifact-classifier
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

Dependency provenance exceptions, including the direct SheetJS `xlsx` tarball pin
used by the SCF extraction pipeline, are documented in
[docs/DEPENDENCY_PROVENANCE.md](docs/DEPENDENCY_PROVENANCE.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Short version: open an issue first, then a PR.

## Security

Report vulnerabilities according to [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) — © 2026 Peter Boaz. Created by Peter Boaz; contributions welcome.
