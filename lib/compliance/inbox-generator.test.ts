import assert from "node:assert/strict";
import test from "node:test";
import { fakeSupabase, type TableHandler } from "@/lib/testing/fake-supabase";
import { generateInbox, invalidateInboxCache } from "./inbox-generator";

// generateInbox caches per userId for 5 minutes at module level — every test
// uses a unique userId so tests stay independent.
let userSeq = 0;
function nextUser(): string {
  userSeq += 1;
  return `inbox-user-${userSeq}`;
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

const CATALOG: TableHandler = {
  data: [
    { id: "AC-01", title: "Access control policy", domain_id: "IAC" },
    { id: "AC-02", title: "Privileged access", domain_id: "IAC" },
    { id: "AC-03", title: "Account management", domain_id: "IAC" },
  ],
};

test("generateInbox: gap data alone yields missing/partial items and a posture summary", async () => {
  // evidence + ERL tables are unhandled → freshness scans empty and ERL
  // resolution throws (both degraded paths the generator handles).
  const { client } = fakeSupabase({
    control_gap_analysis: {
      data: [
        { scf_control_id: "AC-01", status: "missing" },
        { scf_control_id: "AC-02", status: "missing" },
        { scf_control_id: "AC-03", status: "partial" },
      ],
    },
    scf_controls: CATALOG,
    domain_tier_weights: { data: [] },
  });

  const result = await generateInbox(client, nextUser());

  assert.deepEqual(
    result.items.map((i) => i.type),
    ["missing_control", "missing_control", "partial_control"]
  );
  assert.deepEqual(
    result.items.map((i) => i.priority),
    ["high", "high", "low"]
  );
  assert.equal(result.items[0].title, "Missing: AC-01 — Access control policy");
  assert.equal(result.items[0].actionLabel, "Upload Evidence");
  assert.deepEqual(result.items[0].context?.controlIds, ["AC-01"]);
  assert.equal(result.items[2].title, "Strengthen: AC-03 — Account management");
  assert.equal(result.totalItems, 3);

  // Posture computes from the same gap data (weight fallback path)
  assert.ok(result.postureSummary);
  assert.equal(typeof result.postureSummary.score, "number");
  assert.equal(result.postureSummary.trend, "stable");
  assert.equal(result.postureSummary.lastChange, 0);
});

test("generateInbox: stale and expiring evidence become critical/high items", async () => {
  const { client } = fakeSupabase({
    evidence: {
      data: [
        {
          id: "ev-stale",
          file_name: "old-policy.pdf",
          evidence_type: "policy",
          scf_control_id: "AC-01",
          submitted_at: daysFromNow(-400),
          evidence_status: "approved",
        },
        {
          id: "ev-expiring",
          file_name: "soc2-report.pdf",
          evidence_type: "report",
          scf_control_id: "AC-02",
          submitted_at: daysFromNow(-100),
          evidence_status: "approved",
        },
      ],
    },
    evidence_freshness_rules: { data: [] },
    evidence_expiry_overrides: {
      data: [
        { evidence_id: "ev-stale", expires_at: daysFromNow(-5) },
        { evidence_id: "ev-expiring", expires_at: daysFromNow(10) },
      ],
    },
    // No gap rows → no gap items, no posture
    control_gap_analysis: { data: [] },
    domain_tier_weights: { data: [] },
  });

  const result = await generateInbox(client, nextUser());

  assert.equal(result.items.length, 2);
  const [stale, expiring] = result.items;
  assert.equal(stale.type, "stale_evidence");
  assert.equal(stale.priority, "critical");
  assert.equal(stale.title, "Expired: old-policy.pdf");
  assert.equal(stale.metadata.daysExpired, 5);
  assert.equal(expiring.type, "expiring_evidence");
  assert.equal(expiring.priority, "high");
  assert.equal(expiring.title, "Expiring in 10d: soc2-report.pdf");
  assert.equal(result.postureSummary, undefined);
});

test("generateInbox: missing items cap at 10, partial at 5", async () => {
  const gaps = [
    ...Array.from({ length: 12 }, (_, i) => ({
      scf_control_id: `MISS-${String(i + 1).padStart(2, "0")}`,
      status: "missing",
    })),
    ...Array.from({ length: 7 }, (_, i) => ({
      scf_control_id: `PART-${String(i + 1).padStart(2, "0")}`,
      status: "partial",
    })),
  ];

  const { client } = fakeSupabase({
    control_gap_analysis: { data: gaps },
    scf_controls: { data: [] },
    domain_tier_weights: { data: [] },
    // ERL mapping lookup succeeds but matches nothing → no leverage items
    scf_control_evidence_mappings: { data: [] },
  });

  const result = await generateInbox(client, nextUser());
  const byType = (type: string) => result.items.filter((i) => i.type === type);
  assert.equal(byType("missing_control").length, 10);
  assert.equal(byType("partial_control").length, 5);
});

test("generateInbox: ERL resolution produces ranked medium-priority upload items", async () => {
  const { client } = fakeSupabase({
    control_gap_analysis: {
      data: [
        { scf_control_id: "AC-01", status: "missing" },
        { scf_control_id: "AC-02", status: "missing" },
      ],
    },
    scf_controls: CATALOG,
    domain_tier_weights: { data: [] },
    scf_control_evidence_mappings: {
      data: [
        { scf_control_id: "AC-01", evidence_request_id: "row-1" },
        { scf_control_id: "AC-02", evidence_request_id: "row-1" },
        { scf_control_id: "AC-01", evidence_request_id: "row-2" },
      ],
    },
    scf_evidence_request_list: {
      data: [
        {
          id: "row-1",
          erl_id: "ERL-01",
          documentation_artifact: "Access Control Policy",
          artifact_description: "The policy document.",
          area_of_focus: "IAM",
        },
        {
          id: "row-2",
          erl_id: "ERL-02",
          documentation_artifact: "Account Review Records",
          artifact_description: null,
          area_of_focus: "IAM",
        },
      ],
    },
  });

  const result = await generateInbox(client, nextUser());
  const leverage = result.items.filter((i) => i.type === "high_leverage_upload");

  assert.equal(leverage.length, 2);
  // Ranked by overlap descending: ERL-01 covers 2 controls
  assert.equal(leverage[0].id, "leverage-ERL-01");
  assert.equal(leverage[0].priority, "medium");
  assert.equal(leverage[0].title, "Upload: Access Control Policy");
  assert.ok(leverage[0].description.startsWith("Covers 2 missing controls."));
  assert.deepEqual(leverage[0].context?.controlIds, ["AC-01", "AC-02"]);
  assert.equal(leverage[1].id, "leverage-ERL-02");
  assert.ok(leverage[1].description.startsWith("Covers 1 missing control."));

  // Sort characterization: high (missing) before medium (leverage)
  const priorities = result.items.map((i) => i.priority);
  assert.deepEqual(priorities, ["high", "high", "medium", "medium"]);
});

test("generateInbox: result is cached per user until invalidated", async () => {
  const userId = nextUser();
  let gapFetches = 0;
  const { client } = fakeSupabase({
    control_gap_analysis: (chain) => {
      if (chain.some((c) => c.method === "range")) gapFetches += 1;
      return { data: [{ scf_control_id: "AC-01", status: "missing" }] };
    },
    scf_controls: CATALOG,
    domain_tier_weights: { data: [] },
    scf_control_evidence_mappings: { data: [] },
  });

  const first = await generateInbox(client, userId);
  const second = await generateInbox(client, userId);
  assert.equal(second, first);
  assert.equal(gapFetches, 1);

  invalidateInboxCache(userId);
  const third = await generateInbox(client, userId);
  assert.notEqual(third, first);
  assert.equal(gapFetches, 2);
});

test("generateInbox: items sort by priority then title within a priority", async () => {
  const { client } = fakeSupabase({
    evidence: {
      data: [
        {
          id: "ev-1",
          file_name: "zzz-last.pdf",
          evidence_type: "policy",
          scf_control_id: "AC-01",
          submitted_at: daysFromNow(-100),
          evidence_status: "approved",
        },
      ],
    },
    evidence_freshness_rules: { data: [] },
    evidence_expiry_overrides: {
      data: [{ evidence_id: "ev-1", expires_at: daysFromNow(10) }],
    },
    control_gap_analysis: {
      data: [
        { scf_control_id: "AC-02", status: "missing" },
        { scf_control_id: "AC-01", status: "missing" },
      ],
    },
    scf_controls: { data: [] },
    domain_tier_weights: { data: [] },
    scf_control_evidence_mappings: { data: [] },
  });

  const result = await generateInbox(client, nextUser());

  // All three are "high"; expiring item ("Expiring in…") sorts before
  // "Missing: AC-01" alphabetically, and AC-01 before AC-02.
  assert.deepEqual(
    result.items.map((i) => i.title),
    ["Expiring in 10d: zzz-last.pdf", "Missing: AC-01", "Missing: AC-02"]
  );
});
