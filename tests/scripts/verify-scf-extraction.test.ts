import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { verifyExtraction } from "../../scripts/verify-scf-extraction";

function buildFixtureWorkbook(): Buffer {
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Domain", "Control"],
    ["AC", "AC-01"],
    ["AC", "AC-02"],
  ]);
  XLSX.utils.book_append_sheet(wb, sheet, "SCF 2026.1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

async function buildRepo(dir: string): Promise<void> {
  const dataDir = join(dir, "data");
  await mkdir(dataDir, { recursive: true });
  await writeFile(join(dataDir, "fixture.xlsx"), new Uint8Array(buildFixtureWorkbook()));

  // Run the extractor once to produce a known-good canonical CSV + sha256.
  const { extractWorkbookToCsvs } = await import("../../scripts/extract-scf");
  const [result] = await extractWorkbookToCsvs({
    xlsxPath: join(dataDir, "fixture.xlsx"),
    outDir: dataDir,
    mapping: [{ sheet: "SCF 2026.1", csv: "controls.csv" }],
  });

  const xlsxBuf = await readFile(join(dataDir, "fixture.xlsx"));
  const xlsxSha = createHash("sha256").update(new Uint8Array(xlsxBuf)).digest("hex");

  const manifest = {
    scfVersion: "fixture",
    license: "CC BY-ND 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-nd/4.0/",
    source: { publisher: "fixture", url: "fixture", downloadedAt: "2026-05-11" },
    xlsx: { path: "data/fixture.xlsx", sha256: xlsxSha, bytes: xlsxBuf.length },
    extraction: {
      encoding: "utf-8",
      lineEnding: "lf",
      bom: false,
      quoting: "rfc4180",
      trailingNewline: true,
    },
    sheets: [
      { sheet: "SCF 2026.1", csv: "data/controls.csv", consumer: "test", sha256: result.sha256 },
    ],
    graphletterAuthored: [],
    documentation: [],
  };
  await writeFile(
    join(dataDir, "PROVENANCE.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8"
  );
}

test("verifier: passes when committed CSVs match XLSX extraction", async () => {
  const dir = await mkdtemp(join(tmpdir(), "scf-verify-ok-"));
  try {
    await buildRepo(dir);
    const result = await verifyExtraction({ repoRoot: dir });
    assert.equal(result.ok, true, "verifier should report ok=true");
    assert.deepEqual(result.mismatches, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("verifier: detects tampered CSV bytes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "scf-verify-tamper-"));
  try {
    await buildRepo(dir);
    // Tamper: append a row to the committed CSV.
    const csvPath = join(dir, "data", "controls.csv");
    const original = await readFile(csvPath, "utf8");
    await writeFile(csvPath, original + "IC,IC-99\n", "utf8");

    const result = await verifyExtraction({ repoRoot: dir });
    assert.equal(result.ok, false, "verifier should fail on tampered CSV");
    assert.equal(result.mismatches.length, 1);
    assert.equal(result.mismatches[0].csv, "data/controls.csv");
    assert.match(result.mismatches[0].reason, /sha256/i);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("verifier: detects stale PROVENANCE sha256", async () => {
  const dir = await mkdtemp(join(tmpdir(), "scf-verify-stale-"));
  try {
    await buildRepo(dir);
    // Tamper: change the manifest sha256 to a bogus one.
    const manifestPath = join(dir, "data", "PROVENANCE.json");
    const m = JSON.parse(await readFile(manifestPath, "utf8")) as {
      sheets: Array<{ sha256: string }>;
    };
    m.sheets[0].sha256 = "0".repeat(64);
    await writeFile(manifestPath, JSON.stringify(m, null, 2) + "\n", "utf8");

    const result = await verifyExtraction({ repoRoot: dir });
    assert.equal(result.ok, false);
    assert.match(result.mismatches[0].reason, /sha256/i);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("verifier: regenerates README + LICENSE_AUDIT in repoRoot/data", async () => {
  const dir = await mkdtemp(join(tmpdir(), "scf-verify-docs-"));
  try {
    await buildRepo(dir);
    await verifyExtraction({ repoRoot: dir });
    const readme = await readFile(join(dir, "data", "README.md"), "utf8");
    const audit = JSON.parse(await readFile(join(dir, "data", "LICENSE_AUDIT.json"), "utf8")) as {
      verdict: string;
      entries: Array<{ file: string; classification: string }>;
    };
    assert.match(readme, /CC BY-ND 4\.0/);
    assert.match(readme, /controls\.csv/);
    assert.equal(audit.verdict, "clean");
    const entry = audit.entries.find((e) => e.file === "controls.csv");
    assert.equal(entry?.classification, "upstream-extract");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("verifier: generated README.md and LICENSE_AUDIT.json are prettier-idempotent", async () => {
  // The pre-commit hook runs `prettier --write` on staged .md/.json files via
  // lint-staged. If the verifier emits raw markdown that prettier reformats,
  // every subsequent verifier run produces a phantom diff. Guard against that
  // by asserting the verifier's output is already prettier's fixed point.
  const prettier = await import("prettier");
  const dir = await mkdtemp(join(tmpdir(), "scf-verify-idem-"));
  try {
    await buildRepo(dir);
    await verifyExtraction({ repoRoot: dir });

    const readmePath = join(dir, "data", "README.md");
    const auditPath = join(dir, "data", "LICENSE_AUDIT.json");
    const readme = await readFile(readmePath, "utf8");
    const audit = await readFile(auditPath, "utf8");

    const readmeFormatted = await prettier.format(readme, {
      parser: "markdown",
      filepath: readmePath,
    });
    const auditFormatted = await prettier.format(audit, {
      parser: "json",
      filepath: auditPath,
    });

    assert.equal(readme, readmeFormatted, "README.md must match prettier's fixed point");
    assert.equal(audit, auditFormatted, "LICENSE_AUDIT.json must match prettier's fixed point");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
