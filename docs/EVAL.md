# Evaluation Results

Graphletter currently publishes a deterministic artifact-classifier eval for the
filename-to-evidence-artifact classifier.

## Assessment Evidence Contract

AI control assessments now use `assessment-evidence.v1` for full-document
context, offset-verified objective evidence spans, prompt-cache metadata, and
contract-versioned result reuse. The ADR-001 probe harness is
`scripts/eval-assessment-probe.ts`; it writes JSONL plus a side-by-side review
sheet under `scripts/out/`.

## Artifact Classifier

| Metric        | Current                           |
| ------------- | --------------------------------- |
| Fixture file  | `fixtures/classifier-mapping.csv` |
| Rows          | 2                                 |
| Exact matches | 2                                 |
| Wrong picks   | 0                                 |
| No prediction | 0                                 |
| Accuracy      | 100.0%                            |
| CI floor      | 100.0%                            |

Last verified locally on 2026-06-26 with:

```sh
EVAL_CATALOG_SOURCE=fixture EVAL_ACCURACY_FLOOR=1 pnpm eval:artifact-classifier
```

CI runs the same command on pull requests and pushes to `main`. The build fails
if accuracy drops below the floor.

## Catalog Modes

The CI path uses `EVAL_CATALOG_SOURCE=fixture`, which builds the catalog from
the expected artifact labels in `fixtures/classifier-mapping.csv`. This keeps CI
hermetic: it does not need live Supabase data or AI provider credentials for the
current deterministic fixture set.

For broader local evaluation against the live SCF evidence request catalog, run:

```sh
pnpm eval:artifact-classifier
```

That default mode loads the artifact catalog from Supabase and is useful when
the fixture set expands beyond deterministic classifier rules.

## GitLab Public-Handbook Benchmark (local, non-CI)

`fixtures/gitlab-handbook-mapping.csv` is a 45-row real-world benchmark built
2026-07-08 from GitLab's public handbook (see `fixtures/README.md` for
provenance). It replaces the lost InterVenn validation set as the "real
corpus" measurement axis. It requires the live Supabase catalog and AI
credentials, so it is local-only:

```sh
pnpm eval:artifact-classifier ./fixtures/gitlab-handbook-mapping.csv
```

| Metric        | 2026-07-08 baseline |
| ------------- | ------------------- |
| Rows          | 45                  |
| Exact matches | 28                  |
| Wrong picks   | 15                  |
| No prediction | 2                   |
| Accuracy      | 62.2%               |
| Floor         | 45% (default)       |

An earlier same-day run scored 60.0% (27/45) — expect run-to-run variance of
a few rows from model nondeterminism. Prior InterVenn empirical baseline was
~52%. Misses are dominated by judgment-call disagreements (e.g.
`Authenticator Types` vs `System Authenticator Types`); roughly a third of
misses match the documented alternative label in the row's `notes`.
