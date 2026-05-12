// tests/scripts/gen-upsert-from-diff.test.ts
//
// Unit tests for scripts/gen-upsert-from-diff.ts.
// The pure-function core is tested directly — no disk IO.
import test from "node:test";
import assert from "node:assert/strict";
import { generateUpsertSQL } from "../../scripts/gen-upsert-from-diff";

// ---------------------------------------------------------------------------
// Minimal diff shape used by the helper.
// The real diff JSON wraps tables under a "diff" key; these fixtures mirror
// the shape passed to generateUpsertSQL() AFTER unwrapping (i.e. the
// Record<table, { added, changed, ... }> portion).
// ---------------------------------------------------------------------------

const EMPTY_DIFF: Record<string, { added: string[]; changed: string[] }> = {
  scf_controls: { added: [], changed: [] },
  scf_authoritative_sources: { added: [], changed: [] },
  scf_domains: { added: [], changed: [] },
  scf_evidence_request_list: { added: [], changed: [] },
  scf_assessment_objectives: { added: [], changed: [] },
  scf_risks: { added: [], changed: [] },
  scf_threats: { added: [], changed: [] },
};

// ---------------------------------------------------------------------------
// Test 1: generates correct INSERT ... ON CONFLICT DO UPDATE for an `added` row
// ---------------------------------------------------------------------------
test("generates INSERT...ON CONFLICT for an added risk row", () => {
  const diff = {
    ...EMPTY_DIFF,
    scf_risks: { added: ["R-AC-1"], changed: [] },
  };

  const csvRowsByTable: Record<string, Array<Record<string, string>>> = {
    scf_risks: [
      {
        "Risk #": "R-AC-1",
        'Risk*\nNote - Some of these risks may indicate a deficiency that could be considered a failure to meet "reasonable security practices" ':
          "Inability to maintain individual accountability",
        "Description of Possible Risk Due To Control Deficiency": "Loss of accountability.",
        "Risk Grouping": "Access Control",
        "NIST CSF \nFunction": "Protect",
      },
    ],
  };

  const sql = generateUpsertSQL(diff, csvRowsByTable);

  assert.ok(sql.includes("INSERT INTO public.scf_risks"), "should emit INSERT for scf_risks");
  assert.ok(sql.includes("ON CONFLICT"), "should emit ON CONFLICT clause");
  assert.ok(sql.includes("DO UPDATE SET"), "should emit DO UPDATE SET clause");
  assert.ok(sql.includes("'R-AC-1'"), "should include the row id");
});

// ---------------------------------------------------------------------------
// Test 2: generates same for a `changed` row
// ---------------------------------------------------------------------------
test("generates INSERT...ON CONFLICT for a changed risk row", () => {
  const diff = {
    ...EMPTY_DIFF,
    scf_risks: { added: [], changed: ["R-AC-2"] },
  };

  const csvRowsByTable: Record<string, Array<Record<string, string>>> = {
    scf_risks: [
      {
        "Risk #": "R-AC-2",
        'Risk*\nNote - Some of these risks may indicate a deficiency that could be considered a failure to meet "reasonable security practices" ':
          "Improper assignment of privileged functions",
        "Description of Possible Risk Due To Control Deficiency": "Privilege abuse.",
        "Risk Grouping": "Access Control",
        "NIST CSF \nFunction": "Protect",
      },
    ],
  };

  const sql = generateUpsertSQL(diff, csvRowsByTable);

  assert.ok(sql.includes("'R-AC-2'"), "should include the changed row id");
  assert.ok(sql.includes("ON CONFLICT"), "should emit ON CONFLICT clause");
});

// ---------------------------------------------------------------------------
// Test 3: escapes single quotes in string values
// ---------------------------------------------------------------------------
test("escapes single quotes in string values", () => {
  const diff = {
    ...EMPTY_DIFF,
    scf_risks: { added: ["R-AC-1"], changed: [] },
  };

  const csvRowsByTable: Record<string, Array<Record<string, string>>> = {
    scf_risks: [
      {
        "Risk #": "R-AC-1",
        'Risk*\nNote - Some of these risks may indicate a deficiency that could be considered a failure to meet "reasonable security practices" ':
          "Don't miss this",
        "Description of Possible Risk Due To Control Deficiency": "It won't break SQL.",
        "Risk Grouping": "Access Control",
        "NIST CSF \nFunction": "Protect",
      },
    ],
  };

  const sql = generateUpsertSQL(diff, csvRowsByTable);

  assert.ok(sql.includes("Don''t"), "should double single-quotes in title");
  assert.ok(sql.includes("won''t"), "should double single-quotes in description");
  assert.ok(!sql.includes("Don't"), "raw single quote must not appear in SQL output");
});

// ---------------------------------------------------------------------------
// Test 4: skips tables with empty added+changed
// ---------------------------------------------------------------------------
test("skips tables with empty added+changed, emits nothing for them", () => {
  const sql = generateUpsertSQL(EMPTY_DIFF, {});

  assert.equal(sql.trim(), "", "output should be empty when no rows to upsert");
});

// ---------------------------------------------------------------------------
// Test 5: emits ARRAY[...] literals for text-array columns
// ---------------------------------------------------------------------------
test("emits ARRAY[...] literal for scf_control_mappings array column in ERL", () => {
  const diff = {
    ...EMPTY_DIFF,
    scf_evidence_request_list: { added: ["E-GOV-01"], changed: [] },
  };

  const csvRowsByTable: Record<string, Array<Record<string, string>>> = {
    scf_evidence_request_list: [
      {
        "ERL #": "E-GOV-01",
        "Area of Focus": "Cybersecurity & Data Protection Management",
        "Documentation Artifact": "Charter - Cybersecurity Program",
        "Artifact Description": "Evidence of charter.",
        "SCF Control Mappings": "GOV-01 GOV-02",
      },
    ],
  };

  const sql = generateUpsertSQL(diff, csvRowsByTable);

  // scf_control_mappings is text[] — should be ARRAY['GOV-01','GOV-02']
  assert.ok(
    sql.includes("ARRAY['GOV-01','GOV-02']") || sql.includes("ARRAY['GOV-01', 'GOV-02']"),
    `expected ARRAY[...] literal in SQL, got:\n${sql}`
  );
});

// ---------------------------------------------------------------------------
// Test 6: honors NULL vs empty string
//   - empty CSV cell → NULL
//   - whitespace-only cell → NULL (trim first)
// ---------------------------------------------------------------------------
test("treats empty or whitespace-only cells as NULL, not empty string", () => {
  const diff = {
    ...EMPTY_DIFF,
    scf_risks: { added: ["R-AC-1"], changed: [] },
  };

  const csvRowsByTable: Record<string, Array<Record<string, string>>> = {
    scf_risks: [
      {
        "Risk #": "R-AC-1",
        'Risk*\nNote - Some of these risks may indicate a deficiency that could be considered a failure to meet "reasonable security practices" ':
          "Title here",
        "Description of Possible Risk Due To Control Deficiency": "Some desc",
        "Risk Grouping": "", // empty → NULL
        "NIST CSF \nFunction": "  ", // whitespace-only → NULL
      },
    ],
  };

  const sql = generateUpsertSQL(diff, csvRowsByTable);

  // risk_grouping and nist_csf_function columns should both be NULL, not ''
  // Check that there is no occurrence of '' (empty string literal) in the value positions
  // The easiest assertion: NULL appears at least twice (one for each empty column)
  const nullCount = (sql.match(/\bNULL\b/g) ?? []).length;
  assert.ok(
    nullCount >= 2,
    `expected at least 2 NULLs for empty cells, got ${nullCount} in:\n${sql}`
  );
  // Also confirm empty-string literal does not appear
  assert.ok(!sql.includes("''"), `should not emit '' for empty cells, got:\n${sql}`);
});

// ---------------------------------------------------------------------------
// Test 7: ERL conflict target uses (erl_id, import_id) — NOT a partial index
// ---------------------------------------------------------------------------
test("ERL emits ON CONFLICT (erl_id, import_id) and NOT WHERE import_id IS NULL", () => {
  const diff = {
    ...EMPTY_DIFF,
    scf_evidence_request_list: { added: ["E-GOV-01"], changed: [] },
  };

  const csvRowsByTable: Record<string, Array<Record<string, string>>> = {
    scf_evidence_request_list: [
      {
        "ERL #": "E-GOV-01",
        "Area of Focus": "Governance",
        "Documentation Artifact": "Charter",
        "Artifact Description": "Evidence of charter.",
        "SCF Control Mappings": "GOV-01",
      },
    ],
  };

  const sql = generateUpsertSQL(diff, csvRowsByTable);

  assert.ok(
    sql.includes("ON CONFLICT (erl_id, import_id)"),
    `expected ON CONFLICT (erl_id, import_id), got:\n${sql}`
  );
  // The partial-index form must not appear in the conflict clause itself.
  // (A mention in an advisory SQL comment is fine; the regex anchors to ON CONFLICT.)
  assert.ok(
    !sql.match(/ON CONFLICT\s*\([^)]*\)\s*WHERE\s+import_id\s+IS\s+NULL/),
    `must NOT use partial-index form ON CONFLICT (...) WHERE import_id IS NULL, got:\n${sql}`
  );
  // import_id should appear as NULL in the VALUES list
  assert.ok(
    sql.includes("NULL"),
    `expected NULL in VALUES (import_id = NULL for seed rows), got:\n${sql}`
  );
  // import_id must NOT appear in DO UPDATE SET clause
  assert.ok(
    !sql.match(/DO UPDATE SET[\s\S]*import_id\s*=/),
    `import_id must not be in DO UPDATE SET, got:\n${sql}`
  );
});

// ---------------------------------------------------------------------------
// Test 8: scf_authoritative_sources includes source_organization column
// ---------------------------------------------------------------------------
test("scf_authoritative_sources emits source_organization in column list and VALUES", () => {
  const diff = {
    ...EMPTY_DIFF,
    scf_authoritative_sources: { added: ["general-aicpa-pmf-2020"], changed: [] },
  };

  const csvRowsByTable: Record<string, Array<Record<string, string>>> = {
    scf_authoritative_sources: [
      {
        "Focal Document Identifier (FDI)": "general-aicpa-pmf-2020",
        Geography: "General",
        "SCF Column Header": "AICPA\nPrivacy Management Framework (PMF)",
        Source: "AICPA",
        "Focal Document Name (FDN)": "AICPA Privacy Management Framework (PMF) (2020)",
        "Focal Document Source (FDS)": "https://example.com/pmf",
        "Set Theory Relationship Mapping (STRM)": "https://example.com/strm",
      },
    ],
  };

  const sql = generateUpsertSQL(diff, csvRowsByTable);

  assert.ok(
    sql.includes("INSERT INTO public.scf_authoritative_sources"),
    "should emit INSERT for scf_authoritative_sources"
  );
  assert.ok(
    sql.includes("source_organization"),
    `expected source_organization in column list, got:\n${sql}`
  );
  assert.ok(
    sql.includes("'AICPA'"),
    `expected 'AICPA' value for source_organization, got:\n${sql}`
  );
});

// ---------------------------------------------------------------------------
// Test 9: scf_version literal injected in every table INSERT and in DO UPDATE SET
// ---------------------------------------------------------------------------
test("emits scf_version = '2026.1.1' in column list, VALUES, and DO UPDATE SET", () => {
  const diff = {
    ...EMPTY_DIFF,
    scf_risks: { added: ["R-AC-1"], changed: [] },
  };

  const csvRowsByTable: Record<string, Array<Record<string, string>>> = {
    scf_risks: [
      {
        "Risk #": "R-AC-1",
        'Risk*\nNote - Some of these risks may indicate a deficiency that could be considered a failure to meet "reasonable security practices" ':
          "Some risk title",
        "Description of Possible Risk Due To Control Deficiency": "Some description.",
        "Risk Grouping": "Access Control",
        "NIST CSF \nFunction": "Protect",
      },
    ],
  };

  const sql = generateUpsertSQL(diff, csvRowsByTable);

  // Column list must include scf_version
  assert.ok(
    sql.match(/INSERT INTO public\.scf_risks \([^)]*scf_version[^)]*\)/),
    `expected scf_version in INSERT column list, got:\n${sql}`
  );
  // VALUES must include the literal '2026.1.1'
  assert.ok(sql.includes("'2026.1.1'"), `expected '2026.1.1' literal in VALUES, got:\n${sql}`);
  // DO UPDATE SET must include scf_version = EXCLUDED.scf_version
  assert.ok(
    sql.includes("scf_version = EXCLUDED.scf_version"),
    `expected scf_version = EXCLUDED.scf_version in DO UPDATE SET, got:\n${sql}`
  );
});
