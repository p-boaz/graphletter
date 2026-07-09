import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

interface ControlMappingRow {
  control_id: string;
}

interface ControlRow {
  id: string;
}

// All fetches paginate: unpaginated selects silently truncate at PostgREST's
// 1000-row default, which capped the materialized gap snapshot (and therefore
// the Compliance Posture totals) at 1000 of 1,468 controls — QA 2026-07-09
// ISSUE-006.
const PAGE_SIZE = 1000;

async function fetchMappedControlIdsByFrameworkId(
  supabase: SupabaseClient,
  frameworkId: string
): Promise<string[]> {
  const mappedControlIds = new Set<string>();
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("scf_control_mappings")
      .select("control_id")
      .eq("framework_id", frameworkId)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data || []) as ControlMappingRow[];
    for (const row of rows) {
      if (row.control_id) {
        mappedControlIds.add(row.control_id);
      }
    }

    if (rows.length < PAGE_SIZE) {
      break;
    }
    offset += PAGE_SIZE;
  }

  return [...mappedControlIds];
}

async function fetchMappedControlIdsByFrameworkName(
  supabase: SupabaseClient,
  frameworkName: string
): Promise<string[]> {
  const mappedControlIds = new Set<string>();
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("scf_control_mappings")
      .select("control_id, scf_frameworks!inner(framework_name)")
      .eq("scf_frameworks.framework_name", frameworkName)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data || []) as ControlMappingRow[];
    for (const row of rows) {
      if (row.control_id) {
        mappedControlIds.add(row.control_id);
      }
    }

    if (rows.length < PAGE_SIZE) {
      break;
    }
    offset += PAGE_SIZE;
  }

  return [...mappedControlIds];
}

async function fetchAllControlIds(supabase: SupabaseClient): Promise<string[]> {
  const controlIds: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("scf_controls")
      .select("id")
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data || []) as ControlRow[];
    controlIds.push(...rows.map((row) => row.id));

    if (rows.length < PAGE_SIZE) {
      break;
    }
    offset += PAGE_SIZE;
  }

  return controlIds;
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
