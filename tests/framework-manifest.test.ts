import assert from "node:assert/strict";
import test from "node:test";
import { FRAMEWORK_COLUMNS } from "@/lib/scf-parser";
import {
  buildManifest,
  countMappings,
  displayNameFromHeader,
  generate,
  joinFocalDocumentsToColumns,
  readCommittedManifest,
  serializeManifest,
  validateOverrides,
  type FocalDocumentRecord,
  type FrameworkManifest,
} from "../scripts/generate-framework-manifest";

// The three catalog gates (plans/task-2026-07-11-scf-catalog-inventory.md)
// run against a single regeneration from the committed CSVs + overrides.
const regenerated: FrameworkManifest = generate();

test("freshness gate: committed manifest is byte-identical to regeneration", () => {
  assert.equal(
    readCommittedManifest(),
    serializeManifest(regenerated),
    "data/framework-manifest.json is stale — run `pnpm manifest:generate` and review the diff"
  );
});

test("completeness gate: every mapping column is resolved", () => {
  const { entries, exceptions, summary } = regenerated;

  // Every column inside the mapping range must have a Focal Documents match —
  // an unmatched column means a new SCF release added a framework we have not
  // accounted for.
  const unmatchedColumns = exceptions.filter((e) => e.type === "column-without-focal-doc");
  assert.deepEqual(unmatchedColumns, [], "mapping columns without a Focal Documents row");

  const expectedColumnCount =
    summary.mappingColumnRange.last - summary.mappingColumnRange.first + 1;
  assert.equal(
    entries.length,
    expectedColumnCount,
    "entries must cover the full mapping-column range"
  );
  assert.equal(new Set(entries.map((e) => e.columnIndex)).size, entries.length);
  assert.equal(
    new Set(entries.map((e) => e.key)).size,
    entries.length,
    "manifest keys must be unique"
  );

  // Every entry must be classified: no entry may sit outside the reviewed set.
  assert.equal(
    summary.unresolved,
    0,
    "unclassified frameworks — add them to framework-manifest.overrides.json"
  );
  for (const entry of entries) {
    assert.ok(
      ["imported", "classified", "excluded"].includes(entry.resolution),
      `entry "${entry.key}" has unexpected resolution "${entry.resolution}"`
    );
    if (entry.resolution === "excluded") {
      assert.ok(
        entry.exclusionReason,
        `excluded entry "${entry.key}" must carry an exclusionReason`
      );
    }
  }

  // Summary counts must agree with the entry list.
  const countOf = (r: string) => entries.filter((e) => e.resolution === r).length;
  assert.equal(summary.imported, countOf("imported"));
  assert.equal(summary.classified, countOf("classified"));
  assert.equal(summary.excluded, countOf("excluded"));
  assert.equal(summary.mappingColumns, entries.length);
  assert.equal(summary.exceptions, exceptions.length);
});

test("consistency gate: FRAMEWORK_COLUMNS and the manifest cannot drift", () => {
  const importedEntries = regenerated.entries.filter((e) => e.currentlyImported);
  assert.equal(
    importedEntries.length,
    FRAMEWORK_COLUMNS.length,
    "every parser framework must appear in the manifest exactly once"
  );

  const manifestByHeader = new Map(importedEntries.map((e) => [e.upstreamHeader, e]));
  for (const config of FRAMEWORK_COLUMNS) {
    const entry = manifestByHeader.get(config.expectedHeader);
    assert.ok(entry, `FRAMEWORK_COLUMNS "${config.frameworkName}" has no manifest entry`);
    assert.equal(
      entry.columnIndex,
      config.columnIndex,
      `column index drift for "${config.frameworkName}": parser=${config.columnIndex} manifest=${entry.columnIndex}`
    );
    assert.equal(entry.importedName, config.frameworkName);
  }

  assert.deepEqual(
    regenerated.exceptions.filter((e) => e.type === "imported-without-focal-doc"),
    [],
    "parser frameworks missing from Focal Documents"
  );
});

// --- join / unit behavior on synthetic fixtures ---

function record(header: string, fdi: string): FocalDocumentRecord {
  return {
    geography: "General",
    scfColumnHeader: header,
    focalDocumentIdentifier: fdi,
    source: "Test",
    focalDocumentName: `Test ${fdi}`,
    focalDocumentSourceUrl: "https://example.com",
    strmUrl: "https://example.com/strm",
  };
}

test("join: exact match only, unmatched sides reported, range derived from matches", () => {
  const header = ["SCF #", "Control", "FW\nA", "Mystery\nColumn", "FW\nB", "Errata"];
  const result = joinFocalDocumentsToColumns(header, [
    record("FW\nA", "fw-a"),
    record("FW\nB", "fw-b"),
    record("FW\nC", "fw-c"), // not in header
  ]);

  assert.deepEqual(
    result.matched.map((m) => [m.record.focalDocumentIdentifier, m.columnIndex]),
    [
      ["fw-a", 2],
      ["fw-b", 4],
    ]
  );
  assert.deepEqual(result.range, { first: 2, last: 4 });
  assert.deepEqual(
    result.unmatchedColumnsInRange.map((u) => u.columnIndex),
    [3],
    "unmatched column inside the range must be surfaced, never guessed"
  );
  assert.deepEqual(
    result.unmatchedFocalDocs.map((r) => r.focalDocumentIdentifier),
    ["fw-c"]
  );
});

test("buildManifest: duplicate FDIs get deterministic disambiguated keys and an exception", () => {
  const controlsRows = [
    ["SCF #", "FW\nA", "FW\nB"],
    ["GOV-01", "A-1", "B-1"],
    ["GOV-02", "", "B-2"],
  ];
  const focalRows = [
    ["Geography", "SCF Column Header", "FDI", "Source", "FDN", "FDS", "STRM"],
    ["General", "FW\nA", "dup-key", "Test", "First", "", ""],
    ["General", "FW\nB", "dup-key", "Test", "Second", "", ""],
  ];
  const manifest = buildManifest(
    controlsRows,
    focalRows,
    {},
    {
      scfVersion: "test",
      workbookSha256: "x",
      controlsCsvSha256: "y",
      focalDocumentsCsvSha256: "z",
    }
  );

  assert.deepEqual(
    manifest.entries.map((e) => e.key),
    ["dup-key", "dup-key-column-2"]
  );
  assert.equal(
    manifest.exceptions.filter((e) => e.type === "duplicate-focal-doc-identifier").length,
    1
  );
});

test("countMappings ignores blank and whitespace-only cells", () => {
  const rows = [
    ["a", "GOV-01"],
    ["b", "  "],
    ["c", ""],
    ["d", "GOV-02"],
  ];
  assert.equal(countMappings(rows, 1), 2);
});

test("displayNameFromHeader collapses embedded newlines", () => {
  assert.equal(displayNameFromHeader("NIST\n800-53\nR5"), "NIST 800-53 R5");
  assert.equal(displayNameFromHeader("  GDPR  "), "GDPR");
});

test("validateOverrides rejects unknown keys, bad enums, and excluded-without-reason", () => {
  const valid = new Set(["known"]);
  const errors = validateOverrides(
    {
      known: {
        // @ts-expect-error deliberately invalid kind to exercise validation
        kind: "bogus",
        visibility: "excluded",
        exposureStatus: "non-public",
        exposureReason: "r",
      },
      unknown: {
        kind: "law",
        visibility: "preview",
        exposureStatus: "non-public",
        exposureReason: "r",
      },
    },
    valid
  );
  assert.equal(errors.length, 3);
  assert.match(errors.join("\n"), /invalid kind "bogus"/);
  assert.match(errors.join("\n"), /requires exclusionReason/);
  assert.match(errors.join("\n"), /"unknown" matches no generated manifest entry/);
});
