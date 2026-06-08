#!/usr/bin/env node
/**
 * Derives scf_control_evidence_mappings from already-seeded scf_evidence_request_list
 * and scf_controls. Run AFTER seed-erl AND the controls seed.
 */
import { pathToFileURL } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface CEMSeedSummary {
  inserted: number;
}

const PAGE_SIZE = 1000;

async function selectAll<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`seed-cem: read ${table} failed: ${error.message}`);

    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export async function seedControlEvidenceMappings(
  supabase: SupabaseClient
): Promise<CEMSeedSummary> {
  const erlRows = await selectAll<{ id: string; scf_control_mappings: string[] | null }>(
    supabase,
    "scf_evidence_request_list",
    "id, scf_control_mappings"
  );
  const controls = await selectAll<{ id: string }>(supabase, "scf_controls", "id");

  const validControlIds = new Set(controls.map((control) => control.id));

  const rows: Array<{ scf_control_id: string; evidence_request_id: string; is_active: boolean }> =
    [];
  for (const erl of erlRows) {
    const mappings = erl.scf_control_mappings ?? [];
    for (const controlId of mappings) {
      if (validControlIds.has(controlId)) {
        rows.push({
          scf_control_id: controlId,
          evidence_request_id: erl.id,
          is_active: true,
        });
      }
    }
  }

  const { error: delError } = await supabase
    .from("scf_control_evidence_mappings")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all
  if (delError) throw new Error(`seed-cem: delete failed: ${delError.message}`);

  if (rows.length === 0) return { inserted: 0 };

  const { error: insError } = await supabase.from("scf_control_evidence_mappings").insert(rows);
  if (insError) throw new Error(`seed-cem: insert failed: ${insError.message}`);

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
  const summary = await seedControlEvidenceMappings(supabase);
  console.log(`seed-cem: inserted ${summary.inserted} rows`);
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
