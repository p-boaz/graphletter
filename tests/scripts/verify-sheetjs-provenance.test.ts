import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXPECTED, verifySheetJsProvenance } from "../../scripts/verify-sheetjs-provenance.js";

async function writeFixtureRepo(opts?: { packageSpecifier?: string; integrity?: string }) {
  const dir = await mkdtemp(join(tmpdir(), "sheetjs-provenance-"));
  const packageSpecifier = opts?.packageSpecifier ?? EXPECTED.specifier;
  const integrity = opts?.integrity ?? EXPECTED.integrity;

  await writeFile(
    join(dir, "package.json"),
    JSON.stringify(
      {
        dependencies: {
          xlsx: packageSpecifier,
        },
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    join(dir, "pnpm-lock.yaml"),
    [
      "importers:",
      "  .:",
      "    dependencies:",
      "      xlsx:",
      `        specifier: ${EXPECTED.specifier}`,
      `        version: ${EXPECTED.specifier}`,
      "",
      "packages:",
      `  xlsx@${EXPECTED.specifier}:`,
      `    resolution: {integrity: ${integrity}, tarball: ${EXPECTED.tarball}}`,
      `    version: ${EXPECTED.version}`,
      "    engines: {node: '>=0.8'}",
      "",
      "snapshots:",
      `  xlsx@${EXPECTED.specifier}: {}`,
      "",
    ].join("\n"),
    "utf8"
  );

  return dir;
}

test("verifySheetJsProvenance: accepts the expected package and lockfile pins", async () => {
  const dir = await writeFixtureRepo();

  const result = verifySheetJsProvenance(dir);

  assert.equal(result.ok, true);
  assert.deepEqual(result.failures, []);
});

test("verifySheetJsProvenance: rejects a changed package specifier", async () => {
  const dir = await writeFixtureRepo({
    packageSpecifier: "https://cdn.sheetjs.com/xlsx-0.20.4/xlsx-0.20.4.tgz",
  });

  const result = verifySheetJsProvenance(dir);

  assert.equal(result.ok, false);
  assert.match(result.failures.join("\n"), /package\.json xlsx specifier mismatch/);
});

test("verifySheetJsProvenance: rejects a changed lockfile integrity", async () => {
  const dir = await writeFixtureRepo({
    integrity: "sha512-not-the-pinned-integrity",
  });

  const result = verifySheetJsProvenance(dir);

  assert.equal(result.ok, false);
  assert.match(result.failures.join("\n"), /pnpm-lock\.yaml is missing expected SheetJS pin/);
});
