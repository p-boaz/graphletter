# ADR-001: Evidence assembly and output contract for AI control assessments

- **Status:** Accepted (Peter, 2026-07-08)
- **Date:** 2026-07-08
- **Implementation:** `assessment-evidence.v1` implemented 2026-07-08 via `plans/task-2026-07-08-assessment-evidence-architecture.md`.
- **Drivers:** live probe findings of 2026-07-08 (see `plans/task-2026-07-08-assessment-quality-golden-set.md`, tabled — it becomes the acceptance gate for this ADR's outcome)

## Context

The AI assessment (the core product value) evaluates an evidence document
against an SCF control's assessment objectives and maturity benchmarks. A live
probe through the production path (GitLab Password Standard × IAC-02, gpt-5.4)
produced a false flagship claim: maturity assessed L1 for "no evidence of
centralized IAM/SSO" while the document mandates Okta, SAML, and org-wide 2FA
— all past the truncation point.

Verified facts about the current design:

1. **The model never sees the document.** `buildEvidenceText()`
   (`lib/ai/assess-evidence/utils.ts:73`) truncates evidence to 2,000 chars
   (1,500 + image for OCR). The probe doc was 9,736 chars — the model saw 20%.
   Extraction upstream caps documents at 200,000 chars, so the stored text is
   available; assessment just discards it.
2. **The auditor's test script is withheld.** The objective prompt sends only
   `assessment_objective`. SCF's `assessment_procedure` and `expected_results`
   columns exist in `scf_assessment_objectives` and are never sent.
3. **Quality knobs at the floor.** `reasoningEffort: "low"`,
   `textVerbosity: "low"`, and a "brief explanation" instruction.
4. **Output is unfalsifiable.** The Zod schema has no evidence-citation field.
   "The document does not address X" cannot be checked, and the UI cannot show
   provenance.
5. **Targets are invented.** When `scf_controls.target_maturity_level` is
   null, the prompt invites the model to pick one (it picked 3 in the probe).
   Target-gap outputs are therefore not always anchored to anything.
6. **Scoping is unpinned.** Controls carry objectives an artifact class can
   never evidence (device identification vs a password standard); the prompt
   gives no rule for `fail` vs `not_applicable`.
7. **Evidence is client-supplied.** `assess-uploaded` receives `fileContent`
   re-sent from the browser rather than reading the stored file — an integrity
   gap and an obstacle to server-side caching by content hash.
8. **The atom graph is a stub.** `evidence_atoms` are bootstrap placeholders
   (`buildBootstrapAtom`, `lib/graph/atom-bootstrap.ts`): each raw text chunk
   relabeled as one atom, `atom_type: "other"`, hardcoded `confidence: 0.2`,
   claim = first 300 chars, and every atom mapped wholesale to the upload's
   control (`mapping_method: "rule"`). There is no semantic extraction today.

## Decision drivers

- **Assessment quality** — feedback must be correct against the full document
  and credible to a professional assessor; false "missing evidence" claims are
  product-killing.
- **Per-assessment COGS** — unit economics killed a model-tier upgrade on
  Portal; cost per assessment must be a designed number, not a surprise.
- **Latency** — `assess-uploaded` wraps the control assessment in a 90s
  timeout; the UI polls per control.
- **Deliverability** — prefer changes shippable behind existing seams over new
  subsystems.
- **Falsifiability** — outputs should carry the evidence for their own audit.

## Options considered

Baseline for cost figures: typical policy ≈ 10k chars ≈ 2.5k tokens; p95 ≈
60k chars ≈ 15k tokens; hard cap 200k chars ≈ 50k tokens (fits a single
gpt-5.4 context — every ingestible document fits in one call). Two AI calls
per (doc × control): objectives + maturity. Dollar figures below are
order-of-magnitude and MUST be re-priced against current OpenAI rates before
deciding on cost grounds.

### Option A — Full-document context (recommended)

Pass the full extracted text (up to the existing 200k-char cap) to both
assessment calls. Structure prompts document-first so OpenAI automatic prompt
caching amortizes the document across the objectives call, the maturity call,
and sibling controls of the same document.

- Cost: typical doc ≈ 2.5k tok × 2 calls × ~2 controls ≈ ~10k input tokens
  per document (cache-discounted after the first call); worst case (50k tok ×
  3 controls × 2 calls) ≈ 300k input tokens ≈ single-digit dollars at
  plausible rates — rare, and boundable with a per-assessment token budget log.
- Pros: kills failure #1 outright; no new moving parts; simplest to reason
  about; document cache makes marginal control cost small.
- Cons: cost scales with document size; latency rises with input size
  (mitigable: objectives and maturity calls can run in parallel inside the
  existing 90s envelope).

### Option B — Retrieval packets from the atom graph

Assemble a bounded (~4–8k token) per-control evidence packet from
`evidence_atoms` via `evidence_control_map`.

- Pros: bounded cost regardless of document size; per-control focus.
- Cons: **the atom layer is a stub (fact #8)** — this option requires building
  real semantic extraction first (new AI calls at upload time: cost shifts,
  doesn't disappear), then trusting its recall. A missed atom recreates the
  Okta failure with worse debuggability ("why didn't the assessor see
  section 7?"). Highest effort, highest risk, unmeasured foundation.

### Option C — Hybrid threshold

Full text below a size threshold; sectioned map-reduce or retrieval above it.

- Pros: A's simplicity for the common case, bounded worst case.
- Cons: two code paths with divergent behavior; given every ingestible doc
  already fits one context window, the second path exists purely as cost
  optimization for a fat tail we haven't measured yet.

## Decision (proposed)

**Option A now; revisit B/C only if measured COGS demands it.** Concretely:
replace the 2,000-char truncation with full-document context (200k-char cap
unchanged), log input/output tokens per assessment as a first-class metric,
and set a review trigger (e.g. if p95 cost per assessment exceeds an agreed
ceiling, spec the tail optimization as its own ADR). The atom graph is not in
the assessment path until real extraction exists and its recall is measured.

### Bundled output-contract changes (ride along regardless of option)

1. **Require citations.** Schema gains per-objective `evidence_quotes`
   (verbatim spans + char offsets, empty allowed only for fail/N/A) — makes
   claims falsifiable and gives the UI provenance.
2. **Send the full objective row**: `assessment_objective` +
   `assessment_procedure` + `expected_results`.
3. **Raise reasoning effort to "medium"** and drop the "brief" instruction;
   measure the quality/cost delta in the validation matrix rather than assume.
4. **Pin the scoping rule** in the prompt: `not_applicable` when the artifact
   class could never evidence the objective; `fail` when it should and
   doesn't. (Locked as the house rule — Peter, 2026-07-08.)
5. **Never invent targets**: target fields populated only from
   `scf_controls.target_maturity_level`; omitted when null.
6. **Server-side evidence read**: assessment reads the stored file (or stored
   extraction) by content hash instead of trusting client-resent
   `fileContent`; enables caching and closes the integrity gap.

## Consequences

- Per-assessment cost rises from near-zero input to document-scaled input;
  this is the price of assessing the actual document. Token logging + review
  trigger keep it governed.
- Latency per control rises; parallelizing the two calls keeps the 90s
  envelope workable — verify in validation.
- Assessment dedup keys (`assessment_run_key`) remain valid — content hash
  already covers the full text.
- Prompt/schema changes invalidate historical comparability of stored
  assessments; version the prompt (`extractor_version`-style tag in
  `metadata`) so old and new outputs are distinguishable.
- The mocked-model test baseline (task-2026-06-12) pins code paths and is
  unaffected; schema changes need test updates in the same PR.

## Validation plan

1. **Probe matrix** (extends the 2026-07-08 probe script): ~5 corpus docs ×
   {current baseline, Option A + bundled fixes, Option A + fixes + adversarial
   verify lane (addendum A5)}, outputs side-by-side in one review sheet. Peter
   eyeballs for assessor-credibility; token/latency logged per cell. Gate:
   proceed only if A reads clearly better and cost/latency are acceptable;
   the verify lane ships only if it visibly beats single-lane on citation
   trustworthiness.
2. **Acceptance gate:** the tabled golden-set eval
   (`plans/task-2026-07-08-assessment-quality-golden-set.md`) runs against the
   winning configuration — Layer-1 decision agreement vs Peter's labels,
   truncated-vs-full delta retired as a permanent regression check.
3. Re-run after any subsequent prompt change (prompt version bump ⇒ probe
   matrix re-run).

## Addendum (2026-07-08): patterns adopted from bar-playbook grading-v2

Bar-playbook's agentic essay-grading workflow (PR #92, 2026-06-13;
`lib/grading-v2/` + `workflows/agentic-essay-grading.ts`) is architecturally
isomorphic to this pipeline: essay × rubric-issues ≈ document × assessment-
objectives; examiner-calibrated score bands ≈ C|P-CMM maturity benchmarks;
its golden-set MAE-vs-examiner eval ≈ this ADR's Layer-1 agreement gate. It is
a FIXED multi-stage pipeline (not a tool-choosing agent), proven in production
(MAE 2.73 vs target ≤5; 58% input-cost cut via prompt caching). We adopt from
it selectively:

**Adopt now (folded into the bundled contract changes):**

- **A1 — Offset-verified evidence spans (upgrades bundled fix #1).** Citations
  use grading-v2's `EvidenceSpanSchema` shape — `{start, end, text, supports}`
  with exact char offsets — deterministically verified
  (`document.slice(start,end) === text`, cf. `evidenceSpansAreExact`). Quality
  gate: any `pass`/`partial` objective with zero verified spans ⇒ result
  rejected, not published. Citations become machine-checked, not merely present.
- **A2 — Versioned contracts + skills (upgrades the prompt-versioning
  consequence).** `ASSESSMENT_CONTRACT_VERSION` plus per-role prompt-fragment
  versions (objective assessor, maturity assessor), stamped on every stored
  assessment; the reuse/dedup key (`assessment_run_key`) gains the contract
  version so results never silently span prompt generations. Any prompt
  wording change bumps the version (grading-v2's runbook discipline).
- **A3 — Prompt-caching mechanics + monitoring.** Document-first invariant
  prefix with explicit `promptCacheKey` + 24h retention (per upload, the
  document is shared across its controls' objectives+maturity calls); monitor
  `cached_prompt_tokens / prompt_tokens` in the assessment logs as the COGS
  health metric feeding resolved decision #1.
- **A4 — Eval ops discipline (feeds the tabled golden-set spec).** Eval runs
  invoke the production path with result-reuse disabled; add a determinism
  gate alongside accuracy (same doc × control re-run ⇒ determination
  agreement and maturity-level stability within tolerance). Lesson imported
  verbatim: grading-v2 rejected model tiering because the mini tier failed
  determinism — do not swap models here without the same gate.

**Designed extension point (decide with data, not now):**

- **A5 — Adversarial verification lane.** Grading-v2's two independent lanes +
  verifier + conditional adjudication + preserved `dissent[]` is the most
  auditor-shaped idea in the codebase (dissent preservation over averaging).
  It ~3×'s calls per assessment, so it enters as a third probe-matrix cell —
  {baseline, Option A + fixes, Option A + fixes + verify lane} — and ships
  only if the eyeball test + golden set say the single-lane citations are not
  trustworthy enough. If adopted, orchestration moves to a durable workflow
  (Vercel Workflow steps, as grading-v2 did) rather than stretching the 90s
  route timeout.

**Explicitly not imported:** the cohort rollout ladder (grading-v2 serves a
production user base; graphletter needs only a kill-switch env flag +
contract-version stamping), and `patterns.ts` longitudinal coaching
(cross-submission analytics — a possible future "recurring gaps per org"
feature, unrelated to this decision).

## Resolved decisions (Peter, 2026-07-08)

1. **Cost ceiling:** none set up front — ship Option A, log tokens per
   assessment, and set the acceptable ceiling later from observed data. The
   review trigger stands but its threshold is TBD-from-data.
2. **Fail vs not_applicable:** the recommended house rule is locked:
   `not_applicable` when the artifact class could never evidence the
   objective; `fail` when it should and doesn't.
3. **Citations UX:** `evidence_quotes` surface in the assessment review dialog
   in the same release (schema + UI together).
