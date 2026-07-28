# Task Spec: Tighten README intro

## Metadata

- Date: 2026-07-21
- Owner: Codex
- Status: Done
- Branch: codeville/8bd93af1-52dc-42c1-9d0d-f7357aadaeba
- Related issue/PR: None

## Goal

Rewrite the README's opening paragraph so it describes Graphletter's current evidence-validation workflow clearly and concisely, while preserving only claims supported by current source-of-truth files.

## Context Files

- [x] `README.md`
- [x] `plans/task-2026-07-21-readme-intro.md`

## Constraints

- Documentation only; do not change application code, configuration, dependencies, or tests.
- Keep the intro to one compact paragraph.
- Preserve the live-demo links and framework-count source comment.
- Keep the framework total aligned with `MAPPED_FRAMEWORK_COUNT` in `lib/scf-parser.ts`.

## Scope

### In scope

- Replace the first descriptive paragraph below the Graphletter heading.
- Clarify that Graphletter validates uploaded evidence against SCF controls, explains coverage and gaps, and maps findings to 81 supported frameworks.
- Remove stale generic "AI-powered compliance assessment" positioning.

### Out of scope

- Rewriting later README sections.
- Changing product behavior or other public copy surfaces.
- Browser testing or application test changes.

## Implementation Plan

1. Rewrite the opening paragraph using current product terminology and verified capabilities.
2. Review the README diff for brevity, accuracy, and consistency with existing source comments.
3. Run documentation formatting and copy checks relevant to the changed file.

## Test Plan

- [x] Run `pnpm exec prettier --check README.md plans/task-2026-07-21-readme-intro.md`.
- [x] Run `pnpm check:copy`.
- [x] Confirm the diff changes only the approved documentation files.

## Acceptance Criteria

- [x] The README's first paragraph states what Graphletter accepts, does, and returns in plain language.
- [x] The paragraph uses current evidence-validation terminology rather than the stale generic assessment tagline.
- [x] The 81-framework claim remains consistent with `MAPPED_FRAMEWORK_COUNT`.
- [x] No non-documentation files are changed.
- [x] Relevant formatting and copy checks pass.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved
