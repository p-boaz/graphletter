# Task Spec: Admin Artifacts RBAC

## Metadata

- Date: 2026-06-26
- Owner: Codex
- Status: Done
- Branch: main
- Related issue/PR: https://github.com/p-boaz/graphletter/issues/36

## Goal

Protect the administrative SCF artifact editing surface with server-side role authorization for both page access and backing mutations.

## Context Files

- [x] `app/admin/artifacts/page.tsx`
- [x] `app/admin/artifacts/admin-artifacts-client.tsx`
- [x] `app/api/admin/artifacts/route.ts`
- [x] `SECURITY.md`
- [x] `tests/admin-artifacts-route.test.ts`
- [x] `playwright/tests/admin-artifacts.spec.ts`
- [x] `plans/README.md`
- [x] `plans/archive/task-2026-06-26-admin-artifacts-rbac.md`

## Constraints

- Use the existing admin allowlist in `utils/auth.ts`.
- Gate the page server-side before rendering the editor.
- Route all artifact list/create/update/delete operations through an admin-only server API.
- Keep public artifact selection APIs unchanged.

## Scope

### In scope

- Split the current admin artifacts page into a server page and client editor component.
- Add an admin-only `/api/admin/artifacts` route for GET, POST, PATCH, and DELETE.
- Replace direct browser Supabase mutations with fetch calls to the admin API.
- Document admin role assignment and privileges.
- Add UI coverage for unauthorized and authorized admin artifacts states.
- Add route-level coverage for authorized and unauthorized admin artifact API access.

### Out of scope

- Database schema or RLS migrations.
- General RBAC beyond the existing server-controlled allowlist.
- Redesigning the admin artifacts UI.

## Implementation Plan

1. Move the existing interactive editor into `admin-artifacts-client.tsx`.
2. Replace client Supabase reads/writes with `/api/admin/artifacts` fetches.
3. Add the admin artifacts API route with allowlist checks for every method.
4. Make `page.tsx` a server component that renders a safe denial for signed-out or non-admin users.
5. Document `ADMIN_USER_IDS` and `ADMIN_EMAILS` privileges in `SECURITY.md`.
6. Add route tests for admin API authorization and CRUD dispatch.
7. Add Playwright tests for forbidden page access and the admin denial UI.
8. Run targeted route/UI, lint, typecheck, and spec checks.

## Test Plan

- [x] `QA_USER_EMAIL=<qa-email> ADMIN_EMAILS=<qa-email> pnpm test:ui:bg playwright/tests/admin-artifacts.spec.ts`
- [x] `node --import tsx --test tests/admin-artifacts-route.test.ts`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm check:spec`

## Acceptance Criteria

- [x] Non-admin users receive a safe denial instead of the editor.
- [x] Admin artifact list, create, update, and delete operations are server-authorized.
- [x] The client no longer writes directly to Supabase for this admin surface.
- [x] Admin role assignment and privileges are documented.
- [x] GitHub issue #36 is closed after validated changes are pushed.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (active goal: resolve the 21 open GitHub issues one by one)
