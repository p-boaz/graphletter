# Task Spec: SCF catalog inventory — generated framework manifest + completeness gates

## Metadata

- Date: 2026-07-11
- Owner: agent (Claude Code), reviewed by Peter
- Status: Done (implemented 2026-07-11; archive after merge)
- Branch: feat/scf-catalog-inventory
- Related issue/PR: PR pending; roadmap `plans/scf-catalog-roadmap.md` (stages 1–2, licensing classification from stage 6)

## Goal

Produce a deterministic, committed inventory of every framework mapping column
in the SCF 2026.2 controls sheet — joined to Focal Documents metadata, gated by
a completeness invariant, and consistency-checked against the parser's
`FRAMEWORK_COLUMNS` — with zero runtime or database change.

## Context Files

- [x] `lib/scf-parser.ts` — reference for the consistency check; export-only annotations added (see Constraints), values untouched
- [x] `data/controls.csv` — mapping-column headers (columns 33–284 of 372)
- [x] `data/Authoritative Sources.csv` — 2026.2 Focal Documents sheet: `SCF Column Header`, stable FDI key, Source, Geography, FDN, source URL, STRM URL
- [x] `data/PROVENANCE.json` — sheet↔CSV provenance, SHA256s
- [x] `data/LICENSE_AUDIT.json` — repo-level license posture (CC BY-ND 4.0) feeding exposure classification
- [x] `scripts/generate-framework-manifest.ts` — NEW: deterministic generator
- [x] `data/framework-manifest.json` — NEW: generated inventory (committed)
- [x] `data/framework-manifest.overrides.json` — NEW: reviewed human decisions (committed)
- [x] `tests/framework-manifest.test.ts` — NEW: completeness + consistency gates
- [x] `package.json` — NEW scripts: `manifest:generate`, `manifest:check`
- [x] `plans/README.md` — index entry

## Constraints

- **No runtime change.** No edits to `app/`, schema, or seeds. The parser's
  `FRAMEWORK_COLUMNS` values and the production import path are untouched.
  Sole permitted `lib/` edit: export-only annotations on `FRAMEWORK_COLUMNS`
  and `FrameworkColumnConfig` so the consistency gate can import them
  (discovered at implementation start: neither was exported).
- Generator is deterministic: same workbook CSVs in → byte-identical manifest
  out. No network, no LLM, no timestamps in output (provenance SHA256s only).
- Join key is the exact `SCF Column Header` string from Focal Documents ↔ the
  controls.csv header cell, after only the normalization already applied by
  extraction (LF-only). No fuzzy matching in the generator — ambiguity goes to
  the exceptions report, resolution goes to the overrides file.
- Overrides file holds human decisions only: `kind`, `family` corrections,
  `visibility`, `exposure_status`/`exposure_reason`, display-name fixes,
  exclusions with reasons. It never restates generated facts.
- `visibility` and `exposure_status` are separate fields (a framework can be
  supported-but-non-public, or catalog-inspectable-but-unsupported).
- Ambiguous licensing defaults to `exposure_status: "non-public"` pending
  review. Distinguish redistributing the SCF crosswalk (mapping identifiers)
  from reproducing source-framework text.
- Follow repo conventions: TypeScript via tsx like `scripts/seed-all.ts`, no
  `console.*` outside scripts, commit ≤ 15 files.

## Scope

### In scope

1. Manifest generator reading `controls.csv` header + `Authoritative Sources.csv`,
   emitting per mapping column: stable key (upstream FDI), exact upstream
   header, column index, display name, version, publisher/source, geography,
   mapping count (non-empty cells), source + STRM URLs, and
   `currentlyImported` (derived by comparing against the live
   `FRAMEWORK_COLUMNS` export).
2. Exceptions report (generator output section): mapping columns with no
   Focal Documents row, Focal Documents rows with no mapping column,
   duplicate/ambiguous header matches, zero-mapping columns.
3. Overrides file schema + initial reviewed pass classifying every entry:
   `kind` (standard | law | baseline | implementation-group | historical |
   reference), `family`, `visibility` (supported | preview | excluded),
   `exposure_status` + `exposure_reason`.
4. Completeness gate as a test: every mapping column resolves to
   imported | intentionally-excluded-with-reason | explicitly-unresolved, and
   the unresolved count is asserted (ratcheted down to 0 by end of review).
5. Consistency gate as a test: every `FRAMEWORK_COLUMNS` entry matches a
   manifest entry with `currentlyImported: true` on key, header, and column
   index — the manifest and parser cannot drift.
6. Freshness gate as a test: committed manifest is byte-identical to a
   regeneration from the committed CSVs.

### Out of scope

- Any parser, schema, API, seed, or UI change (roadmap stages 3–5).
- Importing any new framework (stage 4+).
- Making the parser consume the manifest (stage 3 rewires
  `FRAMEWORK_COLUMNS` to be generated from it).
- Public copy or count changes.

## Implementation Plan

1. Write `scripts/generate-framework-manifest.ts`: parse both CSVs, identify
   the contiguous mapping-column range in controls.csv, exact-join headers to
   Focal Documents, count non-empty mapping cells per column, merge overrides,
   emit `data/framework-manifest.json` (entries sorted by column index) with
   an `exceptions` section and a provenance block (workbook SHA256 from
   `PROVENANCE.json`).
2. Add `manifest:generate` and `manifest:check` (generate to temp + diff)
   to `package.json`.
3. Run the generator; review the exceptions report; author
   `data/framework-manifest.overrides.json` with the human classification
   pass for all ~250 entries (bulk defaults: current 66 → `visibility`
   matching today's exposure; everything else → `preview` or `excluded`,
   `exposure_status: "non-public"` where licensing is ambiguous).
4. Write `tests/framework-manifest.test.ts` covering the completeness,
   consistency, and freshness gates plus join edge cases.
5. Wire the test into the integration test run (`pnpm test:integration`
   discovers `tests/*.test.ts`).
6. Validation: `pnpm lint`, `pnpm typecheck`, `pnpm test:integration`,
   `pnpm test:scf` (proves parser untouched).

## Test Plan

- [x] Unit: exact-join logic — matched, unmatched-column, unmatched-focal-doc, duplicate-header cases
- [x] Unit: mapping-count derivation on a fixture slice of controls.csv
- [x] Gate: completeness — every mapping column resolved; unresolved count asserted
- [x] Gate: consistency — `FRAMEWORK_COLUMNS` ⊆ manifest `currentlyImported` entries (key + header + index)
- [x] Gate: freshness — regeneration is byte-identical to the committed manifest
- [x] `pnpm test:scf` green (parser behavior unchanged)
- [x] `pnpm lint` + `pnpm typecheck` clean
- [x] Post-commit fix: pre-commit prettier reformat displaced a
      `@ts-expect-error` in `tests/framework-manifest.test.ts`; moved inline,
      all gates re-verified green
- [x] PR #51 review fix (Codex P2): mapping range was derived from min/max
      matched columns, so a framework column appended upstream without a Focal
      Documents row escaped inspection. Range is now derived from structural
      sentinels (`MAPPING_RANGE_SENTINELS`: SCF CORE MA&D column before,
      MCR+DSR column after) with hard failure when a sentinel is missing or a
      Focal Document matches outside the range. Regression tests added for the
      trailing-column case, sentinel absence/inversion, and the real-header
      sentinel bounds (33–284). Manifest output byte-identical.

## Acceptance Criteria

- [x] `data/framework-manifest.json` committed, covering 100% of mapping columns in the 2026.2 controls sheet
- [x] Every entry classified in the overrides file: kind, family, visibility, exposure status — zero `unresolved` at approval of the review pass, or an explicit asserted count with named owners for the remainder
- [x] Exceptions report empty or every exception has a written disposition in overrides
- [x] All three gates run in CI via `pnpm test:integration` and fail the build on violation
- [x] `git diff` shows no changes under `app/` or `supabase/`, and the only `lib/` change is the export-only annotations (no value or behavior change)
- [x] Manifest regeneration is deterministic (two consecutive runs byte-identical)

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved
