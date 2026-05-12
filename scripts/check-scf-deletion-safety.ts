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

import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
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

  // Split an array into groups of at most `size` elements.
  function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  // Fetch every row where fk.referring_column is IN removedIds, paginating
  // through PostgREST's page size (default 1000) to avoid silent count caps.
  // Returns a map from id → tally of referring rows.
  //
  // Type note: the Supabase query builder's generic return types are too complex
  // for a narrow cast here; we reach through via `unknown` and validate at
  // runtime via the error field.
  async function fetchTallies(
    fk: FKMetadataRow,
    removedIds: string[]
  ): Promise<Map<string, number>> {
    const tallies = new Map<string, number>();
    const PAGE = 1000; // conservative page size matching PostgREST default max_rows
    const IN_CHUNK = 1000; // max IDs per IN clause to stay within URL length limits

    type RowResult = { data: Record<string, unknown>[] | null; error: { message: string } | null };

    for (const idChunk of chunk(removedIds, IN_CHUNK)) {
      let offset = 0;
      while (true) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const builder: any = supabase.from(fk.referring_table).select(fk.referring_column);

        // Apply .in() filter then .range() for pagination.
        // Using `any` here because PostgREST builder generics don't expose
        // .in() / .range() in a way that's compatible with the narrow mock type.
        const { data, error }: RowResult = await builder
          .in(fk.referring_column, idChunk)
          .range(offset, offset + PAGE - 1);

        if (error) {
          throw new Error(
            `Failed to fetch inbound refs for ${fk.referring_table}.${fk.referring_column}: ${error.message}`
          );
        }

        const rows = data ?? [];
        for (const row of rows) {
          const id = row[fk.referring_column] as string;
          tallies.set(id, (tallies.get(id) ?? 0) + 1);
        }

        // Fewer rows than a full page means we've consumed all results.
        if (rows.length < PAGE) break;
        offset += PAGE;
      }
    }

    return tallies;
  }

  for (const [scfTable, td] of Object.entries(diff.tables)) {
    if (td.removed.length === 0) continue;
    const fks = fksByReferencedTable.get(scfTable) ?? [];
    const removedIds = td.removed;

    // Batch: one query per FK (across ALL removed IDs), not one per removed ID.
    // For large removed sets (>1000), idChunks are processed inside fetchTallies.
    const countsByFK = new Map<string, Map<string, number>>();
    for (const fk of fks) {
      const tallies = await fetchTallies(fk, removedIds);
      countsByFK.set(`${fk.referring_table}.${fk.referring_column}`, tallies);
    }

    for (const id of removedIds) {
      const inboundReferences: InboundReference[] = [];

      for (const fk of fks) {
        const key = `${fk.referring_table}.${fk.referring_column}`;
        const rowCount = countsByFK.get(key)?.get(id) ?? 0;
        if (rowCount > 0) {
          inboundReferences.push({
            referringTable: fk.referring_table,
            referringColumn: fk.referring_column,
            deleteRule: fk.delete_rule,
            rowCount,
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
  const tmpPath = outPath + ".tmp";
  writeFileSync(
    tmpPath,
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
  renameSync(tmpPath, outPath);

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
