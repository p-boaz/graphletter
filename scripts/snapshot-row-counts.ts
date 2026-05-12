#!/usr/bin/env node
/**
 * One-shot: queries the 13 SCF tables in the connected Supabase project and
 * writes their row counts to data/seed/expected_row_counts.json. Run ONCE
 * after `pnpm seed` against a freshly-seeded sandbox; commit the result.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const TABLES = [
  "scf_principles",
  "scf_domains",
  "scf_authoritative_sources",
  "scf_frameworks",
  "scf_controls",
  "scf_control_mappings",
  "scf_risks",
  "scf_threats",
  "scf_maturity_levels",
  "scf_evidence_request_list",
  "scf_assessment_objectives",
  "scf_control_evidence_mappings",
  "scf_control_integrations",
];

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (url.includes("gbnxwsntyzyrpwmjaaqa")) {
    throw new Error("snapshot-row-counts: refusing to snapshot production. Point at the sandbox.");
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const tables: Record<string, number> = {};
  for (const t of TABLES) {
    const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
    if (error) throw new Error(`snapshot: count(${t}) failed: ${error.message}`);
    tables[t] = count ?? 0;
    console.log(`  ${t}: ${tables[t]}`);
  }

  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const outDir = resolve(repoRoot, "data", "seed");
  await mkdir(outDir, { recursive: true });
  const outPath = resolve(outDir, "expected_row_counts.json");
  // Intentionally OMIT the source project URL — the snapshot must not leak
  // sandbox/prod refs into git. The capture date + SCF version are sufficient.
  const snapshot = {
    capturedAt: new Date().toISOString(),
    scfVersion: "2026.1.1",
    tables,
  };
  await writeFile(outPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  console.log(`\n✓ snapshot written to ${outPath}`);
}

main().catch((err) => {
  console.error("snapshot:", err instanceof Error ? err.message : err);
  process.exit(1);
});
