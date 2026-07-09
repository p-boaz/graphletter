import assert from "node:assert/strict";
import test from "node:test";
import { validateObjectiveAssessmentQuality } from "@/lib/ai/assessment-quality";

test("accepts strong objective coverage and confidence", () => {
  const result = validateObjectiveAssessmentQuality(
    [
      { objective_id: "ao-1", result: "pass", confidence: 0.9, evidence_quotes: [{}] },
      { objective_id: "ao-2", result: "partial", confidence: 0.8, evidence_quotes: [{}] },
      { objective_id: "ao-3", result: "fail", confidence: 0.7, evidence_quotes: [] },
    ],
    3
  );

  assert.equal(result.isValid, true);
});

test("rejects low objective coverage", () => {
  const result = validateObjectiveAssessmentQuality(
    [
      { objective_id: "ao-1", result: "fail", confidence: 0.9 },
      { objective_id: "ao-1", result: "fail", confidence: 0.8 },
    ],
    4
  );

  assert.equal(result.isValid, false);
  assert.match(result.reason || "", /coverage/i);
});

test("rejects low average confidence", () => {
  const result = validateObjectiveAssessmentQuality(
    [
      { objective_id: "ao-1", result: "fail", confidence: 0.2 },
      { objective_id: "ao-2", result: "fail", confidence: 0.3 },
      { objective_id: "ao-3", result: "fail", confidence: 0.4 },
    ],
    3
  );

  assert.equal(result.isValid, false);
  assert.match(result.reason || "", /confidence/i);
});

test("rejects pass or partial objectives without verified evidence spans", () => {
  const result = validateObjectiveAssessmentQuality(
    [
      { objective_id: "ao-1", result: "pass", confidence: 0.9, evidence_quotes: [] },
      { objective_id: "ao-2", result: "partial", confidence: 0.8 },
      { objective_id: "ao-3", result: "fail", confidence: 0.7, evidence_quotes: [] },
    ],
    3
  );

  assert.equal(result.isValid, false);
  assert.match(result.reason || "", /verified evidence/i);
});
