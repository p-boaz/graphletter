/**
 * Unit tests for lib/ai/assess-evidence/objective-assessment.ts
 *
 * assessAgainstObjectives wraps generateObjectWithRetry — the retry /
 * circuit-breaker contract is tested exhaustively in utils.test.ts; here
 * we focus on the happy path (return shape) and one malformed-output path.
 *
 * basic-assessment.ts and maturity-assessment.ts both funnel through the
 * same generateObjectWithRetry wrapper — all retry logic is shared and is
 * tested in utils.test.ts. Duplicating those tests here would add noise
 * without coverage gain.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { assessAgainstObjectives } from "@/lib/ai/assess-evidence/objective-assessment";
import { setCircuitBreakerOverrideForTesting } from "@/lib/ai/circuit-breaker";
import { installMockModel, mockObjectModel, resetMockModel } from "@/lib/ai/testing/mock-model";
import type { AssessmentObjective } from "@/lib/ai/assess-evidence/types";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const OBJECTIVES: AssessmentObjective[] = [
  {
    id: "obj-1",
    scf_ao_id: "SCF-AC-1.1",
    assessment_objective: "Verify access control policy exists",
    assessment_procedure: "Review policy document",
    expected_results: "A written policy document is present",
  },
  {
    id: "obj-2",
    scf_ao_id: "SCF-AC-1.2",
    assessment_objective: "Verify access control is enforced",
    assessment_procedure: "Check system configuration",
    expected_results: "System enforces access control",
  },
];

const LOG_CONTEXT = {
  requestId: "test-req",
  sessionId: "test-session",
  evidenceId: "evidence-abc",
  evidenceContentHash: "hash123",
  scfControlId: "SCF-AC-1",
  objectiveIds: ["obj-1", "obj-2"],
};

// ---------------------------------------------------------------------------
// assessAgainstObjectives: happy path
// ---------------------------------------------------------------------------

test("assessAgainstObjectives: happy path returns ObjectiveAssessmentResult[] with correct shape", async () => {
  const cannedObjectiveOne = {
    assessments: [
      {
        objective_id: "obj-1",
        result: "pass",
        confidence: 0.95,
        reasoning: "Policy document clearly present",
        evidence_quotes: [
          {
            candidate_id: "E1",
            supports: "Shows a written access control policy exists",
          },
        ],
      },
    ],
  };
  const cannedObjectiveTwo = {
    assessments: [
      {
        objective_id: "obj-2",
        result: "fail",
        confidence: 0.8,
        reasoning: "No enforcement evidence found",
        evidence_quotes: [],
      },
    ],
  };

  setCircuitBreakerOverrideForTesting({ allowed: true });
  installMockModel(mockObjectModel([cannedObjectiveOne, cannedObjectiveTwo]));
  try {
    const results = await assessAgainstObjectives(
      "Evidence content: access control policy v2.1",
      null, // no image
      OBJECTIVES,
      "Access Control",
      "Ensures only authorized users can access systems",
      LOG_CONTEXT
    );

    assert.equal(results.length, 2, "one result per objective");

    assert.equal(results[0].objective_id, "obj-1");
    assert.equal(results[0].result, "pass");
    assert.equal(results[0].confidence, 0.95);
    assert.equal(typeof results[0].reasoning, "string");
    assert.ok(results[0].reasoning.length > 0);
    assert.deepEqual(results[0].evidence_quotes, [
      {
        start: 0,
        end: 44,
        text: "Evidence content: access control policy v2.1",
        supports: "Shows a written access control policy exists",
      },
    ]);

    assert.equal(results[1].objective_id, "obj-2");
    assert.equal(results[1].result, "fail");
    // confidence is clamped to [0, 1]
    assert.ok(results[1].confidence >= 0 && results[1].confidence <= 1);
  } finally {
    resetMockModel();
    setCircuitBreakerOverrideForTesting(null);
  }
});

// ---------------------------------------------------------------------------
// assessAgainstObjectives: malformed output — schema violation propagates
// ---------------------------------------------------------------------------

test("assessAgainstObjectives: schema-violating model output (bad confidence) — throws", async () => {
  // Characterization: assessAgainstObjectives re-throws errors from
  // generateObjectWithRetry (it does NOT fall back). Schema violation
  // causes generateObject to throw; after MAX_AI_CALL_ATTEMPTS the error
  // propagates up.
  const badCanned = {
    assessments: [
      {
        objective_id: "obj-1",
        result: "pass",
        confidence: 2.0, // violates Zod max(1)
        reasoning: "Over-confident",
        evidence_quotes: [],
      },
    ],
  };

  setCircuitBreakerOverrideForTesting({ allowed: true });
  installMockModel(mockObjectModel([badCanned, badCanned, badCanned])); // 3 tries all fail
  try {
    await assert.rejects(
      () =>
        assessAgainstObjectives(
          "Evidence",
          null,
          [OBJECTIVES[0]],
          "Control",
          "Description",
          LOG_CONTEXT
        ),
      (err: Error) => {
        assert.ok(err instanceof Error, "throws an Error");
        assert.ok(err.message.length > 0, "error has a message");
        return true;
      }
    );
  } finally {
    resetMockModel();
    setCircuitBreakerOverrideForTesting(null);
  }
});

// ---------------------------------------------------------------------------
// Note: basic-assessment.ts and maturity-assessment.ts share all retry
// and circuit-breaker logic through generateObjectWithRetry. Their behavior
// is fully covered by utils.test.ts — duplicating those tests here would
// add noise without coverage gain.
// ---------------------------------------------------------------------------
