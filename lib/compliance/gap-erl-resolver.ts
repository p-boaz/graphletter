import type { SupabaseClient } from "@supabase/supabase-js";
import { selectAllRows, chunkArray, IN_CHUNK_SIZE } from "@/lib/database/paged-select";

export interface GapControl {
  scfControlId: string;
  status: "missing" | "partial" | "conflicting";
  gapType?: string;
}

export interface ErlRemediation {
  erlId: string;
  artifact: string;
  artifactDescription: string;
  areaOfFocus: string;
  controlsCovered: string[];
  controlsOverlap: number;
  priority: number;
}

interface ErlRow {
  id: string;
  erl_id: string;
  documentation_artifact: string;
  artifact_description: string | null;
  area_of_focus: string | null;
}

interface MappingRow {
  scf_control_id: string;
  evidence_request_id: string;
}

/**
 * Given a list of gap controls (missing/partial/conflicting), resolve which
 * ERL artifacts would best close those gaps. Results are ranked by the number
 * of gap controls each artifact covers (descending).
 */
export async function resolveGapToErl(
  supabase: SupabaseClient,
  gapControls: GapControl[]
): Promise<ErlRemediation[]> {
  if (gapControls.length === 0) return [];

  const gapControlIds = gapControls.map((g) => g.scfControlId);

  // Chunk gapControlIds to stay under PostgREST's .in() list limits and
  // paginate each chunk past the 1000-row cap (scf_control_evidence_mappings
  // exceeds 1000 rows — same table the seeder pagination fix addressed).
  const chunks = chunkArray(gapControlIds, IN_CHUNK_SIZE);
  const allMappings: MappingRow[] = [];

  for (const chunk of chunks) {
    const chunkRows = await selectAllRows<MappingRow>(() =>
      supabase
        .from("scf_control_evidence_mappings")
        .select("scf_control_id, evidence_request_id")
        .in("scf_control_id", chunk)
        .or("is_active.is.null,is_active.eq.true")
        .order("scf_control_id")
    );
    allMappings.push(...chunkRows);
  }

  // selectAllRows throws on DB error; if we reach here, all chunks succeeded.
  const mappings = allMappings;

  if (mappings.length === 0) return [];

  // Group by evidence_request_id to count overlap
  const erlOverlap = new Map<string, Set<string>>();
  for (const m of mappings) {
    const existing = erlOverlap.get(m.evidence_request_id);
    if (existing) {
      existing.add(m.scf_control_id);
    } else {
      erlOverlap.set(m.evidence_request_id, new Set([m.scf_control_id]));
    }
  }

  // Fetch ERL details
  const erlIds = [...erlOverlap.keys()];
  const { data: erlRows, error: erlError } = await supabase
    .from("scf_evidence_request_list")
    .select("id, erl_id, documentation_artifact, artifact_description, area_of_focus")
    .in("id", erlIds);

  if (erlError) {
    throw new Error(`Failed to fetch ERL details: ${erlError.message}`);
  }

  if (!erlRows || erlRows.length === 0) return [];

  // Deduplicate by erl_id (same artifact may have multiple DB rows)
  const seen = new Map<string, ErlRemediation>();
  for (const row of erlRows as ErlRow[]) {
    const controlSet = erlOverlap.get(row.id);
    if (!controlSet) continue;

    const existing = seen.get(row.erl_id);
    if (existing) {
      // Merge control sets
      for (const c of controlSet) {
        if (!existing.controlsCovered.includes(c)) {
          existing.controlsCovered.push(c);
          existing.controlsOverlap += 1;
        }
      }
    } else {
      seen.set(row.erl_id, {
        erlId: row.erl_id,
        artifact: row.documentation_artifact,
        artifactDescription: row.artifact_description || "",
        areaOfFocus: row.area_of_focus || "",
        controlsCovered: [...controlSet],
        controlsOverlap: controlSet.size,
        priority: 0, // will be set after sorting
      });
    }
  }

  // Rank by overlap descending, then alphabetical
  const results = [...seen.values()]
    .sort((a, b) => {
      if (b.controlsOverlap !== a.controlsOverlap) {
        return b.controlsOverlap - a.controlsOverlap;
      }
      return a.artifact.localeCompare(b.artifact);
    })
    .map((item, index) => ({
      ...item,
      priority: index + 1,
    }));

  return results;
}
