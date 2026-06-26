# Task Spec: Pluggable AI Provider Interface

## Metadata

- Date: 2026-06-26
- Owner: Codex
- Status: Done
- Branch: main
- Related issue/PR: https://github.com/p-boaz/graphletter/issues/19

## Goal

Add a small provider seam that keeps existing OpenAI/Anthropic behavior intact
while allowing the assessment path to run against a local OpenAI-compatible
provider such as Ollama.

## Context Files

- [x] `lib/ai-config.ts`
- [x] `lib/ai-client.ts`
- [x] `lib/ai/assessment-engine.test.ts`
- [x] `app/api/ai/test/route.ts`
- [x] `.env.example`
- [x] `.env.self-host.example`
- [x] `docs/SELF_HOSTING.md`
- [x] `docs/AI_PROVIDERS.md`
- [x] `plans/task-2026-06-26-pluggable-ai-provider-interface.md`

## Constraints

- Do not rewrite assessment call sites; keep the existing `getModel(provider, model)` seam.
- Do not add a new provider dependency if the installed AI SDK can target an
  OpenAI-compatible local endpoint.
- Keep hosted-provider fallbacks unchanged for existing deployments.
- Local/Ollama support is text-first; image assessment can use hosted providers
  until a local vision model is explicitly configured and validated.

## Scope

### In scope

- Add an `ollama` provider constant and model config.
- Resolve assessment config from environment variables.
- Instantiate Ollama through the existing OpenAI-compatible AI SDK provider.
- Include Ollama in provider availability and connectivity checks.
- Document the provider seam and self-hosted env settings.
- Add integration tests that prove config selection and model factory routing.

### Out of scope

- Replacing the Vercel AI SDK.
- Adding a local model runtime container.
- Full quality evaluation of local model outputs.
- Migrating all non-assessment AI features to local providers.

## Implementation Plan

1. Extend `AI_PROVIDERS`, `AI_MODELS`, provider config, and environment
   validation with `ollama`.
2. Add config overrides for assessment/control mapping provider, model, base
   URL, and API key.
3. Route `getModel("ollama", ...)` through `createOpenAI(...).chat(model)` with
   an OpenAI-compatible base URL.
4. Update `/api/ai/test` to include every configured provider.
5. Document the seam in `docs/AI_PROVIDERS.md` and reference it from
   self-hosting docs and env examples.
6. Add tests for default hosted behavior, Ollama config selection, and model
   factory routing.

## Test Plan

- [x] Run `pnpm test:integration lib/ai/assessment-engine.test.ts`.
- [x] Run `pnpm check:spec`.
- [x] Run `pnpm lint`.
- [x] Run `pnpm typecheck`.

## Acceptance Criteria

- [x] Existing OpenAI/Anthropic defaults continue to resolve without config changes.
- [x] `AI_PROVIDER=ollama` selects a local provider/model for assessment calls.
- [x] Provider health/test code can report Ollama availability.
- [x] Documentation describes the provider seam and local configuration.
- [x] No real AI calls are required for automated tests.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved
