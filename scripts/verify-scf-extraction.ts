#!/usr/bin/env node
/**
 * Offline byte-comparison verifier for the SCF data pipeline.
 * - Reads data/PROVENANCE.json
 * - Re-extracts every listed CSV to a tmp dir from the committed XLSX
 * - Byte-compares against committed CSV; flags mismatches
 * - Asserts manifest sha256 matches committed CSV sha256
 * - Regenerates data/README.md and data/LICENSE_AUDIT.json from the manifest
 * Exit 0 on success, 2 on mismatch.
 */
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { extractWorkbookToCsvs, type SheetMapping } from "./extract-scf";

interface ManifestSheet {
  sheet: string;
  csv: string;
  consumer: string;
  sha256: string | null;
}

interface Manifest {
  scfVersion: string;
  license: string;
  licenseUrl: string;
  source: { publisher: string; url: string; downloadedAt: string };
  xlsx: { path: string; sha256: string; bytes: number };
  extraction: Record<string, unknown>;
  sheets: ManifestSheet[];
  graphletterAuthored: string[];
  documentation: string[];
}

export interface VerifyMismatch {
  readonly csv: string;
  readonly reason: string;
}

export interface VerifyResult {
  readonly ok: boolean;
  readonly mismatches: VerifyMismatch[];
  readonly checked: number;
}

async function sha256OfFile(path: string): Promise<string> {
  const buf = await readFile(path);
  return createHash("sha256").update(new Uint8Array(buf)).digest("hex");
}

export async function verifyExtraction(opts: { repoRoot: string }): Promise<VerifyResult> {
  const manifestPath = join(opts.repoRoot, "data", "PROVENANCE.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;

  const xlsxAbs = join(opts.repoRoot, manifest.xlsx.path);
  const actualXlsxSha = await sha256OfFile(xlsxAbs);
  const mismatches: VerifyMismatch[] = [];

  if (actualXlsxSha !== manifest.xlsx.sha256) {
    mismatches.push({
      csv: manifest.xlsx.path,
      reason: `XLSX sha256 mismatch: manifest=${manifest.xlsx.sha256} actual=${actualXlsxSha}`,
    });
  }

  // Re-extract to a temp directory and byte-compare.
  const tmp = await mkdtemp(join(tmpdir(), "scf-verify-"));
  try {
    const mapping: SheetMapping[] = manifest.sheets.map((s) => ({
      sheet: s.sheet,
      csv: basename(s.csv),
    }));
    const fresh = await extractWorkbookToCsvs({ xlsxPath: xlsxAbs, outDir: tmp, mapping });
    const freshBySheet = new Map(fresh.map((r) => [r.sheet, r]));

    for (const entry of manifest.sheets) {
      const f = freshBySheet.get(entry.sheet);
      if (!f) {
        mismatches.push({
          csv: entry.csv,
          reason: `sheet "${entry.sheet}" missing from extraction`,
        });
        continue;
      }
      const committedPath = join(opts.repoRoot, entry.csv);
      if (!existsSync(committedPath)) {
        mismatches.push({ csv: entry.csv, reason: "committed CSV is missing on disk" });
        continue;
      }
      const committedSha = await sha256OfFile(committedPath);
      if (committedSha !== f.sha256) {
        // Committed CSV doesn't match a fresh extraction — primary failure.
        mismatches.push({
          csv: entry.csv,
          reason: `sha256 mismatch vs fresh extraction: committed=${committedSha.slice(0, 12)} fresh=${f.sha256.slice(0, 12)}`,
        });
      } else if (entry.sha256 !== null && entry.sha256 !== committedSha) {
        // CSV matches fresh extraction but manifest records a different sha256 — manifest is stale.
        mismatches.push({
          csv: entry.csv,
          reason: `manifest sha256 stale: manifest=${entry.sha256.slice(0, 12)} committed=${committedSha.slice(0, 12)}`,
        });
      }
    }
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }

  // Regenerate docs only if verification succeeded — never write stale docs.
  if (mismatches.length === 0) {
    await regenerateLicenseDocs(opts.repoRoot, manifest);
  }

  return { ok: mismatches.length === 0, mismatches, checked: manifest.sheets.length };
}

async function regenerateLicenseDocs(repoRoot: string, manifest: Manifest): Promise<void> {
  type AuditEntry = {
    file: string;
    authoringSource: "upstream-scf" | "graphletter" | "documentation";
    classification:
      | "upstream-extract"
      | "upstream-verbatim"
      | "graphletter-authored"
      | "documentation";
    sha256: string | null;
    reason: string;
  };

  const entries: AuditEntry[] = [];

  entries.push({
    file: basename(manifest.xlsx.path),
    authoringSource: "upstream-scf",
    classification: "upstream-verbatim",
    sha256: manifest.xlsx.sha256,
    reason: "Vendored verbatim from SCF download under CC BY-ND 4.0.",
  });

  for (const s of manifest.sheets) {
    entries.push({
      file: basename(s.csv),
      authoringSource: "upstream-scf",
      classification: "upstream-extract",
      sha256: s.sha256,
      reason: `Deterministically extracted from sheet "${s.sheet}" of the vendored XLSX.`,
    });
  }

  for (const path of manifest.graphletterAuthored) {
    entries.push({
      file: basename(path),
      authoringSource: "graphletter",
      classification: "graphletter-authored",
      sha256: null,
      reason: "Authored in graphletter (not derived from the SCF upstream).",
    });
  }

  for (const path of manifest.documentation) {
    entries.push({
      file: basename(path),
      authoringSource: "documentation",
      classification: "documentation",
      sha256: null,
      reason: "Documentation; not subject to SCF redistribution rules.",
    });
  }

  const audit = {
    generatedAt: new Date().toISOString().slice(0, 10),
    scfVersion: manifest.scfVersion,
    license: manifest.license,
    licenseUrl: manifest.licenseUrl,
    source: manifest.source,
    xlsxSha256: manifest.xlsx.sha256,
    verdict: "clean" as const,
    entries,
  };

  await writeFile(
    join(repoRoot, "data", "LICENSE_AUDIT.json"),
    JSON.stringify(audit, null, 2) + "\n",
    "utf8"
  );

  const rows = entries
    .map((e) => {
      const sha = e.sha256 ? `\`${e.sha256.slice(0, 12)}…\`` : "—";
      return `| \`${e.file}\` | ${e.authoringSource} | ${e.classification} | ${sha} | ${e.reason} |`;
    })
    .join("\n");

  const readme = `# graphletter \`data/\` license and provenance

Generated by \`pnpm verify:scf-extraction\` on ${audit.generatedAt}.
Verdict: **${audit.verdict}**.

## Attribution

Files classified \`upstream-verbatim\` or \`upstream-extract\` are redistributed under
[Creative Commons Attribution-NoDerivatives 4.0 International (CC BY-ND 4.0)](${manifest.licenseUrl}),
sourced from the Secure Controls Framework, version ${manifest.scfVersion}
(<${manifest.source.url}>).

The XLSX is shipped verbatim. All CSV files are produced by a deterministic extractor
(\`scripts/extract-scf.ts\`) reading named sheets out of the vendored workbook. Run
\`pnpm verify:scf-extraction\` to byte-compare every CSV against a fresh extraction.

## Per-file classification

| File | Authoring | Classification | sha256 | Reason |
|---|---|---|---|---|
${rows}
`;

  await writeFile(join(repoRoot, "data", "README.md"), readme, "utf8");
}

async function runCli(): Promise<void> {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const result = await verifyExtraction({ repoRoot });
  if (result.ok) {
    console.log(`✓ verified ${result.checked} canonical csv(s) against committed xlsx`);
    process.exit(0);
  }
  console.error(`✗ ${result.mismatches.length} mismatch(es) in ${result.checked} csv(s):`);
  for (const m of result.mismatches) {
    console.error(`  ${m.csv}: ${m.reason}`);
  }
  console.error("\nRun: pnpm exec node --import tsx scripts/extract-scf.ts");
  console.error("Then review the diff and commit if intentional.");
  process.exit(2);
}

const isCli =
  typeof process !== "undefined" &&
  !!process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  runCli().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
