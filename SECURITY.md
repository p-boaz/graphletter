# Security Policy

## Reporting a vulnerability

Report security issues to `security@graphletter.com`.

Include:

- A clear description of the issue and affected surface.
- Reproduction steps or a proof of concept.
- Impact assessment if you have one.

## Response targets

- Initial acknowledgment within 48 hours.
- Triage and severity assessment after reproduction.
- Coordinated remediation and disclosure timing once a fix is ready.

Do not open public GitHub issues for undisclosed vulnerabilities.

## Administrative Access

Graphletter gates administrative routes with server-controlled allowlists:

- `ADMIN_USER_IDS`: comma-separated Supabase Auth user UUIDs.
- `ADMIN_EMAILS`: comma-separated Supabase Auth email addresses.

Users in either allowlist are treated as administrators by `utils/auth.ts`.
Administrators can access `/admin/*` surfaces and perform privileged operations
such as SCF artifact list, create, update, and delete actions through
`/api/admin/*` routes. Leave both variables blank to disable admin access in an
environment.
