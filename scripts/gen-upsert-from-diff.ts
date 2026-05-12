// scripts/gen-upsert-from-diff.ts
//
// Reads migrations-staging/scf-2026-1-1-diff.json (emitted by Task 3) and
// generates INSERT ... ON CONFLICT (pk) DO UPDATE SET ... SQL for every row
// in the `added` and `changed` ID lists, sourcing values from the Phase 1
// canonical CSVs in data/.
//
// Output: migrations-staging/scf-2026-1-1-upsert.sql (atomic write).
//
// The output is *advisory* — the operator hand-reviews and stitches it into
// the upgrade migration. SQL injection is not a concern in terms of execution
// here, but we still treat every CSV value as untrusted and escape properly.
//
// COLUMN MAPS — source of truth hierarchy:
//   1. supabase/migrations/20250731000000_create_scf_baseline.sql (schema)
//   2. lib/scf/writer.ts       (controls, domains, authoritative_sources)
//   3. scripts/seed-erl.ts     (scf_evidence_request_list)
//   4. scripts/seed-assessment-objectives.ts  (scf_assessment_objectives)
//   5. scripts/import-scf-data.js             (scf_risks, scf_threats)
//
// TABLE_SPECS below duplicates the table/CSV mapping from
// scripts/diff-scf-versions.ts (where it lives under the same name).
// If TABLE_SPECS changes in either file, keep both in sync. The canonical
// home is scripts/diff-scf-versions.ts; this file is advisory tooling only.
//
// COLUMNS NOT AUTO-EMITTED (operator must hand-fill these in the migration):
//   - scf_controls.domain_id (derived from id prefix, e.g. "ACC-01" → "ACC";
//     replicated here deterministically — see extractDomainId())
//   - scf_controls.risk_ids / threat_ids / assessment_objectives /
//     evidence_requests / control_questions (multi-column derivations or large
//     arrays that require full-row parse; operator should verify post-seed)
//   - scf_controls.guidance_* (large text blocks; included as text columns)
//   - scf_authoritative_sources: uses uuid PK (gen_random_uuid()), so conflict
//     target is the UNIQUE constraint on (mapping_column_header, geography,
//     import_id); because import_id is NULL for seed rows, ON CONFLICT cannot
//     target it. Authoritative sources are emitted with a leading comment
//     noting the operator must verify the upsert strategy.
//
// ADVISORY NOTE: authoritative_sources rows use a uuid PK and the UNIQUE
// constraint includes import_id (which is NULL for seed rows). Standard
// INSERT ... ON CONFLICT (id) DO UPDATE cannot target a uuid PK that is
// generated on insert. The emitted block uses ON CONFLICT DO NOTHING as a
// safe default — operator should hand-tune if updates are needed.

import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SqlType = "text" | "text-array" | "bool" | "int";

interface ColumnSpec {
  db: string; // column name in the database
  csv: string; // column header in the CSV (exact match after trim)
  sql: SqlType; // how to render the value in SQL
  notNull?: boolean; // emit DEFAULT '' fallback if cell is empty
}

interface TableSpec {
  table: string;
  csvFile: string;
  csvIdColumn: string; // header in CSV that maps to the PK
  dbIdColumn: string; // PK column in the DB
  conflictTarget: string; // ON CONFLICT (...) target — usually the PK
  columns: ColumnSpec[]; // ordered list of emitted columns (MUST include id)
}

// ---------------------------------------------------------------------------
// TABLE_SPECS
//
// Keep in sync with TABLE_SPECS in scripts/diff-scf-versions.ts (canonical).
// ---------------------------------------------------------------------------

const RISKS_TITLE_HEADER =
  'Risk*\nNote - Some of these risks may indicate a deficiency that could be considered a failure to meet "reasonable security practices" ';

const AO_OBJECTIVE_HEADER =
  "SCF Assessment Objective (AO)\nIn addition to relevant policies, standards and procedures, the assessor shall examine, interview, and/or test to determine if appropriately scoped evidence exists to support the claim that:";

const TABLE_SPECS: TableSpec[] = [
  // -------------------------------------------------------------------------
  // scf_controls — most columns sourced from controls.csv
  // Columns not auto-derived (domain_id is derived; risk_ids/threat_ids/AOs/
  // evidence_requests are multi-column; guidance columns are included):
  // -------------------------------------------------------------------------
  {
    table: "scf_controls",
    csvFile: "controls.csv",
    csvIdColumn: "SCF #",
    dbIdColumn: "id",
    conflictTarget: "id",
    columns: [
      { db: "id", csv: "SCF #", sql: "text", notNull: true },
      { db: "title", csv: "SCF Control", sql: "text", notNull: true },
      {
        db: "description",
        csv: "Secure Controls Framework (SCF)\nControl Description",
        sql: "text",
        notNull: true,
      },
      // domain_id is derived, not a raw CSV column — handled specially below
      {
        db: "guidance_micro",
        csv: "Possible Solutions & Considerations\nMicro-Small Business (<10 staff)\nBLS Firm Size Classes 1-2",
        sql: "text",
      },
      {
        db: "guidance_small",
        csv: "Possible Solutions & Considerations\nSmall Business (10-49 staff)\nBLS Firm Size Classes 3-4",
        sql: "text",
      },
      {
        db: "guidance_medium",
        csv: "Possible Solutions & Considerations\nMedium Business (50-249 staff)\nBLS Firm Size Classes 5-6",
        sql: "text",
      },
      {
        db: "guidance_large",
        csv: "Possible Solutions & Considerations\nLarge Business (250-999 staff)\nBLS Firm Size Classes 7-8",
        sql: "text",
      },
      {
        db: "guidance_enterprise",
        csv: "Possible Solutions & Considerations\nEnterprise (> 1,000 staff)\nBLS Firm Size Classes 9",
        sql: "text",
      },
    ],
  },
  // -------------------------------------------------------------------------
  // scf_authoritative_sources — uuid PK; ON CONFLICT DO NOTHING (see header)
  // -------------------------------------------------------------------------
  {
    table: "scf_authoritative_sources",
    csvFile: "Authoritative Sources.csv",
    csvIdColumn: "Focal Document Identifier (FDI)",
    dbIdColumn: "id",
    // uuid PK; no viable ON CONFLICT target without import_id — see header note.
    // We emit with a comment; operator must verify.
    conflictTarget: "__ADVISORY_DO_NOTHING__",
    columns: [
      { db: "geography", csv: "Geography", sql: "text", notNull: true },
      { db: "mapping_column_header", csv: "SCF Column Header", sql: "text", notNull: true },
      { db: "authoritative_source", csv: "Focal Document Name (FDN)", sql: "text", notNull: true },
      { db: "source_url", csv: "Focal Document Source (FDS)", sql: "text" },
      { db: "strm_url", csv: "Set Theory Relationship Mapping (STRM)", sql: "text" },
    ],
  },
  // -------------------------------------------------------------------------
  // scf_domains
  // -------------------------------------------------------------------------
  {
    table: "scf_domains",
    csvFile: "Domains and Principles.csv",
    csvIdColumn: "SCF Identifier",
    dbIdColumn: "id",
    conflictTarget: "id",
    columns: [
      { db: "id", csv: "SCF Identifier", sql: "text", notNull: true },
      { db: "name", csv: "SCF Domain", sql: "text", notNull: true },
      { db: "principle_intent", csv: "Principle Intent", sql: "text" },
    ],
  },
  // -------------------------------------------------------------------------
  // scf_evidence_request_list
  // PK is uuid; conflict target is (erl_id, import_id) unique constraint.
  // Seed rows have import_id = NULL; to upsert on erl_id alone we use
  // ON CONFLICT (erl_id) with a partial index — but the actual UNIQUE is on
  // (erl_id, import_id). Emit an advisory comment; operator should verify.
  // -------------------------------------------------------------------------
  {
    table: "scf_evidence_request_list",
    csvFile: "evidence-request-list.csv",
    csvIdColumn: "ERL #",
    dbIdColumn: "id",
    conflictTarget: "__ADVISORY_ERL__",
    columns: [
      { db: "erl_id", csv: "ERL #", sql: "text", notNull: true },
      { db: "area_of_focus", csv: "Area of Focus", sql: "text", notNull: true },
      { db: "documentation_artifact", csv: "Documentation Artifact", sql: "text", notNull: true },
      { db: "artifact_description", csv: "Artifact Description", sql: "text", notNull: true },
      { db: "scf_control_mappings", csv: "SCF Control Mappings", sql: "text-array" },
    ],
  },
  // -------------------------------------------------------------------------
  // scf_assessment_objectives
  // PK is uuid; UNIQUE on scf_ao_id — safe ON CONFLICT (scf_ao_id) target.
  // -------------------------------------------------------------------------
  {
    table: "scf_assessment_objectives",
    csvFile: "Assessment_objectives.csv",
    csvIdColumn: "SCF AO #",
    dbIdColumn: "scf_ao_id",
    conflictTarget: "scf_ao_id",
    columns: [
      { db: "scf_ao_id", csv: "SCF AO #", sql: "text", notNull: true },
      { db: "scf_control_id", csv: "SCF #", sql: "text", notNull: true },
      { db: "assessment_objective", csv: AO_OBJECTIVE_HEADER, sql: "text", notNull: true },
      {
        db: "origin",
        csv: "SCF Assessment Objective (AO) Origin(s)",
        sql: "text",
      },
      { db: "notes_errata", csv: "Notes / Errata", sql: "text" },
    ],
  },
  // -------------------------------------------------------------------------
  // scf_risks — text PK (id = Risk #)
  // -------------------------------------------------------------------------
  {
    table: "scf_risks",
    csvFile: "risks.csv",
    csvIdColumn: "Risk #",
    dbIdColumn: "id",
    conflictTarget: "id",
    columns: [
      { db: "id", csv: "Risk #", sql: "text", notNull: true },
      { db: "title", csv: RISKS_TITLE_HEADER, sql: "text", notNull: true },
      {
        db: "description",
        csv: "Description of Possible Risk Due To Control Deficiency",
        sql: "text",
      },
      { db: "risk_grouping", csv: "Risk Grouping", sql: "text" },
      { db: "nist_csf_function", csv: "NIST CSF \nFunction", sql: "text" },
    ],
  },
  // -------------------------------------------------------------------------
  // scf_threats — text PK (id = Threat #)
  // -------------------------------------------------------------------------
  {
    table: "scf_threats",
    csvFile: "threats.csv",
    csvIdColumn: "Threat #",
    dbIdColumn: "id",
    conflictTarget: "id",
    columns: [
      { db: "id", csv: "Threat #", sql: "text", notNull: true },
      { db: "title", csv: "Threat*", sql: "text", notNull: true },
      { db: "description", csv: "Threat Description", sql: "text" },
      { db: "threat_grouping", csv: "Threat Grouping", sql: "text" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Value renderers
// ---------------------------------------------------------------------------

/** Escape a string for Postgres single-quote literal. ' → '' */
function escapeSql(s: string): string {
  return s.replace(/'/g, "''");
}

/** Render a scalar value to a SQL literal. */
function renderScalar(raw: string | undefined | null, type: SqlType): string {
  const val = raw == null ? null : raw.trim();
  if (val === null || val === "") return "NULL";

  switch (type) {
    case "text":
      return `'${escapeSql(val)}'`;

    case "bool": {
      const lower = val.toLowerCase();
      if (lower === "true" || lower === "yes" || lower === "x") return "TRUE";
      if (lower === "false" || lower === "no" || lower === "") return "FALSE";
      // Unrecognised value — safe fallback
      return "NULL";
    }

    case "int": {
      if (/^-?\d+$/.test(val)) return val;
      return "NULL";
    }

    case "text-array":
      return renderTextArray(val);
  }
}

/** Render a delimited string to a Postgres ARRAY[...] literal.
 *  Delimiter: same as seed-erl.ts — any combination of commas/whitespace. */
function renderTextArray(raw: string): string {
  const elements = raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (elements.length === 0) return "ARRAY[]::text[]";
  return "ARRAY[" + elements.map((e) => `'${escapeSql(e)}'`).join(",") + "]";
}

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

/** Extract domain code from a control id: "ACC-01" → "ACC", "CHG-04" → "CHG". */
function extractDomainId(controlId: string): string {
  return controlId.match(/^([A-Z]+)-/)?.[1] ?? controlId.substring(0, 3).toUpperCase();
}

// ---------------------------------------------------------------------------
// Core pure function
// ---------------------------------------------------------------------------

export type DiffEntry = { added: string[]; changed: string[] };

/**
 * Generate upsert SQL for all tables with added+changed rows.
 *
 * @param diff     - Record<tableName, { added: string[], changed: string[] }>
 * @param csvRowsByTable - Record<tableName, parsed CSV rows (all rows, pre-filtered)>
 * @returns A multi-statement SQL string (operator-reviewed before applying).
 */
export function generateUpsertSQL(
  diff: Record<string, DiffEntry>,
  csvRowsByTable: Record<string, Array<Record<string, string>>>
): string {
  const blocks: string[] = [];

  for (const spec of TABLE_SPECS) {
    const tableDiff = diff[spec.table];
    if (!tableDiff) continue;

    const targets = new Set([...tableDiff.added, ...tableDiff.changed]);
    if (targets.size === 0) continue;

    const csvRows = csvRowsByTable[spec.table] ?? [];
    const rowsById = new Map<string, Record<string, string>>();
    for (const row of csvRows) {
      const id = row[spec.csvIdColumn]?.trim();
      if (id) rowsById.set(id, row);
    }

    const toUpsert: Array<Record<string, string>> = [];
    for (const id of targets) {
      const row = rowsById.get(id);
      if (!row) {
        // Warn but don't throw — advisory output
        blocks.push(
          `-- WARNING: id ${JSON.stringify(id)} not found in ${spec.csvFile}; skipped.\n`
        );
        continue;
      }
      toUpsert.push(row);
    }

    if (toUpsert.length === 0) continue;

    // Build the emitted columns list, potentially injecting domain_id for controls
    const emitColumns = [...spec.columns];
    const isControls = spec.table === "scf_controls";
    if (isControls) {
      // Inject domain_id right after id
      emitColumns.splice(1, 0, {
        db: "domain_id",
        csv: "__DERIVED__",
        sql: "text",
      });
    }

    const colNames = emitColumns.map((c) => c.db).join(", ");

    const valueRows = toUpsert.map((row) => {
      const vals = emitColumns.map((c) => {
        if (c.csv === "__DERIVED__" && c.db === "domain_id") {
          // Derived from control id
          const controlId = row[spec.csvIdColumn]?.trim() ?? "";
          const domainCode = extractDomainId(controlId);
          return `'${escapeSql(domainCode)}'`;
        }
        return renderScalar(row[c.csv], c.sql);
      });
      return "  (" + vals.join(", ") + ")";
    });

    // ON CONFLICT / DO UPDATE strategy
    let conflictClause: string;
    if (spec.conflictTarget === "__ADVISORY_DO_NOTHING__") {
      conflictClause = `ON CONFLICT DO NOTHING`;
      blocks.push(
        `-- ADVISORY: ${spec.table} uses a uuid PK. Rows with identical\n` +
          `-- (mapping_column_header, geography) will be silently skipped.\n` +
          `-- Operator: verify these rows are up-to-date after applying.\n`
      );
    } else if (spec.conflictTarget === "__ADVISORY_ERL__") {
      conflictClause =
        `ON CONFLICT (erl_id) WHERE import_id IS NULL\n` +
        `DO UPDATE SET\n` +
        emitColumns
          .filter((c) => c.db !== "erl_id" && c.db !== "id")
          .map((c) => `  ${c.db} = EXCLUDED.${c.db}`)
          .join(",\n");
      blocks.push(
        `-- NOTE: ${spec.table} conflict target uses partial index on (erl_id) WHERE import_id IS NULL.\n` +
          `-- This requires the partial unique index to exist on prod; verify before applying.\n`
      );
    } else {
      conflictClause =
        `ON CONFLICT (${spec.conflictTarget}) DO UPDATE SET\n` +
        emitColumns
          .filter((c) => c.db !== spec.conflictTarget && c.db !== spec.dbIdColumn)
          .map((c) => `  ${c.db} = EXCLUDED.${c.db}`)
          .join(",\n");
    }

    const block =
      `-- ${spec.table}: ${toUpsert.length} row(s) (added + changed)\n` +
      `INSERT INTO public.${spec.table} (${colNames})\nVALUES\n` +
      valueRows.join(",\n") +
      "\n" +
      conflictClause +
      ";\n";

    blocks.push(block);
  }

  return blocks.join("\n");
}

// ---------------------------------------------------------------------------
// CSV loader (used by main() only; not exposed for unit tests)
// ---------------------------------------------------------------------------

interface RisksRow {
  risk_grouping: string;
  risk_id: string;
  title: string;
  description: string;
  nist_csf_function: string;
}

interface ThreatsRow {
  threat_grouping: string;
  threat_id: string;
  title: string;
  description: string;
  materiality_pre_tax_income: string;
}

function loadCsvRows(spec: TableSpec, csvDir: string): Array<Record<string, string>> {
  const csvPath = join(csvDir, spec.csvFile);
  let content: string;
  try {
    content = readFileSync(csvPath, "utf8");
  } catch {
    console.warn(`[gen-upsert] WARNING: cannot read ${csvPath} — table ${spec.table} skipped.`);
    return [];
  }

  // risks.csv and threats.csv have multi-row preambles; use positional columns
  // and the same from_line offsets as import-scf-data.js.
  if (spec.table === "scf_risks") {
    const records = parse(content, {
      columns: [
        "Risk Grouping",
        "Risk #",
        RISKS_TITLE_HEADER,
        "Description of Possible Risk Due To Control Deficiency",
        "NIST CSF \nFunction",
      ],
      skip_empty_lines: true,
      from_line: 10,
      relax_column_count: true,
      bom: true,
    }) as Array<Record<string, string>>;
    // Filter out residual header-like rows
    return records.filter(
      (r) => r["Risk #"] && !r["Risk #"].includes("Risk #") && /^R-/.test(r["Risk #"])
    );
  }

  if (spec.table === "scf_threats") {
    const records = parse(content, {
      columns: [
        "Threat Grouping",
        "Threat #",
        "Threat*",
        "Threat Description",
        "materiality_pre_tax_income",
        "materiality_total_assets",
      ],
      skip_empty_lines: true,
      from_line: 8,
      relax_column_count: true,
      bom: true,
    }) as Array<Record<string, string>>;
    return records.filter(
      (r) => r["Threat #"] && !r["Threat #"].includes("Threat #") && /^[A-Z]T-/.test(r["Threat #"])
    );
  }

  // All other tables: standard header-row CSV
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
  }) as Array<Record<string, string>>;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const diffPath = "migrations-staging/scf-2026-1-1-diff.json";
  const outDir = "migrations-staging";
  const outFile = "scf-2026-1-1-upsert.sql";
  const outPath = join(outDir, outFile);
  const tmpPath = outPath + ".tmp";

  let rawDiff: Record<string, unknown>;
  try {
    rawDiff = JSON.parse(readFileSync(diffPath, "utf8")) as Record<string, unknown>;
  } catch {
    throw new Error(
      `gen-upsert: cannot read diff file at ${diffPath}. Run pnpm diff:scf-versions first.`
    );
  }

  const diff = (rawDiff.diff ?? {}) as Record<string, DiffEntry>;

  const csvDir = "data";

  // Load CSV rows for every table that has work to do
  const csvRowsByTable: Record<string, Array<Record<string, string>>> = {};
  for (const spec of TABLE_SPECS) {
    const tableDiff = diff[spec.table];
    if (!tableDiff) continue;
    const targets = new Set([...tableDiff.added, ...tableDiff.changed]);
    if (targets.size === 0) continue;
    csvRowsByTable[spec.table] = loadCsvRows(spec, csvDir);
  }

  const sql = generateUpsertSQL(diff, csvRowsByTable);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(tmpPath, sql, "utf8");
  renameSync(tmpPath, outPath);

  // Summary
  let totalRows = 0;
  const tableLines: string[] = [];
  for (const spec of TABLE_SPECS) {
    const tableDiff = diff[spec.table];
    if (!tableDiff) continue;
    const count = tableDiff.added.length + tableDiff.changed.length;
    if (count > 0) {
      tableLines.push(`  ${spec.table}: ${count} rows`);
      totalRows += count;
    }
  }

  if (tableLines.length === 0) {
    console.log("gen-upsert: no rows to upsert — output is empty.");
  } else {
    console.log("gen-upsert: rows per table:");
    tableLines.forEach((l) => console.log(l));
    console.log(`gen-upsert: total ${totalRows} rows`);
  }
  console.log(`gen-upsert: wrote ${outPath}`);
}

// Use fileURLToPath for reliable CLI entry detection under tsx
const isMain = process.argv[1] != null && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  void main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
