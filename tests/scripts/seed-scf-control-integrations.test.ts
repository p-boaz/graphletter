import test from "node:test";
import assert from "node:assert/strict";
import { seedScfControlIntegrations } from "../../scripts/seed-scf-control-integrations";

type Call = { table: string; method: string; args: unknown[] };

function makeMockSupabase(opts: { controlIds: string[] }): { supabase: any; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    supabase: {
      from: (table: string) => {
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
        if (table === "scf_control_integrations") {
          return {
            upsert: (rows: unknown, options: unknown) => {
              calls.push({ table, method: "upsert", args: [rows, options] });
              return Promise.resolve({ data: null, error: null });
            },
          };
        }
        throw new Error(`unexpected table: ${table}`);
      },
    },
  };
}

test("seedScfControlIntegrations inserts all 4 fixtures when controls exist", async () => {
  const { supabase, calls } = makeMockSupabase({ controlIds: ["AAT-02", "ACC-22", "CFG-02"] });

  const summary = await seedScfControlIntegrations(supabase);
  assert.equal(summary.inserted, 4);
  assert.equal(summary.skipped, 0);

  const upsert = calls.find((c) => c.table === "scf_control_integrations" && c.method === "upsert");
  assert.ok(upsert, "upsert call must exist");
  const rows = upsert!.args[0] as Array<Record<string, unknown>>;
  assert.equal(rows.length, 4);

  const ids = rows.map((r) => r.id).sort();
  assert.deepEqual(ids, [
    "a0000000-0000-4000-8000-000000000001",
    "a0000000-0000-4000-8000-000000000002",
    "a0000000-0000-4000-8000-000000000003",
    "a0000000-0000-4000-8000-000000000004",
  ]);

  const controls = rows.map((r) => r.scf_control_id).sort();
  assert.deepEqual(controls, ["AAT-02", "AAT-02", "ACC-22", "CFG-02"]);

  const options = upsert!.args[1] as { onConflict?: string };
  assert.equal(options.onConflict, "id");
});

test("seedScfControlIntegrations skips rows whose control_id is missing", async () => {
  // Only AAT-02 exists — the ACC-22 and CFG-02 rows should be skipped.
  const { supabase, calls } = makeMockSupabase({ controlIds: ["AAT-02"] });

  const summary = await seedScfControlIntegrations(supabase);
  assert.equal(summary.inserted, 2); // both AAT-02 fixtures
  assert.equal(summary.skipped, 2); // ACC-22 + CFG-02 fixtures

  const upsert = calls.find((c) => c.table === "scf_control_integrations" && c.method === "upsert");
  assert.ok(upsert, "upsert call must exist");
  const rows = upsert!.args[0] as Array<Record<string, unknown>>;
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.scf_control_id === "AAT-02"));
});

test("seedScfControlIntegrations skips upsert entirely when no controls match", async () => {
  const { supabase, calls } = makeMockSupabase({ controlIds: [] });

  const summary = await seedScfControlIntegrations(supabase);
  assert.equal(summary.inserted, 0);
  assert.equal(summary.skipped, 4);

  const upsert = calls.find((c) => c.table === "scf_control_integrations" && c.method === "upsert");
  assert.equal(upsert, undefined, "upsert must not be called when there are 0 rows");
});
