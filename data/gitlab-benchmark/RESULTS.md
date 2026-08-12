# GitLab handbook classifier benchmark — run 2026-07-08

Fresh trial corpus for the Graphletter artifact classifier, replacing the lost
InterVenn set. 45 real controlled documents from GitLab's public handbook
(security policies, standards, procedures + acceptable use policy), labeled
against the live 303-artifact SCF ERL catalog (Supabase).

- Source: https://gitlab.com/gitlab-com/content-sites/handbook (public, MIT-ish docs license)
- Filenames = page frontmatter titles; real handbook path in `notes` column
- Run: `pnpm eval:artifact-classifier ~/Desktop/graphletter/gitlab-benchmark/gitlab-classifier-mapping.csv`

## Result

| Metric                       | Value      |
| ---------------------------- | ---------- |
| Total rows                   | 45         |
| Exact match                  | 27 (60.0%) |
| Wrong pick                   | 18         |
| No prediction                | 0          |
| Floor (EVAL_ACCURACY_FLOOR)  | 45% — PASS |
| InterVenn empirical baseline | ~52%       |

## Miss character

Same as InterVenn: mostly judgment-call disagreements, not blunders.
~6 of 18 misses predicted the documented alternative label from the CSV notes
(System Authenticator Types vs Authenticator Types ×2, SCRM Plan vs Third-Party
Service Reviews, SLAs vs Flaw Remediation Actions, adjacent incident-response
artifacts). Lenient regrade ≈ 33/45 ≈ 73%. Zero NO_MATCH outputs.

## Provenance

Corpus assembled + labeled 2026-07-08 by Claude (session work); ground-truth
labels are Claude's judgment against the SCF catalog, hard cases carry
confidence floats + alt labels in notes. Committed to the repo via PR (branch test/gitlab-handbook-classifier-benchmark) —
spec: plans/task-2026-07-08-gitlab-handbook-classifier-benchmark.md; in-repo verified run: 62.2%.
