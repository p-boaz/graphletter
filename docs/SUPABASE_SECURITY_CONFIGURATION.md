# Supabase Security Configuration

Production project: `graphletter` (`gbnxwsntyzyrpwmjaaqa`)

Verified: 2026-06-26 10:28:50 PDT

## Applied Settings

| Area     | Setting                    | Production value                           |
| -------- | -------------------------- | ------------------------------------------ |
| Auth     | Email OTP expiry           | `1800` seconds                             |
| Auth     | Leaked-password protection | `enabled` (`password_hibp_enabled = true`) |
| Database | Supabase Postgres image    | `17.6.1.127`                               |
| Database | Postgres engine            | `17`                                       |
| Database | Release channel            | `ga`                                       |

## Verification

Supabase Management API checks returned:

- Auth config: `mailer_otp_exp = 1800`,
  `password_hibp_enabled = true`, `site_url = https://graphletter.com`.
- Project state: `ACTIVE_HEALTHY` on database version `17.6.1.127`.
- Security advisors: `0` total lints and no matches for OTP, HIBP,
  leaked-password, password, Postgres, or version warnings.

The Postgres upgrade was initiated through the Management API with tracking id
`a21b3978-64a6-4fde-a74e-b2ebddaa36bb` and completed at
`10_completed_post_physical_backup`.
