# Task Spec: Fix pluralization, spacing, and verb-consistency copy bugs in the upload/assessment flow

## Metadata

- Date: 2026-07-09
- Owner: agent
- Status: Done
- Branch: fix/dashboard-copy-plural-spacing
- Related issue/PR: Frontend-design vetting pass, 2026-07-09

## Goal

Eliminate the visible copy defects found during the authenticated upload → assessment → review walkthrough: broken pluralization ("1 controls"), missing spaces ("Found 1relevant controls", emoji jammed against text), and inconsistent verbs for the same event ("frameworks touched" vs "frameworks advanced").

## Context Files

- [ ] components/smart-evidence-upload/assessment-progress-view.tsx
- [ ] components/smart-evidence-upload/upload-results-view.tsx
- [ ] components/smart-evidence-upload/index.tsx
- [ ] components/assessment-review-dialog/summary-view.tsx
- [ ] components/framework-impact-cascade.tsx

## Constraints

- Copy-only changes; no layout, data, or behavior changes.
- Introduce a tiny local plural helper (or use `Intl.PluralRules`) rather than scattering ternaries — but do not add a dependency.
- Any changed string that a Playwright spec asserts on must be updated in the same commit.

## Scope

### In scope

- "Found 1relevant controls for …" (post-upload success banner): missing space and wrong plural. Render "Found 1 relevant control for …" / "Found N relevant controls for …".
- "Assessed 1controls for …" (post-approve success banner): same defect, same fix.
- "AI Assessment Results (1 controls)" (review dialog): pluralize correctly.
- Emoji glued to text: "📄sample-….txt" and "🎯AI Assessment Results" need a space (or drop the emoji — see the neutral-ink spec; here just fix spacing).
- Verb consistency: the post-approve view says both "This upload advanced 43 frameworks" and "43 compliance frameworks touched". Standardize on "advanced" everywhere.
- Sweep the five context files for any other `${n}` interpolations directly adjacent to a word and any singular/plural literals ("1 evidence files", etc.).

### Out of scope

- Removing the duplicated "43 frameworks" banner itself (covered by the dedupe-repeated-statements spec).
- Tone or jargon rewrites (covered by remove-system-jargon spec).

## Implementation Plan

1. Add a `plural(n, singular, plural?)` helper in `components/smart-evidence-upload/utils.ts` (or reuse one if it exists in `lib/`).
2. Fix each flagged string; grep the context files for `}relevant`, `}controls`, `(1 controls`, `(\d+ controls)` interpolation patterns, and emoji-adjacent template literals.
3. Search `playwright/tests/` for assertions on the old strings and update them.

## Test Plan

- [ ] `pnpm lint` and `pnpm typecheck` clean.
- [ ] `pnpm test:ui:bg playwright/tests/<upload spec>` green after string updates.
- [ ] Manual dogfood: upload `public/samples/sample-cybersecurity-charter.txt` as "Charter - Cybersecurity Program", confirm every count reads grammatically with n=1.

## Acceptance Criteria

- [ ] No user-visible string renders a number glued to a word anywhere in the upload/assessment flow.
- [ ] All counts pluralize correctly for n=1 and n>1.
- [ ] Exactly one verb ("advanced") is used for the frameworks-impact fact across the flow.

## Approval Gate

- [ ] Goal is clear
- [ ] Context files listed
- [ ] Constraints explicit
- [ ] Test plan defined
- [ ] Acceptance criteria measurable
- [ ] Human approved
