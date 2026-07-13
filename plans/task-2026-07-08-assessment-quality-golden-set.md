# Task Spec: Assessment-feedback quality golden set + eval harness

## Metadata

- Date: 2026-07-08 (rev 2 — measurement design grounded in probe run)
- Owner: peter (ground-truth oracle) + claude-code (harness)
- Status: Unblocked (2026-07-13) — tabled 2026-07-08 pending the pipeline redesign; ADR-001 shipped via PR #45 (2026-07-09), so this spec is now the pending acceptance gate. Tracked as issue #55.
- Branch: feat/assessment-quality-eval (when approved)
- Related issue/PR: PR #44 (GitLab corpus provenance); plans/task-2026-06-12-ai-pipeline-test-baseline.md (mocked tests pin CODE; this task builds the missing model-QUALITY eval lane)

## What the AI assessment actually produces (verified by live probe, 2026-07-08)

Probe: GitLab Password Standard (9,736 chars) × control IAC-02, run through the
real `assessAgainstObjectives` + `assessMaturityLevel` (production config:
gpt-5.4, reasoningEffort low, 2,000-char truncation). Two output layers:

1. **Per-objective results** — for each SCF assessment objective of the control
   (IAC-02 has 8, e.g. "the identity of each user is authenticated ... as a
   prerequisite to system access"): `result` ∈ {pass, fail, partial,
   not_applicable}, `confidence` 0–1, and 1–2 sentences of `reasoning`.
2. **Maturity assessment** — `assessed_level` 0–5 against the control's own
   SCF C|P-CMM benchmark descriptions (per-control text from
   `scf_maturity_levels`; note many controls define no L4/L5 criteria, so the
   effective scale is often 0–3), plus `rationale`, `target_level/met/gap`,
   `referenced_level_description`, and ≤5 `recommended_actions`.

Probe verdict (the motivating exhibit): the AI assessed maturity **L1** with
rationale "no evidence of centralized IAM/SSO ... as required for Levels 2-3"
— while the document explicitly mandates Okta centralized authentication,
SAML, and org-wide 2FA at char offsets 5,400–9,400, past the 2,000-char
truncation. The flagship feedback claim is false, caused by the pipeline, not
the model. This is exactly the failure class the eval must measure.

Additional facts that shape the design:

- The objective prompt sends only `assessment_objective`; the SCF
  `assessment_procedure` and `expected_results` columns exist in the DB but
  are never shown to the model.
- Reasoning is brief by construction (`reasoningEffort: "low"`,
  `textVerbosity: "low"`, "brief explanation" instruction).
- `target_maturity_level` was null in the DB for IAC-02; the model
  self-supplied target 3 (prompt permits this) — target-gap outputs are not
  always anchored to org data.
- Scoping ambiguity exists: IAC-02 has device-identification objectives a
  password standard will never address — is that `fail` or `not_applicable`?
  House interpretation must be pinned by the ground-truth labels.

## Goal

Measure the quality of the AI's assessment feedback — the core product value —
against ground truth constructed by Peter, so pipeline changes are validated by
score instead of vibes. Classification is explicitly out of scope.

## Measurement design (two layers, replacing the earlier 0–100 essay-style scale)

**Layer 1 — decision agreement (headline, BarPlaybook-equivalent).** Unlike an
essay there is no pre-existing external score, but the output decomposes into
discrete decisions with constructible ground truth: Peter — reading the FULL
document with the control's objectives AND the SCF material the model never
sees (assessment_procedure, expected_results, full maturity benchmarks) —
labels each (doc × control): per-objective result enum and maturity level.
The SCF benchmarks make his labels anchored, not vibes. Metrics:

- Objective-result agreement: exact %, plus severity-weighted (pass↔fail
  disagreement counts 2×; adjacent pass↔partial / partial↔fail counts 1×;
  N/A-vs-fail disputes reported separately as scoping calls).
- Maturity agreement: exact % and within-1-level %; signed bias (does the AI
  systematically under- or over-credit — probe suggests under-credit via
  truncation).
- Confidence calibration: is the AI more often wrong when it claims 0.9 than
  0.6.
- Determinism gate (adopted from bar-playbook grading-v2 per ADR-001 addendum
  A4): re-run a sample of pairs; determination agreement and maturity-level
  stability must hold within tolerance. Evals always run with result-reuse
  disabled so they exercise fresh model calls.

**Layer 2 — prose quality (anchored bands, not 0–100).** For `reasoning`,
`rationale`, `recommended_actions`: per-field 4-band anchored rubric
(1 = wrong or fabricated vs the full document; 2 = generic boilerplate, fits
any document; 3 = correct and document-specific; 4 = assessor-grade: correct,
specific, and the recommendation closes the actual gap). Anchors written with
examples pulled from the baseline outputs themselves. Harsh-scale spirit is
kept (4 should be rare) without pretending 0–100 precision exists in a domain
with no external score.

## Context Files

- [x] lib/ai/assess-evidence/objective-assessment.ts (read — prompt + Zod schema)
- [x] lib/ai/assess-evidence/maturity-assessment.ts (read — prompt, C|P-CMM benchmarks, in-prompt 2,000-char truncation)
- [x] lib/ai/assess-evidence/utils.ts (`buildEvidenceText` 2,000-char truncation; `getAssessmentModel`)
- [x] lib/ai/assess-evidence/control-assessment.ts (`runControlAssessment` orchestration + persistence — harness bypasses this to avoid DB writes)
- [x] lib/ai-config.ts (`controlMapping` profile: OpenAI gpt-5.4, reasoningEffort low)
- [x] lib/ai/assessment-quality.ts (existing structural gate only: coverage/confidence thresholds — not a quality measure)
- [x] Supabase: `scf_evidence_request_list` (ERL, uuid `id`) → `scf_control_evidence_mappings` (`evidence_request_id` uuid, `scf_control_id` = control code) → `scf_controls` (`id` = code, `title`, `description`, `target_maturity_level`) + `scf_assessment_objectives` + `scf_maturity_levels` (verified live 2026-07-08)
- [ ] fixtures/gitlab-handbook-mapping.csv (corpus source)
- [ ] scripts/eval-artifact-classifier.ts (harness pattern reference)
- [ ] docs/EVAL.md (baseline publication target)

## Constraints

- **Measure before changing.** Baseline the production path exactly as-is
  (truncation, low effort, objective-only prompts). The probe's Okta miss is a
  hypothesis generator, not a license to pre-fix.
- **Peter is the oracle.** LLM judge (for Layer 2 only) is trusted only after
  agreement with his hand ratings is measured and published. Layer 1 needs no
  judge — it's label agreement.
- Corpus is public-by-design (GitLab handbook); no customer data.
- Local-only; needs `.env.local` (Supabase + AI keys); no CI in this task.
- 8GB machine: assessment calls at concurrency ≤2; no heavy agent fan-out.
- No production code changes — scripts, fixtures, docs only.
- Note ERL fan-out reality: some ERLs map to a single control (E-IAM-13 →
  IAC-02 only); "3 controls per doc" is a cap, not a promise. Some controls
  carry 8+ objectives, so labeling volume is bounded by objectives, not docs.
- Cost envelope: ~20–25 (doc × control) pairs × 2 calls, +1 contrast run,
  - judge calls ≈ well under 150 calls total; flag if design grows past that.

## Scope

### In scope

- 10-document full-text golden corpus with per-pair ground-truth labels.
- Headless harness + baseline outputs (production config) + one full-text
  contrast run (same model, no truncation) to price the truncation cost in
  the same report.
- Layer-1 agreement metrics + Layer-2 anchored-band ratings (Peter batch,
  then calibrated judge if agreement holds).
- Baseline published in docs/EVAL.md + ranked fix list for the follow-up task.

### Out of scope

- Fixing anything (truncation, prompts, effort tier, procedure/expected_results
  inclusion, target-level anchoring) — next task, justified by this data.
- CI wiring, UI changes, DB writes, classifier work.

## Implementation Plan

1. **Corpus.** 10 docs from the GitLab benchmark spanning SCF domains and
   difficulty (incl. Password Standards — the probe doc — Data Classification,
   Access Review, Incident Response Guide, BIA, Records Retention, SDLC,
   Acceptable Use, Cryptography, Third-Party Risk). Fetch full markdown,
   strip frontmatter/shortcodes, store `fixtures/assessment-golden-set/<slug>.txt`
   - `manifest.csv` (slug, title, erl_id, control codes, char_count).
2. **Pair resolution.** Resolve controls per doc via the production ERL
   junction lookup (active, priority-ordered, cap 3). Freeze the pair list +
   objective UUIDs in the manifest for reproducibility.
3. **Harness.** `scripts/eval-assessment-quality.ts`: per pair, fetch control/
   objectives/maturity rows, call `assessAgainstObjectives` +
   `assessMaturityLevel` twice — (a) production-truncated, (b) full text —
   and write JSONL to `scripts/out/` (config, usage, latency, outputs). No DB
   writes (bypasses `runControlAssessment` persistence).
4. **Ground-truth labeling (Layer 1).** Generate a labeling sheet per pair:
   full doc + objectives + assessment_procedure/expected_results + maturity
   benchmarks, with blank label slots. Peter labels ALL pairs' objective
   results + maturity levels (~20–25 pairs; bounded, roughly 1–2 focused
   hours). House rule to pin explicitly during labeling: fail vs
   not_applicable for out-of-artifact-scope objectives.
5. **Layer-1 scoring.** Deterministic script computes agreement metrics for
   both runs (truncated vs full-text) → the truncation cost lands as a
   measured delta on decision accuracy, not an anecdote.
6. **Layer-2 rubric + ratings.** Draft `docs/ASSESSMENT-RUBRIC.md` (4-band
   anchors per prose field, anchors quoting real baseline outputs). Peter
   rates 10 stratified outputs; LLM judge (Anthropic profile, not the
   assessment model) rates the same 10 with full doc in context; publish
   agreement (within-1-band %); judge the remainder only if agreement ≥ a
   threshold Peter accepts.
7. **Report.** docs/EVAL.md section: Layer-1 agreement (truncated vs full),
   bias direction, confidence calibration, Layer-2 band distribution, worst
   offenders verbatim (incl. the Okta exhibit), cost/latency per assessment,
   ranked fix list.

## Test Plan

- [ ] Harness dry-run: 1 pair, both variants, valid JSONL.
- [ ] Full baseline: all pairs × 2 variants complete; failures logged not dropped.
- [ ] Layer-1 scoring script is deterministic (same inputs → same numbers).
- [ ] `pnpm lint` + `pnpm typecheck` clean.
- [ ] Zero writes to `assessments`/`evidence` (row counts before/after).

## Acceptance Criteria

- [ ] 10 full-text docs + frozen pair manifest committed under `fixtures/assessment-golden-set/`.
- [ ] Baseline + full-text contrast outputs captured as JSONL with config recorded.
- [ ] Peter's ground-truth labels captured for all pairs (Layer 1) + ≥10 prose ratings (Layer 2).
- [ ] Layer-1 agreement metrics published, truncated vs full-text, in docs/EVAL.md.
- [ ] Judge agreement number published, or explicit decision to stay human-only.
- [ ] Ranked fix list exists for the follow-up improvement task.
- [ ] No production code changed.

## Open Questions (answer before approving)

1. Labeling volume OK? (~20–25 pairs of objective+maturity labels ≈ 1–2 hours;
   this replaces the earlier "rate 10 assessments 0–100" ask.)
2. ~~House rule preference~~ RESOLVED (Peter, 2026-07-08, via ADR-001):
   `not_applicable` when the artifact class could never evidence it; `fail`
   when it should and doesn't.
3. Confirm the full-text contrast run (+~25 calls) — recommendation: yes, it
   converts the Okta anecdote into a measured accuracy delta.

## Approval Gate

- [x] Goal is clear
- [x] Context files listed (and actually read; probe run 2026-07-08)
- [x] Constraints explicit
- [x] Test plan defined
- [x] Acceptance criteria measurable
- [ ] Human approved — PENDING
