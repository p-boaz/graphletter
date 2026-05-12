import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { seedAssessmentObjectives } from "../../scripts/seed-assessment-objectives";

type Call = { table: string; method: string; args: unknown[] };

function makeMockSupabase(): { supabase: any; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    supabase: {
      from: (table: string) => ({
        delete: () => {
          const chain: any = {
            eq: (...a: unknown[]) => {
              calls.push({ table, method: "delete.eq", args: a });
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

const FIXTURE_CSV = `SCF #,SCF AO #,"SCF Assessment Objective (AO)","PPTDF Applicability","SCF AO Origin(s)","Notes / Errata","Assessment"
GOV-01,AO-GOV-01.1,Determine if the organization establishes a governance program.,P;T,SCF Baseline,,
GOV-01,AO-GOV-01.2,Determine if the program is documented.,P;D,NIST 800-53 R5,,
ACC-01,AO-ACC-01.1,Determine if logical access is restricted.,T,DHS ZTCF,,
`;

test("seedAssessmentObjectives upserts every AO row with FK + origin field", async () => {
  const dir = await mkdtemp(join(tmpdir(), "seed-ao-"));
  try {
    const csvPath = join(dir, "Assessment_objectives.csv");
    await writeFile(csvPath, FIXTURE_CSV, "utf8");

    const { supabase, calls } = makeMockSupabase();
    const summary = await seedAssessmentObjectives(supabase, csvPath);

    assert.equal(summary.inserted, 3);

    const upsert = calls.find(
      (c) => c.table === "scf_assessment_objectives" && c.method === "upsert"
    );
    assert.ok(upsert, "upsert call must exist");
    const rows = upsert!.args[0] as Array<Record<string, unknown>>;
    assert.equal(rows.length, 3);
    assert.equal(rows[0].scf_control_id, "GOV-01");
    assert.equal(rows[0].scf_ao_id, "AO-GOV-01.1");
    assert.equal(
      rows[0].assessment_objective,
      "Determine if the organization establishes a governance program."
    );
    assert.equal(rows[0].origin, "SCF Baseline");
    assert.equal(rows[0].scf_version, "2026.1.1");

    const opts = upsert!.args[1] as { onConflict: string };
    assert.equal(opts.onConflict, "scf_ao_id");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
