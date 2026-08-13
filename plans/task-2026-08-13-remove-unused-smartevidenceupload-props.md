# Task Spec: Remove unused SmartEvidenceUpload props defaultControlIds and defaultFrameworkId

## Metadata

- Date: 2026-08-13
- Owner: claude (maintainer-loop, dead-code category)
- Status: Done
- Branch: chore/maintainer-loop/20260813-remove-unused-smartevidenceupload-props-defaultcontrolids-and-defaultframeworkid
- Related issue/PR: opened by maintainer-loop; never auto-merged

## Goal

Delete two dead optional props from `SmartEvidenceUpload`. They are declared and
destructured but read nowhere, and they are the only two `no-unused-vars`
warnings in the component.

## Context Files

- [x] components/smart-evidence-upload/types.ts (interface members)
- [x] components/smart-evidence-upload/index.tsx (destructure bindings)
- [x] app/dashboard/page.tsx, components/dashboard-layout.tsx, components/try-it-out-content.tsx (call sites audited)

## Constraints

- No behavior change: both props were optional and never read.
- Touch only the two component files; no feature work, no call-site changes.

## Scope

### In scope

- Remove `defaultControlIds?: string[]` and `defaultFrameworkId?: string` from `SmartEvidenceUploadProps`.
- Remove the matching two destructure entries from the component signature.

### Out of scope

- Wiring the props up to form state (that is a feature, not upkeep).
- The related `uploadDefaults` shape in `app/dashboard/page.tsx`.

## Implementation Plan

1. Prove deadness on `origin/main`: repo-wide grep finds only the 4 declaration/binding lines.
2. Audit all 3 call sites for JSX spread that could pass the props dynamically. None found.
3. Delete the 2 interface members and the 2 destructure entries together.
4. Run the gate.

## Test Plan

- [x] `pnpm typecheck` passes.
- [x] `pnpm exec eslint` on both changed files reports no warnings.

## Acceptance Criteria

- [x] Zero repo-wide references to either prop name remain.
- [x] All 3 call sites still typecheck (none passed either prop).
- [x] The 2 `no-unused-vars` warnings in the component are cleared.
