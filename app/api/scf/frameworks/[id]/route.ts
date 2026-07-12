import { NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/scf/frameworks");

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: frameworkId } = await params;

    // Get framework details. Only publicly-exposable tiers are served:
    // exposure_status gates licensing, visibility gates curation — a
    // framework outside both is a 404, not a hint that it exists.
    const { data: framework, error: frameworkError } = await supabase
      .from("scf_frameworks")
      .select("*")
      .eq("id", frameworkId)
      .eq("exposure_status", "public")
      .in("visibility", ["supported", "preview"])
      .maybeSingle();

    if (frameworkError) {
      throw frameworkError;
    }
    if (!framework) {
      return NextResponse.json({ error: "Framework not found" }, { status: 404 });
    }

    // Get all control mappings for this framework with control details
    const { data: mappings, error: mappingsError } = await supabase
      .from("scf_control_mappings")
      .select(
        `
        id,
        control_id,
        framework_control_id,
        mapping_type,
        confidence_score,
        scf_controls (
          id,
          title,
          description,
          domain_id,
          scf_version
        )
      `
      )
      .eq("framework_id", frameworkId)
      .order("control_id");

    if (mappingsError) {
      throw mappingsError;
    }

    return NextResponse.json({
      framework,
      mappings: mappings || [],
    });
  } catch (error) {
    log.error("frameworks.fetch_details_failed", {
      detail: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to fetch framework details" }, { status: 500 });
  }
}
