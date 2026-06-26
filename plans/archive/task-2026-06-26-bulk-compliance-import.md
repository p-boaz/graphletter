# Task Spec: Bulk Compliance Import

## Metadata

- Date: 2026-06-26
- Owner: Codex
- Status: Done
- Branch: main
- Related issue/PR: https://github.com/BoazGrinvald/Graphletter/issues/31

## Goal

Add a narrow, documented bulk import path for evidence inventory spreadsheets so users can preview row-level validation before creating owned evidence records.

## Context Files

- [x] app/api/evidence/import/route.ts
- [x] app/dashboard/evidence/page.tsx
- [x] lib/evidence-import.ts
- [x] lib/evidence-import.test.ts
- [x] docs/EVIDENCE_IMPORT.md
- [x] playwright/helpers/selectors.ts
- [x] playwright/tests/evidence.spec.ts

## Constraints

- Keep the first import surface narrow: CSV or JSON evidence inventory rows only.
- Do not import uploaded binary files through this flow.
- Never accept user ownership fields from imported data; ownership must come from the authenticated session.
- Do not create partial imports when any row is invalid.
- Use existing dependencies and UI patterns.

## Scope

### In scope

- Document the supported import schema and validation behavior.
- Add server-side CSV/JSON parsing and validation.
- Validate referenced SCF controls and ERL records before commit.
- Add preview and commit actions from the evidence page.
- Show actionable row errors in the UI.
- Add unit and Playwright coverage.

### Out of scope

- XLSX parsing.
- Assessment-result import.
- Background jobs or resumable uploads.
- Binary evidence file ingestion.

## Implementation Plan

1. Add a reusable parser/validator for the supported evidence import schema.
2. Add an authenticated `/api/evidence/import` route with `preview` and `commit` modes.
3. Add the evidence page import dialog with file selection, preview table, and commit handling.
4. Document the schema and operational guarantees.
5. Cover validation logic and browser preview/commit behavior.

## Test Plan

- [x] `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=test SUPABASE_SERVICE_ROLE_KEY=test pnpm test:integration lib/evidence-import.test.ts`
- [x] `pnpm test:ui:bg playwright/tests/evidence.spec.ts`
- [x] `pnpm check:spec`
- [x] `pnpm lint`
- [x] `rm -rf .next/types && pnpm typecheck`

## Acceptance Criteria

- [x] Supported CSV/JSON fields are documented.
- [x] Users can preview parsed rows before commit.
- [x] Invalid rows show row-specific errors and block commit.
- [x] Commit creates evidence records only after all rows validate.
- [x] Authenticated user ownership is enforced server-side.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved
