# Fixtures

Synthetic inputs used by evaluation scripts. None of these files contain customer data.

## `classifier-mapping.csv`

Drives `pnpm eval:artifact-classifier` (defined in `scripts/eval-artifact-classifier.ts`). Each row is a labelled example used to measure classifier accuracy against the few-shot prompt in `lib/artifact-classifier/classify.ts`.

The current published score and CI threshold are tracked in
[`docs/EVAL.md`](../docs/EVAL.md).

### Columns

| column                   | meaning                                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `source_path`            | Path or filename of the source evidence document being classified.                                                           |
| `documentation_artifact` | The artifact-class label expected (e.g. `Information Technology Policy`, `Standard Operating Procedure`, `Risk Assessment`). |
| `erl_id`                 | Synthetic Evidence Reference List ID — six-digit numeric, prefixed by class (e.g. `IT100001`, `POL100007`).                  |
| `confidence`             | Optional float in `[0, 1]` representing the labeller's confidence; blank means "ground truth".                               |
| `notes`                  | Free-text, optional. Reviewer commentary or edge-case justification.                                                         |

The shipped row is empty (header only) — populate with synthetic examples mirroring the prefix conventions in `classify.ts` to evaluate locally.

## `gitlab-handbook-mapping.csv`

A 45-row real-world benchmark built from [GitLab's public handbook](https://gitlab.com/gitlab-com/content-sites/handbook) (security policies, standards, and procedures — public by design, no customer or confidential data). Filenames are the handbook pages' frontmatter titles; `notes` records each source path. Ground-truth labels were validated against the live SCF evidence-request-list catalog; judgment-call rows carry a `confidence` float and an alternative label in `notes`.

Not used by CI (CI stays hermetic on `classifier-mapping.csv`). Run it locally against the live catalog:

```sh
pnpm eval:artifact-classifier ./fixtures/gitlab-handbook-mapping.csv
```

Baseline and history live in [`docs/EVAL.md`](../docs/EVAL.md).
