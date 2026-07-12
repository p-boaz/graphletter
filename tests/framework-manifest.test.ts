import assert from "node:assert/strict";
import test from "node:test";
import { FRAMEWORK_COLUMNS, MAPPED_FRAMEWORK_COUNT } from "@/lib/scf-parser";
import {
  buildManifest,
  countMappings,
  displayNameFromHeader,
  findMappingRange,
  generate,
  joinFocalDocumentsToColumns,
  readCommittedGeneratedColumns,
  readCommittedManifest,
  serializeGeneratedColumns,
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

test("freshness gate: committed generated columns module is byte-identical to regeneration", () => {
  assert.equal(
    readCommittedGeneratedColumns(),
    serializeGeneratedColumns(regenerated),
    "lib/scf/__generated__/framework-columns.ts is stale — run `pnpm manifest:generate`"
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

test("consistency gate: derived FRAMEWORK_COLUMNS ≡ manifest non-excluded entries", () => {
  // The parser config is generated from the manifest, so the gate now proves
  // the derivation is faithful: same entries, same order, same identity — and
  // the supported subset is exactly what MAPPED_FRAMEWORK_COUNT reports.
  const nonExcluded = regenerated.entries.filter((e) => e.visibility !== "excluded");
  assert.equal(FRAMEWORK_COLUMNS.length, nonExcluded.length);

  nonExcluded.forEach((entry, i) => {
    const config = FRAMEWORK_COLUMNS[i];
    assert.equal(config.catalogKey, entry.key);
    assert.equal(config.columnIndex, entry.columnIndex);
    assert.equal(config.expectedHeader, entry.upstreamHeader);
    assert.equal(config.frameworkName, entry.displayName);
    assert.equal(config.visibility, entry.visibility);
    assert.equal(config.exposureStatus, entry.exposureStatus);
  });

  const supported = FRAMEWORK_COLUMNS.filter((c) => c.visibility === "supported");
  assert.equal(supported.length, MAPPED_FRAMEWORK_COUNT);
  assert.equal(
    regenerated.entries.filter((e) => e.currentlyImported).length,
    MAPPED_FRAMEWORK_COUNT
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

test("join: exact match only, unmatched sides reported within an explicit range", () => {
  const header = ["SCF #", "Control", "FW\nA", "Mystery\nColumn", "FW\nB", "Errata"];
  const result = joinFocalDocumentsToColumns(
    header,
    [
      record("FW\nA", "fw-a"),
      record("FW\nB", "fw-b"),
      record("FW\nC", "fw-c"), // not in header
      record("Errata", "fw-outside"), // matches a column outside the range
    ],
    { first: 2, last: 4 }
  );

  assert.deepEqual(
    result.matched.map((m) => [m.record.focalDocumentIdentifier, m.columnIndex]),
    [
      ["fw-a", 2],
      ["fw-b", 4],
    ]
  );
  assert.deepEqual(
    result.unmatchedColumnsInRange.map((u) => u.columnIndex),
    [3],
    "unmatched column inside the range must be surfaced, never guessed"
  );
  assert.deepEqual(
    result.unmatchedFocalDocs.map((r) => r.focalDocumentIdentifier),
    ["fw-c"]
  );
  assert.deepEqual(
    result.matchedOutsideRange.map((m) => [m.record.focalDocumentIdentifier, m.columnIndex]),
    [["fw-outside", 5]],
    "a Focal Document matching outside the sentinel range is a structural anomaly"
  );
});

test("findMappingRange: sentinel-bounded on the real controls header; hard-fails when absent", () => {
  // On the committed workbook the sentinels must bound exactly the range the
  // manifest was generated from — this is what catches an appended framework
  // column that Focal Documents does not know about (PR #51 review finding).
  assert.deepEqual(regenerated.summary.mappingColumnRange, {
    first: 33,
    last: 284,
  });

  assert.throws(
    () => findMappingRange(["SCF #", "FW\nA"], { before: "SCF #", after: "GONE" }),
    /sentinel\(s\) not found/i
  );
  assert.throws(
    () => findMappingRange(["A", "B"], { before: "B", after: "A" }),
    /inverted or adjacent/i
  );
});

test("completeness gate catches a trailing framework column missing from Focal Documents", () => {
  // The Codex-review scenario: upstream appends a framework column after the
  // last matched one; Focal Documents has no row for it. The sentinel-derived
  // range must still inspect it and surface an exception.
  const controlsRows = [
    ["SCF #", "BEFORE", "FW\nA", "FW\nNEW", "AFTER"],
    ["GOV-01", "", "A-1", "N-1", ""],
  ];
  const focalRows = [
    ["Geography", "SCF Column Header", "FDI", "Source", "FDN", "FDS", "STRM"],
    ["General", "FW\nA", "fw-a", "Test", "First", "", ""],
  ];
  const manifest = buildManifest(
    controlsRows,
    focalRows,
    {
      "fw-a": {
        kind: "standard",
        visibility: "preview",
        exposureStatus: "non-public",
        exposureReason: "r",
      },
    },
    {
      scfVersion: "test",
      workbookSha256: "x",
      controlsCsvSha256: "y",
      focalDocumentsCsvSha256: "z",
    },
    { before: "BEFORE", after: "AFTER" }
  );

  const drift = manifest.exceptions.filter((e) => e.type === "column-without-focal-doc");
  assert.equal(drift.length, 1, "the appended column must be surfaced as an exception");
  assert.match(drift[0].detail, /column 3/);
  assert.equal(
    manifest.summary.mappingColumnRange.last,
    3,
    "range must extend to the sentinel, not the last match"
  );
});

test("buildManifest: duplicate FDIs get deterministic disambiguated keys and an exception", () => {
  const controlsRows = [
    ["SCF #", "FW\nA", "FW\nB", "AFTER"],
    ["GOV-01", "A-1", "B-1", ""],
    ["GOV-02", "", "B-2", ""],
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
    },
    { before: "SCF #", after: "AFTER" }
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
