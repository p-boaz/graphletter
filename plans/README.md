# Implementation Plans

Task specs live in `plans/` while active and move to `plans/archive/` after
merge. GitHub issues are the source of truth for backlog work; this file is the
index, not a second backlog.

## Active Plans

| Plan                                 | Status                    |
| ------------------------------------ | ------------------------- |
| `task-2026-06-13-backlog-hygiene.md` | Done; archive after merge |

## Product Backlog

| Issue                                                  | Work                               |
| ------------------------------------------------------ | ---------------------------------- |
| [#19](https://github.com/p-boaz/graphletter/issues/19) | Local/OSS AI provider support      |
| [#31](https://github.com/p-boaz/graphletter/issues/31) | Bulk compliance spreadsheet import |
| [#33](https://github.com/p-boaz/graphletter/issues/33) | Evidence approval workflow UI      |

## Engineering Backlog

| Issue                                                  | Work                      |
| ------------------------------------------------------ | ------------------------- |
| [#30](https://github.com/p-boaz/graphletter/issues/30) | Tailwind CSS v4 migration |

## Recent Reconciliation

- [#11](https://github.com/p-boaz/graphletter/issues/11) Docker Compose
  self-hosting: closed as completed on 2026-06-26.
- [#12](https://github.com/p-boaz/graphletter/issues/12) assessment export:
  closed as completed on 2026-06-13.
- [#13](https://github.com/p-boaz/graphletter/issues/13) synthetic-document
  demo: closed as completed on 2026-06-13.
- [#14](https://github.com/p-boaz/graphletter/issues/14) classifier eval CI
  publishing: closed as completed on 2026-06-26.
- [#15](https://github.com/p-boaz/graphletter/issues/15) Incident Response Plan
  classification: closed as completed on 2026-06-26.
- [#16](https://github.com/p-boaz/graphletter/issues/16) framework filter
  on assessment results: closed as completed on 2026-06-26.
- [#18](https://github.com/p-boaz/graphletter/issues/18) upload and results
  accessibility pass: closed as completed on 2026-06-26.
- [#23](https://github.com/p-boaz/graphletter/issues/23) route-level API tests:
  closed as completed on 2026-06-26.
- [#24](https://github.com/p-boaz/graphletter/issues/24) durable serverless demo
  quotas: closed as completed on 2026-06-26.
- [#25](https://github.com/p-boaz/graphletter/issues/25) SheetJS dependency
  provenance: closed as completed on 2026-06-26.
- [#26](https://github.com/p-boaz/graphletter/issues/26) upload file-signature
  validation: closed as completed on 2026-06-26.
- [#27](https://github.com/p-boaz/graphletter/issues/27) dead-code and
  unused-dependency cleanup: closed as completed on 2026-06-26.
- [#28](https://github.com/p-boaz/graphletter/issues/28) structured AI
  fallback metadata: closed as completed on 2026-06-26.
- [#29](https://github.com/p-boaz/graphletter/issues/29) malformed JSON
  rejection: closed as completed on 2026-06-26.
- [#32](https://github.com/p-boaz/graphletter/issues/32) enhanced analytics
  API product surface: closed as completed on 2026-06-26.
- [#34](https://github.com/p-boaz/graphletter/issues/34) Azure and GCP evidence
  classification: closed as completed on 2026-06-26.
- [#35](https://github.com/p-boaz/graphletter/issues/35) multi-framework
  impact previews: closed as completed on 2026-06-26.
- [#36](https://github.com/p-boaz/graphletter/issues/36) admin artifacts
  RBAC: closed as completed on 2026-06-26.
- [#37](https://github.com/p-boaz/graphletter/issues/37) Supabase dashboard
  security configuration: closed as completed on 2026-06-26.
- All task specs completed through 2026-06-12 are under `plans/archive/`.

## Rejected Findings

These were investigated and intentionally rejected. They are recorded to avoid
repeating the same audit:

- Assignments IDOR/user enumeration: filters only narrow rows already scoped
  to the current user.
- Public-read RLS policies on shared SCF reference tables: intentional.
- Progress subscription race: the check and subscription are synchronous.
- Progress cleanup timers: scheduled only on completion or error.
- Service-role use in the demo route: server-side and intentional.
- Moderate dependency advisories: below the production CI audit threshold.
- Legacy redirect pages: intentional URL-preserving Next.js redirects.
- Assessment status check-then-act: writes remain ownership-scoped; optimistic
  locking is not justified at current concurrency.
