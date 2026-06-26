# Task Spec: Docker Compose Self-Hosting

## Metadata

- Date: 2026-06-26
- Owner: Codex
- Status: Done
- Branch: main
- Related issue/PR: https://github.com/p-boaz/graphletter/issues/11

## Goal

Ship a `docker compose up` path that starts Graphletter against a local
Supabase stack, applies migrations, seeds SCF reference data, and documents the
self-hosting workflow.

## Context Files

- [x] `Dockerfile`
- [x] `docker-compose.yml`
- [x] `.dockerignore`
- [x] `.env.self-host.example`
- [x] `docs/SELF_HOSTING.md`
- [x] `lib/supabase/env.ts`
- [x] `lib/supabase/server.ts`
- [x] `lib/supabase/client.ts`
- [x] `lib/database/supabase.ts`
- [x] `lib/auth/profile-utils.ts`
- [x] `lib/services/evidence/upload-utils.ts`
- [x] `lib/demo/demo-quota.ts`
- [x] `app/api/try-it-out/demo/route.ts`
- [x] `app/api/evidence/assess-uploaded/route.ts`
- [x] `plans/task-2026-06-26-docker-compose-self-hosting.md`

## Constraints

- Keep the path based on the existing Supabase CLI local stack and migrations.
- Pin the Supabase CLI version; do not use an unbounded `latest` install.
- Do not commit real provider API keys.
- Keep browser-facing Supabase URL usable from the host browser.

## Scope

### In scope

- Production-ready app container build.
- Compose bootstrap service for local Supabase start, migration up, seed, and
  seed verification.
- Server-side Supabase internal URL override for container networking.
- Self-hosting documentation for the compose path.

### Out of scope

- Full Supabase self-host Docker distribution replacement.
- Production deployment orchestration beyond local compose.
- AI provider abstraction changes.

## Implementation Plan

1. Add a small Supabase environment helper that separates public browser URL
   from optional server/container internal URL.
2. Update server-side Supabase clients and direct server route clients to use
   the internal URL override.
3. Add a pinned Dockerfile and `docker-compose.yml` with `supabase-bootstrap`
   and `app` services.
4. Add a sample self-host env file with local Supabase defaults and placeholder
   AI provider keys.
5. Update the self-hosting guide with the compose flow and verification steps.

## Test Plan

- [x] Run `pnpm check:spec`.
- [x] Run `pnpm lint`.
- [x] Run `pnpm typecheck`.
- [x] Run `pnpm build`.
- [x] Validate compose config with `docker compose config`.
- [x] Run the compose path and verify bootstrap, seed, app HTTP, Supabase REST,
      and app API responses.

## Acceptance Criteria

- [x] `docker compose up` has a documented path that starts Graphletter against
      local Supabase.
- [x] Migrations and seed data are applied by the compose bootstrap service.
- [x] The self-hosting guide documents required AI keys and verification.
- [x] Server-side Supabase calls work from the app container without breaking
      browser-side Supabase calls.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved
