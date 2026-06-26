import { type NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/error-response";
import { parseJsonBody } from "@/lib/api/json-body";
import { computeControlGaps } from "@/lib/graph/gap-analysis";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/utils/auth";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

interface GapAnalysisRequestBody {
  frameworkId?: string;
  frameworkName?: string;
  analysisVersion?: string;
}

interface ControlMappingRow {
  control_id: string;
}

interface ControlRow {
  id: string;
}

async function resolveFrameworkId(
  supabase: SupabaseClient,
  frameworkId?: string,
  frameworkName?: string
): Promise<string | null> {
  if (frameworkId) {
    return frameworkId;
  }

  if (!frameworkName) {
    return null;
  }

  const { data, error } = await supabase
    .from("scf_frameworks")
    .select("id")
    .eq("framework_name", frameworkName)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data?.id as string | undefined) ?? null;
}

async function resolveControlIds(
  supabase: SupabaseClient,
  frameworkId?: string,
  frameworkName?: string
): Promise<string[]> {
  if (frameworkId) {
    const { data, error } = await supabase
      .from("scf_control_mappings")
      .select("control_id")
      .eq("framework_id", frameworkId);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data || []) as ControlMappingRow[];
    return [...new Set(rows.map((row) => row.control_id))];
  }

  if (frameworkName) {
    const { data, error } = await supabase
      .from("scf_control_mappings")
      .select("control_id, scf_frameworks!inner(framework_name)")
      .eq("scf_frameworks.framework_name", frameworkName);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data || []) as ControlMappingRow[];
    return [...new Set(rows.map((row) => row.control_id))];
  }

  const { data, error } = await supabase.from("scf_controls").select("id");

  if (error) {
    throw new Error(error.message);
  }

  return ((data || []) as ControlRow[]).map((row) => row.id);
}

export async function POST(request: NextRequest) {
  try {
    const parsedBody = await parseJsonBody<GapAnalysisRequestBody>(request, {});
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.body;

    const supabase = await createClient();
    const user = await getCurrentUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const analysisVersion = body.analysisVersion || "graph-gap-v1";

    const frameworkId = await resolveFrameworkId(supabase, body.frameworkId, body.frameworkName);
    const controlIds = await resolveControlIds(supabase, body.frameworkId, body.frameworkName);

    if (controlIds.length === 0) {
      return NextResponse.json({
        success: true,
        analysis_version: analysisVersion,
        inserted_rows: 0,
        summary: {
          total_controls: 0,
          compliant: 0,
          partial: 0,
          missing: 0,
          conflicting: 0,
        },
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
    const inserts = computedGaps.map((gap) => ({
      user_id: user.id,
      framework_id: frameworkId,
      scf_control_id: gap.scfControlId,
      status: gap.status,
      gap_type: gap.gapType,
      summary: gap.summary,
      analysis_version: analysisVersion,
      supporting_atom_ids: gap.supportingAtomIds,
    }));

    // Replace prior analysis rows for this (user, framework) scope so
    // downstream readers see a single current snapshot per control
    // instead of stacking historical rows (compliant rows would be
    // shadowed by older missing rows since readers filter on status
    // before deduping by created_at).
    const deleteQuery = supabase.from("control_gap_analysis").delete().eq("user_id", user.id);
    const scopedDelete = frameworkId
      ? deleteQuery.eq("framework_id", frameworkId)
      : deleteQuery.is("framework_id", null);
    const { error: deleteError } = await scopedDelete;

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    const { error: insertError } = await supabase.from("control_gap_analysis").insert(inserts);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const compliant = inserts.filter((row) => row.status === "compliant").length;
    const partial = inserts.filter((row) => row.status === "partial").length;
    const missing = inserts.filter((row) => row.status === "missing").length;
    const conflicting = inserts.filter((row) => row.status === "conflicting").length;

    return NextResponse.json({
      success: true,
      analysis_version: analysisVersion,
      inserted_rows: inserts.length,
      summary: {
        total_controls: inserts.length,
        compliant,
        partial,
        missing,
        conflicting,
      },
    });
  } catch (error) {
    return apiError("analysis.run_gap_analysis_failed", "Failed to run gap analysis", 500, error);
  }
}
