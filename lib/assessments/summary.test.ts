import assert from "node:assert/strict";
import test from "node:test";
import { assessmentHeadline } from "@/lib/assessments/summary";

test("assessmentHeadline produces a fraction + percentage + overall verdict", () => {
  const result = assessmentHeadline({
    objectives: [{ status: "pass" }, { status: "pass" }, { status: "fail" }, { status: "fail" }],
    overall: "partial",
    confidence: 0.86,
  });
  assert.equal(result.passed, 2);
  assert.equal(result.total, 4);
  assert.equal(result.passRatePercent, 50);
  assert.equal(result.verdict, "PARTIAL");
  assert.equal(result.confidencePercent, 86);
});

test("assessmentHeadline treats no objectives as total 0 with passRatePercent null", () => {
  const result = assessmentHeadline({
    objectives: [],
    overall: "pass",
    confidence: 1,
  });
  assert.equal(result.total, 0);
  assert.equal(result.passed, 0);
  assert.equal(result.passRatePercent, null);
  assert.equal(result.verdict, "PASS");
  assert.equal(result.confidencePercent, 100);
});

test("assessmentHeadline rounds confidence to the nearest whole percent", () => {
  const result = assessmentHeadline({
    objectives: [{ status: "pass" }],
    overall: "pass",
    confidence: 0.876,
  });
  assert.equal(result.confidencePercent, 88);
});
