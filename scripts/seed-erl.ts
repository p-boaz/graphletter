#!/usr/bin/env node
/**
 * Seeds scf_evidence_request_list from data/evidence-request-list.csv.
 * Exported function is callable from scripts/seed-all.ts; the CLI entry point
 * reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the environment.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { parse } from "csv-parse/sync";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SCF_VERSION = "2026.2";

export interface ERLSeedSummary {
  inserted: number;
}

function splitControlMappings(raw: string): string[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function seedERL(supabase: SupabaseClient, csvPath: string): Promise<ERLSeedSummary> {
  const csv = await readFile(csvPath, "utf8").catch((e: NodeJS.ErrnoException) => {
    throw new Error(`seed-erl: cannot read ${csvPath}: ${e.message}`);
  });
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
  }) as Array<Record<string, string>>;

  const rows = records.map((r) => ({
    erl_id: r["ERL #"]?.trim(),
    area_of_focus: r["Area of Focus"]?.trim() || "general",
    documentation_artifact: r["Documentation Artifact"]?.trim() ?? "",
    artifact_description: r["Artifact Description"]?.trim() ?? "",
    scf_control_mappings: splitControlMappings(r["SCF Control Mappings"] ?? ""),
    scf_version: SCF_VERSION,
  }));

  // Clear prior seed-version rows (only those with no import_id, i.e. seed-owned).
  // We can't simply truncate because the app-uploaded rows have import_id set
  // and we leave them alone.
  const { error: delError } = await supabase
    .from("scf_evidence_request_list")
    .delete()
    .eq("scf_version", SCF_VERSION)
    .is("import_id", null);
  if (delError) throw new Error(`seed-erl: delete failed: ${delError.message}`);

  const { error: upError } = await supabase
    .from("scf_evidence_request_list")
    .upsert(rows, { onConflict: "erl_id,import_id" });
  if (upError) throw new Error(`seed-erl: upsert failed: ${upError.message}`);

  return { inserted: rows.length };
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
  const csvPath = resolve(repoRoot, "data", "evidence-request-list.csv");
  const summary = await seedERL(supabase, csvPath);
  console.log(`seed-erl: inserted ${summary.inserted} rows`);
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
