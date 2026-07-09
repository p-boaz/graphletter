# Task Spec: Quiet the AI chrome — retire brain icons, "Smart" naming, and stacked AI labels

## Metadata

- Date: 2026-07-09
- Owner: agent
- Status: Draft
- Branch: fix/ai-chrome-debranding
- Related issue/PR: Frontend-design vetting pass, 2026-07-09

## Goal

In a product where every assessment is AI-generated, AI-branding is noise: the upload flow shows a brain icon three times in one dialog (title, hero banner, "Ready to Start AI Assessment" panel), the dialog is named "Smart Evidence Upload & Assessment" ("Smart" is filler), robot icons and the labels "AI Assessment Summary" / "AI Assessment" / "AI Rationale" stack within a single viewport, and CTAs say "Start AI Assessment". Name things by what they do for the user; state AI provenance once per surface where it carries information (e.g. review gating), not as decoration.

## Context Files

- [ ] components/smart-evidence-upload/index.tsx
- [ ] components/smart-evidence-upload/upload-form.tsx
- [ ] components/smart-evidence-upload/assessment-progress-view.tsx
- [ ] components/smart-evidence-upload/upload-results-view.tsx
- [ ] components/assessment-review-dialog/summary-view.tsx
- [ ] components/assessment-review-dialog/detailed-view.tsx

## Constraints

- Do not hide that assessments are AI-produced — that disclosure matters in a compliance product; it must appear once, clearly, on each results surface (the review dialog's "Review the AI's reasoning…" line is the right register).
- Rename user-visible strings only; do not rename files/components/testids in this pass (avoid churn; converge spec owns structural renames).
- Coordinate with dedupe-repeated-statements (which deletes one of the brain-icon banners) and assessment-list-cleanup (which removes the per-row "AI Generated" chip) — this spec covers the remainder.

## Scope

### In scope

- Dialog title: "Smart Evidence Upload & Assessment" → "Upload evidence". Drop the brain icon from the title.
- "Ready to Start AI Assessment" panel + "Start AI Assessment" button → "Ready to assess" / "Start assessment" (provenance already stated in the flow); replace remaining brain/robot icons with neutral iconography or none.
- Detail views: "AI Assessment Summary" → "Summary"; per-objective "AI Assessment" label → "Assessment" or "Reasoning"; "AI Rationale:" → "Rationale". Keep exactly one AI-provenance statement per dialog (the header instruction line).
- Sweep the six context files for remaining brain (🧠/lucide brain) and robot icons and "Smart"/"AI-powered" adjectives.

### Out of scope

- Marketing/landing copy.
- The "AI Generated" list chips (assessment-list-cleanup) and duplicated banners (dedupe-repeated-statements).
- Log/event names, API fields, internal identifiers.

## Implementation Plan

1. Inventory: grep the context files for `Smart`, `AI `, brain/bot icon imports.
2. Apply renames per Scope; confirm each surface retains exactly one provenance statement.
3. Update Playwright assertions on renamed strings.

## Test Plan

- [ ] `pnpm lint`, `pnpm typecheck` clean.
- [ ] `pnpm test:ui:bg` upload/review specs green after string updates.
- [ ] Manual dogfood: full upload → review loop; count AI mentions per screen (target: one), zero brain icons.

## Acceptance Criteria

- [ ] No "Smart" in user-facing names; no brain/robot icons in the upload/review flow.
- [ ] Each results surface states AI provenance exactly once.
- [ ] Buttons name the action ("Start assessment"), not the technology.

## Approval Gate

- [ ] Goal is clear
- [ ] Context files listed
- [ ] Constraints explicit
- [ ] Test plan defined
- [ ] Acceptance criteria measurable
- [ ] Human approved
