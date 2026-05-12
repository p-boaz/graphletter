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

// ── Mock types ────────────────────────────────────────────────────────────────
//
// Narrow inline interfaces that capture the exact builder chain the
// implementation uses:  from(table).select(col).in(col, ids).range(lo, hi)
//
// If checkDeletionSafety ever calls a method that isn't listed here,
// TypeScript will surface it at compile time — you'll see "Property X does
// not exist on type MockInBuilder" rather than a silent runtime TypeError.

interface MockRangeResult {
  data: Record<string, unknown>[] | null;
  error: { message: string } | null;
}

interface MockInBuilder {
  range: (lo: number, hi: number) => Promise<MockRangeResult>;
}

interface MockSelectBuilder {
  in: (col: string, ids: string[]) => MockInBuilder;
}

interface MockFromBuilder {
  select: (col: string) => MockSelectBuilder;
}

interface MockSupabase {
  rpc: (fn: string, args: unknown) => Promise<{ data: unknown; error: { message: string } | null }>;
  from: (table: string) => MockFromBuilder;
}

/**
 * Build a mock Supabase client that:
 *  - returns fkMetadata from rpc()
 *  - supports from(table).select(col).in(col, ids).range(lo, hi)
 *    → returns the slice [lo..hi] of the synthetic row list built from rowCounts
 *
 * rowCounts: { tableName: { id: count } }  — count is the number of rows to
 * simulate as pointing at that id.
 *
 * callLog is populated with each { table, ids } call so tests can assert on
 * the number of round-trips per FK table.
 */
function makeMockSupabase(
  rowCounts: Record<string, Record<string, number>>,
  callLog?: Array<{ table: string; ids: string[] }>
): MockSupabase {
  return {
    rpc: (_fn: string, _args: unknown) => Promise.resolve({ data: fkMetadata, error: null }),
    from: (table: string): MockFromBuilder => ({
      select: (col: string): MockSelectBuilder => ({
        in: (_filterCol: string, ids: string[]): MockInBuilder => {
          if (callLog) callLog.push({ table, ids: [...ids] });
          // Build the full synthetic row list for the requested IDs.
          const allRows: Record<string, unknown>[] = [];
          for (const id of ids) {
            const count = rowCounts[table]?.[id] ?? 0;
            for (let i = 0; i < count; i++) {
              allRows.push({ [col]: id });
            }
          }
          return {
            range: (lo: number, hi: number): Promise<MockRangeResult> => {
              // Return the requested page slice so the pagination loop in the
              // implementation terminates correctly.
              const page = allRows.slice(lo, hi + 1);
              return Promise.resolve({ data: page, error: null });
            },
          };
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

  const report = await checkDeletionSafety(supabase as never, diff);

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

  const report = await checkDeletionSafety(supabase as never, diff);
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

  const report = await checkDeletionSafety(supabase as never, diff);
  const acc22 = report.removed.find((r) => r.id === "ACC-22")!;
  assert.equal(acc22.classification, "safe-with-orphans");
  assert.equal(acc22.inboundReferences[0].deleteRule, "SET NULL");
  assert.equal(acc22.inboundReferences[0].rowCount, 5);
});

// ── N+1 query elimination ────────────────────────────────────────────────────

const diffMany: VersionDiff = {
  missingFiles: [],
  tables: {
    scf_controls: {
      added: [],
      removed: ["A-01", "A-02", "A-03", "A-04", "A-05"],
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

test("checkDeletionSafety issues at most one query per FK table regardless of removed-ID count", async () => {
  const callLog: Array<{ table: string; ids: string[] }> = [];
  const supabase = makeMockSupabase(
    {
      evidence_control_map: { "A-01": 1 },
      ai_assessment_runs: {},
      scf_control_integrations: {},
    },
    callLog
  );

  await checkDeletionSafety(supabase as never, diffMany);

  // There are 3 FK tables and 5 removed IDs.  Without batching the old code
  // would issue 5 × 3 = 15 calls.  After the fix it must issue ≤ 3 calls
  // (one per FK table, chunked only if removedIds.length > 1000).
  const evidenceCalls = callLog.filter((c) => c.table === "evidence_control_map");
  const assessmentCalls = callLog.filter((c) => c.table === "ai_assessment_runs");
  const integrationCalls = callLog.filter((c) => c.table === "scf_control_integrations");

  assert.equal(evidenceCalls.length, 1, "evidence_control_map must be queried exactly once");
  assert.equal(assessmentCalls.length, 1, "ai_assessment_runs must be queried exactly once");
  assert.equal(integrationCalls.length, 1, "scf_control_integrations must be queried exactly once");

  // The single call must pass ALL removed IDs, not just one.
  assert.deepEqual(
    evidenceCalls[0].ids.sort(),
    ["A-01", "A-02", "A-03", "A-04", "A-05"],
    "batch call must include all removed IDs"
  );

  // Correctness: A-01 has 1 evidence row → requires-decision.
  const a01 = (await checkDeletionSafety(supabase as never, diffMany)).removed.find(
    (r) => r.id === "A-01"
  )!;
  assert.equal(a01.classification, "requires-decision");
});

test("checkDeletionSafety correctly tallies large row sets (pagination correctness)", async () => {
  // Simulate a FK table where ACC-22 has 1500 referring rows and OBS-01 has
  // 700. The batched .in() call must be paginated so no count is silently
  // capped at 1000 (PostgREST default page size).
  //
  // The mock always returns the full synthetic row list in one shot, but the
  // implementation must handle multi-page responses gracefully. This test
  // validates that the final tallied rowCount equals the full simulated count.
  const largeDiff: VersionDiff = {
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

  const supabase = makeMockSupabase({
    evidence_control_map: { "ACC-22": 1500, "OBS-01": 700 },
    ai_assessment_runs: {},
    scf_control_integrations: {},
  });

  const report = await checkDeletionSafety(supabase as never, largeDiff);

  const acc22 = report.removed.find((r) => r.id === "ACC-22")!;
  const obs01 = report.removed.find((r) => r.id === "OBS-01")!;

  assert.equal(acc22.inboundReferences[0].rowCount, 1500, "must not cap count at 1000");
  assert.equal(acc22.classification, "requires-decision");
  assert.equal(obs01.inboundReferences[0].rowCount, 700);
  assert.equal(obs01.classification, "requires-decision"); // CASCADE + 700 rows
});
