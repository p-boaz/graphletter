import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { extractWorkbookToCsvs } from "../../scripts/extract-scf";

function buildFixtureWorkbook(): Buffer {
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Domain", "Control", "Description"],
    ["AC", "AC-01", "Access Control Policy"],
    ["AC", "AC-02", 'Account Management, with "quotes" and, commas'],
    ["AT", "AT-01", "Multi\nline\nvalue"],
    ["AU", "AU-01", "Cell with\r\nCRLF inside"],
  ]);
  XLSX.utils.book_append_sheet(wb, sheet, "SCF 2026.1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

test("extractor: produces byte-stable output across runs", async () => {
  const dir = await mkdtemp(join(tmpdir(), "scf-extract-"));
  try {
    const xlsxPath = join(dir, "fixture.xlsx");
    await writeFile(xlsxPath, new Uint8Array(buildFixtureWorkbook()));

    const mapping = [{ sheet: "SCF 2026.1", csv: "controls.csv" }];

    const outA = join(dir, "a");
    const outB = join(dir, "b");
    await extractWorkbookToCsvs({ xlsxPath, outDir: outA, mapping });
    await extractWorkbookToCsvs({ xlsxPath, outDir: outB, mapping });

    const a = await readFile(join(outA, "controls.csv"));
    const b = await readFile(join(outB, "controls.csv"));
    assert.deepEqual(a, b, "two extractions of the same XLSX must be byte-identical");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("extractor: emits LF line endings, no BOM, RFC 4180 quoting", async () => {
  const dir = await mkdtemp(join(tmpdir(), "scf-extract-"));
  try {
    const xlsxPath = join(dir, "fixture.xlsx");
    await writeFile(xlsxPath, new Uint8Array(buildFixtureWorkbook()));

    const outDir = join(dir, "out");
    await extractWorkbookToCsvs({
      xlsxPath,
      outDir,
      mapping: [{ sheet: "SCF 2026.1", csv: "controls.csv" }],
    });
    const buf = await readFile(join(outDir, "controls.csv"));
    const text = buf.toString("utf8");

    assert.equal(buf[0] !== 0xef || buf[1] !== 0xbb || buf[2] !== 0xbf, true, "no UTF-8 BOM");
    assert.equal(
      text.includes("\r\n"),
      false,
      "no CRLF anywhere — embedded CRLF must be normalized to LF"
    );
    assert.equal(text.includes("\r"), false, "no stray CR bytes");
    assert.ok(text.endsWith("\n"), "file ends with LF");
    assert.match(text, /^Domain,Control,Description\n/, "header row first");
    assert.match(
      text,
      /"Account Management, with ""quotes"" and, commas"/,
      "commas and quotes are RFC 4180 quoted"
    );
    assert.match(text, /"Multi\nline\nvalue"/, "embedded LF newlines are preserved inside quotes");
    assert.match(
      text,
      /"Cell with\nCRLF inside"/,
      "embedded CRLF was normalized to LF inside the quoted cell"
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("extractor: returns sha256 for each emitted csv", async () => {
  const dir = await mkdtemp(join(tmpdir(), "scf-extract-"));
  try {
    const xlsxPath = join(dir, "fixture.xlsx");
    await writeFile(xlsxPath, new Uint8Array(buildFixtureWorkbook()));

    const result = await extractWorkbookToCsvs({
      xlsxPath,
      outDir: join(dir, "out"),
      mapping: [{ sheet: "SCF 2026.1", csv: "controls.csv" }],
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].csv, "controls.csv");
    assert.match(result[0].sha256, /^[0-9a-f]{64}$/, "sha256 is 64 lowercase hex chars");
    assert.equal(typeof result[0].rows, "number");
    assert.equal(result[0].rows, 5, "fixture has header + 4 data rows");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("extractor: missing sheet throws with sheet name in message", async () => {
  const dir = await mkdtemp(join(tmpdir(), "scf-extract-"));
  try {
    const xlsxPath = join(dir, "fixture.xlsx");
    await writeFile(xlsxPath, new Uint8Array(buildFixtureWorkbook()));

    await assert.rejects(
      extractWorkbookToCsvs({
        xlsxPath,
        outDir: join(dir, "out"),
        mapping: [{ sheet: "Does Not Exist", csv: "nope.csv" }],
      }),
      /Does Not Exist/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
