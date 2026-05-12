#!/usr/bin/env node
/**
 * Reads data/seed/expected_row_counts.json and asserts each SCF table's row
 * count is within ±1 % of the snapshot.
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const TOLERANCE = 0.01;

export interface VerifyMismatch {
  table: string;
  expected: number;
  actual: number;
  deltaPct: number;
}

export interface VerifyResult {
  ok: boolean;
  mismatches: VerifyMismatch[];
  checked: number;
}

export async function verifyRowCounts(
  supabase: SupabaseClient,
  snapshotPath: string
): Promise<VerifyResult> {
  if (!existsSync(snapshotPath)) {
    throw new Error(
      `expected snapshot not found at ${snapshotPath} — run \`pnpm seed:snapshot\` against a freshly-seeded sandbox first.`
    );
  }

  const snap = JSON.parse(await readFile(snapshotPath, "utf8")) as {
    tables: Record<string, number>;
  };

  const mismatches: VerifyMismatch[] = [];
  let checked = 0;

  for (const [table, expected] of Object.entries(snap.tables)) {
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error) throw new Error(`verify: count(${table}) failed: ${error.message}`);
    const actual = count ?? 0;
    const deltaPct =
      expected === 0 ? (actual === 0 ? 0 : 1) : Math.abs(actual - expected) / expected;
    if (deltaPct > TOLERANCE) {
      mismatches.push({ table, expected, actual, deltaPct });
    }
    checked++;
  }

  return { ok: mismatches.length === 0, mismatches, checked };
}

async function runCli(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const snapshotPath = resolve(repoRoot, "data", "seed", "expected_row_counts.json");

  const result = await verifyRowCounts(supabase, snapshotPath);
  if (result.ok) {
    console.log(`✓ verified ${result.checked} tables within ±${TOLERANCE * 100}%`);
    process.exit(0);
  }
  console.error(`✗ ${result.mismatches.length} table(s) out of tolerance:`);
  for (const m of result.mismatches) {
    console.error(
      `  ${m.table}: expected=${m.expected} actual=${m.actual} delta=${(m.deltaPct * 100).toFixed(2)}%`
    );
  }
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
