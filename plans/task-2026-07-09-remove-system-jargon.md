# Task Spec: Remove system internals from user-facing chrome

## Metadata

- Date: 2026-07-09
- Owner: agent
- Status: Draft
- Branch: fix/remove-system-jargon
- Related issue/PR: Frontend-design vetting pass, 2026-07-09

## Goal

Purge engineering vocabulary and raw system artifacts from the authenticated UI: character offsets as evidence citations, a raw UUID pill, a "View AI Logs" link that navigates to a bare JSON API response, "ERL artifact" in help copy, and lowercase machine states like "Status: submitted".

## Context Files

- [ ] components/assessment-review-dialog/detailed-view.tsx
- [ ] components/assessment-review-dialog/summary-view.tsx
- [ ] components/assessment-results-display/control-row.tsx
- [ ] components/assessment-results-display/control-detail-dialog.tsx
- [ ] components/smart-evidence-upload/assessment-progress-view.tsx
- [ ] components/smart-evidence-upload/field-help-tooltip.tsx
- [ ] lib/content/compliance-explainer.ts

## Constraints

- Keep auditor-grade traceability: offsets/UUIDs may remain in exports (JSON/CSV) and API responses — this spec only removes them from rendered chrome.
- "View AI Logs" functionality is for admins/debugging; do not delete the endpoint, only its exposure in the user dialog.
- Copy follows the interface-voice rules: name things by what the user recognizes, not how the system stores them.

## Scope

### In scope

- Evidence citations "Offsets 83-287 — <explanation>": drop the offsets from the visible line; keep the explanation as the citation caption. If a human-meaningful locator is cheaply available (e.g. the quoted text's section heading like "§4.2"), show that instead. Offsets stay in the underlying data/exports.
- Raw assessment-run UUID pill (`687063a1-…`) in the Assessment Results detail dialog: remove from display; keep it as a `title` attribute or copy-on-click affordance if a support identifier is genuinely useful.
- "View AI Logs" link (navigates to `/api/ai-assessment-logs?...` raw JSON): remove from the review dialog for regular users. If log visibility matters, it belongs in `/admin/ai-provider-health` or a formatted admin view.
- "Document type (ERL artifact)" in the inline-help popover: explain in user terms ("the kind of document you're uploading — Graphletter uses it to pick which controls to assess"); ERL as a term only if immediately defined.
- "Status: submitted • Ready for assessment": sentence-case human state ("Submitted — ready for assessment"), and audit other lowercase machine states rendered verbatim in the flow.

### Out of scope

- Export payloads, API shapes, admin pages.
- Renaming "Documentation Artifact" field labels overall (upload-dialog-simplification touches the form; coordinate).

## Implementation Plan

1. Grep the context files for `Offsets`, `uuid`/id-pill rendering, `ai-assessment-logs`, `ERL`, `submitted`.
2. Apply the replacements per Scope; where the offsets-to-section mapping is not available, ship the citation caption alone.
3. Update `lib/content/compliance-explainer.ts` entries containing ERL phrasing.
4. Update any Playwright assertions touching removed strings.

## Test Plan

- [ ] `pnpm lint`, `pnpm typecheck` clean.
- [ ] `pnpm test:ui:bg` on review-dialog specs.
- [ ] Manual dogfood: run an assessment, open both detail views and the inline help; confirm no offsets, UUIDs, raw-JSON links, or "ERL" appear unexplained.

## Acceptance Criteria

- [ ] No character offsets, UUIDs, or links to raw JSON endpoints are visible in the standard user flow.
- [ ] Evidence citations still communicate where the quote came from and why it matters.
- [ ] Help copy defines every acronym it uses in the same sentence.

## Approval Gate

- [ ] Goal is clear
- [ ] Context files listed
- [ ] Constraints explicit
- [ ] Test plan defined
- [ ] Acceptance criteria measurable
- [ ] Human approved
