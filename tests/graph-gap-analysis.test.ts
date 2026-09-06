import assert from "node:assert/strict";
import test from "node:test";
import { computeControlGaps } from "@/lib/graph/gap-analysis";

test("marks control as missing when no mappings exist", () => {
  const result = computeControlGaps(["SCF-01"], []);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.status, "missing");
  assert.equal(result[0]?.gapType, "no_evidence_mapping");
  assert.deepEqual(result[0]?.supportingAtomIds, []);
});

test("marks control as partial when only weak supporting evidence exists", () => {
  const result = computeControlGaps(
    ["SCF-02"],
    [
      {
        scf_control_id: "SCF-02",
        coverage_strength: "weak",
        atom_id: "atom-weak-1",
        mapping_polarity: "supports",
      },
    ]
  );

  assert.equal(result[0]?.status, "partial");
  assert.equal(result[0]?.gapType, "covered_by_weak_evidence");
  assert.deepEqual(result[0]?.supportingAtomIds, ["atom-weak-1"]);
});

test("marks control as compliant when moderate/strong supporting evidence exists", () => {
  const result = computeControlGaps(
    ["SCF-03"],
    [
      {
        scf_control_id: "SCF-03",
        coverage_strength: "moderate",
        atom_id: "atom-mod-1",
        mapping_polarity: "supports",
      },
    ]
  );

  assert.equal(result[0]?.status, "compliant");
  assert.equal(result[0]?.gapType, "covered_by_strong_or_moderate_evidence");
});

test("marks control as conflicting when contradiction mappings exist", () => {
  const result = computeControlGaps(
    ["SCF-04"],
    [
      {
        scf_control_id: "SCF-04",
        coverage_strength: "strong",
        atom_id: "atom-support-1",
        mapping_polarity: "supports",
      },
      {
        scf_control_id: "SCF-04",
        coverage_strength: "moderate",
        atom_id: "atom-contradict-1",
        mapping_polarity: "contradicts",
      },
    ]
  );

  assert.equal(result[0]?.status, "conflicting");
  assert.equal(result[0]?.gapType, "conflicting_evidence");
  assert.deepEqual(result[0]?.supportingAtomIds.sort(), ["atom-contradict-1", "atom-support-1"]);
});
