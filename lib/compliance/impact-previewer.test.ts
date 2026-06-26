import assert from "node:assert/strict";
import test from "node:test";
import { fakeSupabase } from "@/lib/testing/fake-supabase";
import { previewUploadImpact } from "./impact-previewer";

const TIER_ROWS = [{ domain_id: "IAC", tier: "critical", weight: 1.0 }];

const CATALOG_ROWS = [
  { id: "AC-01", domain_id: "IAC" },
  { id: "AC-02", domain_id: "IAC" },
  { id: "AC-03", domain_id: "IAC" },
];

test("previewUploadImpact: returns framework impact for a single mapped framework", async () => {
  const { client } = fakeSupabase({
    control_gap_analysis: {
      data: [
        { scf_control_id: "AC-01", status: "missing", framework_id: null },
        { scf_control_id: "AC-02", status: "compliant", framework_id: null },
        { scf_control_id: "AC-03", status: "missing", framework_id: null },
      ],
    },
    domain_tier_weights: { data: TIER_ROWS },
    scf_controls: { data: CATALOG_ROWS },
    scf_control_mappings: {
      data: [
        { control_id: "AC-01", framework_id: "fw-soc2" },
        { control_id: "AC-02", framework_id: "fw-soc2" },
      ],
    },
    scf_frameworks: {
      data: [{ id: "fw-soc2", framework_name: "SOC 2" }],
    },
  });

  const preview = await previewUploadImpact(client, "user-1", ["AC-01"]);

  assert.ok(preview);
  assert.equal(preview.currentScore, 33.33);
  assert.equal(preview.projectedScore, 66.67);
  assert.deepEqual(preview.frameworkImpacts, [
    {
      frameworkName: "SOC 2",
      currentScore: 50,
      projectedScore: 100,
      improvementPct: 50,
    },
  ]);
});

test("previewUploadImpact: returns one score per framework for controls mapped to multiple frameworks", async () => {
  const { client } = fakeSupabase({
    control_gap_analysis: {
      data: [
        { scf_control_id: "AC-01", status: "missing", framework_id: null },
        { scf_control_id: "AC-02", status: "compliant", framework_id: null },
        { scf_control_id: "AC-03", status: "partial", framework_id: null },
      ],
    },
    domain_tier_weights: { data: TIER_ROWS },
    scf_controls: { data: CATALOG_ROWS },
    scf_control_mappings: {
      data: [
        { control_id: "AC-01", framework_id: "fw-iso" },
        { control_id: "AC-01", framework_id: "fw-soc2" },
        { control_id: "AC-02", framework_id: "fw-soc2" },
        { control_id: "AC-03", framework_id: "fw-iso" },
      ],
    },
    scf_frameworks: {
      data: [
        { id: "fw-soc2", framework_name: "SOC 2" },
        { id: "fw-iso", framework_name: "ISO 27001" },
      ],
    },
  });

  const preview = await previewUploadImpact(client, "user-2", ["AC-01"]);

  assert.ok(preview);
  assert.deepEqual(preview.frameworkImpacts, [
    {
      frameworkName: "ISO 27001",
      currentScore: 25,
      projectedScore: 75,
      improvementPct: 50,
    },
    {
      frameworkName: "SOC 2",
      currentScore: 50,
      projectedScore: 100,
      improvementPct: 50,
    },
  ]);
});
