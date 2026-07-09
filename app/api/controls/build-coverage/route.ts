import { type NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/error-response";
import { parseJsonBody } from "@/lib/api/json-body";
import { calculateOverallResult } from "@/lib/assessment-transformer";
import {
  type AssessmentVerdict,
  applyAssessmentVerdicts,
  computeControlGaps,
} from "@/lib/graph/gap-analysis";
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

interface AssessmentVerdictRow {
  scf_control_id: string;
  assessment_result: string | null;
  evidence_id: string | null;
}

interface EvidenceStatusRow {
  id: string;
}

const VERDICTS: ReadonlySet<string> = new Set(["pass", "partial", "fail"]);

async function fetchApprovedEvidenceIds(
  supabase: SupabaseClient,
  userId: string
): Promise<Set<string>> {
  const approvedIds = new Set<string>();
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("evidence")
      .select("id")
      .eq("user_id", userId)
      .eq("evidence_status", "approved")
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data || []) as EvidenceStatusRow[];
    for (const row of rows) {
      approvedIds.add(row.id);
    }

    if (rows.length < PAGE_SIZE) {
      break;
    }
    offset += PAGE_SIZE;
  }

  return approvedIds;
}

// Latest reviewed verdict per control. Assessment rows are per-objective, so
// the control verdict aggregates the newest reviewed run's rows with the same
// rule the review UI uses (calculateOverallResult). Only assessments whose
// evidence has been approved count — review is the gate that moves coverage.
// Paginated like the other fetches so the PostgREST 1000-row default cap
// cannot silently truncate.
async function fetchReviewedVerdicts(
  supabase: SupabaseClient,
  userId: string
): Promise<Map<string, AssessmentVerdict>> {
  const approvedEvidenceIds = await fetchApprovedEvidenceIds(supabase, userId);
  if (approvedEvidenceIds.size === 0) {
    return new Map();
  }

  // Newest-first objective rows, keyed to the latest approved run per control.
  const latestRunEvidence = new Map<string, string>();
  const resultsByControl = new Map<string, string[]>();
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("assessments")
      .select("scf_control_id, assessment_result, evidence_id")
      .eq("user_id", userId)
      .eq("assessment_status", "completed")
      .order("completed_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data || []) as AssessmentVerdictRow[];
    for (const row of rows) {
      if (!row.evidence_id || !approvedEvidenceIds.has(row.evidence_id)) continue;
      if (!row.assessment_result || !VERDICTS.has(row.assessment_result)) continue;

      const runEvidence = latestRunEvidence.get(row.scf_control_id);
      if (runEvidence === undefined) {
        latestRunEvidence.set(row.scf_control_id, row.evidence_id);
        resultsByControl.set(row.scf_control_id, [row.assessment_result]);
      } else if (runEvidence === row.evidence_id) {
        resultsByControl.get(row.scf_control_id)?.push(row.assessment_result);
      }
    }

    if (rows.length < PAGE_SIZE) {
      break;
    }
    offset += PAGE_SIZE;
  }

  const verdictByControl = new Map<string, AssessmentVerdict>();
  for (const [controlId, results] of resultsByControl) {
    const overall = calculateOverallResult(results);
    if (overall === "pass" || overall === "partial" || overall === "fail") {
      verdictByControl.set(controlId, overall);
    }
  }

  return verdictByControl;
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
    const parsedBody = await parseJsonBody<CoverageRequestBody>(request, {});
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.body;

    const supabase = await createClient();
    const user = await getCurrentUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const graphGaps = computeControlGaps(
      controlIds,
      (mappings || []) as Array<{
        scf_control_id: string;
        coverage_strength?: string | null;
        atom_id?: string | null;
        mapping_polarity?: string | null;
      }>
    );

    const verdictByControl = await fetchReviewedVerdicts(supabase, user.id);
    const computedGaps = applyAssessmentVerdicts(graphGaps, verdictByControl);

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
