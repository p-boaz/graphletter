# Task Spec: Upload dialog — grouped artifact picker, recommended items, controls-based impact framing

## Metadata

- Date: 2026-07-09
- Owner: agent
- Status: Done
- Branch: feat/upload-dialog-simplification
- Related issue/PR: Frontend-design vetting pass, 2026-07-09

## Goal

Make the upload dialog's key decision — which documentation artifact — navigable, and frame predicted impact in units that motivate. Today the artifact combobox is a flat alphabetical list of ~300 items, and the impact preview says "+0.1%", which is honest but reads as futility at 1,468-control scale.

## Context Files

- [ ] components/smart-evidence-upload/index.tsx
- [ ] components/smart-evidence-upload/upload-form.tsx
- [ ] components/smart-evidence-upload/impact-preview-banner.tsx
- [ ] components/smart-evidence-upload/utils.ts
- [ ] components/next-upload-suggestion.tsx
- [ ] lib/compliance/impact-previewer.ts

## Constraints

- Keep the existing searchable-combobox interaction; grouping and a recommended section are additive.
- Recommendations must come from the existing gap analysis (the machinery behind "next highest-impact upload" / compliance inbox), not a new scoring system.
- The posture-percent projection may remain as secondary text; the primary line becomes controls-based.

## Scope

### In scope

- Artifact combobox: group options by SCF domain (or the artifact taxonomy's own categories) with sticky group headers in the dropdown; search continues to match across all groups.
- "Recommended for you" section pinned at the top of the dropdown: top 3–5 artifacts by missing-controls coverage for this account (source: same data as next-upload-suggestion), each with a "covers N controls" annotation.
- Impact preview banner: lead with "Advances GOV-01" / "covers N controls across M frameworks"; the "+0.1% posture" figure becomes secondary, and is suppressed when it rounds below 0.1%.
- "How this works" 3-step strip: keep (it is a true sequence), but it must be visible without scrolling on a 900px-tall viewport once the redundant hero banner is removed (dedupe-repeated-statements spec) — verify, don't rebuild.

### Out of scope

- The hero-banner removal itself (dedupe-repeated-statements spec).
- Renaming "Documentation Artifact" (coordinate with remove-system-jargon help-copy changes).
- Server-side changes to the artifact taxonomy.

## Implementation Plan

1. Check what grouping metadata exists per artifact (domain/category) in the data behind the combobox; if absent, derive from the controls each artifact maps to.
2. Implement grouped rendering + pinned recommended section in the combobox listbox.
3. Rework `impact-preview-banner.tsx` copy hierarchy per Scope.
4. Update Playwright selectors/assertions for the combobox and banner.

## Test Plan

- [ ] `pnpm lint`, `pnpm typecheck` clean.
- [ ] `pnpm test:ui:bg` upload-form specs green (including the existing artifact-mapping InlineHelp test).
- [ ] Manual dogfood: open picker → recommended items appear with coverage counts; search "charter" still narrows across groups; select one → impact line leads with controls, not percent.

## Acceptance Criteria

- [ ] Artifact dropdown shows a recommended section (when gap data exists) and grouped options with headers.
- [ ] Search behavior is unchanged in coverage and speed.
- [ ] Impact preview leads with controls/frameworks; no user ever sees a bare "+0.0%"-class projection as the headline.

## Approval Gate

- [ ] Goal is clear
- [ ] Context files listed
- [ ] Constraints explicit
- [ ] Test plan defined
- [ ] Acceptance criteria measurable
- [ ] Human approved
