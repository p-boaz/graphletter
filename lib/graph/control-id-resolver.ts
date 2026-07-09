import { selectAllRows } from "@/lib/database/paged-select";
import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

interface ControlMappingRow {
  control_id: string;
}

interface ControlRow {
  id: string;
}

// All fetches drain past PostgREST's 1000-row default via selectAllRows —
// unpaginated selects silently truncated the materialized gap snapshot (and
// therefore the Compliance Posture totals) at 1000 of 1,468 controls —
// QA 2026-07-09 ISSUE-006.

async function fetchMappedControlIdsByFrameworkId(
  supabase: SupabaseClient,
  frameworkId: string
): Promise<string[]> {
  const rows = await selectAllRows<ControlMappingRow>(() =>
    supabase
      .from("scf_control_mappings")
      .select("control_id")
      .eq("framework_id", frameworkId)
      .order("control_id")
  );
  return [...new Set(rows.map((row) => row.control_id).filter(Boolean))];
}

async function fetchMappedControlIdsByFrameworkName(
  supabase: SupabaseClient,
  frameworkName: string
): Promise<string[]> {
  const rows = await selectAllRows<ControlMappingRow>(() =>
    supabase
      .from("scf_control_mappings")
      .select("control_id, scf_frameworks!inner(framework_name)")
      .eq("scf_frameworks.framework_name", frameworkName)
      .order("control_id")
  );
  return [...new Set(rows.map((row) => row.control_id).filter(Boolean))];
}

async function fetchAllControlIds(supabase: SupabaseClient): Promise<string[]> {
  const rows = await selectAllRows<ControlRow>(() =>
    supabase.from("scf_controls").select("id").order("id")
  );
  return rows.map((row) => row.id);
}

export async function resolveControlIds(
  supabase: SupabaseClient,
  frameworkId?: string,
  frameworkName?: string
): Promise<string[]> {
  if (frameworkId) {
    return fetchMappedControlIdsByFrameworkId(supabase, frameworkId);
  }

  if (frameworkName) {
    return fetchMappedControlIdsByFrameworkName(supabase, frameworkName);
  }

  return fetchAllControlIds(supabase);
}
