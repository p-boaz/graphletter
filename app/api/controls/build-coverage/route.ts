import { type NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/error-response";
import { parseJsonBody } from "@/lib/api/json-body";
import { fetchReviewedVerdicts } from "@/lib/graph/assessment-verdicts";
import { resolveControlIds } from "@/lib/graph/control-id-resolver";
import { applyAssessmentVerdicts, computeControlGaps } from "@/lib/graph/gap-analysis";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

interface CoverageRequestBody {
  frameworkId?: string;
  frameworkName?: string;
  includeControls?: boolean;
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
