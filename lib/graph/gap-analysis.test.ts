import assert from "node:assert/strict";
import test from "node:test";
import {
  type AssessmentVerdict,
  applyAssessmentVerdicts,
  computeControlGaps,
} from "./gap-analysis";

// Regression: QA 2026-07-09 ISSUE-005 — a control whose approved assessment
// FAILed was still counted as "compliant" because coverage only looked at
// mapping strength, never at the verdict.

function strongMapping(controlId: string) {
  return {
    scf_control_id: controlId,
    coverage_strength: "strong",
    atom_id: `atom-${controlId}`,
    mapping_polarity: "supports",
  };
}

test("applyAssessmentVerdicts: FAIL verdict demotes a strongly-mapped control", () => {
  const gaps = computeControlGaps(["HRS-02"], [strongMapping("HRS-02")]);
  assert.equal(gaps[0].status, "compliant");

  const overlaid = applyAssessmentVerdicts(
    gaps,
    new Map<string, AssessmentVerdict>([["HRS-02", "fail"]])
  );

  assert.equal(overlaid[0].status, "conflicting");
  assert.equal(overlaid[0].gapType, "conflicting_evidence");
  assert.match(overlaid[0].summary, /failed its latest approved assessment/);
});

test("applyAssessmentVerdicts: PARTIAL verdict demotes to partial", () => {
  const gaps = computeControlGaps(["HRS-05"], [strongMapping("HRS-05")]);

  const overlaid = applyAssessmentVerdicts(
    gaps,
    new Map<string, AssessmentVerdict>([["HRS-05", "partial"]])
  );

  assert.equal(overlaid[0].status, "partial");
  assert.equal(overlaid[0].gapType, "covered_by_weak_evidence");
});

test("applyAssessmentVerdicts: PASS verdict promotes a weakly-mapped control", () => {
  const gaps = computeControlGaps(
    ["GOV-01"],
    [
      {
        scf_control_id: "GOV-01",
        coverage_strength: "weak",
        atom_id: "atom-GOV-01",
        mapping_polarity: "supports",
      },
    ]
  );
  assert.equal(gaps[0].status, "partial");

  const overlaid = applyAssessmentVerdicts(
    gaps,
    new Map<string, AssessmentVerdict>([["GOV-01", "pass"]])
  );

  assert.equal(overlaid[0].status, "compliant");
});

test("applyAssessmentVerdicts: controls without a verdict keep the graph status", () => {
  const gaps = computeControlGaps(["IAC-01"], [strongMapping("IAC-01")]);

  const overlaid = applyAssessmentVerdicts(gaps, new Map());

  assert.deepEqual(overlaid, gaps);
});
