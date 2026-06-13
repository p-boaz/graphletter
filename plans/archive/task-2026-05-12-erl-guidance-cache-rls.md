# Task Spec: Enable RLS on erl_guidance_cache

## Metadata

- Date: 2026-05-12
- Owner: claude (agent)
- Status: Done (2026-05-12)
- Branch: fix/erl-guidance-cache-rls
- Related issue/PR: surfaced by Supabase advisor during graphletter-sandbox provisioning (project `bxpwedlvaipvqugxnxrk`)

## Goal

Close the RLS gap on `public.erl_guidance_cache`: the table was created without `ENABLE ROW LEVEL SECURITY` and currently grants `SELECT` to `authenticated`. The only caller (`lib/compliance/guidance-generator.ts`, invoked from `app/api/compliance/gap-guidance/route.ts`) uses the service-role client, so client-side access was never intended.

## Context Files

- [x] `supabase/migrations/20260322000000_create_erl_guidance_cache.sql` — original (gappy) migration; leave intact for history
- [x] `supabase/migrations/20260512120000_enable_rls_on_erl_guidance_cache.sql` — new migration that closes the gap
- [x] `lib/compliance/guidance-generator.ts` — only caller; takes a `SupabaseClient` (service-role)
- [x] `app/api/compliance/gap-guidance/route.ts` — passes `supabaseAdmin` into the generator

## Constraints

- No breaking change for the API route: service role bypasses RLS, so existing behaviour is preserved.
- No new policies: a deny-by-default posture is correct for this table (nothing should access it without service-role).
- Migration naming/ordering: filename `20260512120000_…` is strictly greater than the last main-branch migration `20260324000000_…`, satisfying `scripts/schema-migration-convention-check.js`.

## Scope

### In scope

- Add migration that `ENABLE ROW LEVEL SECURITY` and `REVOKE SELECT … FROM authenticated`.
- Apply to graphletter-sandbox (`bxpwedlvaipvqugxnxrk`) via Supabase MCP to verify.
- Apply to graphletter prod (`gbnxwsntyzyrpwmjaaqa`) after PR merge.

### Out of scope

- Adding RLS to other tables (only `erl_guidance_cache` was flagged).
- Backfilling row ownership or adding a `user_id` column — the cache is a shared lookup, not per-user data.
- Editing the original migration in place (Supabase forbids edits to applied migrations).

## Implementation Plan

1. Create `supabase/migrations/20260512120000_enable_rls_on_erl_guidance_cache.sql`.
2. Apply to sandbox via `mcp__supabase__apply_migration`.
3. Confirm via `mcp__supabase__execute_sql` that `pg_class.relrowsecurity = true` for `public.erl_guidance_cache`.
4. Confirm `mcp__supabase__get_advisors(type=security)` no longer flags the table.
5. Run `pnpm schema:migrations:check` for naming/order compliance.
6. Open PR targeting `main`.
7. After merge: apply to prod via `supabase db push` (or MCP equivalent).

## Test Plan

- [ ] `pnpm schema:migrations:check` passes locally.
- [ ] Post-apply on sandbox: `pg_class.relrowsecurity = true` for `public.erl_guidance_cache`.
- [ ] Post-apply on sandbox: `get_advisors(type=security)` no longer lists `rls_disabled` for this table.
- [ ] Sandbox API smoke test (optional): invoke `/api/compliance/gap-guidance` with a known artifact, confirm 200 response (service role still works).

## Acceptance Criteria

- [ ] Migration applied to sandbox and verified.
- [ ] Migration applied to prod (after PR merge).
- [ ] No regressions in `pnpm seed:reset` against either environment.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved
