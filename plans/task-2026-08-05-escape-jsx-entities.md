# Task Spec: Escape unescaped quote/apostrophe entities in JSX copy

## Metadata

- Date: 2026-08-05
- Owner: maintainer-loop (agent)
- Status: Done
- Branch: chore/maintainer-loop/20260805-escape-unescaped-quoteapostrophe-entities-in-jsx-copy-4-lint-warnings
- Related issue/PR: PR opened by maintainer-loop

## Goal

Clear four `react/no-unescaped-entities` lint warnings by escaping literal `"` and `'` characters in JSX copy. Rendered output is identical.

## Context Files

- [x] components/objective-assessment-list.tsx
- [x] components/smart-evidence-upload/assessment-progress-view.tsx

## Constraints

- Mechanical change only: replace `"` with `&quot;` and `'` with `&apos;` in JSX text nodes.
- No behavior, copy, or styling change.

## Scope

### In scope

- The four lint-flagged JSX text occurrences in the two components above.

### Out of scope

- Any other lint rules or files.

## Implementation Plan

1. Replace the two decorative `"` glyphs in `EvidenceSpecimen` with `&quot;`.
2. Replace `couldn't` and `won't` in `AssessmentProgressView` warning copy with `&apos;` forms.
3. Run `pnpm lint` to confirm the warnings are gone.

## Test Plan

- [x] `pnpm lint` passes with the four `react/no-unescaped-entities` warnings cleared.

## Acceptance Criteria

- [x] `pnpm lint` reports no `react/no-unescaped-entities` warnings for the two files.
- [x] Rendered text is unchanged (HTML entities render identically).

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [ ] Human approved (PR review is the gate; do not auto-merge)
