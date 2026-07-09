# Task Spec: ADR-001 Assessment Evidence Architecture

## Metadata

- Date: 2026-07-08
- Owner: Codex
- Status: Approved
- Branch: feat/adr-001-assessment-evidence-architecture
- Related issue/PR: docs/adr/001-assessment-evidence-architecture.md

## Goal

Implement ADR-001 end to end: full-document assessment context, falsifiable offset-verified objective evidence, versioned assessment contracts, server-side evidence reads, UI provenance, and the ADR validation probe harness.

## Context Files

- [x] docs/adr/001-assessment-evidence-architecture.md
- [x] plans/task-template.md
- [x] lib/ai/assess-evidence/objective-assessment.ts
- [x] lib/ai/assess-evidence/maturity-assessment.ts
- [x] lib/ai/assess-evidence/control-assessment.ts
- [x] lib/ai/assess-evidence/utils.ts
- [x] app/api/evidence/assess-uploaded/route.ts
- [x] lib/client/smart-evidence-workflow.ts
- [x] components/assessment-review-dialog/
- [x] lib/ai/assess-evidence/\*.test.ts
- [x] docs/EVAL.md
- [x] fixtures/gitlab-handbook-mapping.csv
- [x] ~/Projects/bar-playbook/lib/grading-v2/

## Constraints

- ADR-001 is the source of truth where it differs from this task spec.
- Do not touch `fixtures/classifier-mapping.csv` or the CI classifier-eval path.
- Production verify lane is out of scope; the adversarial verify lane is harness-only.
- Keep installs/builds/tests serial on this 8 GB machine.
- Before each commit: `pnpm lint`, `pnpm typecheck`, staged file count <= 15.
- Conventional commits only, with this spec referenced in commit bodies.
- Open one PR; never merge.

## Scope

### In scope

- Option A full-document assessment context with an environment kill switch for prior truncation behavior.
- Prompt-cache key and 24h retention for assessment calls, plus token/cache logging.
- Objective schema upgrade to `evidence_quotes: { start, end, text, supports }[]`.
- Deterministic evidence-span verification and rejection before publishing any pass/partial objective lacking verified spans.
- Full objective rows in prompts: objective, procedure, and expected results.
- Medium reasoning effort and removal of brief explanation instruction.
- Pinned fail vs not_applicable scoping rule.
- Target maturity values only from `scf_controls.target_maturity_level`; omitted when null.
- `ASSESSMENT_CONTRACT_VERSION` and prompt role versions in stored metadata and assessment run keys.
- `assess-uploaded` server-side stored evidence/extraction reads by content hash; client stops resending `fileContent`.
- Assessment review dialog provenance display for evidence quotes.
- Headless Playwright coverage for the review dialog evidence-quote UI.
- `scripts/eval-assessment-probe.ts` JSONL + markdown review sheet matrix.
- `docs/EVAL.md` contract-version note and ADR-001 implementation note.

### Out of scope

- Rebuilding the atom graph or using it as production retrieval.
- Production adversarial verification/adjudication.
- Classifier fixture or CI classifier-eval changes.
- Database schema changes unless current JSON metadata cannot safely carry the contract.

## Implementation Plan

1. Add contract constants, evidence-span schema/types, prompt-cache key helpers, and exact-span verification helpers.
2. Update objective and maturity prompts/calls for full document context, prompt caching, token metadata, medium reasoning, target anchoring, and scoping rules.
3. Add quality gate rejection for unsupported pass/partial objectives before persistence.
4. Version run keys and stored metadata; preserve reuse only within a contract version.
5. Resolve assessment content server-side from stored evidence/document extraction keyed by content hash and update the client API call.
6. Surface evidence quotes in the assessment review dialog and type definitions.
7. Update mocked-model unit tests and add/extend Playwright coverage.
8. Build the probe harness and publish evaluation documentation.
9. Run validation gates, commit in <=15-file chunks, push, and open one PR.

## Test Plan

- [ ] `pnpm test:scf`
- [ ] Targeted mocked-model tests for `lib/ai/assess-evidence/`
- [ ] Headless Playwright spec covering evidence quotes in the assessment review dialog
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm build`
- [ ] Probe harness run including Password Standard x IAC-02

## Acceptance Criteria

- [ ] ADR-001 production behavior is implemented and version stamped.
- [ ] Pass/partial objective results cannot publish without exact verified spans.
- [ ] Assessments read stored server-side evidence; client-resent content is not trusted.
- [ ] Review dialog shows objective evidence quotes with offsets/support text.
- [ ] Probe outputs JSONL and markdown review sheet with tokens, latency, and estimated cost columns.
- [ ] PR body references the probe revision and quotes old-vs-new IAC-02 maturity verdict showing Okta/SAML/2FA found.
- [ ] `docs/EVAL.md` notes the new contract version.
- [ ] ADR-001 has a one-line implementation note and is otherwise unchanged.
- [ ] Any deviations are explicitly listed in the PR body.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [x] Human approved — approved by Peter 2026-07-08 via Codex handoff.
