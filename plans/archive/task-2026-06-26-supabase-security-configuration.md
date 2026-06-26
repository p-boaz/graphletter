# Task Spec: Supabase Security Configuration

## Metadata

- Date: 2026-06-26
- Owner: Codex
- Status: Done
- Branch: main
- Related issue/PR: https://github.com/p-boaz/graphletter/issues/37

## Goal

Apply and verify the remaining operator-controlled Supabase security settings:
short email OTP expiry, leaked-password protection, and patched Postgres
version.

## Context Files

- [x] `docs/SUPABASE_SECURITY_CONFIGURATION.md`
- [x] `plans/task-2026-06-26-supabase-security-configuration.md`

## Constraints

- Do not push the local Supabase config wholesale because it contains local
  development URLs.
- Use narrow Supabase Management API updates and verify the production project
  directly.
- Do not record or expose access tokens.

## Scope

### In scope

- Production Supabase Auth OTP expiry.
- Production Supabase leaked-password protection.
- Production Supabase Postgres patch upgrade.
- Documentation of applied settings and verification evidence.

### Out of scope

- Application code changes.
- Local Supabase config changes.
- Database schema or migration changes.

## Implementation Plan

1. Read the current production Auth config and project database version.
2. Patch Auth config with `mailer_otp_exp = 1800` and
   `password_hibp_enabled = true`.
3. Verify Postgres upgrade eligibility and initiate the GA Postgres 17 upgrade.
4. Poll upgrade status until the project is `ACTIVE_HEALTHY` on the patched
   database image.
5. Run Supabase security advisors and record the final production evidence.

## Test Plan

- [x] Verify production Auth config through the Supabase Management API.
- [x] Verify production project status and database version through the
      Supabase Management API.
- [x] Verify Supabase security advisors return no relevant security warnings.
- [x] Run `pnpm check:spec`.
- [x] Run `pnpm lint`.
- [x] Run `pnpm typecheck`.

## Acceptance Criteria

- [x] Email OTP expiry is below one hour in production.
- [x] Leaked-password protection is enabled in production.
- [x] Supabase Postgres is upgraded to a patched version in production.
- [x] Supabase security advisors show no corresponding warnings.
- [x] Applied configuration and verification date are recorded.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved
