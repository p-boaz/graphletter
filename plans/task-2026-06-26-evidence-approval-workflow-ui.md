# Task Spec: Evidence Approval Workflow UI

## Metadata

- Date: 2026-06-26
- Owner: Codex
- Status: Done
- Branch: main
- Related issue/PR: https://github.com/p-boaz/graphletter/issues/33

## Goal

Expose the existing evidence approve/reject API routes from the product evidence detail UI, with visible status, reviewer, rejection, and failure feedback.

## Context Files

- [x] app/api/evidence/history/route.ts
- [x] app/dashboard/evidence/page.tsx
- [x] playwright/helpers/selectors.ts
- [x] playwright/tests/evidence.spec.ts

## Constraints

- Use the existing `/api/evidence/{id}/approve` and `/api/evidence/{id}/reject` routes.
- Do not add a new approval data model.
- Keep authorization enforced by the server endpoints.
- Keep the UI scoped to the evidence detail dialog.

## Scope

### In scope

- Include review fields in evidence history responses.
- Add approve and reject controls to evidence details.
- Show review status, reviewer, rejection reason, success feedback, and API failure feedback.
- Add Playwright coverage for approve, reject, and authorization failure.

### Out of scope

- Multi-user role administration.
- Email notifications.
- New evidence review queues.

## Implementation Plan

1. Extend evidence history rows with review/rejection fields.
2. Add detail-dialog approval state, rejection reason input, and API actions.
3. Refresh evidence history after successful actions and keep feedback visible.
4. Add stable selectors and Playwright route mocks for approval, rejection, and authorization failure.

## Test Plan

- [x] `pnpm test:ui:bg playwright/tests/evidence.spec.ts`
- [x] `pnpm check:spec`
- [x] `pnpm lint`
- [x] `rm -rf .next/types && pnpm typecheck`

## Acceptance Criteria

- [x] Users can approve evidence from the evidence detail dialog.
- [x] Users can reject evidence with a visible rejection reason.
- [x] Status, reviewer, and failure feedback are visible.
- [x] Playwright covers approve, reject, and authorization failure.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved
