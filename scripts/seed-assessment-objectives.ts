#!/usr/bin/env node
/**
 * Seeds scf_assessment_objectives from data/Assessment_objectives.csv.
 * The CSV column header for the AO text is verbose ("SCF Assessment Objective (AO)\n..."); we
 * use the first column whose header starts with that prefix to be header-rev tolerant.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { parse } from "csv-parse/sync";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SCF_VERSION = "2026.1.1";

export interface AOSeedSummary {
  inserted: number;
}

function findColumn(headers: string[], predicate: (h: string) => boolean, label: string): string {
  const hit = headers.find(predicate);
  if (!hit) throw new Error(`seed-ao: column not found: ${label} (have: ${headers.join(", ")})`);
  return hit;
}

export async function seedAssessmentObjectives(
  supabase: SupabaseClient,
  csvPath: string
): Promise<AOSeedSummary> {
  const csv = await readFile(csvPath, "utf8").catch((e: NodeJS.ErrnoException) => {
    throw new Error(`seed-ao: cannot read ${csvPath}: ${e.message}`);
  });
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
  }) as Array<Record<string, string>>;

  if (records.length === 0) return { inserted: 0 };
  const headers = Object.keys(records[0]);

  const colControl = findColumn(headers, (h) => h.trim() === "SCF #", "SCF #");
  const colAoId = findColumn(headers, (h) => h.trim() === "SCF AO #", "SCF AO #");
  const colObjective = findColumn(
    headers,
    (h) => h.replace(/\s+/g, " ").startsWith("SCF Assessment Objective (AO)"),
    "SCF Assessment Objective (AO)"
  );
  const colOrigin = findColumn(headers, (h) => h.includes("Origin"), "SCF AO Origin(s)");
  const colNotes = headers.find((h) => h.includes("Notes")) ?? "";

  const rows = records
    .filter((r) => r[colAoId]?.trim() && r[colControl]?.trim())
    .map((r) => ({
      scf_control_id: r[colControl].trim(),
      scf_ao_id: r[colAoId].trim(),
      assessment_objective: r[colObjective]?.trim() ?? "",
      origin: r[colOrigin]?.trim() || null,
      notes_errata: colNotes ? r[colNotes]?.trim() || null : null,
      scf_version: SCF_VERSION,
    }));

  const { error: delError } = await supabase
    .from("scf_assessment_objectives")
    .delete()
    .eq("scf_version", SCF_VERSION);
  if (delError) throw new Error(`seed-ao: delete failed: ${delError.message}`);

  const { error: upError } = await supabase
    .from("scf_assessment_objectives")
    .upsert(rows, { onConflict: "scf_ao_id" });
  if (upError) throw new Error(`seed-ao: upsert failed: ${upError.message}`);

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
  const csvPath = resolve(repoRoot, "data", "Assessment_objectives.csv");
  const summary = await seedAssessmentObjectives(supabase, csvPath);
  console.log(`seed-ao: inserted ${summary.inserted} rows`);
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
