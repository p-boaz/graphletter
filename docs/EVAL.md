# Evaluation Results

Graphletter currently publishes a deterministic artifact-classifier eval for the
filename-to-evidence-artifact classifier.

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
