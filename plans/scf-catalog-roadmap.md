# SCF Full-Catalog Roadmap

Strategy of record for expanding Graphletter from 67 mapped frameworks to the
full SCF cross-mapping catalog (~250 mapping columns in the 2026.2 workbook).
Agreed 2026-07-11 after two review rounds (Codex plan → Claude amendments →
Codex revision). This file records the strategy and maps it to task specs; it
is not itself a spec and holds no implementation detail.

## Principles

1. **Ingest broadly, expose selectively.** Import everything validated and
   license-cleared; present only a curated "supported" subset prominently.
2. **Inventory is derived, not hand-written.** The 2026.2 Focal Documents
   sheet (`data/Authoritative Sources.csv`) already carries the exact
   `SCF Column Header`, a stable upstream identifier, publisher, geography,
   and source URL per framework. The catalog inventory is a deterministic
   join of mapping-column headers against that sheet; human review supplies
   only `kind`, `family` corrections, `visibility`, and licensing disposition.
3. **Completeness is an invariant.** Every mapping column in the controls
   sheet must resolve to imported, intentionally-excluded-with-reason, or
   explicitly unresolved. New SCF releases can never silently add or drop
   frameworks again (root cause of the May–July 2026 mapping scramble).
4. **Visibility and licensing disposition are separate axes.** A framework
   can be supported but non-public for licensing reasons, or inspectable in
   the catalog but not yet supported. One flag cannot express both.
5. **Exact-header validation stays a hard import failure** (the
   `expectedHeader` guard added in PR #46).
6. **Prove the mechanism once, then expand by metadata.** One demanding
   rollout cohort gets full ceremony; every later cohort is a reviewed
   `preview → supported` metadata transition under a standing checklist.

## Stages → task specs

| #   | Stage                                                                                                                                                                                                                               | Spec                                       | Runtime change        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------- |
| 1   | Generated inventory: join mapping headers ↔ Focal Documents; exceptions report; reviewed overrides file                                                                                                                            | `task-2026-07-11-scf-catalog-inventory.md` | None                  |
| 2   | Formalized generator + completeness gates; manifest consistency-checked against `FRAMEWORK_COLUMNS`                                                                                                                                 | same spec as stage 1                       | None                  |
| 3   | Catalog metadata: stable key, `visibility`, `kind`, `family` in schema; parser consumes manifest; frameworks API defaults to supported; name-regex family heuristic replaced                                                        | spec TBD                                   | Schema + parser + API |
| 4   | Full sandbox import; measure row counts, DB size, seed duration, query latency, Supabase limits; set thresholds before production                                                                                                   | same spec as stage 3                       | Sandbox only          |
| 5   | Catalog inspectability: paginate framework detail mappings (replaces first-20 cutoff), catalog search/filter                                                                                                                        | spec TBD                                   | UI + API              |
| 6   | Licensing gate: reconcile inventory with `data/LICENSE_AUDIT.json`; `exposure_status`/`exposure_reason` in metadata; ambiguous defaults to non-public; distinguish crosswalk redistribution from source-framework text reproduction | folded into stages 1 & 3 specs             | Metadata              |
| 7   | Cohort 1 (FedRAMP, GovRAMP, NIST profiles): full spec, semantic fixtures, production proof, perf checks, rollback boundary                                                                                                          | spec TBD                                   | Production            |
| 8   | Remaining cohorts: one standing rollout spec + per-framework admission checklist; batched promotions                                                                                                                                | spec TBD                                   | Metadata flips        |

## Explicitly rejected

- FedRAMP-only patch ahead of the mechanism.
- Hand-classifying ~250 columns.
- Six separate full-ceremony cohort specs.
- Estimating import scale from 1,534 × N arithmetic — only the sandbox
  rehearsal decides feasibility (workbook sparsity may reduce totals a lot).

## Status

- [x] Stages 1–2: merged 2026-07-11 (PR #51; spec archived) — 252 mapping columns inventoried, 0 unresolved, gates in CI
- [x] Stages 3–4: merged 2026-07-11 (PR #52; spec archived) — manifest-driven import, catalog metadata schema, visibility-filtered APIs; prod migration applied + verified; sandbox rehearsal green (249 fw / 69,791 mappings / 17s seed)
- [x] Stage 5: merged 2026-07-11 (PR #53; spec archived) — detail pagination + mapping search + tier coherence; preview inspectability sandbox-proven (FedRAMP mod, 711 mappings, one page loaded)
- [x] Stage 6: decided + applied 2026-07-11 — `docs/FRAMEWORK_EXPOSURE_REVIEW.md` reviewed all 183 preview frameworks; Peter exposed 178 (incl. SWIFT/MPA without the manual check), kept 5 non-public (COBIT, CR-CMM, SACS-002, ISMAP, SIG); overrides flipped, manifest regenerated, gates + 237 tests green; stage 7 cohort fully cleared
- [ ] Stage 7: not yet specced
- [ ] Stage 8: not yet specced
