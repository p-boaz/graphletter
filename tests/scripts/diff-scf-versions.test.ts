import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { diffSCFVersions } from "../../scripts/diff-scf-versions";

// Fixture CSVs simulate 2026.1.1 canonical extracts. The mocked supabase
// returns 2025.1.1 rows. Diff = (CSV rows) minus (DB rows), classified
// per id presence + per-column delta.

function makeMockSupabase(prodRows: Record<string, Array<Record<string, unknown>>>): any {
  return {
    from: (table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: string) =>
          Promise.resolve({ data: prodRows[table] ?? [], error: null }),
      }),
    }),
  };
}

test("diffSCFVersions classifies added/removed/changed ids per table", async () => {
  const csvDir = mkdtempSync(join(tmpdir(), "diff-scf-"));

  // 2026.1.1 fixture: 3 controls. ACC-01 unchanged, ACC-02 title changed,
  // CHG-04 is net-new. Old ACC-22 is missing (removed).
  writeFileSync(
    join(csvDir, "controls.csv"),
    [
      "SCF #,SCF Control,Description",
      "ACC-01,Access Control,Original description",
      "ACC-02,New Title,Same description",
      "CHG-04,Access Restriction For Change,Net-new in 2026.1.1",
    ].join("\n")
  );

  const supabase = makeMockSupabase({
    scf_controls: [
      { id: "ACC-01", title: "Access Control", description: "Original description" },
      { id: "ACC-02", title: "Old Title", description: "Same description" },
      { id: "ACC-22", title: "Removed", description: "Removed in 2026.1.1" },
    ],
  });

  const diff = await diffSCFVersions(supabase, csvDir, "2025.1.1", "2026.1.1");

  assert.deepEqual(diff.scf_controls.added.sort(), ["CHG-04"]);
  assert.deepEqual(diff.scf_controls.removed.sort(), ["ACC-22"]);
  assert.deepEqual(diff.scf_controls.changed.sort(), ["ACC-02"]);
  assert.equal(diff.scf_controls.unchanged.length, 1);
  assert.equal(diff.scf_controls.unchanged[0], "ACC-01");
});

test("diffSCFVersions covers all 7 currently-seeded SCF tables", async () => {
  // Empty fixtures so we just verify the script attempts every table.
  const csvDir = mkdtempSync(join(tmpdir(), "diff-scf-empty-"));
  const headers = {
    "controls.csv": "SCF #,SCF Control,Description",
    "Authoritative Sources.csv":
      "Geography,SCF Column Header,Focal Document Identifier,Source,Focal Document Name,Focal Document Title,Focal Document Source URL,Set Theory Relationship Map",
    "Domains and Principles.csv": "Domain,Principle,Principle Intent",
    "evidence-request-list.csv":
      "Evidence Request List #,Title,SCF Control Mapping,Evidence Request",
    "Assessment_objectives.csv": "SCF AO #,Assessment Objective,SCF Control",
    "risks.csv": "Risk ID,Risk Name,Risk Description",
    "threats.csv": "Threat ID,Threat Name,Threat Description",
  };
  for (const [name, header] of Object.entries(headers)) {
    writeFileSync(join(csvDir, name), header + "\n");
  }

  const supabase = makeMockSupabase({});
  const diff = await diffSCFVersions(supabase, csvDir, "2025.1.1", "2026.1.1");

  // 7 SCF tables seeded by Phase 2; diff must touch each.
  assert.ok("scf_controls" in diff);
  assert.ok("scf_authoritative_sources" in diff);
  assert.ok("scf_domains" in diff);
  assert.ok("scf_evidence_request_list" in diff);
  assert.ok("scf_assessment_objectives" in diff);
  assert.ok("scf_risks" in diff);
  assert.ok("scf_threats" in diff);
});
