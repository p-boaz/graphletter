// scripts/diff-scf-versions.ts
//
// Compares the 2026.1.1 canonical CSVs (data/) to the SCF rows currently in
// the connected Supabase project (typically prod at 2025.1.1). Emits a
// per-table classification:
//
//   - added:     ids in 2026.1.1 CSV, not in DB
//   - removed:   ids in DB at the prior version, not in 2026.1.1 CSV
//   - changed:   ids in both, but >=1 non-id column differs
//   - unchanged: ids in both with identical column values
//
// Output: migrations-staging/scf-2026-1-1-diff.json
//
// Read-only against the DB; safe to run against prod.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const PAGE = 1000;

export interface TableDiff {
  added: string[];
  removed: string[];
  changed: string[];
  unchanged: string[];
}

export interface VersionDiff {
  missingFiles: string[];
  tables: Record<string, TableDiff>;
}

interface TableSpec {
  table: string;
  csvFile: string;
  idColumn: string; // PK column in DB
  csvIdColumn: string; // header in CSV
  compareColumns: Array<{ db: string; csv: string }>;
}

const TABLE_SPECS: TableSpec[] = [
  {
    table: "scf_controls",
    csvFile: "controls.csv",
    idColumn: "id",
    csvIdColumn: "SCF #",
    compareColumns: [
      { db: "title", csv: "SCF Control" },
      { db: "description", csv: "Description" },
    ],
  },
  {
    table: "scf_authoritative_sources",
    csvFile: "Authoritative Sources.csv",
    idColumn: "id",
    csvIdColumn: "Focal Document Identifier",
    compareColumns: [
      { db: "authoritative_source", csv: "Focal Document Name" },
      { db: "source_url", csv: "Focal Document Source URL" },
    ],
  },
  {
    table: "scf_domains",
    csvFile: "Domains and Principles.csv",
    idColumn: "id",
    csvIdColumn: "Domain",
    compareColumns: [{ db: "principle_intent", csv: "Principle Intent" }],
  },
  {
    table: "scf_evidence_request_list",
    csvFile: "evidence-request-list.csv",
    idColumn: "erl_number",
    csvIdColumn: "Evidence Request List #",
    compareColumns: [
      { db: "title", csv: "Title" },
      { db: "evidence_request", csv: "Evidence Request" },
    ],
  },
  {
    table: "scf_assessment_objectives",
    csvFile: "Assessment_objectives.csv",
    idColumn: "scf_ao_id",
    csvIdColumn: "SCF AO #",
    compareColumns: [{ db: "assessment_objective", csv: "Assessment Objective" }],
  },
  {
    table: "scf_risks",
    csvFile: "risks.csv",
    idColumn: "id",
    csvIdColumn: "Risk ID",
    compareColumns: [
      { db: "name", csv: "Risk Name" },
      { db: "description", csv: "Risk Description" },
    ],
  },
  {
    table: "scf_threats",
    csvFile: "threats.csv",
    idColumn: "id",
    csvIdColumn: "Threat ID",
    compareColumns: [
      { db: "name", csv: "Threat Name" },
      { db: "description", csv: "Threat Description" },
    ],
  },
];

function readCSVRows(path: string): Array<Record<string, string>> {
  const content = readFileSync(path, "utf8");
  // bom:true strips the UTF-8 BOM that Excel may prepend to the first header cell
  return parse(content, { columns: true, skip_empty_lines: true, bom: true });
}

function rowsChanged(
  dbRow: Record<string, unknown>,
  csvRow: Record<string, string>,
  cols: TableSpec["compareColumns"]
): boolean {
  // Values are stringified for comparison; works for all current text columns.
  // Arrays or JSON columns would need custom logic here.
  for (const { db, csv } of cols) {
    const dbVal = dbRow[db] == null ? "" : String(dbRow[db]);
    const csvVal = csvRow[csv] == null ? "" : String(csvRow[csv]);
    if (dbVal.trim() !== csvVal.trim()) return true;
  }
  return false;
}

/** Fetch all rows from a table for a given scf_version, paginating past the
 *  PostgREST 1000-row default cap via .range(). */
async function fetchAllRows(
  supabase: SupabaseClient,
  table: string,
  version: string
): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("scf_version", version)
      .range(from, from + PAGE - 1);

    if (error) {
      throw new Error(`diff: failed to fetch ${table}: ${error.message}`);
    }

    const page = data ?? [];
    rows.push(...page);

    if (page.length < PAGE) break;
    from += PAGE;
  }

  return rows;
}

export async function diffSCFVersions(
  supabase: SupabaseClient,
  csvDir: string,
  priorVersion: string,
  _newVersion: string
): Promise<VersionDiff> {
  const missingFiles: string[] = [];
  const tables: Record<string, TableDiff> = {};

  for (const spec of TABLE_SPECS) {
    const csvPath = join(csvDir, spec.csvFile);

    if (!existsSync(csvPath)) {
      // Surface missing CSVs in output rather than silently skipping
      console.warn(
        `[diff-scf-versions] WARNING: CSV not found for table "${spec.table}": ${csvPath}`
      );
      missingFiles.push(csvPath);
      continue;
    }

    const allCsvRows = readCSVRows(csvPath);

    // Filter rows where the id column is falsy/empty (e.g. BOM-mangled headers)
    const validCsvRows = allCsvRows.filter((r) => {
      const id = r[spec.csvIdColumn];
      return id != null && id.trim() !== "";
    });
    const skipped = allCsvRows.length - validCsvRows.length;
    if (skipped > 0) {
      console.warn(
        `[diff-scf-versions] WARNING: dropped ${skipped} CSV row(s) with empty id in "${spec.table}" (column "${spec.csvIdColumn}")`
      );
    }

    const csvById = new Map(validCsvRows.map((r) => [r[spec.csvIdColumn], r]));

    const dbRows = await fetchAllRows(supabase, spec.table, priorVersion);
    const dbById = new Map(dbRows.map((r) => [String(r[spec.idColumn]), r]));

    const added: string[] = [];
    const removed: string[] = [];
    const changed: string[] = [];
    const unchanged: string[] = [];

    for (const [id, csvRow] of csvById) {
      const dbRow = dbById.get(id);
      if (!dbRow) {
        added.push(id);
      } else if (rowsChanged(dbRow, csvRow, spec.compareColumns)) {
        changed.push(id);
      } else {
        unchanged.push(id);
      }
    }
    for (const id of dbById.keys()) {
      if (!csvById.has(id)) removed.push(id);
    }

    tables[spec.table] = {
      added: added.sort(),
      removed: removed.sort(),
      changed: changed.sort(),
      unchanged: unchanged.sort(),
    };
  }

  return { missingFiles, tables };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  // Read versions from argv with hardcoded fallback defaults
  const priorVersion = process.argv[2] ?? "2025.1.1";
  const newVersion = process.argv[3] ?? "2026.1.1";
  console.log(
    `[diff-scf-versions] comparing priorVersion=${priorVersion} → newVersion=${newVersion}`
  );

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const result = await diffSCFVersions(supabase, "data", priorVersion, newVersion);

  if (result.missingFiles.length > 0) {
    console.warn(
      `[diff-scf-versions] ${result.missingFiles.length} CSV file(s) were missing — those tables are omitted from the diff`
    );
  }

  mkdirSync("migrations-staging", { recursive: true });
  const outPath = "migrations-staging/scf-2026-1-1-diff.json";
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        priorVersion,
        newVersion,
        missingFiles: result.missingFiles,
        diff: result.tables,
      },
      null,
      2
    ) + "\n"
  );

  let totalAdded = 0;
  let totalRemoved = 0;
  let totalChanged = 0;
  for (const [table, td] of Object.entries(result.tables)) {
    console.log(
      `${table}: +${td.added.length} -${td.removed.length} ~${td.changed.length} =${td.unchanged.length}`
    );
    totalAdded += td.added.length;
    totalRemoved += td.removed.length;
    totalChanged += td.changed.length;
  }
  console.log(`\ntotal: +${totalAdded} -${totalRemoved} ~${totalChanged}`);
  console.log(`wrote ${outPath}`);
}

// Use fileURLToPath for reliable CLI entry detection under tsx
const isMain = process.argv[1] != null && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  void main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
