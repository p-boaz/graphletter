// tests/scripts/check-scf-deletion-safety.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { checkDeletionSafety } from "../../scripts/check-scf-deletion-safety";
import type { VersionDiff } from "../../scripts/diff-scf-versions";

// Simulates information_schema.referential_constraints output: which tables
// reference which SCF table, on which column, with which delete rule.
const fkMetadata = [
  // CASCADE FK: customer evidence rows would be destroyed if SCF control deleted.
  {
    referring_table: "evidence_control_map",
    referring_column: "scf_control_id",
    referenced_table: "scf_controls",
    referenced_column: "id",
    delete_rule: "CASCADE",
  },
  // SET NULL FK: child row survives but loses the link.
  {
    referring_table: "ai_assessment_runs",
    referring_column: "scf_control_id",
    referenced_table: "scf_controls",
    referenced_column: "id",
    delete_rule: "SET NULL",
  },
  // NO ACTION FK: delete will be blocked by Postgres if rows exist.
  {
    referring_table: "scf_control_integrations",
    referring_column: "scf_control_id",
    referenced_table: "scf_controls",
    referenced_column: "id",
    delete_rule: "NO ACTION",
  },
];

function makeMockSupabase(rowCounts: Record<string, Record<string, number>>): any {
  return {
    rpc: (_fn: string, _args: unknown) => Promise.resolve({ data: fkMetadata, error: null }),
    from: (table: string) => ({
      select: (_cols: string, _opts: unknown) => ({
        eq: (_col: string, val: string) => {
          const count = rowCounts[table]?.[val] ?? 0;
          return Promise.resolve({ count, data: null, error: null });
        },
      }),
    }),
  };
}

const diff: VersionDiff = {
  missingFiles: [],
  tables: {
    scf_controls: {
      added: [],
      removed: ["ACC-22", "OBS-01"],
      changed: [],
      unchanged: [],
    },
    scf_authoritative_sources: { added: [], removed: [], changed: [], unchanged: [] },
    scf_domains: { added: [], removed: [], changed: [], unchanged: [] },
    scf_evidence_request_list: { added: [], removed: [], changed: [], unchanged: [] },
    scf_assessment_objectives: { added: [], removed: [], changed: [], unchanged: [] },
    scf_risks: { added: [], removed: [], changed: [], unchanged: [] },
    scf_threats: { added: [], removed: [], changed: [], unchanged: [] },
  },
};

test("checkDeletionSafety flags removed IDs with CASCADE FK row references as requires-decision", async () => {
  const supabase = makeMockSupabase({
    evidence_control_map: { "ACC-22": 3, "OBS-01": 0 },
    ai_assessment_runs: { "ACC-22": 0, "OBS-01": 0 },
    scf_control_integrations: { "ACC-22": 0, "OBS-01": 0 },
  });

  const report = await checkDeletionSafety(supabase, diff);

  const acc22 = report.removed.find((r) => r.id === "ACC-22")!;
  assert.equal(acc22.classification, "requires-decision");
  assert.equal(acc22.inboundReferences.length, 1);
  assert.equal(acc22.inboundReferences[0].referringTable, "evidence_control_map");
  assert.equal(acc22.inboundReferences[0].rowCount, 3);
  assert.equal(acc22.inboundReferences[0].deleteRule, "CASCADE");

  const obs01 = report.removed.find((r) => r.id === "OBS-01")!;
  assert.equal(obs01.classification, "safe-to-delete");
  assert.equal(obs01.inboundReferences.length, 0);
});

test("checkDeletionSafety flags NO ACTION FK with rows as requires-decision even if not cascade", async () => {
  const supabase = makeMockSupabase({
    evidence_control_map: { "ACC-22": 0, "OBS-01": 0 },
    ai_assessment_runs: { "ACC-22": 0, "OBS-01": 0 },
    scf_control_integrations: { "ACC-22": 1, "OBS-01": 0 },
  });

  const report = await checkDeletionSafety(supabase, diff);
  const acc22 = report.removed.find((r) => r.id === "ACC-22")!;
  assert.equal(acc22.classification, "requires-decision");
  assert.equal(acc22.inboundReferences[0].referringTable, "scf_control_integrations");
});

test("checkDeletionSafety treats SET NULL FK with rows as advisory (still safe-to-delete)", async () => {
  // SET NULL: data isn't destroyed, link is severed. Mark as safe but
  // surface in the report so the operator knows orphans will appear.
  const supabase = makeMockSupabase({
    evidence_control_map: { "ACC-22": 0, "OBS-01": 0 },
    ai_assessment_runs: { "ACC-22": 5, "OBS-01": 0 },
    scf_control_integrations: { "ACC-22": 0, "OBS-01": 0 },
  });

  const report = await checkDeletionSafety(supabase, diff);
  const acc22 = report.removed.find((r) => r.id === "ACC-22")!;
  assert.equal(acc22.classification, "safe-with-orphans");
  assert.equal(acc22.inboundReferences[0].deleteRule, "SET NULL");
  assert.equal(acc22.inboundReferences[0].rowCount, 5);
});
