# Task Spec: SCF 2026.2 upgrade + framework column-map repair (incl. SOC 2)

## Metadata

- Date: 2026-07-10
- Owner: agent (Claude), approved interactively by Peter
- Status: Approved
- Branch: feat/scf-2026-2-upgrade
- Related issue/PR: —

## Goal

Upgrade the vendored SCF dataset from 2026.1.1 to 2026.2 (released 2026-07-08) and
repair the systemic framework column misalignment discovered during pre-flight: all
79 entries in `FRAMEWORK_COLUMNS` (`lib/scf-parser.ts`) point at wrong columns
(~17-column shift; e.g. rows stored as "ISO 27001" actually contain CSA CCM IDs,
"US HIPAA Security Rule" rows contain FedRAMP IDs). Add SOC 2 (AICPA TSC, new
workbook column 34) to the mapped framework set. Reseed local, then production.

## Context Files

- [ ] data/secure-controls-framework-scf-2026-2.xlsx (new, vendored)
- [ ] data/secure-controls-framework-scf-2026-1-1.xlsx (removed)
- [ ] data/PROVENANCE.json
- [ ] data/README.md
- [ ] data/LICENSE_AUDIT.json
- [ ] data/controls.csv
- [ ] data/Authoritative Sources.csv
- [ ] data/Domains and Principles.csv
- [ ] data/Assessment_objectives.csv
- [ ] data/evidence-request-list.csv
- [ ] data/compensating-controls.csv
- [ ] data/data-privacy-principles.csv
- [ ] data/risks.csv
- [ ] data/threats.csv
- [ ] data/seed/expected_row_counts.json (re-baselined)
- [ ] lib/scf-parser.ts
- [ ] lib/scf-types.ts
- [ ] lib/scf/writer.ts
- [ ] lib/scf/writer.test.ts
- [ ] lib/research/research-topics.ts
- [ ] scripts/extract-scf.ts (doc comment only)
- [ ] scripts/seed-erl.ts
- [ ] scripts/seed-assessment-objectives.ts
- [ ] scripts/snapshot-row-counts.ts
- [ ] scripts/test-scf-parser.ts
- [ ] scripts/import-scf-data.js
- [ ] tests/scripts/seed-erl.test.ts
- [ ] tests/scripts/seed-assessment-objectives.test.ts
- [ ] SEEDING.md
- [ ] plans/README.md (index entry)

## Constraints

- CC BY-ND 4.0 posture: XLSX vendored verbatim; CSVs only via deterministic
  extractor; `pnpm verify:scf-extraction` must pass.
- ≤15 files per commit (regenerated data CSVs + provenance form one commit;
  code and baselines separate).
- Prod and dev share one Supabase project; `seed:reset` TRUNCATEs CASCADE.
  A pre-wipe `pg_dump` backup is mandatory before the prod run.
- Framework display names already referenced by tests/UI ("ISO 27001",
  "NIST CSF", …) keep their existing spelling.

## Scope

### In scope

1. Vendor 2026.2 workbook; update PROVENANCE.json (sha256, bytes, path,
   scfVersion, downloadedAt, sheet renames: "SCF 2026.1"→"SCF 2026.2",
   "Authoritative Sources"→"Focal Documents", "Assessment Objectives 2026.1"→
   "…2026.2", "Evidence Request List 2026.1"→"…2026.2", "Compensating
   Controls 2026.1"→"…2026.2"). CSV filenames unchanged (minimizes churn).
2. Re-derive `FRAMEWORK_COLUMNS` from the 2026.2 header (372 cols) by
   deterministic name matching, preserving the existing 79-framework set,
   dropping any framework no longer published, and adding
   **SOC 2** (header "AICPA | TSC 2017:2022 (used for SOC 2)", col 34).
3. Add a header-validation guard: each `FRAMEWORK_COLUMNS` entry carries
   `expectedHeader`; `parseControlMappings` verifies the header row before
   mapping and hard-fails on mismatch (prevents recurrence of the shift bug).
4. Bump hardcoded "2026.1.1" version strings (parser, writer, seeders,
   import-scf-data.js, SEEDING.md).
5. Local rehearsal: supabase local stack → `pnpm seed` → `pnpm seed:verify`
   → semantic spot-checks (GOV-01 ISO 27001 = clause numbers; HIPAA =
   §164.xxx citations; SOC 2 mappings present; QTS domain present).
6. Re-baseline `data/seed/expected_row_counts.json` via `pnpm seed:snapshot`.
7. Prod: `pg_dump` backup → `pnpm seed:reset` → `pnpm seed:verify` →
   live browser verification of Framework Explorer + a compliance view.

### Out of scope

- Mapping the ~170 other framework columns now present in 2026.2 (GovRAMP,
  IEC 62443, MITRE ATT&CK, FedRAMP, NIS2, …) — follow-up task.
- Backfilling/correcting historical assessment outputs generated from the
  scrambled mappings (needs a separate remediation decision).
- UI changes beyond what reseeded data produces.

## Implementation Plan

1. Create branch; commit spec.
2. PROVENANCE.json update + vendor new XLSX + delete old XLSX.
3. `pnpm extract:scf` → regenerate CSVs → `pnpm verify:scf-extraction`.
4. Generate new `FRAMEWORK_COLUMNS` via scratch script (name→header matching,
   report table for review); hand-verify every row; add SOC 2 entry.
5. Parser changes: new map + `expectedHeader` guard + version bumps.
6. Update writer/seeders/import script versions; fix unit tests; run
   `pnpm test:scf`, `pnpm typecheck`, `pnpm lint`.
7. Local rehearsal per SEEDING.md; semantic spot-checks via SQL.
8. Re-baseline row counts. Commit in ≤15-file batches.
9. Prod backup + `seed:reset` + verify + browser live-proof.
10. Archive spec after merge.

## Test Plan

- [x] `pnpm test:scf` green (incl. new header-guard test)
- [x] `pnpm verify:scf-extraction` green
- [x] `pnpm typecheck` + `pnpm lint` green
- [x] Local `pnpm seed && pnpm seed:verify` green
- [x] SQL spot-checks: GOV-01 ISO 27001 mappings are clause numbers (4.4, 5.1…);
      HIPAA mappings are §164.xxx; SOC 2 (AICPA TSC) rows exist; QTS domain
      controls present (23 expected)
- [ ] Prod smoke workflow green after reseed
- [ ] Browser: Framework Explorer lists SOC 2; control detail shows correct
      ISO/HIPAA citations

## Acceptance Criteria

- [ ] `scf_imports.scf_version` = 2026.2 in prod
- [ ] Every FRAMEWORK_COLUMNS entry's expectedHeader matches the live CSV header
- [ ] SOC 2 framework queryable with >0 control mappings
- [ ] No framework row carries another framework's identifiers (spot-check set)
- [ ] Row-count baseline updated and seed:verify passes at ±1%

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved (AskUserQuestion 2026-07-10: SOC 2 in scope; run all the
      way to prod. Column-scramble discovery reported in-session before start.)
