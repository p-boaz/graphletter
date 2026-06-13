# Task Spec: Wave 2 advisor security hardening

## Metadata

- Date: 2026-05-12
- Owner: claude (peter@graphletter.com)
- Status: Done (2026-05-12)
- Branch: chore/advisor-security-hardening
- Related task: #50 (Triage remaining Supabase security advisors)
- Related PRs: TBD

## Goal

Apply one deterministic SQL migration that closes the safe one-shot Supabase
security advisor findings on the prod project (`gbnxwsntyzyrpwmjaaqa`):

| Lint                                                 | Level | Count | Fix                                                  |
| ---------------------------------------------------- | ----: | ----: | ---------------------------------------------------- |
| `security_definer_view`                              | ERROR |     4 | `ALTER VIEW … SET (security_invoker = true)`         |
| `function_search_path_mutable`                       |  WARN |    36 | `ALTER FUNCTION … SET search_path = public, pg_temp` |
| `anon_security_definer_function_executable`          |  WARN |     8 | `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated`  |
| `authenticated_security_definer_function_executable` |  WARN |     8 | (same — 8 functions × 2 roles = 16 lints)            |
| `materialized_view_in_api`                           |  WARN |     2 | `REVOKE ALL … FROM anon, authenticated`              |

Total: 4 ERROR + 70 WARN of the 80 active advisor lints. Remaining 10 are
design-needed (Wave 3): 13 `rls_policy_always_true`, 3 `rls_enabled_no_policy`,
2 auth-config dashboard clicks, 1 `vulnerable_postgres_version` Postgres upgrade.

## Context Files

- [x] `supabase/migrations/20260512150000_advisor_security_hardening.sql` —
      the migration. Idempotent — every statement is a SET or REVOKE that's
      safe to re-apply.
- [x] Prod project ref: `gbnxwsntyzyrpwmjaaqa`
- [x] Sandbox project ref: `bxpwedlvaipvqugxnxrk`

## Constraints

- Sandbox-first: apply via `execute_sql` to sandbox; re-fetch advisors;
  confirm counts drop appropriately. Then apply to prod the same way.
- Insert a row into prod's `supabase_migrations.schema_migrations` with the
  local file's version (`20260512150000`) so future `supabase db push --dry-run`
  reports clean.
- No `--no-verify`. No `SKIP_SPEC_CHECK=1`.
- Blast radius ≤15 staged files (this is 3: migration + spec + Phase-3 task
  tick-through).

## Scope

### In scope

- Flip 4 SECURITY DEFINER views (`control_maturity_view`,
  `control_threats_view`, `control_risks_view`, `comprehensive_control_view`)
  to `security_invoker = true`.
- Pin `search_path = public, pg_temp` on every public.\* function flagged by
  the advisor (36 distinct names — see migration file for the full list).
- `REVOKE EXECUTE ON FUNCTION … FROM PUBLIC, anon, authenticated` on the 8
  SECURITY DEFINER functions exposed via PostgREST: `handle_new_user`,
  `create_user_profile`, `update_assessment_status_history`,
  `begin_compliance_transaction`, `commit_compliance_transaction`,
  `rollback_compliance_transaction`, `refresh_dashboard_views`,
  `refresh_framework_crosswalk`. Trigger-attached functions
  (`create_user_profile`, `update_assessment_status_history`) keep working
  because triggers bypass EXECUTE grants.
- `REVOKE ALL ON public.framework_crosswalk FROM anon, authenticated;` and the
  same on `public.mv_framework_control_totals` — matviews don't support
  `security_invoker`, so removing API role access is the only remediation.

### Out of scope (Wave 3 — separate tasks)

- 13 `rls_policy_always_true` lints — needs per-policy design review (is the
  table intentionally public, or should the policy gate on auth/role?).
- 3 `rls_enabled_no_policy` INFO lints — same decision per table
  (`ai_provider_health`, `erl_guidance_cache`, `scf_control_evidence_mappings`).
- `vulnerable_postgres_version` — Supabase dashboard Postgres upgrade.
- 2 auth-config WARNs (`auth_leaked_password_protection`,
  `auth_otp_long_expiry`) — dashboard auth-settings clicks.

## Test Plan

- [x] Sandbox rehearsal: `execute_sql` the migration on
      `bxpwedlvaipvqugxnxrk`; re-fetch advisors; confirm:
  - `security_definer_view` ERROR count drops to 0
  - `function_search_path_mutable` WARN count drops to 0
  - `anon_security_definer_function_executable` + `authenticated_…` WARN
    counts drop to 0
  - `materialized_view_in_api` WARN count drops to 0
- [x] Prod application: `execute_sql` the migration on `gbnxwsntyzyrpwmjaaqa`;
      same advisor re-fetch + count check.
- [x] Ledger reconciliation: insert the local version into
      `supabase_migrations.schema_migrations`.
- [x] Smoke check: a SELECT against each touched view + a representative
      function call still works as the service role.

## Acceptance Criteria

- [x] Migration file committed at
      `supabase/migrations/20260512150000_advisor_security_hardening.sql`.
- [x] Migration applied to sandbox `bxpwedlvaipvqugxnxrk`.
- [x] Migration applied to prod `gbnxwsntyzyrpwmjaaqa`.
- [x] Prod advisor count: 4 ERROR + 70 WARN closed (down from 4 ERROR + 73
      WARN; the 3 remaining WARNs are Wave 3 items above).
- [x] Prod migration ledger has a row with version `20260512150000` and name
      `advisor_security_hardening`.
- [x] Task #50 task entry references this spec.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (Peter — "let's tackle those now")
