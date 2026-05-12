import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { seedERL } from "../../scripts/seed-erl";

type Call = { table: string; method: string; args: unknown[] };

function makeMockSupabase(): { supabase: any; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    supabase: {
      from: (table: string) => ({
        // Writer chains .delete().eq("scf_version", v).is("import_id", null)
        // so .eq must return a chainable that exposes .is.
        delete: () => {
          const chain = {
            eq: (...a: unknown[]) => {
              calls.push({ table, method: "delete.eq", args: a });
              return chain;
            },
            is: (...a: unknown[]) => {
              calls.push({ table, method: "delete.is", args: a });
              return Promise.resolve({ data: null, error: null });
            },
          };
          return chain;
        },
        upsert: (rows: unknown, opts?: unknown) => {
          calls.push({ table, method: "upsert", args: [rows, opts] });
          return Promise.resolve({ data: null, error: null });
        },
      }),
    },
  };
}

const FIXTURE_CSV = `#,ERL #,Area of Focus,Documentation Artifact,Artifact Description,SCF Control Mappings,"Relevant\\nCMMC 2.0 L2 Control"
1,E-GOV-01,Cybersecurity & Data Protection Management,Charter - Cybersecurity Program,Documented evidence of a charter.,GOV-01,
2,E-GOV-02,Cybersecurity & Data Protection Management,Policy - Information Security,Documented evidence of a policy.,"GOV-02, GOV-03",AC.L2-3.1.1
3,E-ACC-01,Access Control,Access Control Procedures,Documented evidence of procedures.,ACC-01 ACC-02 ACC-03,
4,E-ACC-02,Access Control,Account Provisioning Logs,Documented evidence of logs.,ACC-04,
5,E-AST-01,Asset Management,Asset Inventory,Documented evidence of inventory.,AST-01,
`;

test("seedERL upserts every ERL row with control mappings parsed into text[]", async () => {
  const dir = await mkdtemp(join(tmpdir(), "seed-erl-"));
  try {
    const csvPath = join(dir, "evidence-request-list.csv");
    await writeFile(csvPath, FIXTURE_CSV, "utf8");

    const { supabase, calls } = makeMockSupabase();
    const result = await seedERL(supabase, csvPath);

    assert.equal(result.inserted, 5);

    const upsertCall = calls.find(
      (c) => c.table === "scf_evidence_request_list" && c.method === "upsert"
    );
    assert.ok(upsertCall, "upsert call must exist");
    const rows = upsertCall!.args[0] as Array<Record<string, unknown>>;
    assert.equal(rows.length, 5);
    assert.equal(rows[0].erl_id, "E-GOV-01");
    assert.deepEqual(rows[0].scf_control_mappings, ["GOV-01"]);
    assert.deepEqual(rows[1].scf_control_mappings, ["GOV-02", "GOV-03"]);
    assert.deepEqual(rows[2].scf_control_mappings, ["ACC-01", "ACC-02", "ACC-03"]);
    assert.equal(rows[0].area_of_focus, "Cybersecurity & Data Protection Management");
    assert.equal(rows[0].documentation_artifact, "Charter - Cybersecurity Program");
    assert.equal(rows[0].scf_version, "2026.1.1");

    const opts = upsertCall!.args[1] as { onConflict: string };
    assert.equal(opts.onConflict, "erl_id,import_id");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
