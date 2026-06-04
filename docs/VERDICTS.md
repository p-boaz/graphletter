# Verdicts: the assessment result schema

When Graphletter assesses an evidence document against a control, it produces a structured result at two levels: per **objective** (the individual testable statements that make up a control) and an **overall** roll-up for the control. This document defines every field and explains how to read them.

The canonical types live in [`lib/ai/assessment-engine.ts`](../lib/ai/assessment-engine.ts); the validated AI output schema is enforced there with Zod.

## The result taxonomy

Every verdict — at both the objective and overall level — is one of four values:

| Result           | Meaning                                                            |
| ---------------- | ------------------------------------------------------------------ |
| `pass`           | Evidence clearly and completely demonstrates the objective is met. |
| `partial`        | Evidence demonstrates the objective is partly met; gaps remain.    |
| `fail`           | Evidence does not demonstrate the objective is met.                |
| `not_applicable` | The objective does not apply to this evidence/context.             |

## Objective-level result

One per assessment objective within the control.

```ts
interface AssessmentResult {
  objective_id: string; // the SCF assessment-objective id
  result: "pass" | "fail" | "partial" | "not_applicable";
  confidence: number; // 0.0–1.0, clamped
  reasoning: string; // plain-language justification for the verdict
  gaps?: string[]; // what's missing (populated for fail/partial)
  recommendations?: string[]; // suggested remediation steps
}
```

- **`reasoning`** is the point of the product: it's the model's explanation, grounded in the evidence, for _why_ it reached the verdict. Read it before trusting the verdict.
- **`gaps`** and **`recommendations`** are most useful on `fail`/`partial` results.

## Control-level (overall) result

The roll-up across all of a control's objectives.

```ts
interface EvidenceAssessment {
  evidence_id: string;
  scf_control_id: string;
  overall_result: "pass" | "fail" | "partial" | "not_applicable";
  overall_confidence: number; // mean of objective confidences, 0.0–1.0
  objective_results: AssessmentResult[];
  summary: string;
  recommendations: string[];
}
```

### How `overall_result` is derived

The roll-up is deterministic, computed from the objective results (not a second model call):

1. Objectives marked `not_applicable` are excluded from the denominator.
2. If **no** objectives are applicable → `partial` (nothing could be evaluated).
3. If **all** applicable objectives `pass` → `pass`.
4. If any `fail` or `partial` remain → `partial` when partials outnumber fails, otherwise `fail`.

`overall_confidence` is the arithmetic mean of the per-objective `confidence` values.

## How to read `confidence`

`confidence` is a number in **[0.0, 1.0]**, clamped on ingestion. **It is the model's self-reported confidence in its own verdict — not a statistically calibrated probability.**

Treat it as a triage signal, not ground truth:

- **High confidence + `pass`** — likely fine, but spot-check the `reasoning`.
- **Low confidence (any result)** — prioritize human review; the model is signalling uncertainty.
- **Do not** sum or average confidences across controls and present the result as an audit-grade coverage percentage. The roll-up math above is a convenience, not an assurance metric.

As with the project overall: these verdicts are a **readiness and gap-analysis aid**, not a substitute for a formal audit or a licensed assessor.
