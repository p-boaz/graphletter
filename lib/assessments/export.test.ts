import assert from "node:assert/strict";
import test from "node:test";
import {
  assessmentsToCsv,
  assessmentsToJson,
  type AssessmentExportRecord,
} from "@/lib/assessments/export";

function record(overrides: Partial<AssessmentExportRecord> = {}): AssessmentExportRecord {
  return {
    scf_control_id: "DCH-01.1",
    control_title: "Data Classification Scheme",
    frameworks: ["SOC 2 CC6.1", "ISO 27001 A.8.2.1"],
    overall_result: "pass",
    overall_confidence: 0.91,
    summary: "Policy defines three sensitivity tiers.",
    objective_results: [
      { objective_id: "AO-1", result: "pass", confidence: 0.9, reasoning: "Tiers defined." },
      { objective_id: "AO-2", result: "fail", confidence: 0.6, reasoning: "No retention rule." },
    ],
    ...overrides,
  };
}

test("assessmentsToJson is indented and round-trips losslessly", () => {
  const records = [record()];
  const json = assessmentsToJson(records);
  assert.ok(json.includes("\n"), "expected pretty-printed JSON");
  assert.deepEqual(JSON.parse(json), records);
});

test("assessmentsToJson renders an empty array for no records", () => {
  assert.equal(assessmentsToJson([]), "[]");
});

test("assessmentsToCsv emits a header plus one row per control", () => {
  const csv = assessmentsToCsv([record()]);
  const lines = csv.split("\r\n");
  assert.equal(lines.length, 2);
  assert.equal(
    lines[0],
    "Control ID,Title,Frameworks,Verdict,Confidence %,Objectives Passed,Objectives Total,Summary"
  );
  // Frameworks are semicolon-joined so the field has no comma and stays
  // unquoted; verdict is upper-cased; confidence becomes a whole percent.
  assert.equal(
    lines[1],
    "DCH-01.1,Data Classification Scheme,SOC 2 CC6.1; ISO 27001 A.8.2.1,PASS,91,1,2,Policy defines three sensitivity tiers."
  );
});

test("assessmentsToCsv returns only the header for empty input", () => {
  const csv = assessmentsToCsv([]);
  assert.equal(csv.split("\r\n").length, 1);
  assert.ok(csv.startsWith("Control ID,"));
});

test("assessmentsToCsv escapes commas, quotes, and newlines per RFC 4180", () => {
  const csv = assessmentsToCsv([
    record({
      control_title: 'Access, Control "AC"',
      summary: "Line one\nline two",
      frameworks: [],
    }),
  ]);
  const dataLine = csv.split("\r\n")[1];
  assert.ok(dataLine.includes('"Access, Control ""AC"""'), "comma + doubled quotes");
  assert.ok(dataLine.includes('"Line one\nline two"'), "embedded newline is quoted");
});

test("assessmentsToCsv handles missing optional fields and not_applicable verdicts", () => {
  const csv = assessmentsToCsv([
    {
      scf_control_id: "IAC-01",
      overall_result: "not_applicable",
      overall_confidence: 0.5,
      objective_results: [],
    },
  ]);
  // Empty title, empty frameworks, NOT APPLICABLE verdict, 0/0 objectives, empty summary.
  assert.equal(csv.split("\r\n")[1], "IAC-01,,,NOT APPLICABLE,50,0,0,");
});

test("assessmentsToCsv clamps out-of-range and non-finite confidence", () => {
  const over = assessmentsToCsv([record({ overall_confidence: 1.4 })]).split("\r\n")[1];
  const nan = assessmentsToCsv([record({ overall_confidence: Number.NaN })]).split("\r\n")[1];
  assert.equal(over.split(",")[4], "100");
  assert.equal(nan.split(",")[4], "0");
});

test("assessmentsToCsv counts passed objectives correctly", () => {
  const csv = assessmentsToCsv([
    record({
      objective_results: [
        { objective_id: "a", result: "pass", confidence: 1, reasoning: "" },
        { objective_id: "b", result: "pass", confidence: 1, reasoning: "" },
        { objective_id: "c", result: "partial", confidence: 0.5, reasoning: "" },
      ],
    }),
  ]);
  const cols = csv.split("\r\n")[1].split(",");
  assert.equal(cols[5], "2"); // passed
  assert.equal(cols[6], "3"); // total
});
