#!/usr/bin/env node
/**
 * Deterministic XLSX → canonical CSV extractor for the vendored SCF workbook (version per data/PROVENANCE.json).
 * Library entry: extractWorkbookToCsvs() — pure, used by tests + CLI + verifier.
 * CLI entry: reads the workbook named in data/PROVENANCE.json and writes
 * the CSVs listed in data/PROVENANCE.json, then rewrites PROVENANCE.json with
 * the freshly computed sha256s.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as XLSX from "xlsx";
import { stringify } from "csv-stringify/sync";

export interface SheetMapping {
  readonly sheet: string;
  readonly csv: string;
}

export interface ExtractedSheet {
  readonly sheet: string;
  readonly csv: string;
  readonly sha256: string;
  readonly rows: number;
  readonly bytes: number;
}

export interface ExtractOptions {
  readonly xlsxPath: string;
  readonly outDir: string;
  readonly mapping: readonly SheetMapping[];
}

/**
 * Normalize cell text to canonical form:
 *   - CRLF / CR → LF (so the whole CSV is LF-only)
 *   - trailing whitespace on each line is preserved (upstream choice)
 * This is a format normalization, not a content change.
 */
function normalizeCell(value: unknown): string {
  if (value == null) return "";
  return String(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function rowsFromSheet(sheet: XLSX.WorkSheet): string[][] {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  });
  // Right-pad short rows to a uniform width so downstream parsers see a
  // rectangular CSV; XLSX rows can be jagged when trailing cells are blank.
  const maxLen = aoa.reduce((m, r) => Math.max(m, r.length), 0);
  return aoa.map((row) => {
    const padded: string[] = [];
    for (let i = 0; i < maxLen; i++) {
      padded.push(normalizeCell(row[i]));
    }
    return padded;
  });
}

export async function extractWorkbookToCsvs(opts: ExtractOptions): Promise<ExtractedSheet[]> {
  const xlsxBuf = await readFile(opts.xlsxPath);
  const wb = XLSX.read(xlsxBuf, { type: "buffer", cellDates: false, cellNF: false });
  await mkdir(opts.outDir, { recursive: true });

  const results: ExtractedSheet[] = [];
  for (const { sheet, csv } of opts.mapping) {
    const ws = wb.Sheets[sheet];
    if (!ws) {
      const available = wb.SheetNames.join(", ");
      throw new Error(`Sheet not found: ${sheet}. Available sheets: ${available}`);
    }
    const rows = rowsFromSheet(ws);
    const csvText = stringify(rows, {
      quoted_string: false,
      quoted_empty: false,
      record_delimiter: "\n",
      eof: true,
    });
    const buf = Buffer.from(csvText, "utf8");
    const outPath = join(opts.outDir, csv);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, new Uint8Array(buf));
    results.push({
      sheet,
      csv,
      sha256: createHash("sha256").update(new Uint8Array(buf)).digest("hex"),
      rows: rows.length,
      bytes: buf.length,
    });
  }
  return results;
}

/**
 * Derive data/full_scf_rev.csv: a deterministic column projection of the
 * controls sheet consumed by scripts/import-scf-data.js (maturity levels +
 * control-risk/threat mappings). Columns are located by header text, never by
 * position, so upstream column inserts cannot silently shift the projection.
 * Projected columns: SCF #, SCR-CMM Level 0–5, then the contiguous
 * Risk/Threat block ("Risk Threat Summary" … last "Threat" column).
 */
export async function deriveFullScfRev(opts: {
  readonly xlsxPath: string;
  readonly controlsSheet: string;
  readonly outPath: string;
}): Promise<{ sha256: string; rows: number; bytes: number }> {
  const xlsxBuf = await readFile(opts.xlsxPath);
  const wb = XLSX.read(xlsxBuf, { type: "buffer", cellDates: false, cellNF: false });
  const ws = wb.Sheets[opts.controlsSheet];
  if (!ws) {
    throw new Error(`deriveFullScfRev: sheet not found: ${opts.controlsSheet}`);
  }
  const rows = rowsFromSheet(ws);
  const headers = rows[0];

  const findHeader = (label: string, predicate: (h: string) => boolean): number => {
    const idx = headers.findIndex(predicate);
    if (idx < 0) throw new Error(`deriveFullScfRev: header not found: ${label}`);
    return idx;
  };

  const idCol = findHeader("SCF #", (h) => h.trim() === "SCF #");
  const cmmCols = [0, 1, 2, 3, 4, 5].map((n) =>
    findHeader(`SCR-CMM Level ${n}`, (h) => h.startsWith(`SCR-CMM Level ${n}`))
  );
  const riskStart = findHeader("Risk Threat Summary", (h) => h.startsWith("Risk Threat Summary"));
  let riskEnd = riskStart;
  for (let i = riskStart; i < headers.length; i++) {
    const h = headers[i];
    if (
      h.startsWith("Risk Threat Summary") ||
      h.startsWith("Control Threat Summary") ||
      h.startsWith("Risk\n") ||
      h.startsWith("Threat\n")
    ) {
      riskEnd = i;
    } else {
      break;
    }
  }

  const cols = [idCol, ...cmmCols];
  for (let i = riskStart; i <= riskEnd; i++) cols.push(i);

  const projected = rows.map((row) => cols.map((c) => row[c] ?? ""));
  const csvText = stringify(projected, {
    quoted_string: false,
    quoted_empty: false,
    record_delimiter: "\n",
    eof: true,
  });
  const buf = Buffer.from(csvText, "utf8");
  await mkdir(dirname(opts.outPath), { recursive: true });
  await writeFile(opts.outPath, new Uint8Array(buf));
  return {
    sha256: createHash("sha256").update(new Uint8Array(buf)).digest("hex"),
    rows: projected.length,
    bytes: buf.length,
  };
}

interface Manifest {
  scfVersion: string;
  license: string;
  licenseUrl: string;
  source: { publisher: string; url: string; downloadedAt: string };
  xlsx: { path: string; sha256: string; bytes: number };
  extraction: Record<string, unknown>;
  sheets: Array<{ sheet: string; csv: string; consumer: string; sha256: string | null }>;
  derived?: Array<{ sourceSheet: string; csv: string; consumer: string; sha256: string | null }>;
  graphletterAuthored: string[];
  documentation: string[];
}

async function runCli(): Promise<void> {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const manifestPath = join(repoRoot, "data", "PROVENANCE.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;

  const xlsxAbs = join(repoRoot, manifest.xlsx.path);
  const xlsxBuf = await readFile(xlsxAbs);
  const xlsxSha = createHash("sha256").update(new Uint8Array(xlsxBuf)).digest("hex");
  if (xlsxSha !== manifest.xlsx.sha256) {
    throw new Error(
      `XLSX sha256 mismatch.\n  manifest: ${manifest.xlsx.sha256}\n  actual:   ${xlsxSha}\nIf this is an intentional upstream version bump, update PROVENANCE.json first.`
    );
  }

  const mapping: SheetMapping[] = manifest.sheets.map((s) => ({
    sheet: s.sheet,
    csv: s.csv.replace(/^data\//, ""),
  }));

  const results = await extractWorkbookToCsvs({
    xlsxPath: xlsxAbs,
    outDir: join(repoRoot, "data"),
    mapping,
  });

  const bySheet = new Map(results.map((r) => [r.sheet, r]));
  for (const entry of manifest.sheets) {
    const r = bySheet.get(entry.sheet);
    if (r) entry.sha256 = r.sha256;
  }

  for (const entry of manifest.derived ?? []) {
    const d = await deriveFullScfRev({
      xlsxPath: xlsxAbs,
      controlsSheet: entry.sourceSheet,
      outPath: join(repoRoot, entry.csv),
    });
    entry.sha256 = d.sha256;
    console.log(
      `  ${entry.csv.replace(/^data\//, "").padEnd(40)} rows=${String(d.rows).padStart(6)}  sha256=${d.sha256.slice(0, 12)}… (derived)`
    );
  }

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  console.log(`extracted ${results.length} sheet(s) from ${manifest.xlsx.path}:`);
  for (const r of results) {
    console.log(
      `  ${r.csv.padEnd(40)} rows=${String(r.rows).padStart(6)}  sha256=${r.sha256.slice(0, 12)}…`
    );
  }
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
