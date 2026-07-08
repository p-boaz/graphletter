# Task Spec: GitLab public-handbook classifier benchmark fixture

## Metadata

- Date: 2026-07-08
- Owner: claude-code (session with Peter)
- Status: Done
- Branch: test/gitlab-handbook-classifier-benchmark
- Related issue/PR: (this PR)

## Goal

Give the artifact classifier a real-world 45-row benchmark again (the original
InterVenn set was lost with `/tmp`), using GitLab's deliberately public handbook
as the corpus, without touching the hermetic CI eval path.

## Context Files

- [x] fixtures/gitlab-handbook-mapping.csv (new)
- [x] fixtures/README.md
- [x] docs/EVAL.md

## Constraints

- Do NOT modify `fixtures/classifier-mapping.csv` — CI runs
  `EVAL_CATALOG_SOURCE=fixture EVAL_ACCURACY_FLOOR=1` against it and must stay
  hermetic (no AI/Supabase credentials in CI).
- No application code changes; fixture + docs only.
- Corpus is public-by-design (GitLab handbook); no customer or confidential data.

## Scope

### In scope

- New fixture `fixtures/gitlab-handbook-mapping.csv`: 45 real controlled
  documents (security policies/standards/procedures + acceptable use policy)
  from https://gitlab.com/gitlab-com/content-sites/handbook, filenames taken
  from page frontmatter titles, ground-truth labels validated against the live
  303-artifact SCF ERL catalog. Judgment calls carry confidence floats and
  alternative labels in `notes`.
- Document the benchmark and its 2026-07-08 baseline in docs/EVAL.md and
  fixtures/README.md.

### Out of scope

- CI changes, classifier prompt changes, any assessment-pipeline work.
- Further classifier-accuracy investment (per Peter 2026-07-08: assessment
  feedback quality is the priority; classifier is secondary).

## Implementation Plan

1. Add fixture CSV.
2. Update fixtures/README.md and docs/EVAL.md.
3. Verify: run the eval against the new fixture path with the live Supabase
   catalog; run lint + typecheck.

## Test Plan

- [x] `pnpm eval:artifact-classifier ./fixtures/gitlab-handbook-mapping.csv`
      completes with accuracy above the 45% floor.
- [x] `pnpm lint` and `pnpm typecheck` clean.
- [x] CI-path fixture (`fixtures/classifier-mapping.csv`) untouched (`git diff --stat`).

## Acceptance Criteria

- [x] 45-row benchmark fixture in repo with catalog-validated labels.
- [x] docs/EVAL.md records the benchmark, run command, and 2026-07-08 baseline.
- [x] CI eval path unchanged.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved — Peter, 2026-07-08: "now that we've gone this far, let's
      at least tie that up in a bow" (bounded close-out of the classifier
      benchmark thread; PR only, no merge)
