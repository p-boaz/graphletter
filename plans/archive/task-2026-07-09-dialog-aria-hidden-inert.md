# Task Spec: Fix aria-hidden-on-focused-ancestor warning when dialogs open

## Metadata

- Date: 2026-07-09
- Owner: agent
- Status: Done
- Branch: fix/dialog-aria-hidden-inert
- Related issue/PR: Frontend-design vetting pass, 2026-07-09

## Goal

Opening the Upload Evidence dialog logs a browser accessibility warning: `aria-hidden` is applied to an ancestor (`div.min-h-screen`) of the still-focused trigger button, hiding focus from assistive technology. Eliminate the warning across all dialogs, per the browser's own recommendation to use `inert` semantics instead.

## Context Files

- [ ] components/ui/dialog.tsx
- [ ] components/smart-evidence-upload/index.tsx
- [ ] playwright/helpers/observability.ts

## Constraints

- We are on Radix-based shadcn dialogs; prefer the supported fix (current Radix versions handle this; check whether a `@radix-ui/react-dialog` patch-level bump resolves it) before hand-rolling focus management.
- Any dependency bump must be pinned (no `latest`) and pass the full UI suite.
- Do not disable Radix's focus trapping or outside-pointer-events handling.

## Scope

### In scope

- Reproduce: open the upload dialog from the dashboard; capture the console warning.
- Root-cause: whether focus remains on the trigger at the moment Radix applies `aria-hidden` to the app root (known Radix/browser interaction), and whether our Radix version is behind the fix.
- Apply the minimal fix: version bump, or ensuring the trigger properly yields focus into the dialog on open.
- Sweep other dialog entry points (review dialog, detail dialogs, version dialog) for the same warning.

### Out of scope

- Broader accessibility audit (focus order, labels) beyond this specific warning.
- Replacing the dialog primitive.

## Implementation Plan

1. Write/extend a Playwright check that opens each dialog and asserts no `aria-hidden` console warning via the observability helper.
2. Check installed `@radix-ui/react-dialog` version against the upstream fix; bump if applicable.
3. Re-run; if the warning persists, adjust open-focus handling (e.g. ensure initial focus target inside the dialog) and re-verify.

## Test Plan

- [ ] `pnpm lint`, `pnpm typecheck` clean.
- [ ] `pnpm test:ui:bg` full suite green (dialog behavior is load-bearing across many specs).
- [ ] Manual dogfood with a screen-reader smoke check (VoiceOver): focus lands inside the dialog on open; no console warning on any dialog.

## Acceptance Criteria

- [ ] Zero `aria-hidden`/focus warnings in the console across all dialog open/close paths.
- [ ] Keyboard focus visibly moves into each dialog on open and restores to the trigger on close.

## Approval Gate

- [ ] Goal is clear
- [ ] Context files listed
- [ ] Constraints explicit
- [ ] Test plan defined
- [ ] Acceptance criteria measurable
- [ ] Human approved
