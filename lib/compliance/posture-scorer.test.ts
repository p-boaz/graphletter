import assert from "node:assert/strict";
import test from "node:test";
import { fakeSupabase, queriesFor, chainArg } from "@/lib/testing/fake-supabase";
import { calculatePostureScore, savePostureSnapshot, getPostureHistory } from "./posture-scorer";

const TIER_ROWS = [
  { domain_id: "IAC", tier: "critical", weight: 2.0 },
  { domain_id: "GOV", tier: "standard", weight: 1.0 },
];

const CATALOG_ROWS = [
  { id: "IAC-01", domain_id: "IAC", scf_domains: { name: "Identity & Access" } },
  { id: "IAC-02", domain_id: "IAC", scf_domains: { name: "Identity & Access" } },
  { id: "GOV-01", domain_id: "GOV", scf_domains: [{ name: "Governance" }] },
  { id: "GOV-02", domain_id: "GOV", scf_domains: { name: "Governance" } },
];

test("calculatePostureScore: weighted multi-domain scoring with exact rounding", async () => {
  const { client } = fakeSupabase({
    domain_tier_weights: { data: TIER_ROWS },
    control_gap_analysis: {
      data: [
        // IAC: 1 compliant, 1 partial → raw 0.75
        { scf_control_id: "IAC-01", status: "compliant" },
        { scf_control_id: "IAC-02", status: "partial" },
        // GOV: 1 compliant, 1 missing → raw 0.5
        { scf_control_id: "GOV-01", status: "compliant" },
        { scf_control_id: "GOV-02", status: "missing" },
      ],
    },
    scf_controls: { data: CATALOG_ROWS },
  });

  const score = await calculatePostureScore(client, "user-1");
  assert.ok(score);

  // Weighted average: (0.75*2 + 0.5*1) / (2+1) = 2/3 → 66.67
  assert.equal(score.overallScore, 66.67);
  assert.equal(score.totalControls, 4);
  assert.equal(score.compliantControls, 2);
  assert.equal(score.partialControls, 1);
  assert.equal(score.missingControls, 1);
  assert.equal(score.conflictingControls, 0);
  assert.equal(score.weightFallback, false);
  assert.equal(score.frameworkId, null);

  // Critical tier sorts first regardless of rawScore
  assert.deepEqual(
    score.domains.map((d) => d.domainId),
    ["IAC", "GOV"]
  );
  const [iac, gov] = score.domains;
  assert.equal(iac.tier, "critical");
  assert.equal(iac.rawScore, 75);
  assert.equal(iac.weightedScore, 1.5);
  assert.equal(iac.domainName, "Identity & Access");
  assert.equal(gov.rawScore, 50);
  assert.equal(gov.weightedScore, 0.5);
  // Array-shaped scf_domains joins are normalized to the first entry
  assert.equal(gov.domainName, "Governance");
});

test("calculatePostureScore: empty tier table falls back to equal weights", async () => {
  const { client } = fakeSupabase({
    domain_tier_weights: { data: [] },
    control_gap_analysis: {
      data: [
        { scf_control_id: "IAC-01", status: "compliant" },
        { scf_control_id: "GOV-01", status: "missing" },
      ],
    },
    scf_controls: { data: CATALOG_ROWS },
  });

  const score = await calculatePostureScore(client, "user-2");
  assert.ok(score);
  assert.equal(score.weightFallback, true);
  for (const domain of score.domains) {
    assert.equal(domain.weight, 1.0);
    assert.equal(domain.tier, "standard");
  }
  // Equal weights: (1.0 + 0.0) / 2 = 50
  assert.equal(score.overallScore, 50);
  // Tie on tier → ascending rawScore (worst first)
  assert.deepEqual(
    score.domains.map((d) => d.rawScore),
    [0, 100]
  );
});

test("calculatePostureScore: tier query error also falls back", async () => {
  const { client } = fakeSupabase({
    domain_tier_weights: { data: null, error: { message: "boom" } },
    control_gap_analysis: {
      data: [{ scf_control_id: "IAC-01", status: "compliant" }],
    },
    scf_controls: { data: CATALOG_ROWS },
  });

  const score = await calculatePostureScore(client, "user-3");
  assert.ok(score);
  assert.equal(score.weightFallback, true);
});

test("calculatePostureScore: gap query error returns null", async () => {
  const { client } = fakeSupabase({
    domain_tier_weights: { data: TIER_ROWS },
    control_gap_analysis: { data: null, error: { message: "db down" } },
  });

  assert.equal(await calculatePostureScore(client, "user-4"), null);
});

test("calculatePostureScore: zero gap rows returns null", async () => {
  const { client } = fakeSupabase({
    domain_tier_weights: { data: TIER_ROWS },
    control_gap_analysis: { data: [] },
  });

  assert.equal(await calculatePostureScore(client, "user-5"), null);
});

test("calculatePostureScore: controls missing from the catalog bucket under Unknown", async () => {
  const { client } = fakeSupabase({
    domain_tier_weights: { data: TIER_ROWS },
    control_gap_analysis: {
      data: [{ scf_control_id: "GHOST-01", status: "compliant" }],
    },
    scf_controls: { data: [] },
  });

  const score = await calculatePostureScore(client, "user-6");
  assert.ok(score);
  assert.equal(score.domains.length, 1);
  assert.equal(score.domains[0].domainId, "Unknown");
  assert.equal(score.domains[0].domainName, "Unknown");
});

test("savePostureSnapshot: insert payload carries score fields and metadata", async () => {
  const { client, queries } = fakeSupabase({
    compliance_snapshots: { data: null },
  });

  await savePostureSnapshot(client, "user-7", {
    overallScore: 66.67,
    totalControls: 4,
    compliantControls: 2,
    partialControls: 1,
    missingControls: 1,
    conflictingControls: 0,
    domains: [],
    frameworkId: "fw-1",
    calculatedAt: "2026-06-12T00:00:00.000Z",
    weightFallback: true,
  });

  const [insertQuery] = queriesFor(queries, "compliance_snapshots");
  assert.ok(insertQuery);
  const payload = chainArg(insertQuery, "insert") as Record<string, unknown>;
  assert.equal(payload.user_id, "user-7");
  assert.equal(payload.framework_id, "fw-1");
  assert.equal(payload.score, 66.67);
  assert.equal(payload.total_controls, 4);
  assert.deepEqual(payload.metadata, {
    weight_fallback: true,
    conflicting_controls: 0,
  });
});

test("getPostureHistory: maps rows with Number coercion; error returns []", async () => {
  const { client } = fakeSupabase({
    compliance_snapshots: {
      data: [
        {
          score: "72.5",
          created_at: "2026-06-01T00:00:00.000Z",
          total_controls: 10,
          compliant_controls: 7,
        },
      ],
    },
  });

  const history = await getPostureHistory(client, "user-8");
  assert.deepEqual(history, [
    {
      score: 72.5,
      createdAt: "2026-06-01T00:00:00.000Z",
      totalControls: 10,
      compliantControls: 7,
    },
  ]);

  const { client: errClient } = fakeSupabase({
    compliance_snapshots: { data: null, error: { message: "boom" } },
  });
  assert.deepEqual(await getPostureHistory(errClient, "user-8"), []);
});
