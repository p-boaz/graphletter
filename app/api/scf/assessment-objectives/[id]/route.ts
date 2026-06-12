import { type NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/scf/assessment-objectives");

// Helper function to validate UUID format
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Assessment objective ID is required" }, { status: 400 });
    }

    // Query the database for the specific assessment objective
    // Try to match by scf_ao_id first (most likely scenario)
    let { data: assessmentObjective, error } = await supabase
      .from("scf_assessment_objectives")
      .select(
        `
        id,
        scf_control_id,
        scf_ao_id,
        assessment_objective,
        assessment_procedure,
        expected_results,
        origin,
        notes_errata,
        scf_baseline_aos,
        dhs_ztcf_aos,
        nist_800_53_r5_aos,
        nist_800_171_r2_aos,
        nist_800_171_r3_aos,
        nist_800_172_aos,
        asset_type,
        assessment_status,
        inherited,
        assessment_frequency,
        last_date_assessed,
        assessment_performed_by,
        scf_version,
        created_at,
        updated_at
      `
      )
      .eq("scf_ao_id", id)
      .single();

    // If not found by scf_ao_id, try by UUID id field (for backwards compatibility)
    // But only if the ID looks like a UUID
    if (error && error.code === "PGRST116" && isValidUUID(id)) {
      ({ data: assessmentObjective, error } = await supabase
        .from("scf_assessment_objectives")
        .select(
          `
          id,
          scf_control_id,
          scf_ao_id,
          assessment_objective,
          assessment_procedure,
          expected_results,
          origin,
          notes_errata,
          scf_baseline_aos,
          dhs_ztcf_aos,
          nist_800_53_r5_aos,
          nist_800_171_r2_aos,
          nist_800_171_r3_aos,
          nist_800_172_aos,
          asset_type,
          assessment_status,
          inherited,
          assessment_frequency,
          last_date_assessed,
          assessment_performed_by,
          scf_version,
          created_at,
          updated_at
        `
        )
        .eq("id", id)
        .single());
    }

    if (error) {
      if (error.code === "PGRST116") {
        // No rows found
        return NextResponse.json({ error: "Assessment objective not found" }, { status: 404 });
      }

      log.error("assessment_objectives.fetch_failed", {
        detail: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: "Failed to fetch assessment objective" }, { status: 500 });
    }

    if (!assessmentObjective) {
      return NextResponse.json({ error: "Assessment objective not found" }, { status: 404 });
    }

    return NextResponse.json(assessmentObjective);
  } catch (error) {
    log.error("assessment_objectives.unhandled_error", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
