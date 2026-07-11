# Task Spec: Framework-count truth line — fix stale "79+ / 76 other frameworks" copy

## Metadata

- Date: 2026-07-11
- Owner: agent (Claude); approved by Peter 2026-07-11 ("go on both")
- Status: Done (PR #49 merged 2026-07-11; live meta description verified)
- Branch: fix/framework-count-copy
- Related issue/PR: surfaced during PR #46 live-proof (see PR comment thread)

## Goal

Public copy claims "79+ frameworks" (and the site meta description says
"SOC 2, ISO 27001, NIST, and 76 other frameworks"), but after PR #46 the
product maps **66** frameworks. Align every public claim with a defined truth
line and stop the number from rotting again.

## Truth line (the two honest numbers)

- **66** — frameworks Graphletter actually maps and produces verdicts against
  (`FRAMEWORK_COLUMNS` entries = `scf_frameworks` rows in prod, verified
  2026-07-11).
- **252** — framework mapping columns in the SCF 2026.2 workbook itself
  (Graphletter maps 66 of them; the rest are a documented follow-up in the
  2026.2 spec's out-of-scope list).

Rule: claims about **what Graphletter checks** use the 66-line ("65+" or the
exact number). Claims describing **the SCF library** may cite its broader
cross-mapping ("250+ framework mapping columns") but must not imply Graphletter
covers them all. The old "79+" was FRAMEWORK_COLUMNS' entry count circa
2026.1.1 — 6 of those entries were phantoms pointing at columns that didn't
exist, so 79 was never actually true.

## Stale occurrences (9, all must change)

| File                                          | Current claim                     |
| --------------------------------------------- | --------------------------------- |
| app/layout.tsx:13 (site meta description)     | "and 76 other frameworks"         |
| app/docs/page.tsx:516                         | "scf_frameworks — 79+"            |
| components/demo-smart-evidence-upload.tsx:419 | "across 79+ frameworks"           |
| lib/research/research-topics.ts:21            | "across 79+ frameworks"           |
| lib/how-it-works/glossary.ts:4                | "map to 79+ regulatory standards" |
| README.md:3                                   | "verdicts across 79+ frameworks"  |
| README.md:25                                  | "spanning 79+ frameworks"         |
| README.md:33                                  | "cross-maps to 79+ frameworks"    |
| AGENTS.md:7                                   | "(SCF, 79+ frameworks)"           |

## Context Files

- [ ] app/layout.tsx
- [ ] app/docs/page.tsx
- [ ] components/demo-smart-evidence-upload.tsx
- [ ] lib/research/research-topics.ts
- [ ] lib/how-it-works/glossary.ts
- [ ] README.md
- [ ] AGENTS.md
- [ ] lib/scf-parser.ts (export the count as a constant)
- [ ] playwright/tests/public-pages.spec.ts (meta-description assertion)

## Constraints

- `app/layout.tsx` metadata affects SEO; keep the description under ~160 chars.
- Do not import the full parser table into client components to get a number —
  export a `MAPPED_FRAMEWORK_COUNT` constant (derived from
  `FRAMEWORK_COLUMNS.length` in `lib/scf-parser.ts`) and use it in server
  contexts; markdown files hardcode the number with a comment pointing at the
  constant.
- De-jargon rules from the 2026-07 copy pass still apply — plain language.

## Scope

### In scope

1. Export `MAPPED_FRAMEWORK_COUNT` from `lib/scf-parser.ts`.
2. Update all 9 occurrences per the truth line. Recommended phrasings:
   - meta description: "…checks them against SOC 2, ISO 27001, NIST, and 60+
     other frameworks…" (durable floor, no rot on minor changes)
   - README/AGENTS SCF descriptions: "the SCF cross-maps hundreds of laws and
     standards; Graphletter maps 66 of them today"
3. Playwright assertion pinning the meta description so the number can't
   silently drift from the constant again.

### Out of scope

- Expanding actual framework coverage (tracked as the 2026.2 spec's follow-up:
  GovRAMP, IEC 62443, MITRE ATT&CK, FedRAMP, NIS2, …).
- Any pricing/positioning copy rewrite beyond the counts.

## Implementation Plan

1. Create branch; get spec approved.
2. Add the exported constant + swap the 9 occurrences.
3. Update/extend the public-pages Playwright spec; `pnpm test:ui:bg` on it.
4. `pnpm lint && pnpm typecheck`; grep gate: `grep -rn "79+\|76 other" app
components lib README.md AGENTS.md` returns nothing.
5. PR.

## Test Plan

- [x] Grep gate clean (no "79+" / "76 other" outside plans/ and git history)
- [x] Playwright meta-description assertion green
- [x] `pnpm lint` / `typecheck` green

Note: the pre-existing `public pages: dogfood report regressions are covered`
test fails on `open-smart-upload-button` (/try) on a CLEAN main checkout too —
verified by stash + re-run, unrelated to this change; needs its own follow-up.
Also fixed in passing (same docs block as the flagged line): stale
"1,468 controls across 33 domains" → 1,534 / 34.

## Acceptance Criteria

- [ ] Every public surface states a claim consistent with the truth line
- [ ] The mapped-framework number has one code source of truth
- [ ] Live site meta description reflects the new copy after deploy

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (Peter, 2026-07-11: "go on both")
