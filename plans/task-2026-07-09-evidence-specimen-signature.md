# Task Spec: Evidence-as-specimen — carry the landing page's document identity into the assessment detail view

## Metadata

- Date: 2026-07-09
- Owner: agent
- Status: Draft
- Branch: feat/evidence-specimen-signature
- Related issue/PR: Frontend-design vetting pass, 2026-07-09

## Goal

Give the dashboard the visual signature it lacks. The landing page's identity — the assessment as a paper specimen, "AI reasoning quoted back to your source" — currently dies at the login wall; inside, verified evidence quotes (the product's genuine differentiator) render as generic gray boxes. Typeset verified evidence as document specimens using the landing page's established `ft-` design language, making the quote the hero of the detail view and unifying marketing and product identity.

## Context Files

- [ ] components/assessment-review-dialog/detailed-view.tsx (or the shared component from task-2026-07-09-converge-assessment-detail-views)
- [ ] components/assessment-results-display/control-detail-dialog.tsx
- [ ] app/globals.css (existing `ft-paper`, `ft-serif`, `ft-eyebrow`, `ft-rule` tokens)
- [ ] app/page.tsx (reference only — the landing specimen treatment to match)

## Constraints

- Sequence AFTER converge-assessment-detail-views so the treatment is built once in the shared component. If sequencing slips, apply to `control-detail-dialog.tsx` first (the surviving design).
- Boldness budget goes here and only here: the specimen treatment is the one expressive element; surrounding chrome stays quiet (neutral ink per ai-text-neutral-ink, one status system per status-color-system).
- Reuse the existing `ft-*` utilities from `globals.css`; do not invent a parallel token set.
- Human-meaningful source lines depend on remove-system-jargon (offsets removed); this spec supplies the visual treatment for whatever citation text that spec settles on.

## Scope

### In scope

- Verified evidence quotes become specimens: serif quote text (landing's `ft-serif`), paper-card treatment (`ft-paper` texture/border, subtle document shadow), hanging quotation mark or rule, and a source/caption line in the landing's mono-eyebrow style (`ft-mono` small caps).
- The AI explanation attached to each quote sits under the specimen as a quiet caption — the quote is primary, the reasoning secondary.
- Quote-level visual hierarchy inside each objective: specimen > AI reasoning > metadata.
- A restrained page-level echo: the detail dialog's header adopts the landing's document-chrome pattern (eyebrow + serif title + mono meta line: file name, controls evaluated, SCF edition) replacing the current mixed-style header.

### Out of scope

- Broader dashboard re-theming (gradient buttons, nav) — candidate follow-up, not this task.
- Any data or citation-content changes (remove-system-jargon owns the text).
- Landing page changes.

## Implementation Plan

1. Extract the landing specimen card's treatment into reusable classes (or a small `EvidenceSpecimen` component under `components/ui/`).
2. Apply to the evidence quotes in the shared detail component; restyle the dialog header per Scope.
3. Screenshot side-by-side with the landing specimen; iterate until they read as one family.
4. Verify at 390px (quotes wrap, no horizontal scroll) and with reduced-motion (no new motion introduced).

## Test Plan

- [ ] `pnpm lint`, `pnpm typecheck` clean.
- [ ] `pnpm test:ui:bg` review/detail specs green.
- [ ] Manual dogfood: run an assessment, open details — evidence quotes are unmistakably the visual anchor; compare against the landing page for family resemblance.

## Acceptance Criteria

- [ ] Evidence quotes use the serif/paper specimen treatment consistent with the landing page's `ft-*` language.
- [ ] The quote is the strongest visual element in each objective block; AI reasoning reads as its caption.
- [ ] Treatment holds at mobile widths and introduces no new motion.

## Approval Gate

- [ ] Goal is clear
- [ ] Context files listed
- [ ] Constraints explicit
- [ ] Test plan defined
- [ ] Acceptance criteria measurable
- [ ] Human approved
