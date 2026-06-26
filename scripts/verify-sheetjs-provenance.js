#!/usr/bin/env node
const { readFileSync } = require("node:fs");
const { join, resolve } = require("node:path");

const EXPECTED = Object.freeze({
  packageName: "xlsx",
  version: "0.20.3",
  specifier: "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz",
  tarball: "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz",
  integrity:
    "sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==",
});

function readText(path) {
  return readFileSync(path, "utf8");
}

function verifySheetJsProvenance(repoRoot = resolve(__dirname, "..")) {
  const failures = [];
  const packagePath = join(repoRoot, "package.json");
  const lockPath = join(repoRoot, "pnpm-lock.yaml");
  const pkg = JSON.parse(readText(packagePath));
  const lock = readText(lockPath);
  const actualSpecifier = pkg.dependencies?.[EXPECTED.packageName];

  if (actualSpecifier !== EXPECTED.specifier) {
    failures.push(
      `package.json xlsx specifier mismatch: expected ${EXPECTED.specifier}, got ${String(actualSpecifier)}`
    );
  }

  const requiredFragments = [
    `specifier: ${EXPECTED.specifier}`,
    `version: ${EXPECTED.specifier}`,
    `xlsx@${EXPECTED.specifier}:`,
    `resolution: {integrity: ${EXPECTED.integrity}, tarball: ${EXPECTED.tarball}}`,
    `version: ${EXPECTED.version}`,
  ];

  for (const fragment of requiredFragments) {
    if (!lock.includes(fragment)) {
      failures.push(`pnpm-lock.yaml is missing expected SheetJS pin: ${fragment}`);
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    expected: EXPECTED,
  };
}

function runCli() {
  const result = verifySheetJsProvenance();
  if (!result.ok) {
    console.error("SheetJS provenance verification failed:");
    for (const failure of result.failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(
    `SheetJS provenance verified: ${result.expected.packageName}@${result.expected.version} ${result.expected.integrity}`
  );
}

if (require.main === module) {
  runCli();
}

module.exports = {
  EXPECTED,
  verifySheetJsProvenance,
};
