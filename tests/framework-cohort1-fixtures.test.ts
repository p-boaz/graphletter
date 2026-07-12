import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SCFParser } from "@/lib/scf-parser";
import { CATALOG_FRAMEWORK_COLUMNS } from "@/lib/scf/__generated__/framework-columns";

// Semantic fixtures for the stage-7 cohort (first preview → supported
// promotion). Every triple and count below was verified BY HAND against raw
// cells of data/controls.csv, addressed by manifest column index — an
// independent path from the parser under test. Rationale: the 2026-07-10
// mapping-scramble incident (memory: scf-data-pipeline) shifted every column
// by ~17 positions while all count-based checks stayed green; only exact
// cell-content pins catch that class of failure.
// Spec: plans/task-2026-07-11-scf-cohort-1-promotion.md

const controlsCSV = readFileSync(join(process.cwd(), "data", "controls.csv"), "utf-8");
const mappings = SCFParser.parseControlMappings(controlsCSV);

const columnByKey = new Map(CATALOG_FRAMEWORK_COLUMNS.map((c) => [c.catalogKey, c]));

const COHORT: {
  key: string;
  // Hand-read from the SCF 2026.2 workbook cell (SCF # row × framework column).
  fixture: { controlId: string; frameworkControlId: string };
  // Parsed mapping-row count: newline-split identifiers, hand-counted from
  // raw CSV cells. NOTE: this is NOT the manifest's mappingCount, which
  // counts non-empty cells (one cell can hold many identifiers).
  mappingCount: number;
  // First 16 hex chars of sha256 over the sorted "controlId frameworkControlId"
  // lines for the column. Triples/counts/shapes cannot distinguish a swap
  // between similar sibling columns; the hash pins exact content, so ANY
  // column shift that changes what a framework's mappings say trips here.
  contentHash: string;
  // Every identifier in the column must look like this framework's real
  // citation scheme (FedRAMP/GovRAMP → NIST 800-53 control IDs; NIST docs →
  // their own section/assessment identifiers).
  idShape: RegExp;
}[] = [
  {
    key: "usa-federal-gsa-fedramp-5-low",
    fixture: { controlId: "GOV-01", frameworkControlId: "PM-01" },
    mappingCount: 570,
    contentHash: "1f3179954ad6b389",
    idShape: /^[A-Z]{2}-\d/,
  },
  {
    key: "usa-federal-gsa-fedramp-5-mod",
    fixture: { controlId: "GOV-04", frameworkControlId: "PL-09" },
    mappingCount: 711,
    contentHash: "587aedd63a4b2a54",
    idShape: /^[A-Z]{2}-\d/,
  },
  {
    key: "usa-federal-gsa-fedramp-5-high",
    fixture: { controlId: "GOV-01", frameworkControlId: "PM-01" },
    mappingCount: 791,
    contentHash: "efe7684b84f7f20c",
    idShape: /^[A-Z]{2}-\d/,
  },
  {
    key: "usa-federal-gsa-fedramp-5-li-saas",
    fixture: { controlId: "GOV-04", frameworkControlId: "PM-06" },
    mappingCount: 570,
    contentHash: "1f3179954ad6b389",
    idShape: /^[A-Z]{2}-\d/,
  },
  {
    key: "general-govramp",
    fixture: { controlId: "GOV-06", frameworkControlId: "IR-06" },
    mappingCount: 548,
    contentHash: "585803359ea468b0",
    idShape: /^[A-Z]{2}-\d/,
  },
  {
    key: "general-govramp-core",
    fixture: { controlId: "AST-02", frameworkControlId: "CM-08" },
    mappingCount: 100,
    contentHash: "7c3246ac948a35a9",
    idShape: /^[A-Z]{2}-\d/,
  },
  {
    key: "general-govramp-low",
    fixture: { controlId: "GOV-06", frameworkControlId: "IR-06" },
    mappingCount: 222,
    contentHash: "c06ce1841120f71e",
    idShape: /^[A-Z]{2}-\d/,
  },
  {
    key: "general-govramp-low-plus",
    fixture: { controlId: "AST-02", frameworkControlId: "CM-08" },
    mappingCount: 297,
    contentHash: "c931c83e61734ac7",
    idShape: /^[A-Z]{2}-\d/,
  },
  {
    key: "general-govramp-mod",
    fixture: { controlId: "GOV-06", frameworkControlId: "IR-06" },
    mappingCount: 441,
    contentHash: "fb6241c4e50f351b",
    idShape: /^[A-Z]{2}-\d/,
  },
  {
    key: "general-govramp-high",
    fixture: { controlId: "AST-02", frameworkControlId: "CM-08" },
    mappingCount: 548,
    contentHash: "585803359ea468b0",
    idShape: /^[A-Z]{2}-\d/,
  },
  {
    key: "general-nist-600-1-gen-ai-profile",
    fixture: { controlId: "GOV-02", frameworkControlId: "GV-1.5-002" },
    mappingCount: 403,
    contentHash: "e9f40c94ba229a7a",
    // Trailing (\d|[- .]) tolerates the upstream typo "GV4.3--001" (2026.2).
    idShape: /^(GOVERN|MAP|MEASURE|MANAGE|GV|MP|MS|MG)(\d|[- .])/,
  },
  {
    key: "general-nist-800-66-r2",
    // 800-66 R2 is the HIPAA Security Rule implementation guide; its
    // identifiers are 45 CFR §164 citations, not NIST control IDs.
    fixture: { controlId: "GOV-01", frameworkControlId: "164.316(a)" },
    mappingCount: 154,
    contentHash: "1eb6114a59dd32b9",
    idShape: /^164\./,
  },
  {
    key: "general-nist-800-82-r3",
    fixture: { controlId: "GOV-01", frameworkControlId: "PM-01" },
    mappingCount: 1117,
    contentHash: "68737d3c36ec2d57",
    idShape: /^[A-Z]{2}-\d/,
  },
  {
    key: "general-nist-800-172a-r3",
    fixture: { controlId: "GOV-04.1", frameworkControlId: "A.03.02.03E.ODP[01]" },
    mappingCount: 414,
    contentHash: "5cc68e724971b6c7",
    idShape: /^(DS-)?A\.03\./,
  },
  {
    key: "general-nist-cswp-39",
    fixture: { controlId: "CLD-02", frameworkControlId: "6.4" },
    mappingCount: 24,
    contentHash: "e17cfa3794772a42",
    idShape: /^\d+(\.\d+)*$/,
  },
];

test("stage-7 cohort: all 15 frameworks are supported and exposure-cleared", () => {
  for (const { key } of COHORT) {
    const column = columnByKey.get(key);
    assert.ok(column, `cohort key "${key}" missing from generated columns`);
    assert.equal(column.visibility, "supported", `"${key}" must be supported`);
    assert.equal(column.exposureStatus, "public", `"${key}" must be exposure-cleared`);
  }
});

test("stage-7 cohort: hand-verified mapping triples parse intact", () => {
  for (const { key, fixture } of COHORT) {
    const column = columnByKey.get(key);
    assert.ok(column, key);
    const hit = mappings.find(
      (m) =>
        m.frameworkName === column.frameworkName &&
        m.controlId === fixture.controlId &&
        m.frameworkControlId === fixture.frameworkControlId
    );
    assert.ok(
      hit,
      `"${key}": expected ${fixture.controlId} ↔ ${fixture.frameworkControlId} (hand-read from controls.csv) in parsed mappings`
    );
  }
});

test("stage-7 cohort: per-framework mapping-row counts match the hand-counted 2026.2 values", () => {
  for (const { key, mappingCount } of COHORT) {
    const column = columnByKey.get(key);
    assert.ok(column, key);
    const parsed = mappings.filter((m) => m.frameworkName === column.frameworkName).length;
    assert.equal(
      parsed,
      mappingCount,
      `"${key}": parsed mapping count drifted from the pinned 2026.2 value`
    );
  }
});

function columnContentHash(frameworkName: string): string {
  const lines = mappings
    .filter((m) => m.frameworkName === frameworkName)
    .map((m) => `${m.controlId} ${m.frameworkControlId}`)
    .sort();
  return createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 16);
}

test("stage-7 cohort: per-column content hashes are pinned exactly", () => {
  for (const { key, contentHash } of COHORT) {
    const column = columnByKey.get(key);
    assert.ok(column, key);
    assert.equal(
      columnContentHash(column.frameworkName),
      contentHash,
      `"${key}": column content changed — either an upstream SCF revision (re-pin deliberately) or a column scramble (investigate before re-pinning)`
    );
  }
});

test("stage-7 cohort: known-identical sibling columns stay identical", () => {
  // In the 2026.2 workbook these pairs are byte-identical columns (verified
  // cell-by-cell against raw CSV), so no discriminating triple between them
  // exists and a swap within a pair is content-neutral. Pin the equivalence:
  // if a future SCF release differentiates a pair, this fails and the pair
  // needs distinct pins chosen from the newly differing cells.
  const equivalentPairs: [string, string][] = [
    ["usa-federal-gsa-fedramp-5-low", "usa-federal-gsa-fedramp-5-li-saas"],
    ["general-govramp", "general-govramp-high"],
  ];
  for (const [a, b] of equivalentPairs) {
    const colA = columnByKey.get(a);
    const colB = columnByKey.get(b);
    assert.ok(colA && colB, `${a} / ${b}`);
    assert.equal(
      columnContentHash(colA.frameworkName),
      columnContentHash(colB.frameworkName),
      `"${a}" and "${b}" were identical in 2026.2 but have diverged — choose discriminating fixture pins for the pair`
    );
  }
});

test("stage-7 cohort: every identifier matches the framework's citation scheme", () => {
  for (const { key, idShape } of COHORT) {
    const column = columnByKey.get(key);
    assert.ok(column, key);
    const offenders = mappings
      .filter((m) => m.frameworkName === column.frameworkName)
      .filter((m) => !idShape.test(m.frameworkControlId));
    assert.deepEqual(
      offenders.map((m) => `${m.controlId} => ${m.frameworkControlId}`).slice(0, 5),
      [],
      `"${key}": identifiers no longer look like this framework's citation scheme — possible column scramble`
    );
  }
});
