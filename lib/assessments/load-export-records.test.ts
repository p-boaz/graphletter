import assert from "node:assert/strict";
import test from "node:test";
import { fakeSupabase, queriesFor } from "@/lib/testing/fake-supabase";
import { loadAssessmentExportRecords } from "./load-export-records";

const SUMMARY_ROW = {
  scf_control_id: "AC-01",
  assessment_result: "pass",
  confidence_level: "high",
  assessment_summary: "Assessment completed: 2/2 objectives passed",
  metadata: {
    is_summary: true,
    objective_results: [
      {
        objective_id: "AC-01.a",
        result: "pass",
        confidence: 0.9,
        reasoning: "Policy covers it.",
        gaps: [],
        recommendations: ["Review annually"],
      },
      {
        objective_id: "AC-01.b",
        result: "pass",
        confidence: 0.7,
        reasoning: "Procedure documented.",
      },
    ],
  },
  scf_controls: { title: "Access control policy" },
};

test("loadAssessmentExportRecords: maps a summary row with objective averaging", async () => {
  const { client } = fakeSupabase({
    assessments: { data: [SUMMARY_ROW] },
    scf_control_mappings: {
      data: [
        { control_id: "AC-01", scf_frameworks: { framework_name: "NIST CSF" } },
        { control_id: "AC-01", scf_frameworks: [{ framework_name: "ISO 27001" }] },
        // Duplicate framework name dedupes
        { control_id: "AC-01", scf_frameworks: { framework_name: "NIST CSF" } },
      ],
    },
  });

  const records = await loadAssessmentExportRecords(client, "user-1");
  assert.equal(records.length, 1);
  const [record] = records;
  assert.equal(record.scf_control_id, "AC-01");
  assert.equal(record.control_title, "Access control policy");
  // Sorted + deduped
  assert.deepEqual(record.frameworks, ["ISO 27001", "NIST CSF"]);
  assert.equal(record.overall_result, "pass");
  // Mean of objective confidences, not the level string
  assert.equal(record.overall_confidence, (0.9 + 0.7) / 2);
  assert.equal(record.summary, "Assessment completed: 2/2 objectives passed");
  assert.equal(record.objective_results.length, 2);
  assert.deepEqual(record.objective_results[0].recommendations, ["Review annually"]);
  assert.equal(record.objective_results[1].gaps, undefined);
});

test("loadAssessmentExportRecords: basic assessments fall back to confidence_level scoring", async () => {
  const { client } = fakeSupabase({
    assessments: {
      data: [
        {
          scf_control_id: "GOV-01",
          assessment_result: "partial",
          confidence_level: "medium",
          assessment_summary: "Reasoning text",
          metadata: { basic_assessment: true },
          scf_controls: null,
        },
      ],
    },
    scf_control_mappings: { data: [] },
  });

  const records = await loadAssessmentExportRecords(client, "user-2");
  const [record] = records;
  assert.equal(record.overall_result, "partial");
  // confidenceLevelToScore("medium") — pinned helper behavior
  assert.equal(record.overall_confidence, 0.6);
  assert.equal(record.objective_results.length, 0);
  assert.equal(record.control_title, undefined);
  assert.equal(record.frameworks, undefined);
});

test("loadAssessmentExportRecords: malformed metadata and unknown verdicts are sanitized", async () => {
  const { client } = fakeSupabase({
    assessments: {
      data: [
        {
          scf_control_id: "XX-01",
          assessment_result: "exploded",
          confidence_level: null,
          assessment_summary: null,
          metadata: {
            is_summary: true,
            objective_results: [
              null,
              "garbage",
              { objective_id: 42, result: "maybe", confidence: "NaN", reasoning: 7 },
            ],
          },
          scf_controls: [],
        },
      ],
    },
    scf_control_mappings: { data: [] },
  });

  const [record] = await loadAssessmentExportRecords(client, "user-3");
  assert.equal(record.overall_result, "not_applicable");
  assert.equal(record.objective_results.length, 1);
  assert.deepEqual(record.objective_results[0], {
    objective_id: "",
    result: "not_applicable",
    confidence: 0,
    reasoning: "",
  });
  // One sanitized objective with confidence 0 → average 0
  assert.equal(record.overall_confidence, 0);
  assert.equal(record.summary, undefined);
});

test("loadAssessmentExportRecords: empty result set short-circuits without a mappings query", async () => {
  const { client, queries } = fakeSupabase({
    assessments: { data: [] },
  });

  assert.deepEqual(await loadAssessmentExportRecords(client, "user-4"), []);
  assert.equal(queriesFor(queries, "scf_control_mappings").length, 0);
});

test("loadAssessmentExportRecords: filters to completed summary rows for the user", async () => {
  const { client, queries } = fakeSupabase({
    assessments: { data: [] },
  });

  await loadAssessmentExportRecords(client, "user-5");
  const [query] = queriesFor(queries, "assessments");
  const eqCalls = query.chain.filter((c) => c.method === "eq");
  assert.deepEqual(
    eqCalls.map((c) => c.args),
    [
      ["user_id", "user-5"],
      ["assessment_status", "completed"],
    ]
  );
  const orCall = query.chain.find((c) => c.method === "or");
  assert.equal(
    orCall?.args[0],
    "metadata->>is_summary.eq.true,metadata->>basic_assessment.eq.true"
  );
});

test("loadAssessmentExportRecords: query errors propagate to the caller", async () => {
  const { client } = fakeSupabase({
    assessments: { data: null, error: { message: "db down" } },
  });

  await assert.rejects(() => loadAssessmentExportRecords(client, "user-6"), /db down/);
});
