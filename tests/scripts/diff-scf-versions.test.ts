import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { diffSCFVersions } from "../../scripts/diff-scf-versions";

// Fixture CSVs simulate 2026.1.1 canonical extracts. The mocked supabase
// returns 2025.1.1 rows. Diff = (CSV rows) minus (DB rows), classified
// per id presence + per-column delta.

const PAGE = 1000;

interface EqCall {
  col: string;
  val: string;
}

function makeMockSupabase(
  prodRows: Record<string, Array<Record<string, unknown>>>,
  eqCalls?: EqCall[]
): any {
  return {
    from: (table: string) => ({
      select: (_cols: string) => ({
        eq: (col: string, val: string) => {
          if (eqCalls) eqCalls.push({ col, val });
          const rows = prodRows[table] ?? [];
          return {
            // Paginated path: .range(from, to) returns a slice
            range: (from: number, to: number) =>
              Promise.resolve({ data: rows.slice(from, to + 1), error: null }),
            // Direct thenable (fallback — should NOT be used if pagination is implemented)
            then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
              Promise.resolve({ data: rows, error: null }).then(resolve),
          };
        },
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

  const result = await diffSCFVersions(supabase, csvDir, "2025.1.1", "2026.1.1");
  const diff = result.tables;

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
  const result = await diffSCFVersions(supabase, csvDir, "2025.1.1", "2026.1.1");
  const diff = result.tables;

  // 7 SCF tables seeded by Phase 2; diff must touch each.
  assert.ok("scf_controls" in diff);
  assert.ok("scf_authoritative_sources" in diff);
  assert.ok("scf_domains" in diff);
  assert.ok("scf_evidence_request_list" in diff);
  assert.ok("scf_assessment_objectives" in diff);
  assert.ok("scf_risks" in diff);
  assert.ok("scf_threats" in diff);
});

test("diffSCFVersions passes scf_version as eq filter on every table query", async () => {
  // This test captures every .eq() call and asserts the filter is always
  // col="scf_version" and val=priorVersion. A regression changing the filter
  // column or value would fail here.
  const csvDir = mkdtempSync(join(tmpdir(), "diff-scf-eq-"));

  writeFileSync(
    join(csvDir, "controls.csv"),
    ["SCF #,SCF Control,Description", "ACC-01,Access Control,Desc"].join("\n")
  );

  const eqCalls: EqCall[] = [];
  const supabase = makeMockSupabase(
    {
      scf_controls: [{ id: "ACC-01", title: "Access Control", description: "Desc" }],
    },
    eqCalls
  );

  await diffSCFVersions(supabase, csvDir, "2025.1.1", "2026.1.1");

  // At least one eq call must have fired (controls.csv is present)
  assert.ok(eqCalls.length > 0, "expected at least one .eq() call");
  for (const call of eqCalls) {
    assert.equal(call.col, "scf_version", `unexpected eq col: ${call.col}`);
    assert.equal(call.val, "2025.1.1", `unexpected eq val: ${call.val}`);
  }
});

test("diffSCFVersions paginates to collect rows beyond the 1000-row PostgREST cap", async () => {
  // Build a DB fixture with 1500 rows (well above the 1000-row cap).
  // The CSV matches all 1500 so every row should land in "unchanged".
  const TOTAL = 1500;
  const csvDir = mkdtempSync(join(tmpdir(), "diff-scf-pg-"));

  const dbRows = Array.from({ length: TOTAL }, (_, i) => ({
    id: `CTL-${String(i).padStart(4, "0")}`,
    title: `Control ${i}`,
    description: `Desc ${i}`,
  }));

  const csvLines = [
    "SCF #,SCF Control,Description",
    ...dbRows.map((r) => `${r.id},${r.title},${r.description}`),
  ];
  writeFileSync(join(csvDir, "controls.csv"), csvLines.join("\n"));

  // Mock returns sliced pages via .range() — simulates PostgREST pagination.
  // If the implementation does NOT use .range(), .then() returns all rows but
  // the test checks that the page count is correct via call tracking.
  let rangeCallCount = 0;
  const supabase = {
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: string) => ({
          range: (from: number, to: number) => {
            rangeCallCount++;
            return Promise.resolve({
              data: dbRows.slice(from, to + 1),
              error: null,
            });
          },
        }),
      }),
    }),
  };

  const result = await diffSCFVersions(supabase as any, csvDir, "2025.1.1", "2026.1.1");
  const diff = result.tables;

  // All 1500 rows should be unchanged (CSV matches DB exactly)
  assert.equal(
    diff.scf_controls.unchanged.length,
    TOTAL,
    `expected ${TOTAL} unchanged rows, got ${diff.scf_controls.unchanged.length}`
  );
  assert.equal(diff.scf_controls.added.length, 0);
  assert.equal(diff.scf_controls.removed.length, 0);

  // Must have taken at least 2 range calls to cover 1500 rows with PAGE=1000
  assert.ok(
    rangeCallCount >= 2,
    `expected >= 2 range calls for ${TOTAL} rows, got ${rangeCallCount}`
  );
});
