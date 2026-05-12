# Task Spec: Wave 3 advisor RLS hardening

## Metadata

- Date: 2026-05-12
- Owner: claude (peter@graphletter.com)
- Status: In Progress
- Branch: chore/advisor-security-hardening (stacked on Wave 2)
- Related task: #50 (Triage remaining Supabase security advisors)
- Related PRs: TBD

## Goal

Close the remaining Supabase RLS advisor findings on prod
(`gbnxwsntyzyrpwmjaaqa`) by dropping 13 over-permissive policies that are
dead code, and adding minimal policies on the 3 tables that had RLS enabled
without any policy.

After this migration, the only remaining advisors are:

- `auth_otp_long_expiry` (WARN) — Supabase dashboard auth-settings click.
- `auth_leaked_password_protection` (WARN) — same.
- `vulnerable_postgres_version` (WARN) — Supabase dashboard Postgres upgrade.

Those three are out of code scope; they're filed against the prod project
config and need Peter to click in the Supabase UI.

## Context Files

- [x] `supabase/migrations/20260512160000_advisor_rls_hardening.sql` —
      this migration. Every DROP uses `IF EXISTS`; every CREATE pairs with
      `DROP IF EXISTS`. Idempotent.
- [x] `app/api/scf/import/route.ts` — confirms all SCF writes go through
      `supabaseAdmin` (service role).
- [x] `scripts/seed-all.ts`, `scripts/seed-erl.ts`,
      `scripts/seed-assessment-objectives.ts`,
      `scripts/seed-scf-control-integrations.ts`, `scripts/seed-verify.ts` —
      all use `SUPABASE_SERVICE_ROLE_KEY`.
- [x] `lib/ai/circuit-breaker.ts`,
      `app/api/admin/ai-provider-health/route.ts` — confirm
      `ai_provider_health` is service-role-only.
- [x] `app/api/scf/erl/route.ts` — user-session client GET against
      `scf_control_evidence_mappings`, so the table needs a public read
      policy after the INFO lint mitigation.

## Constraints

- Sandbox-first: apply via `execute_sql` against `bxpwedlvaipvqugxnxrk`;
  re-fetch advisors; confirm `rls_policy_always_true` and
  `rls_enabled_no_policy` drop to 0. Apply to prod the same way; insert a
  ledger row with the local version (`20260512160000`).
- No `--no-verify`. No `SKIP_SPEC_CHECK=1`.
- Blast radius ≤15 staged files (this is 2: migration + spec).
- The 13 dropped policies are dead — service role bypasses RLS, so seeds
  and in-app SCF imports (which use `supabaseAdmin`) continue working.
- The two SELECT policies must precede any merge of this migration so the
  app's `app/api/scf/erl/route.ts` GET against
  `scf_control_evidence_mappings` keeps returning rows for authenticated
  users (RLS would otherwise deny SELECT after the policy was added in a
  prior migration).

## Scope

### In scope

- Drop 13 `rls_policy_always_true` policies (see migration for the full
  list).
- Create public-read SELECT policies on `erl_guidance_cache` and
  `scf_control_evidence_mappings`.
- Create deny-all policies on `ai_provider_health` and
  `integration_sync_logs` to silence the `rls_enabled_no_policy` INFO
  lint without changing behavior (service role still bypasses).

### Out of scope (dashboard clicks for Peter)

- `auth_otp_long_expiry` — Supabase dashboard → Authentication → Email
  → reduce OTP expiry to <1 h.
- `auth_leaked_password_protection` — Authentication → Password Security
  → enable HaveIBeenPwned check.
- `vulnerable_postgres_version` — Project Settings → Infrastructure →
  Upgrade Postgres.

## Test Plan

- [x] Sandbox rehearsal: `execute_sql` migration on
      `bxpwedlvaipvqugxnxrk`; re-fetch advisors; confirm
      `rls_policy_always_true` count drops to 0 and `rls_enabled_no_policy`
      INFO count drops to 0.
- [x] Prod application: same against `gbnxwsntyzyrpwmjaaqa`; insert ledger
      row at version `20260512160000`.
- [x] Functional smoke check: confirm `app/api/scf/erl/route.ts` still
      returns ERL rows for an authenticated user (i.e. the new SELECT
      policy on `scf_control_evidence_mappings` is in effect).

## Acceptance Criteria

- [x] Migration file at
      `supabase/migrations/20260512160000_advisor_rls_hardening.sql`.
- [x] Migration applied to sandbox and prod.
- [x] Prod advisor count: 0 ERROR + 3 WARN (auth-config + Postgres
      upgrade) + 0 INFO. Down from 4 ERROR + 73 WARN + 3 INFO at the start
      of the day, with the remaining 3 being dashboard-only items.
- [x] Prod migration ledger has a row at version `20260512160000` and
      name `advisor_rls_hardening`.
- [x] Task #50 has a follow-on entry covering the 3 dashboard items so
      they aren't forgotten.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (Peter — "let's tackle those now")
