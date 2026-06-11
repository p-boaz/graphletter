import { type NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/error-response";
import { computeControlGaps } from "@/lib/graph/gap-analysis";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

interface CoverageRequestBody {
  frameworkId?: string;
  frameworkName?: string;
  includeControls?: boolean;
}

interface ControlMappingRow {
  control_id: string;
}

interface ControlRow {
  id: string;
}

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

async function resolveControlIds(
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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as CoverageRequestBody;
    const controlIds = await resolveControlIds(supabase, body.frameworkId, body.frameworkName);

    if (controlIds.length === 0) {
      return NextResponse.json({
        success: true,
        coverage: {
          total_controls: 0,
          covered_controls: 0,
          partial_controls: 0,
          missing_controls: 0,
          coverage_percentage: 0,
        },
        controls: [],
      });
    }

    const { data: mappings, error: mappingsError } = await supabase
      .from("evidence_control_map")
      .select(
        "scf_control_id, coverage_strength, atom_id, mapping_polarity, evidence_atoms!inner(user_id)"
      )
      .eq("evidence_atoms.user_id", user.id)
      .in("scf_control_id", controlIds);

    if (mappingsError) {
      return NextResponse.json({ error: mappingsError.message }, { status: 500 });
    }

    const computedGaps = computeControlGaps(
      controlIds,
      (mappings || []) as Array<{
        scf_control_id: string;
        coverage_strength?: string | null;
        atom_id?: string | null;
        mapping_polarity?: string | null;
      }>
    );

    const controls = computedGaps.map((gap) => {
      return {
        scf_control_id: gap.scfControlId,
        strongest_coverage_rank: gap.strongestSupportRank,
        status: gap.status,
        gap_type: gap.gapType,
      };
    });

    const coveredControls = controls.filter((c) => c.status === "compliant").length;
    const partialControls = controls.filter((c) => c.status === "partial").length;
    const missingControls = controls.filter((c) => c.status === "missing").length;
    const conflictingControls = controls.filter((c) => c.status === "conflicting").length;

    return NextResponse.json({
      success: true,
      coverage: {
        total_controls: controlIds.length,
        covered_controls: coveredControls,
        partial_controls: partialControls,
        missing_controls: missingControls,
        conflicting_controls: conflictingControls,
        coverage_percentage:
          controlIds.length > 0
            ? Math.round(((coveredControls + partialControls) / controlIds.length) * 100)
            : 0,
      },
      controls: body.includeControls === false ? undefined : controls,
    });
  } catch (error) {
    return apiError("controls.build_coverage_failed", "Failed to build coverage", 500, error);
  }
}
