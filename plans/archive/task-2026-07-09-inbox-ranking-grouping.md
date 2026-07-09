# Task Spec: Compliance Inbox — rank by leverage, group domain walls

## Metadata

- Date: 2026-07-09
- Owner: agent
- Status: Done
- Branch: feat/inbox-ranking-grouping
- Related issue/PR: Frontend-design vetting pass, 2026-07-09

## Goal

Fix the inbox's inverted prioritization. Today ten identical alphabetical "Missing: AAT-…" single-control rows rank _high_ while "Upload: Incident Response Plan — covers 9 missing controls" ranks _medium_; the user's highest-leverage actions sit below a wall of repetitive low-leverage items with identical copy. Rank by controls-closed-per-action and collapse same-domain missing-control runs into grouped items.

## Context Files

- [ ] lib/compliance/inbox-generator.ts
- [ ] lib/compliance/inbox-generator.test.ts
- [ ] components/compliance-inbox/inbox-item-card.tsx
- [ ] app/dashboard/compliance-inbox/page.tsx
- [ ] app/dashboard/page.tsx

## Constraints

- Ranking change is a pure re-scoring in `inbox-generator.ts`; keep the generator deterministic and unit-tested (extend the existing test file).
- Grouping must not hide information: a grouped item expands or links to the full control list.
- The dashboard Overview's 3-item inbox preview consumes the same ordering — verify it inherits the fix.

## Scope

### In scope

- Scoring: an action item's priority derives primarily from controls closed per action (an upload covering 10 controls outranks a single missing control), with domain criticality as a secondary factor. Alphabetical control ID must not correlate with rank.
- Grouping: N missing-control items from one domain with identical copy collapse to one item — "AI & Autonomous Technologies: 156 controls missing — start with the AAT Governance Program artifact (covers 12)" — with an expandable/linked detail list.
- Copy: grouped and single items name the concrete next action; retire the repeated boilerplate "No evidence uploaded for this control. Upload documentation to close this gap." in favor of per-item specifics (the medium "Upload:" items already model this well).
- Severity labels: with the new scoring, "high" must mean high leverage or genuine urgency; recheck the "Urgent (0 critical, 10 high)" summary math after re-scoring.
- "Upload Evidence" row buttons should prefill the upload dialog's artifact when the item implies one (the "Upload: <artifact>" items name it explicitly).

### Out of scope

- New data sources or gap-analysis changes.
- Posture-score changes.
- Dialog internals beyond accepting a prefilled artifact (coordinate with upload-dialog-simplification).

## Implementation Plan

1. Read `inbox-generator.ts` scoring; write failing unit tests encoding the new ranking (coverage-per-action dominant, no alphabetical bias) and grouping behavior.
2. Implement re-scoring and domain grouping in the generator.
3. Update `inbox-item-card.tsx` for grouped items (count, expand/link) and prefill wiring on the upload button.
4. Verify the dashboard preview reflects the new order.

## Test Plan

- [ ] `pnpm test:integration` (or the generator's unit-test runner) green with new cases.
- [ ] `pnpm lint`, `pnpm typecheck` clean.
- [ ] `pnpm test:ui:bg` inbox specs; add an assertion that the top item on the QA account is a multi-control action, not an AAT singleton.
- [ ] Manual dogfood: inbox top 5 are distinct, specific, high-leverage; clicking a row's Upload button lands in the dialog with the artifact prefilled where applicable.

## Acceptance Criteria

- [ ] Top-ranked items maximize controls closed per action on the QA dataset.
- [ ] No run of >2 visually identical items; same-domain missing-control walls are grouped with counts.
- [ ] "High" count in the summary reflects the new scoring.
- [ ] Upload buttons prefill the artifact when the item names one.

## Approval Gate

- [ ] Goal is clear
- [ ] Context files listed
- [ ] Constraints explicit
- [ ] Test plan defined
- [ ] Acceptance criteria measurable
- [ ] Human approved
