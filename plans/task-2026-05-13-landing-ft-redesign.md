# Task Spec: Landing page FT-style redesign + supply-chain cooldown + pnpm/node engine bumps

## Metadata

- Date: 2026-05-13
- Owner: peter (with claude)
- Status: Done
- Branch: main
- Related issue/PR: follow-up to tone cleanup rounds 1–3 (commits 0fe6ce4, b5da1af, ad029e9)

## Goal

Three independent changes bundled into one commit:

1. Rework the landing page into a typographic FT-style layout — eyebrow rules,
   ticker-rail stats grid, specimen-document example card, numbered open-source
   columns, quieter closing CTA. Adds reusable utility classes.
2. Add a 3-day supply-chain cooldown to pnpm (`minimum-release-age=4320`).
3. Bump `packageManager` to pnpm 10.33.4 and declare `engines.node >=22`.

## Context Files

- [x] app/page.tsx
- [x] app/globals.css
- [x] .npmrc
- [x] package.json

## Constraints

- Preserve all hero/example/example-output content fidelity — exact stat values
  must stay aligned with `data/seed/expected_row_counts.json` (79 / 1,468 /
  34,619, SCF 2026.1.1).
- Reuse existing brand tokens (`ft-pink`, `ft-cream`, `ft-black`, `ft-serif`,
  `ft-sans`) and only add minor new utilities for typographic detail.
- The `engines.node >=22` floor must match the Node version already used by CI
  and Vercel.
- pnpm `minimum-release-age` requires pnpm ≥ 10.16 — bump `packageManager` in
  the same commit so local installs pick it up.

## Scope

### In scope

- Landing page (`app/page.tsx`) markup + copy refinement.
- Five new utility classes in `app/globals.css`: `ft-mono`, `ft-eyebrow`,
  `ft-rule`, `ft-rule-strong`, `ft-paper`.
- `.npmrc` cooldown line.
- `package.json` packageManager + engines bump.

### Out of scope

- Other marketing surface pages (docs, frameworks, research) — left intact.
- Node version pinning beyond the floor declaration.
- Visual regression baseline updates beyond targeted playwright checks.

## Implementation Plan

1. Add ft-mono / ft-eyebrow / ft-rule / ft-rule-strong / ft-paper utilities to
   `app/globals.css`.
2. Rewrite landing sections in `app/page.tsx`: hero with stat ticker rail,
   example specimen card, numbered open-source columns, soft closing CTA.
3. Append `minimum-release-age=4320` to `.npmrc`.
4. Bump `packageManager` to `pnpm@10.33.4` and add `engines.node: ">=22.0.0"`
   in `package.json`.

## Test Plan

- [x] `pnpm lint` clean.
- [x] `pnpm typecheck` clean.
- [x] Hero CTA still resolves (`data-testid="hero-primary-cta"` preserved).
- [x] Closing CTA still resolves (`data-testid="landing-closing-cta"` preserved).
- [x] Stats reflect `data/seed/expected_row_counts.json`.

## Acceptance Criteria

- [x] Landing page reads in FT typographic style with stat rail + specimen
      example card.
- [x] `.npmrc` enforces 3-day release cooldown.
- [x] `package.json` declares pnpm 10.33.4 + node >=22 engine.
- [x] No regression to existing landing data-testids.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (Peter: "commit")
