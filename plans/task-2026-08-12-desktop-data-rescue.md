# Task Spec: Desktop data rescue — golden-set fixtures, gitlab benchmark, sample docs

## Metadata

- Date: 2026-08-12
- Owner: agent (Claude Code, desktop sweep, approved by Peter)
- Status: Done
- Branch: main
- Related issue/PR: plans/task-2026-07-08-assessment-quality-golden-set.md (#55)

## Goal

Bring graphletter data that existed only as loose, unversioned files in
`~/Desktop/graphletter/` under version control in this repo.

## Context Files

- [x] fixtures/golden-set/ — golden-set eval fixtures (9 policy docs, labeling workbook, sealed answer key)
- [x] fixtures/sample-docs/ — synthetic ACME sample input docs (tabletop summary, third-party policy)
- [x] data/gitlab-benchmark/ — gitlab benchmark run artifacts (eyeball sheets, mapping CSV, results, screenshot)

## Constraints

- Data-only change: no code touched, no behavior change.
- Desktop `risks.csv` (Sep 2025) was NOT imported — it is a stale predecessor of the
  regenerated canonical `data/risks.csv` (7b5b657) and was discarded.
- `intervennbioscience_summary/` was NOT imported — real-client consultancy material,
  routed to `~/Documents/Archive/consulting/`, must never enter git.

## Scope

### In scope

- Move the three data sets above into the repo and commit.

### Out of scope

- Running the golden-set eval (#55 — still gated on Peter's go + cost projection).
- Any change to fixture-consuming code.

## Implementation Plan

1. Compare Desktop copies against existing repo files (dedupe check).
2. Move unique data into fixtures/ and data/.
3. Commit in blast-radius-compliant chunks.

## Test Plan

- [x] `cmp` against existing repo copies confirmed no silent overwrites.
- [x] N/A beyond that — additive data files, no code paths changed.

## Acceptance Criteria

- [x] `~/Desktop/graphletter/` no longer exists; all unique data is tracked in git.
