/**
 * Deterministic framework-manifest generator (roadmap stages 1–2,
 * plans/task-2026-07-11-scf-catalog-inventory.md).
 *
 * Joins every mapping column in data/controls.csv against the Focal Documents
 * sheet (data/Authoritative Sources.csv) by exact `SCF Column Header` string,
 * merges the reviewed human decisions from
 * data/framework-manifest.overrides.json, and emits
 * data/framework-manifest.json.
 *
 * Determinism contract: same committed CSVs + overrides in, byte-identical
 * manifest out. No network, no timestamps, no fuzzy matching — ambiguity goes
 * to the exceptions section, resolution goes to the overrides file.
 *
 * Usage:
 *   pnpm manifest:generate          # (re)write data/framework-manifest.json
 *   pnpm manifest:check             # regenerate in memory, diff vs committed
 */

import { parse } from "csv-parse/sync";
import { readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { FRAMEWORK_COLUMNS } from "../lib/scf-parser";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = join(REPO_ROOT, "data");
const CONTROLS_CSV = join(DATA_DIR, "controls.csv");
const FOCAL_DOCUMENTS_CSV = join(DATA_DIR, "Authoritative Sources.csv");
const PROVENANCE_JSON = join(DATA_DIR, "PROVENANCE.json");
const OVERRIDES_JSON = join(DATA_DIR, "framework-manifest.overrides.json");
const MANIFEST_JSON = join(DATA_DIR, "framework-manifest.json");

export const FRAMEWORK_KINDS = [
  "standard",
  "law",
  "baseline",
  "implementation-group",
  "historical",
  "reference",
] as const;
export type FrameworkKind = (typeof FRAMEWORK_KINDS)[number];

export const VISIBILITIES = ["supported", "preview", "excluded"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const EXPOSURE_STATUSES = ["public", "non-public"] as const;
export type ExposureStatus = (typeof EXPOSURE_STATUSES)[number];

export interface ManifestOverride {
  /** What the entry is: standard | law | baseline | implementation-group | historical | reference */
  kind: FrameworkKind;
  /** Product exposure tier. Separate axis from exposureStatus by design. */
  visibility: Visibility;
  /** Licensing/redistribution disposition. Separate axis from visibility by design. */
  exposureStatus: ExposureStatus;
  exposureReason: string;
  /** Correction only — generated default is the Focal Documents `Source` column. */
  family?: string;
  /** Correction only — generated default is derived from the imported parser entry or the header. */
  displayName?: string;
  version?: string;
  /** Required when visibility === "excluded". */
  exclusionReason?: string;
  notes?: string;
}

export interface FocalDocumentRecord {
  geography: string;
  scfColumnHeader: string;
  focalDocumentIdentifier: string;
  source: string;
  focalDocumentName: string;
  focalDocumentSourceUrl: string;
  strmUrl: string;
}

export type ResolutionStatus = "imported" | "classified" | "excluded" | "unresolved";

export interface ManifestEntry {
  key: string;
  upstreamHeader: string;
  columnIndex: number;
  displayName: string;
  version?: string;
  family: string;
  geography: string;
  kind: FrameworkKind | null;
  visibility: Visibility | null;
  exposureStatus: ExposureStatus | null;
  exposureReason: string | null;
  focalDocumentName: string;
  sourceUrl: string;
  strmUrl: string;
  mappingCount: number;
  currentlyImported: boolean;
  importedName?: string;
  importedVersion?: string;
  exclusionReason?: string;
  notes?: string;
  resolution: ResolutionStatus;
}

export interface ManifestException {
  type:
    | "focal-doc-without-column"
    | "column-without-focal-doc"
    | "zero-mapping-column"
    | "imported-without-focal-doc"
    | "duplicate-focal-doc-identifier";
  detail: string;
}

export interface FrameworkManifest {
  provenance: {
    scfVersion: string;
    workbookSha256: string;
    controlsCsvSha256: string;
    focalDocumentsCsvSha256: string;
  };
  summary: {
    mappingColumnRange: { first: number; last: number };
    mappingColumns: number;
    imported: number;
    classified: number;
    excluded: number;
    unresolved: number;
    exceptions: number;
  };
  entries: ManifestEntry[];
  exceptions: ManifestException[];
}

function parseCsv(path: string): string[][] {
  return parse(readFileSync(path, "utf-8"), {
    relax_column_count: true,
  }) as string[][];
}

export function parseFocalDocuments(rows: string[][]): {
  records: FocalDocumentRecord[];
  emptyHeaderRows: string[][];
} {
  const records: FocalDocumentRecord[] = [];
  const emptyHeaderRows: string[][] = [];
  for (const row of rows.slice(1)) {
    if ((row[1] ?? "").trim() === "") {
      emptyHeaderRows.push(row);
      continue;
    }
    records.push({
      geography: row[0] ?? "",
      scfColumnHeader: row[1],
      focalDocumentIdentifier: row[2] ?? "",
      source: row[3] ?? "",
      focalDocumentName: row[4] ?? "",
      focalDocumentSourceUrl: row[5] ?? "",
      strmUrl: row[6] ?? "",
    });
  }
  return { records, emptyHeaderRows };
}

/** Header-derived fallback display name: collapse embedded newlines to spaces. */
export function displayNameFromHeader(header: string): string {
  return header.replace(/\s*\n\s*/g, " ").trim();
}

export interface MappingRangeSentinels {
  /** Last non-framework column immediately before the mapping block. */
  before: string;
  /** First non-framework column immediately after the mapping block. */
  after: string;
}

// Structural boundaries of the framework-mapping block in the controls sheet.
// The range is derived from these sentinels — NOT from which columns happen to
// join to Focal Documents — so a framework column appended by a new SCF
// release is still inspected (and fails the completeness gate) even when Focal
// Documents lacks its row. If upstream renames either sentinel, the generator
// hard-fails: re-derive both against the new workbook.
export const MAPPING_RANGE_SENTINELS: MappingRangeSentinels = {
  before: "SCF\nCORE\nMergers, Acquisitions & Divestitures (MA&D)",
  after: "Minimum Security Requirements \nMCR + DSR",
};

export function findMappingRange(
  controlsHeader: string[],
  sentinels: MappingRangeSentinels = MAPPING_RANGE_SENTINELS
): { first: number; last: number } {
  const beforeIndex = controlsHeader.indexOf(sentinels.before);
  const afterIndex = controlsHeader.indexOf(sentinels.after);
  if (beforeIndex === -1 || afterIndex === -1) {
    const missing = [
      ...(beforeIndex === -1 ? [JSON.stringify(sentinels.before)] : []),
      ...(afterIndex === -1 ? [JSON.stringify(sentinels.after)] : []),
    ];
    throw new Error(
      `Mapping-range sentinel(s) not found in the controls header: ${missing.join(", ")}. ` +
        "The SCF workbook layout changed — re-derive MAPPING_RANGE_SENTINELS against the new controls sheet."
    );
  }
  if (afterIndex <= beforeIndex + 1) {
    throw new Error(
      `Mapping-range sentinels are inverted or adjacent (before=${beforeIndex}, after=${afterIndex}) — ` +
        "re-derive MAPPING_RANGE_SENTINELS against the new controls sheet."
    );
  }
  return { first: beforeIndex + 1, last: afterIndex - 1 };
}

export interface JoinResult {
  matched: { record: FocalDocumentRecord; columnIndex: number }[];
  /** Focal Documents whose header matched a column outside the sentinel range — a structural anomaly. */
  matchedOutsideRange: { record: FocalDocumentRecord; columnIndex: number }[];
  unmatchedFocalDocs: FocalDocumentRecord[];
  unmatchedColumnsInRange: { columnIndex: number; header: string }[];
  range: { first: number; last: number };
}

/**
 * Exact-string join of Focal Documents records onto controls-sheet header
 * cells within an explicit, structurally derived column range. Any unmatched
 * column inside the range is an exception, never a guess.
 */
export function joinFocalDocumentsToColumns(
  controlsHeader: string[],
  records: FocalDocumentRecord[],
  range: { first: number; last: number }
): JoinResult {
  const columnIndexByHeader = new Map<string, number>();
  controlsHeader.forEach((header, index) => {
    columnIndexByHeader.set(header, index);
  });

  const matched: JoinResult["matched"] = [];
  const matchedOutsideRange: JoinResult["matchedOutsideRange"] = [];
  const unmatchedFocalDocs: FocalDocumentRecord[] = [];
  for (const record of records) {
    const columnIndex = columnIndexByHeader.get(record.scfColumnHeader);
    if (columnIndex === undefined) {
      unmatchedFocalDocs.push(record);
    } else if (columnIndex < range.first || columnIndex > range.last) {
      matchedOutsideRange.push({ record, columnIndex });
    } else {
      matched.push({ record, columnIndex });
    }
  }
  matched.sort((a, b) => a.columnIndex - b.columnIndex);

  const matchedIndices = new Set(matched.map((m) => m.columnIndex));
  const unmatchedColumnsInRange: JoinResult["unmatchedColumnsInRange"] = [];
  for (let i = range.first; i <= range.last; i++) {
    if (!matchedIndices.has(i)) {
      unmatchedColumnsInRange.push({ columnIndex: i, header: controlsHeader[i] });
    }
  }
  return { matched, matchedOutsideRange, unmatchedFocalDocs, unmatchedColumnsInRange, range };
}

export function countMappings(dataRows: string[][], columnIndex: number): number {
  let count = 0;
  for (const row of dataRows) {
    if ((row[columnIndex] ?? "").trim() !== "") count++;
  }
  return count;
}

type OverridesFile = Record<string, ManifestOverride>;

export function validateOverrides(overrides: OverridesFile, validKeys: Set<string>): string[] {
  const errors: string[] = [];
  for (const [key, override] of Object.entries(overrides)) {
    if (!validKeys.has(key)) {
      errors.push(`override key "${key}" matches no generated manifest entry`);
    }
    if (!FRAMEWORK_KINDS.includes(override.kind)) {
      errors.push(`override "${key}": invalid kind "${override.kind}"`);
    }
    if (!VISIBILITIES.includes(override.visibility)) {
      errors.push(`override "${key}": invalid visibility "${override.visibility}"`);
    }
    if (!EXPOSURE_STATUSES.includes(override.exposureStatus)) {
      errors.push(`override "${key}": invalid exposureStatus "${override.exposureStatus}"`);
    }
    if (!override.exposureReason?.trim()) {
      errors.push(`override "${key}": exposureReason is required`);
    }
    if (override.visibility === "excluded" && !override.exclusionReason?.trim()) {
      errors.push(`override "${key}": visibility "excluded" requires exclusionReason`);
    }
  }
  return errors;
}

export function buildManifest(
  controlsRows: string[][],
  focalRows: string[][],
  overrides: OverridesFile,
  provenance: FrameworkManifest["provenance"],
  sentinels: MappingRangeSentinels = MAPPING_RANGE_SENTINELS
): FrameworkManifest {
  const controlsHeader = controlsRows[0];
  const dataRows = controlsRows.slice(1);
  const { records, emptyHeaderRows } = parseFocalDocuments(focalRows);
  const range = findMappingRange(controlsHeader, sentinels);
  const joined = joinFocalDocumentsToColumns(controlsHeader, records, range);

  if (joined.matchedOutsideRange.length > 0) {
    const details = joined.matchedOutsideRange.map(
      (m) => `"${m.record.focalDocumentIdentifier}" at column ${m.columnIndex}`
    );
    throw new Error(
      `Focal Documents header(s) matched outside the sentinel-bounded mapping range: ${details.join(", ")} — ` +
        "the workbook layout changed; re-derive MAPPING_RANGE_SENTINELS."
    );
  }

  const importedByHeader = new Map(
    FRAMEWORK_COLUMNS.map((config) => [config.expectedHeader, config])
  );

  const exceptions: ManifestException[] = [];
  for (const row of emptyHeaderRows) {
    exceptions.push({
      type: "focal-doc-without-column",
      detail: `Focal Documents row with empty SCF Column Header (geography="${row[0]}") — upstream status marker, not a framework`,
    });
  }
  for (const record of joined.unmatchedFocalDocs) {
    exceptions.push({
      type: "focal-doc-without-column",
      detail: `Focal Document "${record.focalDocumentIdentifier}" header not found in controls.csv: ${JSON.stringify(record.scfColumnHeader)}`,
    });
  }
  for (const unmatched of joined.unmatchedColumnsInRange) {
    exceptions.push({
      type: "column-without-focal-doc",
      detail: `controls.csv column ${unmatched.columnIndex} inside mapping range has no Focal Documents row: ${JSON.stringify(unmatched.header)}`,
    });
  }

  const matchedHeaders = new Set(joined.matched.map((m) => m.record.scfColumnHeader));
  for (const config of FRAMEWORK_COLUMNS) {
    if (!matchedHeaders.has(config.expectedHeader)) {
      exceptions.push({
        type: "imported-without-focal-doc",
        detail: `FRAMEWORK_COLUMNS entry "${config.frameworkName}" (column ${config.columnIndex}) matches no Focal Documents row`,
      });
    }
  }

  // Upstream FDIs are not guaranteed unique (2026.2 assigns
  // "americas-can-osfi-self-assessment" to two columns). Manifest keys must be
  // unique — first occurrence keeps the FDI, later ones get a deterministic
  // "-column-<index>" suffix, and each collision is surfaced as an exception.
  const seenKeys = new Set<string>();
  const keyFor = (record: FocalDocumentRecord, columnIndex: number): string => {
    let key = record.focalDocumentIdentifier;
    if (seenKeys.has(key)) {
      key = `${key}-column-${columnIndex}`;
      exceptions.push({
        type: "duplicate-focal-doc-identifier",
        detail: `Focal Documents assigns "${record.focalDocumentIdentifier}" to more than one column; column ${columnIndex} keyed as "${key}"`,
      });
    }
    seenKeys.add(key);
    return key;
  };

  const entries: ManifestEntry[] = joined.matched.map(({ record, columnIndex }) => {
    const imported = importedByHeader.get(record.scfColumnHeader);
    const key = keyFor(record, columnIndex);
    const override = overrides[key];
    const mappingCount = countMappings(dataRows, columnIndex);
    if (mappingCount === 0) {
      exceptions.push({
        type: "zero-mapping-column",
        detail: `"${record.focalDocumentIdentifier}" (column ${columnIndex}) has zero mapped controls`,
      });
    }

    let resolution: ResolutionStatus;
    if (!override) {
      resolution = "unresolved";
    } else if (override.visibility === "excluded") {
      resolution = "excluded";
    } else if (imported) {
      resolution = "imported";
    } else {
      resolution = "classified";
    }

    return {
      key,
      upstreamHeader: record.scfColumnHeader,
      columnIndex,
      displayName:
        override?.displayName ??
        imported?.frameworkName ??
        displayNameFromHeader(record.scfColumnHeader),
      ...((override?.version ?? imported?.frameworkVersion)
        ? { version: override?.version ?? imported?.frameworkVersion }
        : {}),
      family: override?.family ?? record.source,
      geography: record.geography,
      kind: override?.kind ?? null,
      visibility: override?.visibility ?? null,
      exposureStatus: override?.exposureStatus ?? null,
      exposureReason: override?.exposureReason ?? null,
      focalDocumentName: record.focalDocumentName,
      sourceUrl: record.focalDocumentSourceUrl,
      strmUrl: record.strmUrl,
      mappingCount,
      currentlyImported: Boolean(imported),
      ...(imported ? { importedName: imported.frameworkName } : {}),
      ...(imported?.frameworkVersion ? { importedVersion: imported.frameworkVersion } : {}),
      ...(override?.exclusionReason ? { exclusionReason: override.exclusionReason } : {}),
      ...(override?.notes ? { notes: override.notes } : {}),
      resolution,
    };
  });

  exceptions.sort((a, b) => a.type.localeCompare(b.type) || a.detail.localeCompare(b.detail));

  const count = (status: ResolutionStatus) => entries.filter((e) => e.resolution === status).length;

  return {
    provenance,
    summary: {
      mappingColumnRange: joined.range,
      mappingColumns: entries.length,
      imported: count("imported"),
      classified: count("classified"),
      excluded: count("excluded"),
      unresolved: count("unresolved"),
      exceptions: exceptions.length,
    },
    entries,
    exceptions,
  };
}

interface ProvenanceFile {
  scfVersion: string;
  xlsx: { sha256: string };
  sheets: { csv: string; sha256: string }[];
}

export function generate(): FrameworkManifest {
  const provenanceFile = JSON.parse(readFileSync(PROVENANCE_JSON, "utf-8")) as ProvenanceFile;
  const sheetSha = (csvName: string): string => {
    const sheet = provenanceFile.sheets.find((s) => s.csv === `data/${csvName}`);
    if (!sheet) throw new Error(`PROVENANCE.json has no sheet entry for data/${csvName}`);
    return sheet.sha256;
  };

  const controlsRows = parseCsv(CONTROLS_CSV);
  const focalRows = parseCsv(FOCAL_DOCUMENTS_CSV);
  const overrides = JSON.parse(readFileSync(OVERRIDES_JSON, "utf-8")) as OverridesFile;

  const manifest = buildManifest(controlsRows, focalRows, overrides, {
    scfVersion: provenanceFile.scfVersion,
    workbookSha256: provenanceFile.xlsx.sha256,
    controlsCsvSha256: sheetSha("controls.csv"),
    focalDocumentsCsvSha256: sheetSha("Authoritative Sources.csv"),
  });

  // Validate against final (collision-disambiguated) entry keys.
  const validKeys = new Set(manifest.entries.map((e) => e.key));
  const overrideErrors = validateOverrides(overrides, validKeys);
  if (overrideErrors.length > 0) {
    throw new Error(
      `framework-manifest.overrides.json is invalid:\n  ${overrideErrors.join("\n  ")}`
    );
  }

  return manifest;
}

export function serializeManifest(manifest: FrameworkManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function readCommittedManifest(): string {
  return readFileSync(MANIFEST_JSON, "utf-8");
}

function main(): void {
  const checkMode = process.argv.includes("--check");
  const manifest = generate();
  const serialized = serializeManifest(manifest);

  if (checkMode) {
    const committed = readCommittedManifest();
    if (committed !== serialized) {
      console.error(
        "data/framework-manifest.json is stale — regenerate with `pnpm manifest:generate` and review the diff."
      );
      process.exit(1);
    }
    console.log("framework-manifest.json is fresh (byte-identical to regeneration).");
  } else {
    writeFileSync(MANIFEST_JSON, serialized);
    console.log(`Wrote data/framework-manifest.json`);
  }

  const { summary } = manifest;
  console.log(
    `columns ${summary.mappingColumnRange.first}–${summary.mappingColumnRange.last}: ` +
      `${summary.mappingColumns} frameworks | imported ${summary.imported} | classified ${summary.classified} | ` +
      `excluded ${summary.excluded} | unresolved ${summary.unresolved} | exceptions ${summary.exceptions}`
  );
  if (summary.unresolved > 0) {
    const unresolvedKeys = manifest.entries
      .filter((e) => e.resolution === "unresolved")
      .map((e) => e.key);
    console.log(`unresolved: ${unresolvedKeys.join(", ")}`);
  }
}

const isDirectInvocation =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectInvocation) {
  main();
}
