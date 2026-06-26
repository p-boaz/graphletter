# Task Spec: Evidence File Signature Validation

## Metadata

- Date: 2026-06-26
- Owner: Codex
- Status: Done
- Branch: main
- Related issue/PR: https://github.com/p-boaz/graphletter/issues/26

## Goal

Reject spoofed evidence uploads before files reach storage or parsers by validating file signatures, MIME types, and extensions for supported evidence formats.

## Context Files

- [x] `lib/services/evidence/upload-utils.ts`
- [x] `lib/services/evidence/upload-utils.test.ts`
- [x] `app/api/evidence/route.ts`
- [x] `app/api/evidence/upload-only/route.ts`
- [x] `app/api/evidence/extract-content/route.ts`
- [x] `playwright/tests/evidence-errors.spec.ts`
- [x] `plans/README.md`
- [x] `plans/task-2026-06-26-evidence-file-signatures.md`

## Constraints

- Do not add dependencies.
- Keep validation server-side so client-provided MIME types are never trusted alone.
- Return safe user-facing errors without leaking parser internals.
- Avoid changing the downstream extraction behavior for files that pass validation.

## Scope

### In scope

- Validate PDF, Word, Excel, text, CSV, PNG, JPEG, and GIF evidence files by signature or safe text sniffing.
- Reject MIME/extension/signature mismatches in upload and extract-content routes.
- Add unit tests for valid files and spoofed mismatches.
- Add an upload-flow Playwright test that exercises a spoofed file rejection.

### Out of scope

- Client-side magic-byte validation.
- New supported file formats.
- Deep content inspection beyond file container signatures.

## Implementation Plan

1. Replace the synchronous upload file validator with an async validator that checks size, MIME, extension, and file header bytes.
2. Use the validator in `/api/evidence`, `/api/evidence/upload-only`, and `/api/evidence/extract-content`.
3. Add focused unit tests for accepted and rejected file signatures.
4. Add a Playwright upload-flow test for a spoofed PDF rejection.
5. Update plan index.

## Test Plan

- [x] `pnpm test:integration`
- [x] `pnpm test:ui:bg playwright/tests/evidence-errors.spec.ts`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm check:spec`

## Acceptance Criteria

- [x] Supported formats are validated using magic bytes or safe text sniffing.
- [x] MIME/extension/signature mismatches are rejected with a safe user-facing error.
- [x] Unit tests cover valid and spoofed files.
- [x] Upload-flow tests cover spoofed file rejection.
- [ ] GitHub issue #26 is closed after validated changes are pushed.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (active goal: resolve the 21 open GitHub issues one by one)
