import test from "node:test";
import assert from "node:assert/strict";
import { seedControlEvidenceMappings } from "../../scripts/seed-control-evidence-mappings";

type Call = { table: string; method: string; args: unknown[] };

function makeMockSupabase(opts: {
  erlRows: Array<{ id: string; scf_control_mappings: string[] }>;
  controlIds: string[];
}): { supabase: any; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    supabase: {
      from: (table: string) => {
        if (table === "scf_evidence_request_list") {
          return {
            select: (...a: unknown[]) => {
              calls.push({ table, method: "select", args: a });
              return Promise.resolve({ data: opts.erlRows, error: null });
            },
          };
        }
        if (table === "scf_controls") {
          return {
            select: (...a: unknown[]) => {
              calls.push({ table, method: "select", args: a });
              return Promise.resolve({
                data: opts.controlIds.map((id) => ({ id })),
                error: null,
              });
            },
          };
        }
        if (table === "scf_control_evidence_mappings") {
          return {
            delete: () => ({
              neq: (...a: unknown[]) => {
                calls.push({ table, method: "delete.neq", args: a });
                return Promise.resolve({ data: null, error: null });
              },
            }),
            insert: (rows: unknown) => {
              calls.push({ table, method: "insert", args: [rows] });
              return Promise.resolve({ data: null, error: null });
            },
          };
        }
        throw new Error(`unexpected table: ${table}`);
      },
    },
  };
}

test("seedControlEvidenceMappings emits one row per (ERL × valid control) pair", async () => {
  const { supabase, calls } = makeMockSupabase({
    erlRows: [
      { id: "e1", scf_control_mappings: ["GOV-01", "GOV-02"] },
      { id: "e2", scf_control_mappings: ["ACC-01"] },
      { id: "e3", scf_control_mappings: ["DELETED-01"] }, // skipped: control not in DB
    ],
    controlIds: ["GOV-01", "GOV-02", "ACC-01"],
  });

  const summary = await seedControlEvidenceMappings(supabase);
  assert.equal(summary.inserted, 3); // GOV-01+e1, GOV-02+e1, ACC-01+e2

  const insert = calls.find(
    (c) => c.table === "scf_control_evidence_mappings" && c.method === "insert"
  );
  assert.ok(insert, "insert call must exist");
  const rows = insert!.args[0] as Array<Record<string, unknown>>;
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => `${r.scf_control_id}|${r.evidence_request_id}`).sort(), [
    "ACC-01|e2",
    "GOV-01|e1",
    "GOV-02|e1",
  ]);
  assert.equal(rows[0].is_active, true);
});
