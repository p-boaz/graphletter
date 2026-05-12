// scripts/check-scf-deletion-safety.ts
//
// For each removed ID in the SCF 2025.1.1 → 2026.1.1 diff, queries the
// referential graph and counts how many customer-authored rows in each
// referrer table point at that ID. Partitions removed IDs into:
//
//   - safe-to-delete:    zero inbound references
//   - safe-with-orphans: only SET NULL FKs reference it; data survives, link severed
//   - requires-decision: CASCADE or NO ACTION FK with row count > 0 (data loss or blocked delete)
//
// Output: migrations-staging/scf-2026-1-1-deletion-safety.json
//
// Read-only against the DB; safe to run against prod.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { VersionDiff } from "./diff-scf-versions";

export type Classification = "safe-to-delete" | "safe-with-orphans" | "requires-decision";

export interface InboundReference {
  referringTable: string;
  referringColumn: string;
  deleteRule: string;
  rowCount: number;
}

export interface RemovedIDReport {
  id: string;
  scfTable: string;
  classification: Classification;
  inboundReferences: InboundReference[];
}

export interface SafetyReport {
  removed: RemovedIDReport[];
  summary: {
    safeToDelete: number;
    safeWithOrphans: number;
    requiresDecision: number;
  };
}

interface FKMetadataRow {
  referring_table: string;
  referring_column: string;
  referenced_table: string;
  referenced_column: string;
  delete_rule: string;
}

function classify(refs: InboundReference[]): Classification {
  let hasDestructive = false;
  let hasSetNull = false;
  for (const r of refs) {
    if (r.rowCount === 0) continue;
    if (r.deleteRule === "CASCADE" || r.deleteRule === "NO ACTION" || r.deleteRule === "RESTRICT") {
      hasDestructive = true;
    } else if (r.deleteRule === "SET NULL" || r.deleteRule === "SET DEFAULT") {
      hasSetNull = true;
    }
  }
  if (hasDestructive) return "requires-decision";
  if (hasSetNull) return "safe-with-orphans";
  return "safe-to-delete";
}

export async function checkDeletionSafety(
  supabase: SupabaseClient,
  diff: VersionDiff
): Promise<SafetyReport> {
  // 1. Fetch FK metadata for every SCF table (the script ships the SQL
  // function; this assumes it's already deployed).
  const { data: fkRows, error: fkError } = await supabase.rpc("get_fk_metadata", {
    referenced_schema: "public",
  });
  if (fkError) {
    throw new Error(`Failed to fetch FK metadata: ${fkError.message}`);
  }

  const fksByReferencedTable = new Map<string, FKMetadataRow[]>();
  for (const row of (fkRows ?? []) as FKMetadataRow[]) {
    const existing = fksByReferencedTable.get(row.referenced_table) ?? [];
    existing.push(row);
    fksByReferencedTable.set(row.referenced_table, existing);
  }

  const removed: RemovedIDReport[] = [];

  for (const [scfTable, td] of Object.entries(diff.tables)) {
    if (td.removed.length === 0) continue;
    const fks = fksByReferencedTable.get(scfTable) ?? [];

    for (const id of td.removed) {
      const inboundReferences: InboundReference[] = [];

      for (const fk of fks) {
        const { count, error } = await supabase
          .from(fk.referring_table)
          .select("*", { count: "exact", head: true })
          .eq(fk.referring_column, id);
        if (error) {
          throw new Error(
            `Failed counting ${fk.referring_table}.${fk.referring_column}=${id}: ${error.message}`
          );
        }
        if ((count ?? 0) > 0) {
          inboundReferences.push({
            referringTable: fk.referring_table,
            referringColumn: fk.referring_column,
            deleteRule: fk.delete_rule,
            rowCount: count ?? 0,
          });
        }
      }

      removed.push({
        id,
        scfTable,
        classification: classify(inboundReferences),
        inboundReferences,
      });
    }
  }

  const summary = {
    safeToDelete: removed.filter((r) => r.classification === "safe-to-delete").length,
    safeWithOrphans: removed.filter((r) => r.classification === "safe-with-orphans").length,
    requiresDecision: removed.filter((r) => r.classification === "requires-decision").length,
  };

  return { removed, summary };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const diffPath = "migrations-staging/scf-2026-1-1-diff.json";
  const parsed = JSON.parse(readFileSync(diffPath, "utf8")) as {
    missingFiles?: string[];
    diff: VersionDiff["tables"];
  };
  const diff: VersionDiff = {
    missingFiles: parsed.missingFiles ?? [],
    tables: parsed.diff,
  };

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const report = await checkDeletionSafety(supabase, diff);

  mkdirSync("migrations-staging", { recursive: true });
  const outPath = "migrations-staging/scf-2026-1-1-deletion-safety.json";
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        priorVersion: "2025.1.1",
        newVersion: "2026.1.1",
        ...report,
      },
      null,
      2
    ) + "\n"
  );

  console.log(`safe-to-delete:    ${report.summary.safeToDelete}`);
  console.log(`safe-with-orphans: ${report.summary.safeWithOrphans}`);
  console.log(`requires-decision: ${report.summary.requiresDecision}`);
  console.log(`\nwrote ${outPath}`);

  if (report.summary.requiresDecision > 0) {
    console.error(
      `\n❌ ${report.summary.requiresDecision} removed IDs have customer-authored row references.\n` +
        `   Inspect ${outPath} and resolve case-by-case before applying the upgrade migration.`
    );
    process.exit(2);
  }
}

// Use fileURLToPath for reliable CLI entry detection under tsx
const isMain = process.argv[1] != null && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  void main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
