# Task Spec: Set long-form AI and objective text in neutral ink

## Metadata

- Date: 2026-07-09
- Owner: agent
- Status: Draft
- Branch: fix/ai-text-neutral-ink
- Related issue/PR: Frontend-design vetting pass, 2026-07-09

## Goal

Stop setting paragraphs in accent colors. The upload-flow detailed view renders entire AI rationale paragraphs (250+ words) in blue and SCF objective sentences in green-on-green; colored text signals links or status, and at paragraph length it destroys readability. Body text becomes neutral ink; the category ("SCF Objective" / "AI Assessment" / "Verified Evidence") is carried by a small colored label or left rail only.

## Context Files

- [ ] components/assessment-review-dialog/detailed-view.tsx
- [ ] components/assessment-review-dialog/summary-view.tsx

## Constraints

- Keep the three-part structure per objective (objective / AI reasoning / evidence) — this spec changes only the ink and container treatment, not the information architecture.
- The Assessment Results detail dialog (`control-detail-dialog.tsx`) already does this correctly (neutral text, bold inline labels); use it as the reference treatment.
- Must hold up in both light and dark themes if a dark theme exists; verify via `theme-provider.tsx` usage.

## Scope

### In scope

- AI Rationale paragraph, AI Recommendations list, AI Assessment sentences: neutral foreground (`text-foreground`/slate-700 equivalents).
- SCF Objective text: neutral foreground; the green stays only on the small "SCF Objective" label/icon.
- The tinted container backgrounds (green box, blue box): reduce to either a neutral card with a colored label, or a 2px colored left border on white — one pattern, applied to all three box types.
- Reduce the 22×3 repeated labeled-box weight: labels set smaller (eyebrow style), boxes lose their borders-plus-background double treatment.

### Out of scope

- Status pill colors (status-color-system spec).
- Merging the two detail views (converge-assessment-detail-views spec) — but implement this spec in a way that survives that merge, i.e. as class changes, not structural rewrites.

## Implementation Plan

1. In `detailed-view.tsx`, replace accent text classes on paragraph/list content with neutral ones; keep accents on the section labels and icons only.
2. Convert the three tinted boxes to the single chosen container pattern (recommend: white/neutral background, colored 2px left border, small colored label).
3. Apply the same to the maturity "AI Rationale" block in `summary-view.tsx` if it shares the treatment.
4. Screenshot before/after at 1200px and 390px.

## Test Plan

- [ ] `pnpm lint`, `pnpm typecheck` clean.
- [ ] `pnpm test:ui:bg` on the upload/review specs (selectors should be unaffected; fix any class-based selectors).
- [ ] Manual dogfood: open the detailed view for a completed assessment; confirm rationale reads as body text and category colors survive only as labels/rails.

## Acceptance Criteria

- [ ] No sentence longer than one line renders in an accent color anywhere in the review dialog.
- [ ] Category identity (objective vs AI vs evidence) remains distinguishable without reading the labels.
- [ ] Contrast of all body text meets WCAG AA against its background.

## Approval Gate

- [ ] Goal is clear
- [ ] Context files listed
- [ ] Constraints explicit
- [ ] Test plan defined
- [ ] Acceptance criteria measurable
- [ ] Human approved
