/**
 * Unit tests for lib/ai/assessment-engine.ts
 *
 * All tests use the mock model seam — no real AI calls, no env vars required.
 *
 * Functions under test:
 *   - assessEvidenceAgainstObjectives
 *   - generateAssessmentSummary
 *   - assessEvidence (happy path via composition)
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  assessEvidenceAgainstObjectives,
  generateAssessmentSummary,
} from "@/lib/ai/assessment-engine";
import { installMockModel, mockObjectModel, resetMockModel } from "@/lib/ai/testing/mock-model";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OBJECTIVES = [
  {
    id: "obj-1",
    scf_ao_id: "SCF-1.1",
    assessment_objective: "Verify access control policy exists",
    assessment_procedure: "Review the policy document",
    expected_results: "A written policy document exists",
  },
  {
    id: "obj-2",
    scf_ao_id: "SCF-1.2",
    assessment_objective: "Verify policy is communicated",
    assessment_procedure: "Check employee training records",
    expected_results: "Training completion records present",
  },
];

// ---------------------------------------------------------------------------
// assessEvidenceAgainstObjectives
// ---------------------------------------------------------------------------

test("assessEvidenceAgainstObjectives: happy path returns mapped assessments", async () => {
  const canned = {
    assessments: [
      {
        objective_id: "obj-1",
        result: "pass",
        confidence: 0.9,
        reasoning: "Policy document found",
        gaps: [],
        recommendations: [],
      },
      {
        objective_id: "obj-2",
        result: "partial",
        confidence: 0.6,
        reasoning: "Records incomplete",
        gaps: ["Missing Q4 records"],
        recommendations: ["Add Q4 records"],
      },
    ],
  };

  installMockModel(mockObjectModel([canned]));
  try {
    const results = await assessEvidenceAgainstObjectives(
      "Evidence text here",
      OBJECTIVES,
      "Access Control Policy",
      "Ensure access control is enforced"
    );

    assert.equal(results.length, 2);
    assert.equal(results[0].objective_id, "obj-1");
    assert.equal(results[0].result, "pass");
    assert.equal(results[0].confidence, 0.9);
    assert.equal(results[0].reasoning, "Policy document found");
    assert.deepEqual(results[0].gaps, []);
    assert.equal(results[1].result, "partial");
    assert.deepEqual(results[1].gaps, ["Missing Q4 records"]);
  } finally {
    resetMockModel();
  }
});

test("assessEvidenceAgainstObjectives: all four result enum values round-trip", async () => {
  const enumValues = ["pass", "fail", "partial", "not_applicable"] as const;

  for (const resultValue of enumValues) {
    const canned = {
      assessments: [
        {
          objective_id: "obj-1",
          result: resultValue,
          confidence: 0.7,
          reasoning: `Result is ${resultValue}`,
        },
      ],
    };

    installMockModel(mockObjectModel([canned]));
    try {
      const results = await assessEvidenceAgainstObjectives(
        "Evidence",
        [OBJECTIVES[0]],
        "Control Title",
        "Control Description"
      );
      assert.equal(results[0].result, resultValue, `enum value ${resultValue} should round-trip`);
    } finally {
      resetMockModel();
    }
  }
});

test("assessEvidenceAgainstObjectives: confidence clamped to 0–1 range", async () => {
  // confidence: 1.5 exceeds the Zod schema max(1) — generateObject itself
  // will reject the schema-violating response and throw. The function re-throws
  // as "Failed to complete AI assessment". This pins that characterization.
  const canned = {
    assessments: [
      {
        objective_id: "obj-1",
        result: "pass",
        confidence: 1.5, // violates Zod max(1)
        reasoning: "Over-confident",
      },
    ],
  };

  installMockModel(mockObjectModel([canned]));
  try {
    await assert.rejects(
      () => assessEvidenceAgainstObjectives("Evidence", [OBJECTIVES[0]], "Title", "Description"),
      (err: Error) => {
        // Characterization: function wraps the Zod error as this message
        assert.equal(err.message, "Failed to complete AI assessment");
        return true;
      }
    );
  } finally {
    resetMockModel();
  }
});

test("assessEvidenceAgainstObjectives: missing objective_id in model output — schema rejects, function throws", async () => {
  // objective_id is z.string() (required) — missing it fails Zod validation
  const canned = {
    assessments: [
      {
        // objective_id intentionally missing
        result: "pass",
        confidence: 0.8,
        reasoning: "Missing ID",
      },
    ],
  };

  installMockModel(mockObjectModel([canned]));
  try {
    await assert.rejects(
      () => assessEvidenceAgainstObjectives("Evidence", [OBJECTIVES[0]], "Title", "Description"),
      (err: Error) => {
        assert.equal(err.message, "Failed to complete AI assessment");
        return true;
      }
    );
  } finally {
    resetMockModel();
  }
});

test("assessEvidenceAgainstObjectives: empty assessments array returns []", async () => {
  // Characterization: empty array passes Zod validation; function maps it to []
  const canned = { assessments: [] };

  installMockModel(mockObjectModel([canned]));
  try {
    const results = await assessEvidenceAgainstObjectives(
      "Evidence",
      OBJECTIVES,
      "Title",
      "Description"
    );
    assert.deepEqual(results, []);
  } finally {
    resetMockModel();
  }
});

// ---------------------------------------------------------------------------
// generateAssessmentSummary
// ---------------------------------------------------------------------------

const OBJECTIVE_RESULTS = [
  {
    objective_id: "obj-1",
    result: "pass" as const,
    confidence: 0.9,
    reasoning: "Policy exists",
    gaps: [],
    recommendations: [],
  },
  {
    objective_id: "obj-2",
    result: "fail" as const,
    confidence: 0.4,
    reasoning: "No training records",
    gaps: ["Missing records"],
    recommendations: ["Add records"],
  },
];

test("generateAssessmentSummary: returns summary string and recommendations array", async () => {
  const canned = {
    summary: "1 of 2 objectives passed. Training records are missing.",
    recommendations: ["Implement training program", "Document procedures"],
  };

  installMockModel(mockObjectModel([canned]));
  try {
    const result = await generateAssessmentSummary(
      OBJECTIVE_RESULTS,
      "Access Control",
      "Evidence text"
    );

    assert.equal(typeof result.summary, "string");
    assert.ok(result.summary.length > 0);
    assert.ok(Array.isArray(result.recommendations));
    assert.equal(result.recommendations.length, 2);
    assert.equal(result.summary, "1 of 2 objectives passed. Training records are missing.");
  } finally {
    resetMockModel();
  }
});

test("generateAssessmentSummary: model failure falls back gracefully", async () => {
  // generateAssessmentSummary has a catch block that returns a fallback
  // (does not re-throw). This pins that characterization.
  installMockModel(
    mockObjectModel([]) // exhausted immediately → throws on first call
  );
  try {
    const result = await generateAssessmentSummary(OBJECTIVE_RESULTS, "Access Control", "Evidence");

    // Characterization: fallback returns a non-empty summary and array
    assert.equal(typeof result.summary, "string");
    assert.ok(result.summary.length > 0);
    assert.ok(Array.isArray(result.recommendations));
  } finally {
    resetMockModel();
  }
});
